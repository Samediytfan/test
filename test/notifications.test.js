import test from 'node:test';
import assert from 'node:assert/strict';
import { isBotMention, isDirectMessage, upsertConversation, validConversation } from '../src/notifications.js';

test('mention detection includes direct, role, and everyone mentions but excludes others and the bot itself',()=>{
 const base={guild_id:'1',author:{id:'2'},mentions:[],mention_roles:[]};
 assert.equal(isBotMention({...base,mentions:[{id:'9'}]},'9'),true);
 assert.equal(isBotMention({...base,mention_roles:['7']},'9',['7']),true);
 assert.equal(isBotMention({...base,mention_roles:['7']},'9',['8']),false);
 assert.equal(isBotMention({...base,mention_everyone:true},'9'),true);
 assert.equal(isBotMention({...base,mentions:[{id:'9'}],author:{id:'9'}},'9'),false);
 assert.equal(isBotMention({mentions:[{id:'9'}]},'9'),false);
});
test('DM events exclude guilds, own messages, group channels and ephemeral interactions',()=>{
 const dm={id:'3',channel_id:'4',author:{id:'2'},channel_type:1};
 assert.equal(isDirectMessage(dm,'9'),true);
 assert.equal(isDirectMessage({...dm,channel_type:undefined},'9'),true);
 assert.equal(isDirectMessage({...dm,flags:64},'9'),false);
 assert.equal(isDirectMessage({...dm,guild_id:'1'},'9'),false);
 assert.equal(isDirectMessage({...dm,channel_type:3},'9'),false);
 assert.equal(isDirectMessage({...dm,author:{id:'9'}},'9'),false);
});
test('conversation registry deduplicates and checks browser storage entries',()=>{
 const a={id:'1',userId:'10',name:'A'},b={id:'2',userId:'20',name:'B'};
 assert.deepEqual(upsertConversation([a,b],{...b,name:'Updated'}),[{...b,name:'Updated'},a]);
 assert.equal(validConversation(a),true);assert.equal(validConversation({...a,id:'../../x'}),false);assert.equal(validConversation({...a,name:'x'.repeat(101)}),false);
});
