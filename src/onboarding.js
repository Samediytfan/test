// Preserve IDs and option mappings while translating Discord's response emoji shape for writes.
export function onboardingPayload(value) {
  return {enabled:Boolean(value.enabled),mode:Number(value.mode||0),default_channel_ids:[...(value.default_channel_ids||[])],prompts:(value.prompts||[]).map(p=>({id:p.id,type:p.type??0,title:p.title,single_select:Boolean(p.single_select),required:Boolean(p.required),in_onboarding:Boolean(p.in_onboarding),options:p.options.map(o=>({id:o.id,title:o.title,description:o.description||'',channel_ids:[...(o.channel_ids||[])],role_ids:[...(o.role_ids||[])],emoji_id:Object.hasOwn(o,'emoji_id')?o.emoji_id:o.emoji?.id??null,emoji_name:Object.hasOwn(o,'emoji_name')?o.emoji_name:o.emoji?.name??null,emoji_animated:o.emoji_animated??o.emoji?.animated??false}))}))};
}
export function validateOnboarding(value) {
  if(![0,1].includes(Number(value.mode)))return 'Choose a valid onboarding mode.';
  if(value.enabled&&Number(value.mode)===0&&value.default_channel_ids.length<7)return 'Default mode requires at least 7 default channels. At least 5 must allow @everyone to send messages.';
  if(value.prompts.some(p=>!p.title.trim()||!p.options.length||p.options.some(o=>!o.title.trim())))return 'Every question needs a title and at least one answer with a title.';
  return '';
}
