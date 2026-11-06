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
// Shared across the proxy and public bot verification, both use Discord's budget.
export const discordRequestLimit = createRequestLimiter();
