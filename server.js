import express from 'express';
import { createServer as createViteServer } from 'vite';
import { existsSync } from 'node:fs';
import { createVaultRouter } from './vault.js';
import { createDiscordProxy } from './discord-proxy.js';

const app = express();
// Enable only behind the single trusted hosting proxy; ignore forwarded IPs otherwise.
app.set('trust proxy', process.env.TRUST_PROXY_HOPS === '1' ? 1 : false);
app.use(express.json({ limit: '1mb' }));
app.use((error, _req, res, next) => {
  if (!error) return next();
  res.status(error.type === 'entity.too.large' ? 413 : 400).json({ message: 'Invalid request body.' });
});
app.use('/api/vault', createVaultRouter());
app.use('/secret', (_req, res) => res.sendStatus(404));
// The public connect endpoint is mounted on the vault router; other Discord calls stay fixed-host.
app.post('/api/discord', createDiscordProxy());
if (process.env.NODE_ENV === 'production' && existsSync('dist/index.html')) {
  app.use(express.static('dist'));
  app.get('/{*path}', (_req, res) => res.sendFile('dist/index.html', { root: process.cwd() }));
} else {
  const vite = await createViteServer({ server: { middlewareMode: true, fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/secret/**'] } }, appType: 'spa' });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`Relay running on http://0.0.0.0:${port}`));
