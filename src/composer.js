export function mentionTrigger(text, cursor=text.length) {
  const match=text.slice(0,cursor).match(/(?:^|\s)@([^@\s]*)$/);
  return match?{start:cursor-match[1].length-1,query:match[1]}:null;
}
export function replaceMention(text,cursor,start,mention) {
  const rest=text.slice(cursor).replace(/^[^\s]*/, '');
  return text.slice(0,start)+mention+' '+rest.replace(/^ /,'');
}
export function flattenCommands(commands) {
  const results=[];
  const visit=(command,path,id)=>{
    const children=(command.options||[]).filter(o=>o.type===1||o.type===2);
    if(children.length)children.forEach(child=>visit(child,path+' '+child.name,id));
    else results.push({id:id+'-'+path,name:path,description:command.description||'',options:command.options||[],kind:'slash'});
  };
  commands.filter(c=>!c.type||c.type===1).forEach(c=>visit(c,c.name,c.id));return results;
}
export function validShortcut(value) {
 return typeof value?.name==='string'&&/^[a-zA-Z0-9_-]{1,32}$/.test(value.name)&&typeof value.text==='string'&&value.text.length<=2000&&/^[^\w\s/]/.test(value.text)&&!/[\r\n]/.test(value.text);
}
