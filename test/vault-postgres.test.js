import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresVaultStore } from '../vault-storage.js';
import { createVaultRouter } from '../vault.js';
import { createDiscordBudgets } from '../request-limits.js';
import express from 'express';
import pg from 'pg';

const url=process.env.RELAY_TEST_DATABASE_URL;
test('database persists encrypted saves across instances and serializes concurrent connections', {skip:!url && 'Set RELAY_TEST_DATABASE_URL to a disposable PostgreSQL database'}, async t => {
 const admin=new pg.Client({connectionString:url});await admin.connect();
 await admin.query('DROP TABLE IF EXISTS relay_vault');
 const a=await createPostgresVaultStore(url), b=await createPostgresVaultStore(url);
 t.after(async()=>{await a.close();await b.close();await admin.query('DROP TABLE IF EXISTS relay_vault');await admin.end();});
 const app=express();app.use(express.json());
 const fetchImpl=async (endpoint,init)=>({ok:true,json:async()=>endpoint.endsWith('/guilds')?[]:{id:init.headers.Authorization.endsWith('one')?'1':'2',username:'Bot',bot:true}});
 for(const [path,store] of [['/a',a],['/b',b]])app.use(path,createVaultRouter({password:'synthetic-long-test-password',store,fetchImpl,budgets:createDiscordBudgets()}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const connect=(path,token)=>fetch(base+path+'/connect',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,acknowledgeOwnerAccess:true})});
 const results=await Promise.all([connect('/a','synthetic-one'),connect('/b','synthetic-two')]);
 assert.ok(results.every(r=>r.status===200));
 const view=await fetch(base+'/b',{headers:{Authorization:'Bearer synthetic-long-test-password'}});
 assert.deepEqual((await view.json()).map(b=>b.id).sort(),['1','2']);
 const row=await admin.query('SELECT envelope::text AS value FROM relay_vault WHERE id=1');
 assert.ok(!row.rows[0].value.includes('synthetic-one'));
 const c=await createPostgresVaultStore(url);t.after(()=>c.close());
 const envelope=await c.transaction(tx=>tx.read());assert.equal(envelope.version,1);
 await assert.rejects(c.transaction(async tx=>{await tx.save({version:999});throw new Error('abort');}));
 assert.equal((await c.transaction(tx=>tx.read())).version,1);
});
test('database configuration fails closed', async()=>{
 await assert.rejects(createPostgresVaultStore('not-a-url'), /VAULT_DATABASE_URL/);
});
