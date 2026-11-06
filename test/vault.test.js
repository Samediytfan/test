import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDiscordBudgets } from '../request-limits.js';
import { createVaultRouter } from '../vault.js';

const connectCode = 'synthetic-owner-invite-code';
const password = 'synthetic-test-password-only';
async function fixture(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'relay-vault-test-'));
  const filePath = join(dir, 'secret', 'bots.enc.json');
  const app = express(); app.set('trust proxy', 'loopback'); app.use(express.json());
  let calls = 0;
  app.use('/api/vault', createVaultRouter({ password, connectCode, filePath, budgets: createDiscordBudgets(), fetchImpl: async (_url, init) => {
    assert.ok(init.headers.Authorization.startsWith('Bot '));
    return { ok: true, json: async () => ({ id: String(++calls), username: `Synthetic bot ${calls}`, bot: true }) };
  }, ...options }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/vault`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  const request = async (path = '', method = 'GET', body, auth = password, client = '192.0.2.1') => {
    if (path === '/connect' && body) body = { connectCode, ...body };
    const r = await fetch(url + path, { method, headers: { 'X-Forwarded-For': client, Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
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

test('failed authentication blocks all guesses for that client without blocking others', async t => {
  const { request } = await fixture(t);
  for (let i=0;i<10;i++) assert.equal((await request('', 'GET', undefined, 'incorrect')).status, 401);
  assert.equal((await request('', 'GET', undefined, 'incorrect')).status, 429);
  assert.equal((await request()).status, 429);
  assert.equal((await request('', 'GET', undefined, password, '192.0.2.2')).status, 200);
});

test('saving the same bot updates its token without creating a duplicate', async t => {
  const { request } = await fixture(t, { fetchImpl: async () => ({ok:true,json:async()=>({id:'5',username:'Synthetic renamed bot',bot:true})}) });
  await request('/bots','POST',{token:'synthetic-old'});
  await request('/bots','POST',{token:'synthetic-updated'});
  assert.deepEqual((await request()).data, [{id:'5',name:'Synthetic renamed bot'}]);
  assert.equal((await request('/reveal','POST',{id:'5'})).data.token,'synthetic-updated');
});

test('connecting requires acknowledgement and stores only verified bot tokens for the owner', async t => {
  let calls=0;
  const {request,filePath}=await fixture(t,{fetchImpl:async url=>{calls++;return {ok:true,json:async()=>url.endsWith('/guilds')?[{id:'10',name:'Synthetic server'}]:{id:'42',username:'Synthetic bot',bot:true}}}});
  assert.equal((await request('/connect','POST',{token:'synthetic-token'},'')).status,400);
  assert.equal(calls,0);
  assert.equal((await request('/connect','POST',{token:'synthetic-token',acknowledgeOwnerAccess:false},'')).status,400);
  const connected=await request('/connect','POST',{token:'synthetic-token',acknowledgeOwnerAccess:true},'');
  assert.equal(connected.status,200);assert.equal(connected.data.user.id,'42');assert.equal(connected.data.guilds[0].id,'10');assert.equal(JSON.stringify(connected.data).includes('synthetic-token'),false);
  assert.equal(connected.headers.get('cache-control'),'no-store');
  assert.deepEqual((await request()).data,[{id:'42',name:'Synthetic bot'}]);
  assert.equal((await request('/reveal','POST',{id:'42'})).data.token,'synthetic-token');
  assert.ok(!(await readFile(filePath,'utf8')).includes('synthetic-token'));
  assert.equal((await request('/reveal','POST',{id:'42'},'')).status,401);
});

test('connecting fails closed for disabled vault, invalid bots, and provider failures', async t => {
  const disabled=await fixture(t,{password:''});
  assert.equal((await disabled.request('/connect','POST',{token:'synthetic',acknowledgeOwnerAccess:true},'')).status,503);
  const rejected=await fixture(t,{fetchImpl:async()=>({ok:false})});
  assert.equal((await rejected.request('/connect','POST',{token:'synthetic',acknowledgeOwnerAccess:true},'')).status,401);
  assert.deepEqual((await rejected.request()).data,[]);
  const human=await fixture(t,{fetchImpl:async()=>({ok:true,json:async()=>({id:'1',username:'Human',bot:false})})});
  assert.equal((await human.request('/connect','POST',{token:'synthetic',acknowledgeOwnerAccess:true},'')).status,400);
  assert.deepEqual((await human.request()).data,[]);
  const guildFailure=await fixture(t,{fetchImpl:async url=>url.endsWith('/guilds')?{ok:false}:{ok:true,json:async()=>({id:'1',username:'Synthetic',bot:true})}});
  assert.equal((await guildFailure.request('/connect','POST',{token:'synthetic',acknowledgeOwnerAccess:true},'')).status,502);
  assert.deepEqual((await guildFailure.request()).data,[]);
});

test('simultaneous acknowledged connections and owner writes retain all bots',async t=>{
  const {request}=await fixture(t,{fetchImpl:async(url,init)=>url.endsWith('/guilds')?{ok:true,json:async()=>[]}:{ok:true,json:async()=>({id:init.headers.Authorization.endsWith('one')?'1':'2',username:'Synthetic bot',bot:true})}});
  const [connected,saved]=await Promise.all([request('/connect','POST',{token:'synthetic-one',acknowledgeOwnerAccess:true},''),request('/bots','POST',{token:'synthetic-two'})]);
  assert.equal(connected.status,200);assert.equal(saved.status,201);
  assert.equal((await request()).data.length,2);
});

test('full vault rejects new acknowledged connections without losing existing entries',async t=>{
  const {request}=await fixture(t,{fetchImpl:async(url,init)=>url.endsWith('/guilds')?{ok:true,json:async()=>[]}:{ok:true,json:async()=>({id:init.headers.Authorization.match(/\d+$/)?.[0]||'999',username:'Synthetic bot',bot:true})}});
  const saves=await Promise.all(Array.from({length:100},(_,i)=>request('/bots','POST',{token:`synthetic-${i+1}`})));
  assert.ok(saves.every(r=>r.status===201));
  assert.equal((await request('/connect','POST',{token:'synthetic-101',acknowledgeOwnerAccess:true},'')).status,409);
  assert.equal((await request()).data.length,100);
  assert.equal((await request('/connect','POST',{token:'replacement-1',acknowledgeOwnerAccess:true,connectCode:''},'')).status,200);
  assert.equal((await request()).data.length,100);
  assert.equal((await request('/reveal','POST',{id:'1'})).data.token,'replacement-1');
});


test('new bots require owner admission and rejected writes preserve the encrypted file',async t=>{
 const {request,filePath}=await fixture(t,{fetchImpl:async url=>({ok:true,json:async()=>url.endsWith('/guilds')?[]:{id:'8',username:'Synthetic',bot:true}})});
 assert.equal((await request('/connect','POST',{token:'synthetic',acknowledgeOwnerAccess:true,connectCode:''},'')).status,403);
 await assert.rejects(readFile(filePath),{code:'ENOENT'});
 assert.equal((await request('/connect','POST',{token:'synthetic',acknowledgeOwnerAccess:true},'')).status,200);
 const original=await readFile(filePath,'utf8');
 assert.equal((await request('/connect','POST',{token:'updated',acknowledgeOwnerAccess:true,connectCode:''},'')).status,200);
 assert.notEqual(await readFile(filePath,'utf8'),original);
 assert.equal((await request('/reveal','POST',{id:'8'})).data.token,'updated');
});

test('password guess windows reset before authentication',async t=>{
 let time=1000; const {request}=await fixture(t,{now:()=>time});
 for(let i=0;i<10;i++)assert.equal((await request('', 'GET', undefined, 'wrong')).status,401);
 assert.equal((await request()).status,429);
 time+=60000;
 assert.equal((await request()).status,200);
});


test('vault attempt capacity fails closed without evicting active lockouts',async t=>{
 let time=0;const {request}=await fixture(t,{authClientCapacity:2,now:()=>time});
 for(let i=0;i<10;i++)assert.equal((await request('', 'GET',undefined,'wrong','192.0.2.1')).status,401);
 assert.equal((await request('', 'GET',undefined,'wrong','192.0.2.2')).status,401);
 assert.equal((await request('', 'GET',undefined,password,'192.0.2.3')).status,429);
 assert.equal((await request('', 'GET',undefined,password,'192.0.2.1')).status,429);
 assert.equal((await request('', 'GET',undefined,password,'192.0.2.2')).status,200);
 time=60000;assert.equal((await request('', 'GET',undefined,password,'192.0.2.3')).status,200);
});


test('guild lookup 401 invalidates existing trust without changing its error response',async t=>{
 const budgets=createDiscordBudgets();const token='synthetic-guild-revoked';budgets.markVerified(token);
 const {request}=await fixture(t,{budgets,fetchImpl:async url=>url.endsWith('/guilds')?{ok:false,status:401}:{ok:true,json:async()=>({id:'8',username:'Synthetic',bot:true})}});
 assert.equal((await request('/connect','POST',{token,acknowledgeOwnerAccess:true},'')).status,502);
 let admitted=0;const res={set(){},status(){return this},json(){}};
 for(let i=0;i<11;i++)budgets.proxy({ip:'probe',body:{token}},res,()=>{admitted++});
 assert.equal(admitted,10,'revoked token must use unverified budget');
});

test('rejected admission never grants trust; admitted connections enforce trusted client limits',async t=>{
 const budgets=createDiscordBudgets();const token='synthetic-admission-budget';let calls=0;
 const {request,filePath}=await fixture(t,{budgets,fetchImpl:async url=>{calls++;return {ok:true,json:async()=>url.endsWith('/guilds')?[]:{id:'8',username:'Synthetic',bot:true}}}});
 assert.equal((await request('/connect','POST',{token,acknowledgeOwnerAccess:true,connectCode:''},'')).status,403);
 await assert.rejects(readFile(filePath),{code:'ENOENT'});
 let admitted=0;const res={set(){},status(){return this},json(){}};
 for(let i=0;i<11;i++)budgets.proxy({ip:'probe',body:{token}},res,()=>{admitted++});
 assert.equal(admitted,10,'rejected admission must not grant trusted budget');
 assert.equal((await request('/connect','POST',{token,acknowledgeOwnerAccess:true},'')).status,200);
 for(let i=0;i<10;i++)assert.equal((await request('/connect','POST',{token,acknowledgeOwnerAccess:true,connectCode:''},'')).status,200);
 const before=calls;
 assert.equal((await request('/connect','POST',{token,acknowledgeOwnerAccess:true},'')).status,429);assert.equal(calls,before,'limited requests must not reach Discord');
 assert.equal((await request('/connect','POST',{token,acknowledgeOwnerAccess:true},'','192.0.2.2')).status,200);
});
