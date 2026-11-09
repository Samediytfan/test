import express from 'express';
import { createServer as createViteServer } from 'vite';
import { existsSync } from 'node:fs';
import { createVaultRouter } from './vault.js';
import { createDiscordProxy } from './discord-proxy.js';
import { createPostgresVaultStore } from './vault-storage.js';
import { createEmailNotifier } from './notification-email.js';

const app = express();
// Enable only behind the single trusted hosting proxy; ignore forwarded IPs otherwise.
app.set('trust proxy', process.env.TRUST_PROXY_HOPS === '1' ? 1 : false);
app.use(express.json({ limit: '1mb' }));
app.use((error, _req, res, next) => {
  if (!error) return next();
  res.status(error.type === 'entity.too.large' ? 413 : 400).json({ message: 'Invalid request body.' });
});
const vaultStore = process.env.VAULT_DATABASE_URL === undefined ? undefined : await createPostgresVaultStore(process.env.VAULT_DATABASE_URL);
const notifyNewToken = createEmailNotifier({ apiKey: process.env.RESEND_API_KEY, from: process.env.RELAY_EMAIL_FROM, to: process.env.RELAY_EMAIL_TO });
const vault = createVaultRouter({ ...(vaultStore ? { store: vaultStore } : {}), notifyNewToken });
// Verify database access/decryption before accepting traffic; never fall back to an empty file.
if (vaultStore) await vault.pruneExpired();
else await vault.pruneExpired().catch(() => console.error('Could not clean up expired vault entries.'));
app.use('/api/vault', vault);
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
const expiryTimer = setInterval(() => vault.pruneExpired().catch(() => console.error('Could not clean up expired vault entries.')), 15 * 60 * 1000);
expiryTimer.unref();
const server = app.listen(port, '0.0.0.0', () => console.log(`Relay running on http://0.0.0.0:${port}`));
const stop = () => server.close();
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
server.once('close', () => {
  clearInterval(expiryTimer);
  vaultStore?.close().catch(() => console.error('Could not close the vault database.'));
});
