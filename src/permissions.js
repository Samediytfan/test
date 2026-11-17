// Permission flags from Discord’s documented permission table. Unknown bits are preserved.
export const PERMISSIONS = [
  {
    "name": "CREATE_INSTANT_INVITE",
    "bit": 0,
    "channel": true
  },
  {
    "name": "KICK_MEMBERS",
    "bit": 1,
    "channel": false
  },
  {
    "name": "BAN_MEMBERS",
    "bit": 2,
    "channel": false
  },
  {
    "name": "ADMINISTRATOR",
    "bit": 3,
    "channel": false
  },
  {
    "name": "MANAGE_CHANNELS",
    "bit": 4,
    "channel": true
  },
  {
    "name": "MANAGE_GUILD",
    "bit": 5,
    "channel": false
  },
  {
    "name": "ADD_REACTIONS",
    "bit": 6,
    "channel": true
  },
  {
    "name": "VIEW_AUDIT_LOG",
    "bit": 7,
    "channel": false
  },
  {
    "name": "PRIORITY_SPEAKER",
    "bit": 8,
    "channel": true
  },
  {
    "name": "STREAM",
    "bit": 9,
    "channel": true
  },
  {
    "name": "VIEW_CHANNEL",
    "bit": 10,
    "channel": true
  },
  {
    "name": "SEND_MESSAGES",
    "bit": 11,
    "channel": true
  },
  {
    "name": "SEND_TTS_MESSAGES",
    "bit": 12,
    "channel": true
  },
  {
    "name": "MANAGE_MESSAGES",
    "bit": 13,
    "channel": true
  },
  {
    "name": "EMBED_LINKS",
    "bit": 14,
    "channel": true
  },
  {
    "name": "ATTACH_FILES",
    "bit": 15,
    "channel": true
  },
  {
    "name": "READ_MESSAGE_HISTORY",
    "bit": 16,
    "channel": true
  },
  {
    "name": "MENTION_EVERYONE",
    "bit": 17,
    "channel": true
  },
  {
    "name": "USE_EXTERNAL_EMOJIS",
    "bit": 18,
    "channel": true
  },
  {
    "name": "VIEW_GUILD_INSIGHTS",
    "bit": 19,
    "channel": false
  },
  {
    "name": "CONNECT",
    "bit": 20,
    "channel": true
  },
  {
    "name": "SPEAK",
    "bit": 21,
    "channel": true
  },
  {
    "name": "MUTE_MEMBERS",
    "bit": 22,
    "channel": true
  },
  {
    "name": "DEAFEN_MEMBERS",
    "bit": 23,
    "channel": true
  },
  {
    "name": "MOVE_MEMBERS",
    "bit": 24,
    "channel": true
  },
  {
    "name": "USE_VAD",
    "bit": 25,
    "channel": true
  },
  {
    "name": "CHANGE_NICKNAME",
    "bit": 26,
    "channel": false
  },
  {
    "name": "MANAGE_NICKNAMES",
    "bit": 27,
    "channel": false
  },
  {
    "name": "MANAGE_ROLES",
    "bit": 28,
    "channel": true
  },
  {
    "name": "MANAGE_WEBHOOKS",
    "bit": 29,
    "channel": true
  },
  {
    "name": "MANAGE_GUILD_EXPRESSIONS",
    "bit": 30,
    "channel": false
  },
  {
    "name": "USE_APPLICATION_COMMANDS",
    "bit": 31,
    "channel": true
  },
  {
    "name": "REQUEST_TO_SPEAK",
    "bit": 32,
    "channel": true
  },
  {
    "name": "MANAGE_EVENTS",
    "bit": 33,
    "channel": true
  },
  {
    "name": "MANAGE_THREADS",
    "bit": 34,
    "channel": true
  },
  {
    "name": "CREATE_PUBLIC_THREADS",
    "bit": 35,
    "channel": true
  },
  {
    "name": "CREATE_PRIVATE_THREADS",
    "bit": 36,
    "channel": true
  },
  {
    "name": "USE_EXTERNAL_STICKERS",
    "bit": 37,
    "channel": true
  },
  {
    "name": "SEND_MESSAGES_IN_THREADS",
    "bit": 38,
    "channel": true
  },
  {
    "name": "USE_EMBEDDED_ACTIVITIES",
    "bit": 39,
    "channel": true
  },
  {
    "name": "MODERATE_MEMBERS",
    "bit": 40,
    "channel": false
  },
  {
    "name": "VIEW_CREATOR_MONETIZATION_ANALYTICS",
    "bit": 41,
    "channel": false
  },
  {
    "name": "USE_SOUNDBOARD",
    "bit": 42,
    "channel": true
  },
  {
    "name": "CREATE_GUILD_EXPRESSIONS",
    "bit": 43,
    "channel": false
  },
  {
    "name": "CREATE_EVENTS",
    "bit": 44,
    "channel": true
  },
  {
    "name": "USE_EXTERNAL_SOUNDS",
    "bit": 45,
    "channel": true
  },
  {
    "name": "SEND_VOICE_MESSAGES",
    "bit": 46,
    "channel": true
  },
  {
    "name": "SET_VOICE_CHANNEL_STATUS",
    "bit": 48,
    "channel": true
  },
  {
    "name": "SEND_POLLS",
    "bit": 49,
    "channel": true
  },
  {
    "name": "USE_EXTERNAL_APPS",
    "bit": 50,
    "channel": true
  },
  {
    "name": "PIN_MESSAGES",
    "bit": 51,
    "channel": true
  },
  {
    "name": "BYPASS_SLOWMODE",
    "bit": 52,
    "channel": true
  }
];
export const hasPermission = (value, bit) => (BigInt(value || '0') & (1n << BigInt(bit))) !== 0n;
export function togglePermission(value, bit, enabled) {
  const mask = 1n << BigInt(bit), current = BigInt(value || '0');
  return (enabled ? current | mask : current & ~mask).toString();
}
export function setOverwrite(allow, deny, bit, state) {
  return { allow: togglePermission(allow, bit, state === 'allow'), deny: togglePermission(deny, bit, state === 'deny') };
}
export const permissionLabel = name => name.toLowerCase().split('_').map(x => x[0].toUpperCase()+x.slice(1)).join(' ');
