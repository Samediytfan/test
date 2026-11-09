import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';

export function createFileVaultStore(filePath) {
  return {
    kind: 'file',
    async transaction(fn) {
      return fn({
        async read() {
          try { return JSON.parse(await readFile(filePath, 'utf8')); }
          catch (error) { if (error.code === 'ENOENT') return null; throw error; }
        },
        async save(envelope) {
          await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
          const temp = `${filePath}.${randomBytes(8).toString('hex')}.tmp`;
          try {
            await writeFile(temp, JSON.stringify(envelope), { mode: 0o600, flag: 'wx' });
            await rename(temp, filePath);
          } finally { await unlink(temp).catch(() => {}); }
        },
      });
    },
  };
}

export async function createPostgresVaultStore(connectionString) {
  let url;
  try { url = new URL(connectionString); } catch { /* handled below without exposing the URL */ }
  if (!url || !['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('VAULT_DATABASE_URL must be a PostgreSQL connection URL. No local fallback was used.');
  const pool = new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, application_name: 'relay-vault' });
  // Never log connection errors: provider messages can contain private connection details.
  pool.on('error', () => console.error('Vault database connection error.'));
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS relay_vault (id integer PRIMARY KEY CHECK (id = 1), envelope jsonb)');
    await pool.query('INSERT INTO relay_vault (id, envelope) VALUES (1, NULL) ON CONFLICT (id) DO NOTHING');
  } catch {
    await pool.end();
    throw new Error('Could not initialize database vault. Check VAULT_DATABASE_URL. No local fallback was used.');
  }
  return {
    kind: 'postgres',
    close: () => pool.end(),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SET LOCAL lock_timeout = '15s'");
        await client.query("SET LOCAL statement_timeout = '20s'");
        const result = await client.query('SELECT envelope FROM relay_vault WHERE id = 1 FOR UPDATE');
        if (result.rows.length !== 1) throw new Error('Missing vault record');
        const value = await fn({
          read: async () => result.rows[0].envelope,
          save: envelope => client.query('UPDATE relay_vault SET envelope = $1::jsonb WHERE id = 1', [JSON.stringify(envelope)]),
        });
        await client.query('COMMIT');
        return value;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { client.release(); }
    },
  };
}
