import { discordBudgets } from './request-limits.js';
import { isAllowedDiscordRequest } from './discord-routes.js';
export function createDiscordProxy(fetchImpl = fetch, limit = discordBudgets.proxy) {
 return (req, res) => {
  const { path, method = 'GET', body, token } = req.body || {};
  if (typeof token !== 'string' || !token.trim() || !isAllowedDiscordRequest(path, method)) {
    return res.status(400).json({ message: 'Invalid Discord request.' });
  }
  return limit(req, res, async () => {
  try {
    const response = await fetchImpl(`https://discord.com/api/v10${path}`, {
      method,
      headers: { Authorization: `Bot ${token.trim()}`, 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401) discordBudgets.invalidate(token);
    if (response.ok) discordBudgets.markVerified(token);
    if (response.status === 204) return res.status(204).end();
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { message: 'Discord returned an unexpected response.' }; }
    res.status(response.status).json(data);
  } catch {
    res.status(502).json({ message: 'Could not reach Discord. Please try again.' });
  }
 });
 };
}
