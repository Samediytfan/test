import React, { useEffect, useState, useRef } from 'react';
import PermissionEditor from './PermissionEditor.jsx';
const defaults={name:'New role',permissions:'0',color:0,hoist:false,mentionable:false,unicode_emoji:null};
export default function RoleManager({guildId,roles,setRoles,members,setMembers,demo,api,onNotify}) {
  const [selectedId,setSelectedId]=useState(roles.find(r=>r.id!==guildId)?.id||guildId),[draft,setDraft]=useState(defaults),[memberId,setMemberId]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const dirty=useRef(false),saveRef=useRef(null),mounted=useRef(true),queue=useRef(Promise.resolve()),revision=useRef(0),latest=useRef(null),creating=useRef(false);
  const [saving,setSaving]=useState(0);
  const edit=value=>{dirty.current=true;revision.current++;setDraft(value)};
  const selected=roles.find(r=>r.id===selectedId),everyone=selectedId===guildId,managed=Boolean(selected?.managed);
  latest.current={id:selectedId,draft,selected,revision:revision.current};
  useEffect(()=>{dirty.current=false;revision.current++;setDraft(selected?{...defaults,...selected,color:selected.colors?.primary_color??selected.color??0}:{...defaults});setError('');setNotice('');},[selectedId]);
  const choose=id=>{saveRef.current?.();dirty.current=false;setSelectedId(id)};
  const run=async fn=>{const id=selectedId,name=selected?.name||draft.name;setBusy(true);setError('');setNotice('');try{await fn()}catch(e){if(mounted.current)setError({id,message:e.message});else onNotify?.(`${name}: ${e.message}`)}finally{if(mounted.current)setBusy(false)}};
  const enqueue=job=>{
    if(!job.selected){if(creating.current)return queue.current;creating.current=true;}
    if(mounted.current)setSaving(n=>n+1);
    queue.current=queue.current.catch(()=>{}).then(async()=>{
      const {id,draft:value,selected:roleBefore}=job,all=id===guildId;
      try {
        const body=all?{permissions:value.permissions}:{name:value.name.trim(),permissions:value.permissions,hoist:value.hoist,mentionable:value.mentionable};
        if(!all&&(!body.name||body.name.length>100))throw new Error('Role names must have 1–100 characters.');
        if(!all&&(!roleBefore||value.color!==(roleBefore.colors?.primary_color??roleBefore.color??0)))body.colors={...(roleBefore?.colors||{secondary_color:null,tertiary_color:null}),primary_color:value.color};
        if(!all&&value.unicode_emoji!==roleBefore?.unicode_emoji)body.unicode_emoji=value.unicode_emoji||null;
        const role=demo?{...value,...body,id:roleBefore?.id||String(Date.now()),position:roleBefore?.position??roles.length}:await api(`/guilds/${guildId}/roles${roleBefore?'/'+roleBefore.id:''}`,roleBefore?'PATCH':'POST',body);
        setRoles(prev=>roleBefore?prev.map(r=>r.id===role.id?role:r):[...prev,role]);
        if(mounted.current){
          setError(old=>old?.job===job?'':old);
          if(latest.current.id===id&&revision.current===job.revision){setDraft({...defaults,...role,color:role.colors?.primary_color??role.color??0});setNotice({id,message:'Role saved.'});if(!roleBefore)setSelectedId(role.id)}
        }
      }catch(e){if(mounted.current)setError({id,message:`${value.name}: ${e.message}`,job});else onNotify?.(`${value.name}: ${e.message}`)}
      finally{if(!roleBefore)creating.current=false;if(mounted.current)setSaving(n=>n-1)}
    });
    return queue.current;
  };
  const save=e=>{e?.preventDefault();if(managed)return;dirty.current=false;setError('');setNotice('');return enqueue({...latest.current,draft:{...draft}})};
  saveRef.current=()=>{if(dirty.current&&selected&&!managed)save()};
  useEffect(()=>{if(!dirty.current||!selected||managed)return;const timer=setTimeout(()=>saveRef.current(),600);return()=>clearTimeout(timer)},[draft,selected,managed]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;saveRef.current?.()}},[]);
  const remove=()=>{if(!selected||!window.confirm(`Permanently delete the ${selected.name} role?`))return;run(async()=>{if(!demo)await api(`/guilds/${guildId}/roles/${selected.id}`,'DELETE');setRoles(prev=>prev.filter(r=>r.id!==selected.id));setSelectedId(guildId)})};
  const move=direction=>run(async()=>{
    const ordered=[...roles].sort((a,b)=>(b.position||0)-(a.position||0));const index=ordered.findIndex(r=>r.id===selectedId),other=ordered[index+direction];
    if(!other||other.id===guildId)throw new Error('This role cannot move further in that direction.');
    [ordered[index],ordered[index+direction]]=[ordered[index+direction],ordered[index]];
    const positions=ordered.map((r,i)=>({id:r.id,position:ordered.length-1-i}));
    if(demo)setRoles(prev=>prev.map(r=>({...r,position:positions.find(p=>p.id===r.id).position})));else setRoles(await api(`/guilds/${guildId}/roles`,'PATCH',[{id:selectedId,position:other.position}]));
    setNotice({id:selectedId,message:'Role order updated.'});
  });
  const assign=add=>run(async()=>{
    if(!memberId||(!demo&&!/^\d+$/.test(memberId)))throw new Error('Select a member or enter their Discord ID.');
    if(!demo)await api(`/guilds/${guildId}/members/${memberId}/roles/${selectedId}`,add?'PUT':'DELETE');
    setMembers(prev=>prev.map(m=>m.id!==memberId?m:{...m,roles:add?[...new Set([...(m.roles||[]),selectedId])]:(m.roles||[]).filter(id=>id!==selectedId)}));
    setNotice({id:selectedId,message:add?'Role assigned to member.':'Role removed from member.'});
  });
  return <><h2>Server roles</h2><p className="modal-sub">Manage appearance, permissions, order, and members. Discord restricts bots to roles below their highest role; integration-managed roles cannot be edited here.</p><div className="role-layout"><nav className="role-navigation">{[...roles].sort((a,b)=>(b.position||0)-(a.position||0)).map(r=><button key={r.id} className={selectedId===r.id?'selected':''} onClick={()=>choose(r.id)}><i style={{background:`#${(r.colors?.primary_color||r.color||0x99aab5).toString(16).padStart(6,'0')}`}}/>{r.name}{r.managed?' 🔒':''}</button>)}<button onClick={()=>choose('new')}>＋ Create role</button></nav><div className="role-detail"><form onSubmit={save}><label>ROLE NAME</label><input className="modal-input" aria-label="Role name" value={draft.name} disabled={managed||everyone} maxLength={100} onChange={e=>edit({...draft,name:e.target.value})}/><div className="role-properties"><label>COLOR <input aria-label="Role color" type="color" disabled={managed||everyone} value={`#${draft.color.toString(16).padStart(6,'0')}`} onChange={e=>edit({...draft,color:parseInt(e.target.value.slice(1),16)})}/></label><button type="button" className="secondary-button" disabled={managed||everyone} onClick={()=>edit({...draft,color:0})}>Reset color</button></div><label>ROLE EMOJI (REQUIRES ROLE ICONS)</label><input className="modal-input" aria-label="Role emoji" disabled={managed||everyone} value={draft.unicode_emoji||''} onChange={e=>edit({...draft,unicode_emoji:e.target.value||null})}/><label className="check-row"><input type="checkbox" disabled={managed||everyone} checked={draft.hoist} onChange={e=>edit({...draft,hoist:e.target.checked})}/>Display members separately</label><label className="check-row"><input type="checkbox" disabled={managed||everyone} checked={draft.mentionable} onChange={e=>edit({...draft,mentionable:e.target.checked})}/>Allow everyone to mention this role</label><h3>Permissions</h3><PermissionEditor value={draft.permissions} disabled={managed} onChange={permissions=>edit({...draft,permissions})}/>{!selected&&<button className="primary-button" disabled={busy}>Create role</button>}{selected&&<p className="field-help" role="status">{saving?'Saving…':'Edits save automatically.'}</p>}</form>{selected&&!everyone&&<><div className="settings-actions"><button className="secondary-button" disabled={managed||busy} onClick={()=>move(-1)}>Move up</button><button className="secondary-button" disabled={managed||busy} onClick={()=>move(1)}>Move down</button><button className="danger-button" disabled={managed||busy} onClick={remove}>Delete role</button></div><h3>Role members</h3><select className="modal-input" aria-label="Role member" value={memberId} onChange={e=>setMemberId(e.target.value)}><option value="">Choose a member</option>{members.map(m=><option value={m.id} key={m.id}>{m.name}{m.roles?.includes(selectedId)?' — has role':''}</option>)}{memberId&&!members.some(m=>m.id===memberId)&&<option value={memberId}>{memberId}</option>}</select><input className="modal-input member-id-input" aria-label="Role member ID" placeholder="Or enter member ID" value={memberId} onChange={e=>setMemberId(e.target.value.replace(/\D/g,''))}/><div className="settings-actions"><button className="secondary-button" disabled={managed||busy} onClick={()=>assign(true)}>Assign role</button><button className="secondary-button" disabled={managed||busy} onClick={()=>assign(false)}>Remove role</button></div></>}{error&&<p className="error" role="alert">{error.message} {error.job&&<button className="secondary-button" disabled={busy} onClick={()=>{const job=error.job;setError('');enqueue(job)}}>Retry save</button>}</p>}{notice?.id===selectedId&&<p className="vault-notice" role="status">{notice.message}</p>}</div></div></>;
}
