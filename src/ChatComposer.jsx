import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, AtSign, Smile, Send, Shield, Hash, ArrowUpRight } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import MentionInput from './MentionInput.jsx';
import { mentionTrigger, replaceMention } from './composer.js';
export default function ChatComposer({draft,setDraft,channel,guild,bot,members,roles,commands,shortcuts,onSend,onLoadCommands,onMemberQuery,onSettings,onMentionSelected,commandError,demo}) {
 const [emojiOpen,setEmojiOpen]=useState(false);
 const input=useRef(null),[cursor,setCursor]=useState(0),[active,setActive]=useState(0),[dismissed,setDismissed]=useState(false),[remote,setRemote]=useState([]),[searchError,setSearchError]=useState(''),[notice,setNotice]=useState(''),[slashSelected,setSlashSelected]=useState(false);
 const trigger=mentionTrigger(draft,cursor),slash=draft.startsWith('/');
 const query=trigger?.query??'';
 useEffect(()=>{setActive(0);setDismissed(false);setNotice('')},[draft,cursor]);
 useEffect(()=>{if(slash)onLoadCommands()},[slash,guild?.id]);
 useEffect(()=>{setSlashSelected(false);setDismissed(true);setRemote([])},[channel?.id,guild?.id]);
 useEffect(()=>{let valid=true;setRemote([]);setSearchError('');if(!trigger||!query||demo)return;const timer=setTimeout(()=>{onMemberQuery(query).then(list=>{if(valid)setRemote(list)}).catch(()=>{if(valid)setSearchError('Discord member search is unavailable. Suggestions show the members already loaded.')})},250);return()=>{valid=false;clearTimeout(timer)}},[query,Boolean(trigger),guild?.id,demo]);
 const results=useMemo(()=>{
  if(trigger){const users=[...new Map([...members,...remote].map(m=>[m.id,m])).values()];return [...users.map(m=>({...m,kind:'user'})),...roles.filter(r=>r.id!==guild?.id).map(r=>({...r,kind:'role'}))].filter(x=>x.name.toLowerCase().includes(query.toLowerCase())).slice(0,30)}
  const aliasQuery=draft.startsWith('/')?draft.slice(1).toLowerCase():null;
  if(aliasQuery!==null)return [...commands,...shortcuts.map(s=>({...s,id:'prefix-'+s.name,kind:'prefix'}))].filter(c=>c.name.toLowerCase().startsWith(aliasQuery)).slice(0,20);
  if(draft&&/^\S+$/.test(draft))return shortcuts.filter(s=>s.text.toLowerCase().startsWith(draft.toLowerCase())).map(s=>({...s,id:'prefix-'+s.name,kind:'prefix'}));return [];
 },[draft,cursor,commands,shortcuts,members,remote,roles,guild?.id]);
 const hasChosenName=commands.some(c=>draft.startsWith('/'+c.name+' '));
 const visible=!dismissed&&Boolean(trigger||(!slashSelected&&!hasChosenName&&(slash||results.length)));
 const change=text=>{setDraft(text);setCursor(text.length);setSlashSelected(false);requestAnimationFrame(()=>{input.current?.focus();input.current?.setSelectionRange(text.length,text.length)})};
 const choose=item=>{
  if(item.kind==='user'||item.kind==='role'){if(item.kind==='user')onMentionSelected?.(item);change(replaceMention(draft,cursor,trigger.start,demo?'@'+item.name:item.kind==='role'?`<@&${item.id}>`:`<@${item.id}>`))}
  else if(item.kind==='prefix')change(item.text+' ');
  else {change('/'+item.name+' ');setSlashSelected(true)}
  setDismissed(true);
 };
 const submit=e=>{e.preventDefault();if(draft.trim().startsWith('/')){setSlashSelected(true);setDismissed(true);setNotice('Run this slash command in Discord. A bot token cannot invoke it here.');return}onSend(e);setCursor(0);setSlashSelected(false)};
 const keydown=e=>{
  if(e.key==='Escape'){setDismissed(true);return}
  if(visible&&results.length){if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setActive(i=>(i+(e.key==='ArrowDown'?1:-1)+results.length)%results.length)}else if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();choose(results[Math.min(active,results.length-1)])}}
 };
 return <div className="composer-wrap">{emojiOpen&&<div className="emoji-popover"><button className="secondary-button" onClick={()=>setEmojiOpen(false)}>Close emojis</button><EmojiPicker theme="dark" width="100%" height={400} onEmojiClick={emoji=>{change(draft.slice(0,cursor)+emoji.emoji+draft.slice(cursor));setEmojiOpen(false)}}/></div>}{visible&&<div className="composer-suggestions" role="listbox" aria-label={trigger?'Mention suggestions':'Command suggestions'}><div className="picker-title">{trigger?'USERS & ROLES':'COMMANDS'}<button onMouseDown={e=>e.preventDefault()} onClick={onSettings}>Manage commands</button></div>{results.map((item,i)=><button key={item.kind+item.id} role="option" aria-selected={i===active} className={i===active?'highlighted':''} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(item)}>{item.kind==='role'?<Shield size={16}/>:item.kind==='user'?<AtSign size={16}/>:<Hash size={16}/>}<span><strong>{item.kind==='slash'||item.kind==='prefix'?'/':'@'}{item.name}</strong>{item.description&&<small>{item.description}</small>}</span><em>{item.kind==='slash'?'in Discord':item.kind==='prefix'?'prefix shortcut':item.kind}</em></button>)}{!results.length&&<p>{trigger?'No matching members or roles.':commandError||'No matching commands. Add a prefix shortcut in Manage commands.'}</p>}{searchError&&<p>{searchError}</p>}<div className="suggestion-hint">↑ ↓ to navigate · Enter or Tab to select · Esc to close</div></div>}
 {slashSelected&&<div className="slash-help"><span>{notice||'Slash commands must be run by a user in Discord.'}</span><div><button onClick={async()=>{try{await navigator.clipboard.writeText(draft.trim());setNotice('Command copied. Paste it into Discord and choose its native command.')}catch{setNotice('Select and copy the command text, then open Discord.')}}}>Copy command</button>{!demo&&guild&&channel&&<a href={`https://discord.com/channels/${guild.id}/${channel.id}`} target="_blank" rel="noreferrer">Open Discord <ArrowUpRight size={12}/></a>}</div></div>}
 <form className="composer" onSubmit={submit}><MentionInput members={[...members,...remote]} roles={roles} ref={input} aria-label={`Message #${channel?.name||'channel'}`} value={draft} disabled={!channel||![0,5].includes(channel.type)} onChange={e=>{setDraft(e.target.value);setCursor(e.target.selectionStart);setSlashSelected(false)}} onSelect={e=>setCursor(e.target.selectionStart)} onKeyDown={keydown} placeholder={`Message #${channel?.name||'channel'}`} autoComplete="off"/><div className="compose-tools"><button type="button" title="Suggest commands" className="slash-button" onClick={()=>change('/')}>/</button><button type="button" title="Emoji" aria-expanded={emojiOpen} onClick={()=>setEmojiOpen(open=>!open)}><Smile size={20}/></button><button type="submit" title="Send message" className="send-button"><Send size={19}/></button></div></form><div className="compose-hint">Messaging as <strong>{bot.name}</strong> <span>•</span> Type <b>@</b> to mention · <b>/</b> for commands</div></div>;
}
