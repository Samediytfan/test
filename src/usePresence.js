import { useEffect, useState, useRef } from 'react';
export default function usePresence(token, enabled, guildId, memberIds=[], presenceEnabled=true, onEvent, onMemberUpdate) {
 const socketRef=useRef(null);
 const callback=useRef(onEvent);callback.current=onEvent;
 const memberCallback=useRef(onMemberUpdate);memberCallback.current=onMemberUpdate;
 const [state,setState]=useState({members:{},message:''});
 useEffect(()=>{
  setState({members:{},message:''});if(!token||!enabled)return;
  let stopped=false,socket,heartbeat,retry,seq=null,ack=true,attempts=0,requestPresence=presenceEnabled;
  const clear=()=>{clearTimeout(heartbeat);clearTimeout(retry)};
  const connect=()=>{
   if(stopped)return;
   setState({members:{},message:'Connecting live status…'});
   socket=socketRef.current=new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
   const send=(op,d)=>{if(socket.readyState===1)socket.send(JSON.stringify({op,d}))};
   const beat=interval=>{if(!ack){socket.close(4000,'Heartbeat timeout');return}ack=false;send(1,seq);heartbeat=setTimeout(()=>beat(interval),interval)};
   socket.onmessage=event=>{
    if(stopped)return;let packet;try{packet=JSON.parse(event.data)}catch{return}
    if(packet.s!==null&&packet.s!==undefined)seq=packet.s;
    if(packet.op===10){ack=true;heartbeat=setTimeout(()=>beat(packet.d.heartbeat_interval),Math.random()*packet.d.heartbeat_interval);send(2,{token,intents:4609+(requestPresence?256:0),properties:{os:'browser',browser:'Relay',device:'Relay'}})}
    if(packet.op===11)ack=true;
    if(packet.op===1)send(1,seq);
    if(packet.op===7||packet.op===9)socket.close(4000,'Reconnect requested');
    if(packet.t==='READY'){attempts=0;setState({members:{},message:requestPresence?'Live status connected':presenceEnabled?'Notifications connected; enable Presence Intent for member status.':'Notifications connected; live status disabled.'})}
    if(packet.t==='GUILD_MEMBER_UPDATE')memberCallback.current?.(packet.d);
    if(packet.t==='MESSAGE_CREATE')callback.current?.(packet.d);
    if(packet.t==='GUILD_CREATE'||packet.t==='GUILD_MEMBERS_CHUNK'||packet.t==='PRESENCE_UPDATE'){
     const guildId=packet.t==='GUILD_CREATE'?packet.d.id:packet.d.guild_id;
     const updates=packet.t==='PRESENCE_UPDATE'?[packet.d]:packet.d.presences||[];
     setState(old=>{const members={...old.members};for(const p of updates)if(p.user?.id&&['online','idle','dnd','offline'].includes(p.status))members[`${guildId}:${p.user.id}`]=p.status;return {...old,members}});
    }
   };
   socket.onclose=event=>{
    clear();if(stopped)return;
    if(event.code===4014&&requestPresence){requestPresence=false;setState({members:{},message:'Presence Intent unavailable; reconnecting notifications…'});retry=setTimeout(connect,1000);return}
    const fatal=[4004,4010,4011,4012,4013,4014].includes(event.code);
    setState({members:{},message:event.code===4014?'Enable Presence Intent in your bot’s Discord Developer Portal, then reconnect live status.':fatal?'Discord rejected live status. Check the bot configuration.':'Live status disconnected; statuses are unknown.'});
    if(!fatal&&attempts<3)retry=setTimeout(connect,5000*2**attempts++);
   };
  };
  connect();return()=>{stopped=true;clear();socket?.close(1000,'Status disabled')};
 },[token,enabled,presenceEnabled]);
 const idsKey=memberIds.join(',');
 useEffect(()=>{if(!enabled||!guildId||state.message!=='Live status connected')return;const ids=idsKey.split(',').filter(id=>/^\d+$/.test(id));const timers=[];for(let i=0;i<ids.length;i+=100)timers.push(setTimeout(()=>{if(socketRef.current?.readyState===1)socketRef.current.send(JSON.stringify({op:8,d:{guild_id:guildId,user_ids:ids.slice(i,i+100),presences:true}}))},i*10));return()=>timers.forEach(clearTimeout)},[enabled,guildId,idsKey,state.message]);
 return state;
}
