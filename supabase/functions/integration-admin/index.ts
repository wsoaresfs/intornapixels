import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.102.0";

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
function serviceKey(){
  const modern=Deno.env.get('SUPABASE_SECRET_KEYS');
  if(modern){try{const p=JSON.parse(modern);if(p?.default)return p.default as string}catch(_){}}
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
}
const cleanUrl=(v:string)=>v.trim().replace(/\/+$/,'');

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Método não permitido'},405);
  try{
    const bearer=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    const supabaseUrl=Deno.env.get('SUPABASE_URL')||'',secret=serviceKey();
    if(!bearer||!supabaseUrl||!secret)return json({error:'Sessão inválida'},401);
    const service=createClient(supabaseUrl,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:userErr}=await service.auth.getUser(bearer);
    if(userErr||!user)return json({error:'Sessão inválida'},401);
    const {data:admin}=await service.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle();
    if(!admin)return json({error:'Somente o administrador Master pode gerenciar integrações.'},403);

    const body=await req.json().catch(()=>({}));
    const action=String(body.action||'status');
    const {data:cfg,error:cfgErr}=await service.from('platform_integrations').select('*').eq('id',1).single();
    if(cfgErr)throw cfgErr;

    if(action==='status'){
      return json({ok:true,config:{
        imageProviderDefault:cfg.image_provider_default,
        openaiModel:cfg.openai_model,
        googleModel:cfg.google_model,
        googleProModel:cfg.google_pro_model,
        asaasEnvironment:cfg.asaas_environment,
        wahaBaseUrl:cfg.waha_base_url||'',
        wahaSession:cfg.waha_session||'default',
        connected:{openai:!!cfg.openai_secret_id,google:!!cfg.google_secret_id,asaas:!!cfg.asaas_secret_id,asaasWebhook:!!cfg.asaas_webhook_secret_id,waha:!!cfg.waha_secret_id&&!!cfg.waha_base_url},
        updatedAt:cfg.updated_at
      }});
    }

    if(action==='save'){
      const allowedProviders=['openai','google','asaas','asaas_webhook','waha'];
      const secrets=body.secrets&&typeof body.secrets==='object'?body.secrets:{};
      for(const p of allowedProviders){
        const value=String(secrets[p]||'').trim();
        if(value){
          if(p==='asaas_webhook'&&(value.length<32||value.length>255))return json({error:'O token do webhook Asaas precisa ter entre 32 e 255 caracteres.'},400);
          const {error}=await service.rpc('set_platform_integration_secret',{p_provider:p,p_value:value});
          if(error)throw error;
        }
      }
      const updates:Record<string,unknown>={updated_at:new Date().toISOString()};
      const provider=String(body.imageProviderDefault||cfg.image_provider_default);if(['auto','openai','google','google_pro'].includes(provider))updates.image_provider_default=provider;
      const openaiModel=String(body.openaiModel||'').trim();if(openaiModel)updates.openai_model=openaiModel;
      const googleModel=String(body.googleModel||'').trim();if(googleModel)updates.google_model=googleModel;
      const googleProModel=String(body.googleProModel||'').trim();if(googleProModel)updates.google_pro_model=googleProModel;
      const asaasEnvironment=String(body.asaasEnvironment||cfg.asaas_environment);if(['sandbox','production'].includes(asaasEnvironment))updates.asaas_environment=asaasEnvironment;
      if(body.wahaBaseUrl!==undefined)updates.waha_base_url=cleanUrl(String(body.wahaBaseUrl||''))||null;
      if(body.wahaSession!==undefined)updates.waha_session=String(body.wahaSession||'default').trim()||'default';
      const {error}=await service.from('platform_integrations').update(updates).eq('id',1);if(error)throw error;
      await service.from('audit_logs').insert({studio_id:null,user_id:user.id,event:'platform_integrations_updated',payload:{providers:Object.keys(secrets).filter(k=>String(secrets[k]||'').trim()),config:Object.keys(updates)}});
      return json({ok:true});
    }

    if(action==='configure_asaas_webhook'){
      const [{data:apiKey,error:apiErr},{data:webhookToken,error:webhookErr}]=await Promise.all([service.rpc('get_platform_integration_secret',{p_provider:'asaas'}),service.rpc('get_platform_integration_secret',{p_provider:'asaas_webhook'})]);
      if(apiErr)throw apiErr;if(webhookErr)throw webhookErr;
      const key=String(apiKey||'').trim(),authToken=String(webhookToken||'').trim();
      if(!key)return json({error:'Salve primeiro a API Key do Asaas.'},400);
      if(authToken.length<32||authToken.length>255)return json({error:'O token do webhook Asaas precisa ter entre 32 e 255 caracteres.'},400);
      const base=cfg.asaas_environment==='production'?'https://api.asaas.com/v3':'https://api-sandbox.asaas.com/v3';
      const webhookUrl=`${supabaseUrl}/functions/v1/asaas-webhook`;
      const headers={'Content-Type':'application/json','access_token':key,'User-Agent':'IntornaPixels/2.0'};
      const events=['PAYMENT_CREATED','PAYMENT_UPDATED','PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_CREDIT_CARD_CAPTURE_REFUSED','PAYMENT_OVERDUE','PAYMENT_DELETED','PAYMENT_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE'];
      const listResponse=await fetch(`${base}/webhooks?offset=0&limit=100`,{headers});const listed=await listResponse.json().catch(()=>({}));
      if(!listResponse.ok)return json({error:listed?.errors?.[0]?.description||listed?.error||`Asaas respondeu HTTP ${listResponse.status} ao listar webhooks.`},502);
      const rows=Array.isArray(listed?.data)?listed.data:Array.isArray(listed)?listed:[];
      const existing=rows.find((w:any)=>String(w?.url||'')===webhookUrl||String(w?.name||'').toLowerCase()==='intorná pixels'||String(w?.name||'').toLowerCase()==='intorna pixels');
      const common={name:'Intorná Pixels',url:webhookUrl,enabled:true,interrupted:false,authToken,sendType:'SEQUENTIALLY',events};
      let response:Response;
      if(existing?.id)response=await fetch(`${base}/webhooks/${encodeURIComponent(String(existing.id))}`,{method:'PUT',headers,body:JSON.stringify(common)});
      else { const webhookEmail=String(user.email||'').trim(); if(!webhookEmail)return json({error:'O usuário Master precisa ter um e-mail válido para configurar o webhook Asaas.'},400); response=await fetch(`${base}/webhooks`,{method:'POST',headers,body:JSON.stringify({...common,email:webhookEmail,apiVersion:3})}); }
      const webhook=await response.json().catch(()=>({}));
      if(!response.ok)return json({error:webhook?.errors?.[0]?.description||webhook?.error||`Asaas respondeu HTTP ${response.status} ao configurar webhook.`},502);
      await service.from('audit_logs').insert({studio_id:null,user_id:user.id,event:'asaas_webhook_configured',payload:{webhook_id:webhook?.id||existing?.id||null,environment:cfg.asaas_environment,url:webhookUrl}});
      return json({ok:true,message:`Webhook Asaas ${existing?.id?'atualizado':'criado'} em ${cfg.asaas_environment==='production'?'produção':'sandbox'}.`,webhookId:webhook?.id||existing?.id||null,url:webhookUrl});
    }

    if(action==='test'){
      const provider=String(body.provider||'');const {data:key,error:keyErr}=await service.rpc('get_platform_integration_secret',{p_provider:provider});if(keyErr)throw keyErr;if(!key)return json({error:`${provider} ainda não possui credencial salva.`},400);
      if(provider==='openai'){const model=String(cfg.openai_model||'gpt-image-1');const r=await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`,{headers:{Authorization:`Bearer ${key}`}});const d=await r.json().catch(()=>({}));if(!r.ok)return json({error:d?.error?.message||`OpenAI respondeu HTTP ${r.status}`},502);return json({ok:true,message:`OpenAI conectada. Modelo ${d?.id||model} disponível.`});}
      if(provider==='google'){const model=String(body.pro===true?cfg.google_pro_model:cfg.google_model);const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}?key=${encodeURIComponent(String(key))}`);const d=await r.json().catch(()=>({}));if(!r.ok)return json({error:d?.error?.message||`Google respondeu HTTP ${r.status}`},502);return json({ok:true,message:`Google Gemini conectada. Modelo ${d?.displayName||model} disponível.`});}
      if(provider==='asaas'){const base=cfg.asaas_environment==='production'?'https://api.asaas.com/v3':'https://api-sandbox.asaas.com/v3';const r=await fetch(`${base}/customers?limit=1&offset=0`,{headers:{access_token:String(key),'User-Agent':'IntornaPixels/2.0'}});const d=await r.json().catch(()=>({}));if(!r.ok)return json({error:d?.errors?.[0]?.description||d?.error||`Asaas respondeu HTTP ${r.status}`},502);return json({ok:true,message:`Asaas ${cfg.asaas_environment==='production'?'produção':'sandbox'} conectada.`});}
      if(provider==='waha'){const base=cleanUrl(String(cfg.waha_base_url||''));if(!base)return json({error:'Informe a URL do servidor WAHA.'},400);const r=await fetch(`${base}/api/sessions`,{headers:{'X-Api-Key':String(key),Accept:'application/json'}});const text=await r.text();let d:any={};try{d=JSON.parse(text)}catch{d=text}if(!r.ok)return json({error:typeof d==='string'?d:(d?.message||d?.error||`WAHA respondeu HTTP ${r.status}`)},502);return json({ok:true,message:'WAHA conectado e autenticado.'});}
      return json({error:'Provedor de teste inválido.'},400);
    }
    return json({error:'Ação inválida.'},400);
  }catch(e){console.error('integration-admin',e);return json({error:e instanceof Error?e.message:String(e)},500);}
});
