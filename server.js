import express from 'express';
import { createServer as createViteServer } from 'vite';
import { existsSync } from 'node:fs';
import { createVaultRouter } from './vault.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use((error, _req, res, next) => {
  if (!error) return next();
  res.status(error.type === 'entity.too.large' ? 413 : 400).json({ message: 'Invalid request body.' });
});
app.use('/api/vault', createVaultRouter());
app.use('/secret', (_req, res) => res.sendStatus(404));
// Connecting stays session-only. Saving in the private vault requires a separate, explicit action.
app.post('/api/discord', async (req, res) => {
  const { path, method = 'GET', body, token } = req.body || {};
  if (typeof token !== 'string' || !token.trim() || typeof path !== 'string' || !/^\/(users\/@me(?:\/guilds)?|guilds\/\d+(?:\/(?:channels|roles(?:\/\d+)?|members(?:\/\d+)?|bans\/\d+))?|channels\/\d+(?:\/messages(?:\/\d+)?)?|applications\/\d+\/(?:guilds\/\d+\/)?commands)(?:\?[^#]*)?$/.test(path) || !['GET','POST','PATCH','DELETE','PUT'].includes(method)) {
    return res.status(400).json({ message: 'Invalid Discord request.' });
  }
  try {
    const response = await fetch(`https://discord.com/api/v10${path}`, {
      method,
      headers: { Authorization: `Bot ${token.trim()}`, 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { message: 'Discord returned an unexpected response.' }; }
    res.status(response.status).json(data);
  } catch {
    res.status(502).json({ message: 'Could not reach Discord. Please try again.' });
  }
});
if (process.env.NODE_ENV === 'production' && existsSync('dist/index.html')) {
  app.use(express.static('dist'));
  app.get('/{*path}', (_req, res) => res.sendFile('dist/index.html', { root: process.cwd() }));
} else {
  const vite = await createViteServer({ server: { middlewareMode: true, fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/secret/**'] } }, appType: 'spa' });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`Relay running on http://0.0.0.0:${port}`));
