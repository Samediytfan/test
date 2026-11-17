export async function requestDiscord({path,method='GET',body,token}, fetchImpl=fetch) {
 const response=await fetchImpl('/api/discord',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,method,body,token})});
 let data=null;
 if(response.status!==204)try{data=await response.json()}catch(error){if(response.ok)throw error}
 if(!response.ok)throw new Error(data?.message||`Discord request failed (${response.status})`);
 return data;
}
