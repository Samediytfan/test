import React, { useEffect, useState } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { Smile } from 'lucide-react';

function safeUrl(value) {
 try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; }
 catch { return null; }
}
function EmbedImage({ image, className }) {
 const src = safeUrl(image?.proxy_url || image?.url);
 return src ? <img className={className} src={src} alt="" loading="lazy" referrerPolicy="no-referrer"/> : null;
}
function EmbedTextLink({ url, children, className }) {
 const href = safeUrl(url);
 return href ? <a className={className} href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span className={className}>{children}</span>;
}
function Embed({ embed }) {
 const color = Number.isInteger(embed.color) && embed.color >= 0 && embed.color <= 0xffffff ? `#${embed.color.toString(16).padStart(6, '0')}` : undefined;
 return <article className="message-embed" style={{ borderLeftColor: color }}>
  <div className="embed-inner">{embed.author?.name && <div className="embed-author"><EmbedImage image={{url:embed.author.icon_url,proxy_url:embed.author.proxy_icon_url}} className="embed-icon"/><EmbedTextLink url={embed.author.url}>{embed.author.name}</EmbedTextLink></div>}
   {embed.title && <strong className="embed-title"><EmbedTextLink url={embed.url}>{embed.title}</EmbedTextLink></strong>}
   {embed.description && <div className="embed-description">{embed.description}</div>}
   {embed.fields?.length > 0 && <div className="embed-fields">{embed.fields.map((field, i)=><div key={i} className={field.inline?'embed-field inline':'embed-field'}><strong>{field.name}</strong><div>{field.value}</div></div>)}</div>}
   <EmbedImage image={embed.image} className="embed-image"/>
   {embed.video?.url && <div><EmbedTextLink url={embed.url || embed.video.url}>Open video</EmbedTextLink></div>}
   {(embed.footer?.text || embed.timestamp) && <div className="embed-footer"><EmbedImage image={{url:embed.footer?.icon_url,proxy_url:embed.footer?.proxy_icon_url}} className="embed-icon"/>{embed.footer?.text}{embed.footer?.text && embed.timestamp && ' • '}{embed.timestamp && !Number.isNaN(Date.parse(embed.timestamp)) && new Date(embed.timestamp).toLocaleString()}</div>}
  </div><EmbedImage image={embed.thumbnail} className="embed-thumbnail"/>
 </article>;
}
const emojiKey = emoji => emoji?.id ? (/^\d{1,32}$/.test(emoji.id) ? `${emoji.name || '_'}:${emoji.id}` : null) : emoji?.name;

export default function MessageExtras({ message, channelId, api, demo, onError }) {
 const [reactions, setReactions] = useState(message.reactions || []);
 const [picker, setPicker] = useState(false), [busy, setBusy] = useState(false);
 useEffect(() => setReactions(message.reactions || []), [message.reactions]);
 const toggle = async emoji => {
  const key = emojiKey(emoji); if (!key || busy) return;
  const existing = reactions.find(r=>emojiKey(r.emoji) === key), remove = !!existing?.me;
  setBusy(true); setPicker(false);
  try {
   if (!demo) await api(`/channels/${channelId}/messages/${message.id}/reactions/${encodeURIComponent(key)}/@me`, remove ? 'DELETE' : 'PUT');
   setReactions(old => {
    const found=old.find(r=>emojiKey(r.emoji)===key);
    if (!found) return [...old,{emoji,count:1,me:true}];
    const count=Math.max(0,found.count+(remove?-1:1));
    return count ? old.map(r=>r===found?{...r,count,me:!remove}:r) : old.filter(r=>r!==found);
   });
  } catch (error) { onError(error.message); } finally { setBusy(false); }
 };
 return <>
  {message.embeds?.map((embed, i)=><Embed key={i} embed={embed}/>)}
  <div className="message-reaction-wrap"><div className="reactions">{reactions.filter(reaction=>emojiKey(reaction.emoji)).map(reaction=><button key={emojiKey(reaction.emoji)} className={reaction.me?'own-reaction':''} type="button" disabled={busy} aria-label={`${reaction.me?'Remove':'Add'} reaction ${reaction.emoji?.name || 'emoji'}`} title={reaction.emoji?.name || 'emoji'} onClick={()=>toggle(reaction.emoji)}>{reaction.emoji?.id?<img src={`https://cdn.discordapp.com/emojis/${reaction.emoji.id}.${reaction.emoji.animated?'gif':'png'}?size=48`} alt=""/>:reaction.emoji?.name} <b>{reaction.count}</b></button>)}<button type="button" title="Add reaction" aria-label="Add reaction" aria-expanded={picker} disabled={busy} onClick={()=>setPicker(value=>!value)}><Smile size={14}/></button></div>
   {picker && <div className="reaction-picker"><button type="button" className="secondary-button" onClick={()=>setPicker(false)}>Close emojis</button><EmojiPicker theme="dark" width="100%" height={360} onEmojiClick={item=>toggle({name:item.emoji,id:null})}/></div>}
  </div>
 </>;
}
