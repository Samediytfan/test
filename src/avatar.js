const CDN = 'https://cdn.discordapp.com';
const isId = value => /^\d+$/.test(String(value || ''));
const isHash = value => typeof value === 'string' && /^[a-zA-Z0-9_]+$/.test(value);
const image = (path, hash) => `${CDN}/${path}/${hash}.webp?size=128${hash.startsWith('a_') ? '&animated=true' : ''}`;

// Prefer the member's server profile, then their global profile, then Discord's default.
export function profileImages(user, member, guildId) {
  if (!isId(user?.id)) return [];
  const images = [];
  if (isId(guildId) && isHash(member?.avatar)) images.push(image(`guilds/${guildId}/users/${user.id}/avatars`, member.avatar));
  if (isHash(user.avatar)) images.push(image(`avatars/${user.id}`, user.avatar));
  const discriminator = Number(user.discriminator || 0);
  const index = Number.isInteger(discriminator) && discriminator > 0
    ? discriminator % 5
    : Number((BigInt(user.id) >> 22n) % 6n);
  images.push(`${CDN}/embed/avatars/${index}.png`);
  return images;
}
