import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.102.0";
function secretKey(){const m=Deno.env.get("SUPABASE_SECRET_KEYS");if(m){try{return JSON.parse(m).default||""}catch{}}return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""}
const ok=(s="EVENT_RECEIVED")=>new Response(s,{status:200});
async function validSignature(req:Request,raw:string,secret:string|null){if(!secret)return true;const sig=req.headers.get("x-hub-signature-256")||"";if(!sig.startsWith("sha256="))return false;const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const buf=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(raw));const hex=[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");return sig===`sha256=${hex}`}
function parseMessage(m:any){const type=String(m?.type||"unknown");let body="";if(type==="text")body=m.text?.body||"";else if(type==="button")body=m.button?.text||m.button?.payload||"";else if(type==="interactive")body=m.interactive?.button_reply?.title||m.interactive?.list_reply?.title||"[interativo]";else if(type==="image")body=m.image?.caption||"[imagem]";else if(type==="video")body=m.video?.caption||"[vídeo]";else if(type==="audio")body="[áudio]";else if(type==="document")body=m.document?.caption||m.document?.filename||"[documento]";else if(type==="location")body=`[localização] ${m.location?.name||""}`.trim();else if(type==="contacts")body="[contato]";else if(type==="reaction")body=`[reação] ${m.reaction?.emoji||""}`;else body=`[${type}]`;const media=m[type]||{};return{type,body,mediaId:media?.id||null,mime:media?.mime_type||null,filename:media?.filename||null,reply:m.context?.id||null}}

Deno.serve(async req=>{
 const url=Deno.env.get("SUPABASE_URL")||"",sk=secretKey();if(!url||!sk)return new Response("Backend incomplete",{status:500});
 const admin=createClient(url,sk,{auth:{persistSession:false,autoRefreshToken:false}});
 if(req.method==="GET"){
  const u=new URL(req.url),mode=u.searchParams.get("hub.mode"),verify=u.searchParams.get("hub.verify_token"),challenge=u.searchParams.get("hub.challenge");
  const {data:expected}=await admin.rpc("get_whatsapp_webhook_verify_token");
  if(mode==="subscribe"&&verify&&expected&&verify===expected)return new Response(challenge||"",{status:200});
  return new Response("Forbidden",{status:403});
 }
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 const raw=await req.text(); const {data:appSecret}=await admin.rpc("get_whatsapp_meta_app_secret"); if(!(await validSignature(req,raw,appSecret||null)))return new Response("Invalid signature",{status:401});
 let payload:any;try{payload=JSON.parse(raw)}catch{return new Response("Bad request",{status:400})}
 try{
  for(const entry of payload.entry||[])for(const change of entry.changes||[]){if(change.field!=="messages")continue;const v=change.value||{},phoneId=String(v.metadata?.phone_number_id||"");if(!phoneId)continue;
   const {data:conn}=await admin.from("whatsapp_connections").select("studio_id,id").eq("phone_number_id",phoneId).eq("status","connected").maybeSingle();if(!conn)continue;const sid=conn.studio_id;
   await admin.from("whatsapp_connections").update({last_webhook_at:new Date().toISOString()}).eq("id",conn.id);
   for(const st of v.statuses||[]){const mapped=String(st.status||"");await admin.from("whatsapp_messages").update({status:mapped,error_message:st.errors?.[0]?.title||null,raw:st}).eq("provider_message_id",st.id);}
   for(const m of v.messages||[]){const waId=String(m.from||"");if(!waId)continue;const profile=(v.contacts||[]).find((c:any)=>String(c.wa_id)===waId)?.profile?.name||null;
    const digits=waId.replace(/\D/g,"");let clientId:null|string=null;
    const {data:clients}=await admin.from("clients").select("id,whatsapp").eq("studio_id",sid).not("whatsapp","is",null);
    const match=(clients||[]).find((c:any)=>{const d=String(c.whatsapp||"").replace(/\D/g,"");return d&&((digits.endsWith(d))||(d.endsWith(digits.slice(-11))))});if(match)clientId=match.id;
    const {data:contact,error:ce}=await admin.from("whatsapp_contacts").upsert({studio_id:sid,wa_id:waId,phone:waId,profile_name:profile,client_id:clientId,last_seen_at:new Date().toISOString()},{onConflict:"studio_id,wa_id"}).select("id,client_id").single();if(ce)throw ce;
    const parsed=parseMessage(m),at=m.timestamp?new Date(Number(m.timestamp)*1000).toISOString():new Date().toISOString();
    let {data:conv}=await admin.from("whatsapp_conversations").select("id,unread_count").eq("studio_id",sid).eq("contact_id",contact.id).maybeSingle();
    if(!conv){const r=await admin.from("whatsapp_conversations").insert({studio_id:sid,contact_id:contact.id,unread_count:1,last_message_at:at,last_customer_message_at:at,last_message_preview:parsed.body}).select("id,unread_count").single();if(r.error)throw r.error;conv=r.data}else await admin.from("whatsapp_conversations").update({unread_count:Number(conv.unread_count||0)+1,last_message_at:at,last_customer_message_at:at,last_message_preview:parsed.body,status:"open"}).eq("id",conv.id);
    const {error:me}=await admin.from("whatsapp_messages").upsert({studio_id:sid,conversation_id:conv.id,contact_id:contact.id,provider_message_id:m.id,direction:"inbound",message_type:parsed.type,body:parsed.body,status:"received",reply_to_provider_message_id:parsed.reply,media_id:parsed.mediaId,media_mime_type:parsed.mime,media_filename:parsed.filename,raw:m,message_at:at},{onConflict:"provider_message_id"});if(me)throw me;
   }
  }
  return ok();
 }catch(e){console.error("whatsapp-webhook",e);return ok()}
});
