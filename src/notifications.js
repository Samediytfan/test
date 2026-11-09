export function isBotMention(message, botId, botRoles = []) {
 if (!message?.guild_id || !botId || message.author?.id === botId) return false;
 return Boolean(message.mention_everyone || message.mentions?.some(user => user.id === botId) || message.mention_roles?.some(id => botRoles.includes(id)));
}
export function isDirectMessage(message, botId) {
 return Boolean(message?.id && message.channel_id && !message.guild_id && (message.channel_type == null || message.channel_type === 1) && !(Number(message.flags || 0) & 64) && message.author?.id && message.author.id !== botId);
}
export function upsertConversation(list, item) {
 if (!item?.id || !item?.userId) return list;
 return [item, ...list.filter(previous => previous.id !== item.id)].slice(0,200);
}
export function validConversation(item) {
 return item && /^\d{1,32}$/.test(item.id) && /^\d{1,32}$/.test(item.userId) && typeof item.name === 'string' && item.name.length <= 100;
}
