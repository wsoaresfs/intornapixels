import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.102.0";
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json'}});
function secretKey(){const modern=Deno.env.get('SUPABASE_SECRET_KEYS');if(modern){try{const p=JSON.parse(modern);if(p?.default)return p.default as string}catch(_){}}return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''}
async function asaasConfig(service:any){const [{data:key},{data:cfg}]=await Promise.all([service.rpc('get_platform_integration_secret',{p_provider:'asaas'}),service.from('platform_integrations').select('asaas_environment').eq('id',1).single()]);return {apiKey:String(key||Deno.env.get('ASAAS_API_KEY')||''),base:Deno.env.get('ASAAS_BASE_URL')||(cfg?.asaas_environment==='production'?'https://api.asaas.com/v3':'https://api-sandbox.asaas.com/v3')}}
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Método não permitido'},405);
  try{
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    const url=Deno.env.get('SUPABASE_URL')||'',secret=secretKey();
    if(!token)return json({error:'Não autenticado'},401);
    const service=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user}}=await service.auth.getUser(token);if(!user)return json({error:'Sessão inválida'},401);
    const {subscriptionId}=await req.json();if(!subscriptionId)return json({error:'subscriptionId obrigatório'},400);
    const {data:sub}=await service.from('subscriptions').select('*').eq('id',subscriptionId).single();if(!sub)return json({error:'Assinatura não encontrada'},404);
    const [{data:member},{data:admin}]=await Promise.all([
      service.from('studio_members').select('role').eq('studio_id',sub.studio_id).eq('user_id',user.id).eq('active',true).maybeSingle(),
      service.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle()
    ]);
    if(!admin&&!['owner','admin'].includes(member?.role||''))return json({error:'Sem permissão'},403);
    const {apiKey,base}=await asaasConfig(service);
    if(!apiKey)return json({error:'Asaas ainda não foi conectado no Admin Master.'},503);
    if(sub.provider_subscription_id){
      const r=await fetch(`${base}/subscriptions/${sub.provider_subscription_id}`,{method:'DELETE',headers:{'access_token':apiKey,'User-Agent':'IntornaPixels/1.0 (Supabase Edge Functions)'}});
      if(!r.ok){const detail=await r.text();return json({error:'Falha ao cancelar no Asaas',detail},502)}
    }
    await service.from('subscriptions').update({status:'cancelled',cancelled_at:new Date().toISOString()}).eq('id',subscriptionId);
    await service.from('studios').update({plan_id:'free',billing_status:'cancelled',status:'active',next_billing_at:null}).eq('id',sub.studio_id);
    await service.from('audit_logs').insert({studio_id:sub.studio_id,user_id:user.id,event:'subscription_cancelled',payload:{subscription_id:subscriptionId}});
    return json({ok:true});
  }catch(e){return json({error:e instanceof Error?e.message:String(e)},500)}
});
