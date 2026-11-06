export async function requestDiscord({path,method='GET',body,token}, fetchImpl=fetch) {
 const response=await fetchImpl('/api/discord',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,method,body,token})});
 const data=response.status===204?null:await response.json();
 if(!response.ok)throw new Error(data?.message||`Discord request failed (${response.status})`);
 return data;
}
