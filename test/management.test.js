import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedDiscordRequest } from '../discord-routes.js';
import { PERMISSIONS, hasPermission, togglePermission, setOverwrite } from '../src/permissions.js';
import { onboardingPayload, validateOnboarding } from '../src/onboarding.js';
import { flattenCommands, mentionTrigger, replaceMention, validShortcut } from '../src/composer.js';

test('proxy supports the management routes and preserves previous app requests',()=>{
 for(const [path,method] of [['/users/@me/channels','POST'],['/guilds/1/onboarding','GET'],['/guilds/1/onboarding','PUT'],['/channels/2/permissions/3','PUT'],['/channels/2/permissions/3','DELETE'],['/guilds/1/roles','PATCH'],['/guilds/1/members/2/roles/3','PUT'],['/guilds/1/members/2/roles/3','DELETE'],['/guilds/1/members/search?query=a%20b&limit=25','GET'],['/users/@me','GET'],['/users/@me/guilds','GET'],['/guilds/1/channels','POST'],['/channels/1/messages?limit=50','GET'],['/channels/1/messages/2','PATCH'],['/guilds/1/bans/2','PUT'],['/applications/1/commands','GET'],['/applications/1/guilds/2/commands','GET']])assert.equal(isAllowedDiscordRequest(path,method),true,method+' '+path);
});
test('proxy rejects unexpected methods, paths, query parameters and destinations',()=>{
 for(const [path,method] of [['/users/@me/channels','GET'],['https://evil.example/users/@me','GET'],['//evil.example/users/@me','GET'],['/users/@me','DELETE'],['/guilds/1/onboarding','POST'],['/channels/2/permissions/3','GET'],['/channels/2/messages?redirect=https://evil.example','GET'],['/guilds/1/members/../roles','GET'],['/channels/%31/messages','GET'],['/channels/1/messages#fragment','GET'],['/channels/1/messages?limit=5','POST'],['/guilds/1/members/search?query=x?limit=5','GET'],[null,'GET']])assert.equal(isAllowedDiscordRequest(path,method),false,String(path));
});
test('permission editing preserves high unknown bits and known flags independently',()=>{
 const original=((1n<<63n)|(1n<<52n)|(1n<<10n)).toString();
 const changed=togglePermission(original,11,true);
 assert.equal(hasPermission(changed,52),true);assert.equal(hasPermission(changed,63),true);assert.equal(hasPermission(changed,11),true);
 assert.equal(togglePermission(changed,11,false),original);
 assert.equal(PERMISSIONS.find(p=>p.name==='BYPASS_SLOWMODE').bit,52);
});
test('allow/deny/inherit transitions never drop unrelated overwrite flags',()=>{
 const extra=(1n<<63n).toString();
 let v=setOverwrite(extra,'0',11,'allow');assert.equal(hasPermission(v.allow,11),true);
 v=setOverwrite(v.allow,v.deny,11,'deny');assert.equal(hasPermission(v.allow,11),false);assert.equal(hasPermission(v.deny,11),true);assert.equal(hasPermission(v.allow,63),true);
 v=setOverwrite(v.allow,v.deny,11,'inherit');assert.equal(v.allow,extra);assert.equal(v.deny,'0');
});
test('onboarding writes preserve IDs and mappings and translate or clear emojis',()=>{
 const value={enabled:false,mode:1,default_channel_ids:['1'],guild_id:'99',prompts:[{id:'2',type:0,title:'Question',single_select:false,required:true,in_onboarding:true,options:[{id:'3',title:'Answer',description:'Desc',channel_ids:['4'],role_ids:['5'],emoji:{id:'6',name:'wave',animated:true}}]}]};
 const payload=onboardingPayload(value);assert.equal(payload.guild_id,undefined);assert.equal(payload.prompts[0].id,'2');assert.deepEqual(payload.prompts[0].options[0].role_ids,['5']);assert.deepEqual(payload.prompts[0].options[0].channel_ids,['4']);assert.equal(payload.prompts[0].options[0].emoji_id,'6');assert.equal(payload.prompts[0].options[0].emoji,undefined);
 value.prompts[0].options[0].emoji_id=null;value.prompts[0].options[0].emoji_name=null;
 assert.equal(onboardingPayload(value).prompts[0].options[0].emoji_id,null);
 assert.equal(onboardingPayload(value).prompts[0].options[0].emoji_name,null);
 assert.equal(validateOnboarding(payload),'');assert.match(validateOnboarding({...payload,enabled:true,mode:0}),/7/);
});
test('mention selection replaces the caret token and preserves surrounding message text',()=>{
 const text='Hello @sop and welcome';const cursor=10;const trigger=mentionTrigger(text,cursor);
 assert.equal(trigger.query,'sop');assert.equal(replaceMention(text,cursor,trigger.start,'<@123>'),'Hello <@123> and welcome');
 assert.equal(mentionTrigger('someone@example.com'),null);assert.equal(mentionTrigger('Hello @').query,'');
});
test('slash suggestions include nested commands but exclude context menu commands',()=>{
 const list=flattenCommands([{id:'1',type:1,name:'admin',options:[{type:2,name:'member',options:[{type:1,name:'ban',description:'Ban member',options:[{type:6,name:'user'}]}]}]},{id:'2',type:2,name:'Inspect user'}]);
 assert.equal(list.length,1);assert.equal(list[0].name,'admin member ban');assert.equal(list[0].id,'1-admin member ban');assert.equal(list[0].options[0].name,'user');
});
test('prefix shortcuts accept plain prefix messages and reject disguised slash execution',()=>{
 assert.equal(validShortcut({name:'help',text:'!help'}),true);
 assert.equal(validShortcut({name:'help',text:'/help'}),false);
 assert.equal(validShortcut({name:'help',text:'!help\n!ban'}),false);
 assert.equal(validShortcut({name:'bad name',text:'!help'}),false);
});

test('client accepts successful empty Discord responses and preserves provider errors', async()=>{
 const { requestDiscord } = await import('../src/discord-api.js');
 assert.equal(await requestDiscord({path:'/channels/1/permissions/2',method:'PUT',token:'synthetic'},async()=>new Response(null,{status:204})),null);
 await assert.rejects(requestDiscord({path:'/guilds/1/roles',token:'synthetic'},async()=>Response.json({message:'Missing Permissions'},{status:403})),/Missing Permissions/);
});

test('proxy forwards allowed management writes to Discord and correctly returns 204', async t=>{
 const express=(await import('express')).default;
 const { createDiscordProxy }=await import('../discord-proxy.js');
 const requests=[];const app=express();app.use(express.json());app.post('/api/discord',createDiscordProxy(async(url,init)=>{requests.push({url,init});return new Response(null,{status:204})}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url=`http://127.0.0.1:${server.address().port}/api/discord`;
 const request=body=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await request({token:'synthetic',path:'https://evil.example',method:'GET'})).status,400);assert.equal(requests.length,0);
 const response=await request({token:'synthetic',path:'/channels/2/permissions/3',method:'PUT',body:{allow:'0',deny:'2048',type:0}});
 assert.equal(response.status,204);assert.equal(await response.text(),'');assert.equal(requests[0].url,'https://discord.com/api/v10/channels/2/permissions/3');assert.equal(requests[0].init.method,'PUT');assert.deepEqual(JSON.parse(requests[0].init.body),{allow:'0',deny:'2048',type:0});
});
