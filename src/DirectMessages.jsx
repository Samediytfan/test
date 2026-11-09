import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import Avatar from './Avatar.jsx';
import MessageExtras from './MessageExtras.jsx';
import { profileImages } from './avatar.js';

export default function DirectMessages({ conversations, selected, onSelect, onBack, unread, api, bot, demo, incoming }) {
 const [messages,setMessages]=useState([]),[draft,setDraft]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const current=conversations.find(item=>item.id===selected); const end=useRef(null),scroll=useRef(null),scrollState=useRef({selected:null,last:null,near:true});
 useEffect(()=>{let active=true;setMessages([]);setDraft('');setError('');if(!selected||demo)return;
  const refresh=()=>api(`/channels/${selected}/messages?limit=50`).then(list=>{if(active)setMessages(list.slice().reverse())}).catch(e=>{if(active)setError(e.message)});
  refresh();const timer=setInterval(refresh,10000);return()=>{active=false;clearInterval(timer)};
 },[selected,bot.id,demo]);
 useEffect(()=>{if(incoming?.channel_id===selected)setMessages(old=>old.some(m=>m.id===incoming.id)?old:[...old,incoming]);},[incoming,selected]);
 useEffect(()=>{
  const state=scrollState.current,last=messages.at(-1)?.id;
  const appended=last&&last!==state.last&&messages.some(message=>message.id===state.last);
  if(state.selected!==selected||(!state.last&&last)||appended||state.near)end.current?.scrollIntoView({block:'nearest'});
  scrollState.current={...state,selected,last};
 },[messages,selected]);
 const send=async e=>{e.preventDefault();const text=draft.trim();if(!text||!selected||busy)return;setBusy(true);setError('');try{const message=demo?{id:String(Date.now()),author:{id:bot.id,username:bot.name},content:text,timestamp:new Date().toISOString()}:await api(`/channels/${selected}/messages`,'POST',{content:text,allowed_mentions:{parse:[]}});setMessages(old=>old.some(m=>m.id===message.id)?old:[...old,message]);setDraft('')}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <div className="dm-view"><aside className="dm-sidebar"><button className="dm-back" onClick={onBack}><ArrowLeft size={17}/> Back to servers</button><h2>Direct Messages</h2><p>Conversations opened or received in this browser</p><div className="dm-list">{conversations.map(item=><button key={item.id} className={'dm-item '+(item.id===selected?'active':'')} onClick={()=>onSelect(item.id)}><Avatar size="small" person={{name:item.name,avatars:profileImages({id:item.userId,avatar:item.avatar,discriminator:item.discriminator})}}/><span>{item.name}</span>{unread[item.id]>0&&<i className="red-badge" aria-label={`${unread[item.id]} unread messages`}>{unread[item.id]>99?'99+':unread[item.id]}</i>}</button>)}</div><p>Open a member profile to start a DM. Previous conversations appear here after you open them or receive a new message.</p></aside><section className="dm-main"><header className="topbar"><strong>{current?'@ '+current.name:'Direct Messages'}</strong></header>{current?<><div ref={scroll} onScroll={()=>{const node=scroll.current;scrollState.current.near=node.scrollHeight-node.scrollTop-node.clientHeight<80}} className="dm-messages" role="log" aria-label="Direct messages">{messages.map(message=><div className="message" key={message.id}><Avatar person={{name:message.author?.username,bot:message.author?.bot,avatars:profileImages(message.author)}}/><div className="message-body"><div className="message-meta"><strong>{message.author?.global_name||message.author?.username||'User'}</strong><time>{message.timestamp?new Date(message.timestamp).toLocaleString():''}</time></div><div className="message-content">{message.content || (message.attachments?.length?'📎 Attachment':'')}</div><MessageExtras key={message.id} message={message} channelId={selected} api={api} demo={demo} onError={setError}/></div></div>)}{!messages.length&&<p className="field-help">No messages to show.</p>}<div ref={end}/></div>{error&&<p className="error dm-error" role="alert">{error}</p>}<form className="dm-compose composer" onSubmit={send}><input aria-label="Direct message" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={2000} placeholder={`Message @${current.name}`}/><button type="submit" title="Send DM" disabled={busy||!draft.trim()}><Send size={19}/></button></form></>:<div className="dm-empty"><h2>Your direct messages</h2><p>Select a conversation or open a member’s profile to start one.</p></div>}</section></div>;
}
