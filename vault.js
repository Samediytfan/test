import { clientId, discordBudgets } from './request-limits.js';
import { Router } from 'express';
import { randomBytes, createCipheriv, createDecipheriv, scryptSync, createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const aad = Buffer.from('relay-vault-v1');
function encrypt(bots, password) {
  const salt = randomBytes(16), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', scryptSync(password, salt, 32), iv);
  cipher.setAAD(aad);
  const data = Buffer.concat([cipher.update(JSON.stringify(bots), 'utf8'), cipher.final()]);
  return { version: 1, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}
function decrypt(envelope, password) {
  if (envelope?.version !== 1) throw new Error('Invalid backup');
  for (const [key, size] of [['salt', 16], ['iv', 12], ['tag', 16]]) {
    if (typeof envelope[key] !== 'string' || Buffer.from(envelope[key], 'base64').length !== size) throw new Error('Invalid backup');
  }
  if (typeof envelope.data !== 'string' || envelope.data.length > 500000) throw new Error('Invalid backup');
  const cipher = createDecipheriv('aes-256-gcm', scryptSync(password, Buffer.from(envelope.salt, 'base64'), 32), Buffer.from(envelope.iv, 'base64'));
  cipher.setAAD(aad);
  cipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const bots = JSON.parse(Buffer.concat([cipher.update(Buffer.from(envelope.data, 'base64')), cipher.final()]).toString('utf8'));
  if (!Array.isArray(bots) || bots.length > 100 || new Set(bots.map(b => b.id)).size !== bots.length || bots.some(b => !/^\d{1,32}$/.test(b.id) || typeof b.name !== 'string' || b.name.length > 100 || typeof b.token !== 'string' || b.token.length > 256 || !b.token.trim())) throw new Error('Invalid backup');
  return bots;
}

export function createVaultRouter({ password = process.env.VAULT_PASSWORD, filePath = process.env.VAULT_FILE || resolve('secret/bots.enc.json'), fetchImpl = fetch, connectCode = process.env.VAULT_CONNECT_CODE, connectLimit = discordBudgets.connect, now = Date.now, authClientCapacity = 1024 } = {}) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const enabled = typeof password === 'string' && password.length >= 16;
  const hash = value => createHash('sha256').update(value).digest();
  const attempts = new Map();
  let queue = Promise.resolve();
  const read = async () => {
    try { return decrypt(JSON.parse(await readFile(filePath, 'utf8')), password); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  };
  const save = async bots => {
    await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
    const temp = `${filePath}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      await writeFile(temp, JSON.stringify(encrypt(bots, password)), { mode: 0o600, flag: 'wx' });
      await rename(temp, filePath);
    } finally { await unlink(temp).catch(() => {}); }
  };
  const route = fn => (req, res) => {
    queue = queue.catch(() => {}).then(async () => {
      try { await fn(req, res); }
      catch { res.status(500).json({ message: 'Could not read or update the encrypted vault. Check storage access and keep the same vault password.' }); }
    });
  };
  // The public connect operation only writes after a visitor has acknowledged the
  // owner-access notice. It never returns a token or permits reading the vault.
  router.post('/connect', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!enabled) return res.status(503).json({ message: 'The site vault is unavailable. Ask the site owner to configure it before connecting.' });
    if (req.body?.acknowledgeOwnerAccess !== true) return res.status(400).json({ message: 'Please acknowledge that the site owner can access your bot token.' });
    const token = typeof req.body?.token === 'string' ? req.body.token.trim().replace(/^Bot\s+/i, '') : '';
    if (!token || token.length > 256) return res.status(400).json({ message: 'Enter a valid bot token.' });
    return connectLimit(req, res, async () => {
    let user, guilds;
    try {
      const headers = { Authorization: `Bot ${token}` };
      const response = await fetchImpl('https://discord.com/api/v10/users/@me', { headers, signal: AbortSignal.timeout(15000) });
      if (response.status === 401) discordBudgets.invalidate(token);
      if (!response.ok) return res.status(401).json({ message: 'Discord could not verify this bot token.' });
      user = await response.json();
      if (!user.bot || !/^\d{1,32}$/.test(user.id) || typeof user.username !== 'string') return res.status(400).json({ message: 'Only bot accounts can be connected.' });
      discordBudgets.markVerified(token);
      const guildResponse = await fetchImpl('https://discord.com/api/v10/users/@me/guilds', { headers, signal: AbortSignal.timeout(15000) });
      if (!guildResponse.ok) return res.status(502).json({ message: 'Discord could not load the bot’s servers. Please try again.' });
      guilds = await guildResponse.json();
      if (!Array.isArray(guilds)) throw new Error('Invalid Discord response');
    } catch {
      return res.status(502).json({ message: 'Could not reach Discord. Please try again.' });
    }
    return route(async (_req, response) => {
      const bots = await read();
      if (!bots.some(b => b.id === user.id) && (typeof connectCode !== 'string' || connectCode.length < 16 || !timingSafeEqual(hash(String(req.body?.connectCode || '')), hash(connectCode)))) return response.status(403).json({ message: 'Ask the owner for a connection code to add a new bot.' });
      const rest = bots.filter(b => b.id !== user.id);
      if (rest.length >= 100) return response.status(409).json({ message: 'The site vault is full. Ask the site owner to remove a saved bot.' });
      await save([...rest, { id: user.id, name: user.username.slice(0, 100), token }]);
      response.json({ user, guilds });
    })(req, res);
    });
  });
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!enabled) return res.status(503).json({ message: 'Saved bots are disabled. Set VAULT_PASSWORD to a unique password of at least 16 characters in your hosting environment.' });
    const time = now(), id = clientId(req);
    // Windows have fixed lifetimes and insertion order; cleanup is capped per request.
    let cleaned = 0;
    for (const [key, entry] of attempts) {
      if (entry.resetAt > time || cleaned++ >= 16) break;
      attempts.delete(key);
    }
    if (attempts.get(id)?.resetAt <= time) attempts.delete(id);
    let entry = attempts.get(id);
    if (!entry && attempts.size >= authClientCapacity) { res.set('Retry-After', '60'); return res.status(429).json({ message: 'Too many authentication clients. Try again in a minute.' }); }
    if (!entry) { entry = { failures: 0, resetAt: time + 60000 }; attempts.set(id, entry); }
    if (entry.failures >= 10) { res.set('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt-time)/1000)))); return res.status(429).json({ message: 'Too many failed attempts. Try again in a minute.' }); }
    const supplied = (req.get('Authorization') || '').replace(/^Bearer /, '');
    if (!timingSafeEqual(hash(supplied), hash(password))) {
      entry.failures++;
      return res.status(401).json({ message: 'Vault password is incorrect.' });
    }
    next();
  });
  router.get('/', route(async (_req, res) => res.json((await read()).map(({ id, name }) => ({ id, name })))));
  router.post('/bots', route(async (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim().replace(/^Bot\s+/i, '') : '';
    if (!token || token.length > 256) return res.status(400).json({ message: 'Enter a valid bot token.' });
    const response = await fetchImpl('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bot ${token}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) return res.status(400).json({ message: 'Discord could not verify this bot token.' });
    const user = await response.json();
    if (!user.bot || !/^\d{1,32}$/.test(user.id) || typeof user.username !== 'string') return res.status(400).json({ message: 'Only bot accounts can be saved.' });
    const bots = await read();
    const rest = bots.filter(b => b.id !== user.id);
    if (rest.length >= 100) return res.status(400).json({ message: 'The vault can hold up to 100 bots.' });
    await save([...rest, { id: user.id, name: user.username.slice(0, 100), token }]);
    res.status(201).json({ id: user.id, name: user.username.slice(0, 100) });
  }));
  router.post('/reveal', route(async (req, res) => {
    const bot = (await read()).find(b => b.id === req.body?.id);
    if (!bot) return res.status(404).json({ message: 'Saved bot not found.' });
    res.json({ token: bot.token });
  }));
  router.delete('/bots/:id', route(async (req, res) => {
    await save((await read()).filter(b => b.id !== req.params.id));
    res.json({ ok: true });
  }));
  router.get('/export', route(async (_req, res) => res.json(encrypt(await read(), password))));
  router.post('/import', route(async (req, res) => {
    let bots;
    try { bots = decrypt(req.body?.backup, password); }
    catch { return res.status(400).json({ message: 'The backup is invalid or was encrypted with a different vault password.' }); }
    await save(bots);
    res.json({ count: bots.length });
  }));
  return router;
}
