import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createVaultRouter } from '../vault.js';

const password = 'synthetic-test-password-only';
async function fixture(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'relay-vault-test-'));
  const filePath = join(dir, 'secret', 'bots.enc.json');
  const app = express(); app.use(express.json());
  let calls = 0;
  app.use('/api/vault', createVaultRouter({ password, filePath, fetchImpl: async (_url, init) => {
    assert.ok(init.headers.Authorization.startsWith('Bot '));
    return { ok: true, json: async () => ({ id: String(++calls), username: `Synthetic bot ${calls}`, bot: true }) };
  }, ...options }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/vault`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  const request = async (path = '', method = 'GET', body, auth = password) => {
    const r = await fetch(url + path, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, headers: r.headers, data: await r.json() };
  };
  return { request, filePath, url };
}

test('vault fails closed without a strong configured owner password', async t => {
  const f = await fixture(t, { password: '' });
  assert.equal((await f.request()).status, 503);
});

test('authentication protects every vault route and responses are not cached', async t => {
  const { request } = await fixture(t);
  for (const [path, method, body] of [['', 'GET'], ['/bots','POST',{token:'synthetic-token'}], ['/reveal','POST',{id:'1'}], ['/bots/1','DELETE'], ['/export','GET'], ['/import','POST',{backup:{}}]]) {
    const r = await request(path, method, body, 'wrong-password');
    assert.equal(r.status, 401);
    assert.equal(r.headers.get('cache-control'), 'no-store');
  }
  assert.deepEqual((await request()).data, []);
});

test('encrypted storage, reveal, delete, backup restore, tamper rejection, and restart', async t => {
  const { request, filePath } = await fixture(t);
  assert.equal((await request('/bots','POST',{token:'synthetic-private-bot-token'})).status, 201);
  const disk = await readFile(filePath, 'utf8');
  assert.ok(!disk.includes('synthetic-private-bot-token'));
  assert.ok(!disk.includes('Synthetic bot'));
  assert.equal((await stat(filePath)).mode & 0o777, 0o600);
  assert.deepEqual((await request()).data, [{ id:'1', name:'Synthetic bot 1' }]);
  assert.equal((await request('/reveal','POST',{id:'1'})).data.token, 'synthetic-private-bot-token');
  const backup = (await request('/export')).data;
  const original = await readFile(filePath, 'utf8');
  assert.equal((await request('/import','POST',{backup:{...backup, data: 'tampered'}})).status, 400);
  assert.equal(await readFile(filePath, 'utf8'), original);
  await request('/bots/1','DELETE');
  assert.deepEqual((await request()).data, []);
  assert.equal((await request('/reveal','POST',{id:'1'})).status, 404);
  assert.equal((await request('/import','POST',{backup})).status, 200);
  assert.equal((await request('/reveal','POST',{id:'1'})).data.token, 'synthetic-private-bot-token');
  const other = await fixture(t, { filePath });
  assert.deepEqual((await other.request()).data, [{id:'1',name:'Synthetic bot 1'}]);
  const changedPassword = await fixture(t, { filePath, password:'another-long-synthetic-password' });
  assert.equal((await changedPassword.request('', 'GET', undefined, 'another-long-synthetic-password')).status, 500);
  assert.equal((await request()).status, 200);
});

test('simultaneous writes retain both bots', async t => {
  const { request } = await fixture(t);
  const results = await Promise.all([request('/bots','POST',{token:'synthetic-one'}), request('/bots','POST',{token:'synthetic-two'})]);
  assert.ok(results.every(r => r.status === 201));
  assert.equal((await request()).data.length, 2);
});

test('Discord verification failure and non-bot identities are never stored', async t => {
  const rejected = await fixture(t, { fetchImpl: async () => ({ok:false}) });
  assert.equal((await rejected.request('/bots','POST',{token:'synthetic-rejected'})).status, 400);
  assert.deepEqual((await rejected.request()).data, []);
  const human = await fixture(t, { fetchImpl: async () => ({ok:true,json:async()=>({id:'1',username:'Synthetic user',bot:false})}) });
  assert.equal((await human.request('/bots','POST',{token:'synthetic-human'})).status, 400);
  assert.deepEqual((await human.request()).data, []);
});

test('failed authentication is throttled while the correct password remains usable', async t => {
  const { request } = await fixture(t);
  for (let i=0;i<10;i++) assert.equal((await request('', 'GET', undefined, 'incorrect')).status, 401);
  assert.equal((await request('', 'GET', undefined, 'incorrect')).status, 429);
  assert.equal((await request()).status, 200);
});

test('saving the same bot updates its token without creating a duplicate', async t => {
  const { request } = await fixture(t, { fetchImpl: async () => ({ok:true,json:async()=>({id:'5',username:'Synthetic renamed bot',bot:true})}) });
  await request('/bots','POST',{token:'synthetic-old'});
  await request('/bots','POST',{token:'synthetic-updated'});
  assert.deepEqual((await request()).data, [{id:'5',name:'Synthetic renamed bot'}]);
  assert.equal((await request('/reveal','POST',{id:'5'})).data.token,'synthetic-updated');
});
