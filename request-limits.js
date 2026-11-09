// Use the socket address unless Express has explicitly configured a trusted proxy.
export const clientId = req => req.ip || req.socket?.remoteAddress || 'unknown';
export function createRequestLimiter({ clientLimit = 120, globalLimit = 600, windowMs = 60000, now = Date.now } = {}) {
  const clients = new Map();
  let total = 0, resetAt = 0;
  return (req, res, next) => {
    const time = now();
    if (time >= resetAt) { clients.clear(); total = 0; resetAt = time + windowMs; }
    const id = clientId(req), count = clients.get(id) || 0;
    if (total >= globalLimit || count >= clientLimit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((resetAt - time) / 1000))));
      return res.status(429).json({ message: 'Too many requests. Please try again shortly.' });
    }
    clients.set(id, count + 1); total++;
    return next();
  };
}

// Only a successful Discord response establishes a token identity. Never trust a
// submitted token or forwarded header as proof of authentication.
import { createHash } from 'node:crypto';
export function createDiscordBudgets({ now = Date.now } = {}) {
  const verified = new Map(), ttl = 3600000;
  const key = token => createHash('sha256').update(token.trim().replace(/^Bot\s+/i, '')).digest('hex');
  const prune = () => { for (const [id, expires] of verified) { if (expires > now()) break; verified.delete(id); } };
  const markVerified = token => { prune(); const id = key(token); if (!verified.has(id) && verified.size < 1000) verified.set(id, now() + ttl); };
  const route = (knownLimit, unknownLimit, clientLimit = 120) => {
    const known = createRequestLimiter({ clientLimit, globalLimit: knownLimit, now });
    const unknown = createRequestLimiter({ clientLimit: 10, globalLimit: unknownLimit, now });
    return (req, res, next) => {
      prune();
      const token = req.body?.token;
      const trusted = typeof token === 'string' && verified.has(key(token));
      return (trusted ? known : unknown)(req, res, next);
    };
  };
  // Fixed aggregate ceilings sum to 600/minute, independent of client rotation.
  return { proxy: route(450, 30), connect: route(90, 30, 10), markVerified, invalidate: token => verified.delete(key(token)) };
}
export const discordBudgets = createDiscordBudgets();
