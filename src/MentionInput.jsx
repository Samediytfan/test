import React, { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
const serialize = node => node.nodeType === 3 ? node.textContent : node.dataset?.mention || [...node.childNodes].map(serialize).join('');
export default forwardRef(function MentionInput({value,members,roles,onChange,onSelect,onKeyDown,disabled,...props},ref){
 const root=useRef(null);
 const offset=()=>{const selection=window.getSelection();if(!selection?.rangeCount||!root.current.contains(selection.anchorNode))return value.length;const range=selection.getRangeAt(0).cloneRange();range.selectNodeContents(root.current);range.setEnd(selection.focusNode,selection.focusOffset);return serialize(range.cloneContents()).length};
 useImperativeHandle(ref,()=>({focus:()=>root.current.focus(),get selectionStart(){return offset()},setSelectionRange:(start,end=start)=>{
   const locate=position=>{let remaining=position;for(const node of root.current.childNodes){const length=node.dataset?.mention?.length??node.textContent.length;if(remaining<=length){if(node.nodeType===3)return [node,remaining];const index=[...root.current.childNodes].indexOf(node);return [root.current,index+(remaining?1:0)]}remaining-=length}return [root.current,root.current.childNodes.length]};
   const range=document.createRange();range.setStart(...locate(start));range.setEnd(...locate(end));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range)
  }}));
 useLayoutEffect(()=>{
  if(serialize(root.current)===value&&root.current.dataset.ready)return;
  root.current.replaceChildren();
  for(const part of value.split(/(<@!?\d+>|<@&\d+>)/g)){
   if(/^<@/.test(part)){const role=part.startsWith('<@&');const id=part.replace(/\D/g,'');const name=(role?roles:members).find(x=>x.id===id)?.name||(role?'role':'user');const chip=document.createElement('span');chip.contentEditable='false';chip.className='mention-text';chip.dataset.mention=part;chip.textContent='@'+name;root.current.append(chip)}else root.current.append(document.createTextNode(part));
  }
  root.current.dataset.ready='true';
 },[value,members,roles]);
 const removeMention=e=>{
  if(!['Backspace','Delete'].includes(e.key)||e.defaultPrevented)return;
  const selection=window.getSelection();if(!selection?.isCollapsed||!selection.rangeCount)return;
  const range=selection.getRangeAt(0);if(!root.current.contains(range.startContainer))return;
  const before=range.cloneRange();before.selectNodeContents(root.current);before.setEnd(range.startContainer,range.startOffset);
  const pos=serialize(before.cloneContents()).length;
  const matches=[...value.matchAll(/<@!?\d+>|<@&\d+>/g)];
  const match=matches.find(m=>e.key==='Backspace'?m.index+m[0].length===pos:m.index===pos);
  if(!match)return;e.preventDefault();const next=value.slice(0,match.index)+value.slice(match.index+match[0].length);
  onChange({target:{value:next,selectionStart:match.index}});
  requestAnimationFrame(()=>{const walk=document.createTreeWalker(root.current,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT,{acceptNode:n=>n.nodeType===3||n.dataset?.mention?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP});let remaining=match.index,node;while(node=walk.nextNode()){const length=node.dataset?.mention?.length??node.textContent.length;if(remaining<=length&&node.nodeType===3){const caret=document.createRange();caret.setStart(node,remaining);caret.collapse(true);selection.removeAllRanges();selection.addRange(caret);break}remaining-=length}});
 };
 const select=()=>onSelect?.({target:{selectionStart:offset()}});
 return <div {...props} ref={root} role="textbox" aria-multiline="false" aria-disabled={disabled} contentEditable={!disabled} suppressContentEditableWarning className="message-editor" data-placeholder={props.placeholder} onInput={()=>onChange({target:{value:serialize(root.current),selectionStart:offset()}})} onKeyUp={select} onMouseUp={select} onKeyDown={e=>{onKeyDown(e);removeMention(e);if(e.key==='Enter'&&!e.defaultPrevented&&!e.nativeEvent.isComposing){e.preventDefault();root.current.closest('form').requestSubmit()}}} onPaste={e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain').replace(/\r?\n/g,' '))}}/>;
});
