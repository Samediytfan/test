import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmailNotifier } from '../notification-email.js';

test('notification sends bot name but never sends a token', async () => {
 let captured;
 const notify=createEmailNotifier({apiKey:'synthetic-key',from:'sender@example.test',to:'recipient@example.test',fetchImpl:async (url,options)=>{captured={url,...options};return {ok:true};}});
 await notify({name:'Synthetic Bot',token:'synthetic-private-token'});
 const body=JSON.parse(captured.body);
 assert.equal(body.subject,'Tocken Login Relay');
 assert.match(body.text,/Synthetic Bot/);
 assert.ok(!captured.body.includes('synthetic-private-token'));
 assert.equal(captured.url,'https://api.resend.com/emails');
});
