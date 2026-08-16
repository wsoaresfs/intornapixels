import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.102.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
function secretKey(){const m=Deno.env.get("SUPABASE_SECRET_KEYS");if(m){try{return JSON.parse(m).default||""}catch{}}return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""}

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,""); if(!token)return json({error:"Sessão ausente."},401);
  const url=Deno.env.get("SUPABASE_URL")||"", sk=secretKey(); if(!url||!sk)return json({error:"Backend incompleto."},500);
  const admin=createClient(url,sk,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:ue}=await admin.auth.getUser(token); if(ue||!user)return json({error:"Sessão inválida."},401);
  const body=await req.json(); const studioId=String(body.studioId||""); const action=String(body.action||"connect");
  if(!studioId)return json({error:"Estúdio obrigatório."},400);
  const {data:pa}=await admin.from("platform_admins").select("user_id").eq("user_id",user.id).maybeSingle();
  const {data:member}=await admin.from("studio_members").select("role,active").eq("studio_id",studioId).eq("user_id",user.id).eq("active",true).maybeSingle();
  if(!pa && !member?.active)return json({error:"Sem acesso a este estúdio."},403);
  if(!pa && !["owner","admin"].includes(member?.role||""))return json({error:"Somente proprietário/administrador pode configurar o WhatsApp."},403);

  if(action==="save_platform_config"){
   if(!pa)return json({error:"Somente o administrador da plataforma pode configurar o aplicativo Meta."},403);
   const appId=String(body.appId||"").trim(),appSecret=String(body.appSecret||"").trim(),graphVersion=String(body.graphVersion||"v23.0").trim();
   const {error:pe}=await admin.rpc("set_whatsapp_meta_platform",{p_app_id:appId,p_app_secret:appSecret,p_graph_version:graphVersion}); if(pe)throw pe;
   return json({ok:true});
  }
  if(action==="webhook_info"){
   if(!pa)return json({error:"Somente o administrador da plataforma pode ver a configuração global do webhook."},403);
   const [{data:verifyToken,error:ve},{data:pc}]=await Promise.all([admin.rpc("get_whatsapp_webhook_verify_token"),admin.from("whatsapp_platform_config").select("meta_app_id,graph_version,meta_app_secret_id").eq("id",1).single()]); if(ve)throw ve;
   return json({ok:true,callbackUrl:`${url}/functions/v1/whatsapp-webhook`,verifyToken,graphVersion:pc?.graph_version||"v23.0",appId:pc?.meta_app_id||"",appSecretConfigured:!!pc?.meta_app_secret_id});
  }
  if(action==="status"){
   const {data}=await admin.from("whatsapp_connections").select("id,status,waba_id,phone_number_id,display_phone_number,business_name,connected_at,last_webhook_at,last_error,metadata").eq("studio_id",studioId).maybeSingle();
   return json({ok:true,connection:data||null});
  }
  if(action==="disconnect"){
   await admin.from("whatsapp_connections").update({status:"disconnected",last_error:null}).eq("studio_id",studioId);
   return json({ok:true});
  }

  const accessToken=String(body.accessToken||"").trim(), phoneNumberId=String(body.phoneNumberId||"").trim(), wabaId=String(body.wabaId||"").trim();
  if(!accessToken||!phoneNumberId||!wabaId)return json({error:"Informe WABA ID, Phone Number ID e Access Token."},400);
  const {data:gvData}=await admin.rpc("get_whatsapp_graph_version"); const gv=String(gvData||"v23.0");
  const test=await fetch(`https://graph.facebook.com/${gv}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating`,{headers:{Authorization:`Bearer ${accessToken}`}});
  const testBody=await test.json();
  if(!test.ok)return json({error:testBody?.error?.message||"Não foi possível validar o número no Meta."},400);
  const {error:rpcErr}=await admin.rpc("set_whatsapp_access_token",{p_studio_id:studioId,p_token:accessToken}); if(rpcErr)throw rpcErr;
  let subscription:any=null;
  try{
   const r=await fetch(`https://graph.facebook.com/${gv}/${encodeURIComponent(wabaId)}/subscribed_apps`,{method:"POST",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"}});
   subscription=await r.json();
  }catch(e){subscription={error:String(e)}}
  const display=String(testBody.display_phone_number||body.displayPhoneNumber||""); const business=String(testBody.verified_name||body.businessName||"");
  const {data:connection,error}=await admin.from("whatsapp_connections").upsert({studio_id:studioId,status:"connected",waba_id:wabaId,phone_number_id:phoneNumberId,display_phone_number:display||null,business_name:business||null,connected_at:new Date().toISOString(),last_error:null,metadata:{graph_version:gv,subscription}}, {onConflict:"studio_id"}).select("id,status,waba_id,phone_number_id,display_phone_number,business_name,connected_at,last_webhook_at,last_error,metadata").single();
  if(error)throw error;
  await admin.from("audit_logs").insert({studio_id:studioId,user_id:user.id,event:"whatsapp_connected",payload:{waba_id:wabaId,phone_number_id:phoneNumberId,display_phone_number:display}});
  return json({ok:true,connection,subscription});
 }catch(e){console.error("whatsapp-connect",e);return json({error:e instanceof Error?e.message:"Falha ao conectar WhatsApp."},500)}
});
