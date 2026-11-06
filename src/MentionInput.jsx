import React, { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
const serialize = node => node.nodeType === 3 ? node.textContent : node.dataset?.mention || [...node.childNodes].map(serialize).join('');
export default forwardRef(function MentionInput({value,members,roles,onChange,onSelect,onKeyDown,disabled,...props},ref){
 const root=useRef(null);
 const offset=()=>{const selection=window.getSelection();if(!selection?.rangeCount||!root.current.contains(selection.anchorNode))return value.length;const range=selection.getRangeAt(0).cloneRange();range.selectNodeContents(root.current);range.setEnd(selection.focusNode,selection.focusOffset);return serialize(range.cloneContents()).length};
 useImperativeHandle(ref,()=>({focus:()=>root.current.focus(),get selectionStart(){return offset()},setSelectionRange:()=>{const range=document.createRange();range.selectNodeContents(root.current);range.collapse(false);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range)}}));
 useLayoutEffect(()=>{
  if(serialize(root.current)===value&&root.current.dataset.ready)return;
  root.current.replaceChildren();
  for(const part of value.split(/(<@!?\d+>|<@&\d+>)/g)){
   if(/^<@/.test(part)){const role=part.startsWith('<@&');const id=part.replace(/\D/g,'');const name=(role?roles:members).find(x=>x.id===id)?.name||(role?'role':'user');const chip=document.createElement('span');chip.contentEditable='false';chip.className='mention-text';chip.dataset.mention=part;chip.textContent='@'+name;root.current.append(chip)}else root.current.append(document.createTextNode(part));
  }
  root.current.dataset.ready='true';
 },[value,members,roles]);
 const select=()=>onSelect?.({target:{selectionStart:offset()}});
 return <div {...props} ref={root} role="textbox" aria-multiline="false" aria-disabled={disabled} contentEditable={!disabled} suppressContentEditableWarning className="message-editor" data-placeholder={props.placeholder} onInput={()=>onChange({target:{value:serialize(root.current),selectionStart:offset()}})} onKeyUp={select} onMouseUp={select} onKeyDown={e=>{onKeyDown(e);if(e.key==='Enter'&&!e.defaultPrevented&&!e.nativeEvent.isComposing){e.preventDefault();root.current.closest('form').requestSubmit()}}} onPaste={e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain').replace(/\r?\n/g,' '))}}/>;
});
