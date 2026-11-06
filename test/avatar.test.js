import test from 'node:test';
import assert from 'node:assert/strict';
import { profileImages } from '../src/avatar.js';

test('server profiles precede global avatars and keep animated images', () => {
  assert.deepEqual(profileImages({id:'4194304',avatar:'global'}, {avatar:'a_server'}, '99'), [
    'https://cdn.discordapp.com/guilds/99/users/4194304/avatars/a_server.webp?size=128&animated=true',
    'https://cdn.discordapp.com/avatars/4194304/global.webp?size=128',
    'https://cdn.discordapp.com/embed/avatars/1.png',
  ]);
});
test('default avatars follow modern snowflakes and legacy discriminators without precision loss', () => {
  assert.deepEqual(profileImages({id:'175928847299117063',discriminator:'0'}), ['https://cdn.discordapp.com/embed/avatars/2.png']);
  assert.deepEqual(profileImages({id:'175928847299117063',discriminator:'1337'}), ['https://cdn.discordapp.com/embed/avatars/2.png']);
  assert.deepEqual(profileImages({id:'4194304',discriminator:'1234'}), ['https://cdn.discordapp.com/embed/avatars/4.png']);
});
test('invalid identity and image paths do not produce arbitrary image URLs', () => {
  assert.deepEqual(profileImages({id:'demo',avatar:'test'}), []);
  assert.deepEqual(profileImages({id:'4194304',avatar:'../bad'}, {avatar:'bad/path'}, '99'), ['https://cdn.discordapp.com/embed/avatars/1.png']);
});
