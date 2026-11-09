const id = '\\d+';
const rules = [
  ['GET', '/users/@me'], ['POST', '/users/@me/channels'], ['GET', '/users/@me/guilds', ['limit','before','after']],
  ['GET PATCH', `/guilds/${id}`], ['GET POST', `/guilds/${id}/channels`],
  ['GET POST PATCH', `/guilds/${id}/roles`], ['PATCH DELETE', `/guilds/${id}/roles/${id}`],
  ['GET', `/guilds/${id}/members`, ['limit','after']],
  ['GET', `/guilds/${id}/members/search`, ['query','limit']],
  ['GET PATCH DELETE', `/guilds/${id}/members/${id}`],
  ['PUT DELETE', `/guilds/${id}/members/${id}/roles/${id}`],
  ['PUT DELETE', `/guilds/${id}/bans/${id}`], ['GET PUT', `/guilds/${id}/onboarding`],
  ['GET PATCH DELETE', `/channels/${id}`], ['PUT DELETE', `/channels/${id}/permissions/${id}`],
  ['GET POST', `/channels/${id}/messages`, ['limit','before','after','around']],
  ['PATCH DELETE', `/channels/${id}/messages/${id}`],
  ['GET', `/applications/${id}/commands`], ['GET', `/applications/${id}/guilds/${id}/commands`],
].map(([methods, path, query=[]]) => ({ methods:methods.split(' '), path:new RegExp(`^${path}$`), query }));
export function isAllowedDiscordRequest(path, method) {
  if (typeof path !== 'string' || path.length > 2000 || /[#\\]/.test(path)) return false;
  const [pathname, ...query] = path.split('?');
  if (query.length > 1) return false;
  const reaction = pathname.match(/^\/channels\/\d+\/messages\/\d+\/reactions\/([^/]+)\/@me$/);
  if (reaction) {
    if (query.length || !['PUT', 'DELETE'].includes(method)) return false;
    try {
      const emoji = decodeURIComponent(reaction[1]);
      if (emoji.length > 64 || encodeURIComponent(emoji) !== reaction[1]) return false;
      return /^[A-Za-z0-9_]{1,32}:\d{1,32}$/.test(emoji) || (/\p{Emoji}/u.test(emoji) && /^[\p{Emoji}\u200d\ufe0e\ufe0f\u20e3\u{e0020}-\u{e007f}]+$/u.test(emoji));
    } catch { return false; }
  }
  const rule = rules.find(r => r.path.test(pathname) && r.methods.includes(method));
  if (!rule) return false;
  if (query.length && method !== 'GET') return false;
  return [...new URLSearchParams(query[0] || '').keys()].every(key => rule.query.includes(key));
}
