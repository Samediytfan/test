import { clientId, discordBudgets } from './request-limits.js';
import { Router } from 'express';
import { randomBytes, createCipheriv, createDecipheriv, scryptSync, createHash, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { createFileVaultStore } from './vault-storage.js';

const aad = Buffer.from('relay-vault-v1');
const retentionMs = 7 * 24 * 60 * 60 * 1000;
function verificationFailure(status) {
  if (status === 401) return { status: 401, data: { message: 'Discord rejected this bot token. Check that it is the current bot token in the Discord Developer Portal.' } };
  if (status === 429) return { status: 429, data: { message: 'Discord is rate limiting connections. Please try again later.' } };
  return { status: 502, data: { message: 'Discord could not verify the bot right now. Please try again later.' } };
}
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
  if (!Array.isArray(bots) || bots.length > 100 || new Set(bots.map(b => b.id)).size !== bots.length || bots.some(b => !/^\d{1,32}$/.test(b.id) || typeof b.name !== 'string' || b.name.length > 100 || typeof b.token !== 'string' || b.token.length > 256 || !b.token.trim() || (b.expiresAt !== undefined && (!Number.isSafeInteger(b.expiresAt) || b.expiresAt < 0)))) throw new Error('Invalid backup');
  return bots;
}

export function createVaultRouter({ password = process.env.VAULT_PASSWORD, filePath = process.env.VAULT_FILE || resolve('secret/bots.enc.json'), store = createFileVaultStore(filePath), fetchImpl = fetch, notifyNewToken = async () => {}, budgets = discordBudgets, connectLimit = budgets.connect, now = Date.now, authClientCapacity = 1024 } = {}) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const enabled = typeof password === 'string' && password.length >= 16;
  const hash = value => createHash('sha256').update(value).digest();
  const attempts = new Map();
  let queue = Promise.resolve();
  const activeBots = (bots, time) => bots.filter(b => b.expiresAt === undefined || b.expiresAt > time).map(b => ({ ...b, expiresAt: Math.min(b.expiresAt ?? time + retentionMs, time + retentionMs) }));
  const transact = fn => {
    queue = queue.catch(() => {}).then(() => store.transaction(async tx => {
      const envelope = await tx.read();
      const original = envelope === null ? [] : decrypt(envelope, password);
      const state = { bots: activeBots(original, now()) };
      const result = await fn(state);
      if (JSON.stringify(state.bots) !== JSON.stringify(original)) await tx.save(encrypt(state.bots, password));
      return result;
    }));
    return queue;
  };
  const route = (fn, afterCommit) => async (req, res) => {
    try {
      const result = await transact(state => fn(req, state));
      afterCommit?.(result);
      res.status(result.status || 200).json(result.data);
    } catch { res.status(500).json({ message: 'Could not read or update the encrypted vault. Check storage access and keep the same vault password.' }); }
  };
  router.pruneExpired = () => enabled ? transact(() => {}) : Promise.resolve();
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
      if (response.status === 401) budgets.invalidate(token);
      if (!response.ok) { const failure = verificationFailure(response.status); return res.status(failure.status).json(failure.data); }
      user = await response.json();
      if (!user.bot || !/^\d{1,32}$/.test(user.id) || typeof user.username !== 'string') return res.status(400).json({ message: 'Only bot accounts can be connected.' });
      const guildResponse = await fetchImpl('https://discord.com/api/v10/users/@me/guilds', { headers, signal: AbortSignal.timeout(15000) });
      if (guildResponse.status === 401) budgets.invalidate(token);
      if (guildResponse.status === 401) return res.status(401).json({ message: 'Discord rejected this bot token. Check that it is the current bot token in the Discord Developer Portal.' });
      if (guildResponse.status === 429) return res.status(429).json({ message: 'Discord is rate limiting connections. Please try again later.' });
      if (!guildResponse.ok) return res.status(502).json({ message: 'Discord could not load the bot’s servers. Please try again.' });
      guilds = await guildResponse.json();
      if (!Array.isArray(guilds)) throw new Error('Invalid Discord response');
    } catch {
      return res.status(502).json({ message: 'Could not reach Discord. Please try again.' });
    }
    return route(async (_req, state) => {
      const rest = state.bots.filter(b => b.id !== user.id);
      if (rest.length >= 100) return { status: 409, data: { message: 'The site vault is full. Ask the site owner to remove a saved bot.' } };
      const newToken = !state.bots.some(b => b.id === user.id && b.token === token);
      state.bots = [...rest, { id: user.id, name: user.username.slice(0, 100), token, expiresAt: now() + retentionMs }];
      return { data: { user, guilds }, newToken };
    }, result => {
      if (!result.status) {
        budgets.markVerified(token);
        if (result.newToken) Promise.resolve().then(() => notifyNewToken({ name: user.username.slice(0, 100) })).catch(() => console.error('Could not send the bot connection notification.'));
      }
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
  router.get('/status', route(async () => ({ data: { storage: store.kind, retentionDays: 7 } })));
  router.get('/', route(async (_req, state) => ({ data: state.bots.map(({ id, name }) => ({ id, name })) })));
  router.post('/bots', route(async (req, state) => {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim().replace(/^Bot\s+/i, '') : '';
    if (!token || token.length > 256) return { status: 400, data: { message: 'Enter a valid bot token.' } };
    const response = await fetchImpl('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bot ${token}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) return verificationFailure(response.status);
    const user = await response.json();
    if (!user.bot || !/^\d{1,32}$/.test(user.id) || typeof user.username !== 'string') return { status: 400, data: { message: 'Only bot accounts can be saved.' } };
    const rest = state.bots.filter(b => b.id !== user.id);
    if (rest.length >= 100) return { status: 400, data: { message: 'The vault can hold up to 100 bots.' } };
    state.bots = [...rest, { id: user.id, name: user.username.slice(0, 100), token, expiresAt: now() + retentionMs }];
    return { status: 201, data: { id: user.id, name: user.username.slice(0, 100) } };
  }));
  router.post('/reveal', route(async (req, state) => {
    const bot = state.bots.find(b => b.id === req.body?.id);
    if (!bot) return { status: 404, data: { message: 'Saved bot not found.' } };
    return { data: { token: bot.token } };
  }));
  router.delete('/bots/:id', route(async (req, state) => {
    state.bots = state.bots.filter(b => b.id !== req.params.id);
    return { data: { ok: true } };
  }));
  router.get('/export', route(async (_req, state) => ({ data: encrypt(state.bots, password) })));
  router.post('/import', route(async (req, state) => {
    let bots;
    try { bots = decrypt(req.body?.backup, password); }
    catch { return { status: 400, data: { message: 'The backup is invalid or was encrypted with a different vault password.' } }; }
    state.bots = activeBots(bots, now());
    return { data: { count: state.bots.length } };
  }));
  return router;
}
