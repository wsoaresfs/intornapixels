import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.102.0";
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
function secretKey(){const m=Deno.env.get('SUPABASE_SECRET_KEYS');if(m){try{const p=JSON.parse(m);if(p?.default)return p.default as string}catch(_){}}return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''}
function randomToken(){const b=new Uint8Array(32);crypto.getRandomValues(b);return btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function sha256(v:string){const a=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return [...new Uint8Array(a)].map(x=>x.toString(16).padStart(2,'0')).join('')}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'Método não permitido'},405);try{
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,''); const url=Deno.env.get('SUPABASE_URL')||'',secret=secretKey(); if(!token||!url||!secret)return json({error:'Sessão ou backend ausente'},401);
 const service=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}}); const {data:{user},error:ue}=await service.auth.getUser(token);if(ue||!user)return json({error:'Sessão inválida'},401);
 const body=await req.json();const action=String(body.action||'create');const orderId=String(body.orderId||'');if(!orderId)return json({error:'Pedido obrigatório'},400);
 const {data:order,error:oe}=await service.from('orders').select('id,studio_id').eq('id',orderId).single();if(oe||!order)return json({error:'Pedido não encontrado'},404);
 const {data:member}=await service.from('studio_members').select('role').eq('studio_id',order.studio_id).eq('user_id',user.id).eq('active',true).maybeSingle(); const {data:pa}=await service.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle(); if(!member&&!pa)return json({error:'Sem acesso a este pedido'},403);
 if(action==='disable'){await service.from('portal_links').update({enabled:false}).eq('order_id',orderId);return json({ok:true,enabled:false})}
 const raw=randomToken(),hash=await sha256(raw); const expiresAt=body.expiresDays?new Date(Date.now()+Math.max(1,Number(body.expiresDays))*86400000).toISOString():null;
 const {data:link,error:le}=await service.from('portal_links').upsert({studio_id:order.studio_id,order_id:orderId,token_hash:hash,enabled:true,expires_at:expiresAt,created_by:user.id,settings:body.settings||{}},{onConflict:'order_id'}).select('*').single();if(le)throw le;
 await service.from('audit_logs').insert({studio_id:order.studio_id,user_id:user.id,event:'client_portal_link_created',payload:{order_id:orderId}});
 return json({ok:true,token:raw,relativeUrl:`/cliente/?token=${encodeURIComponent(raw)}`,link:{id:link.id,enabled:link.enabled,expires_at:link.expires_at}});
}catch(e){console.error(e);return json({error:e instanceof Error?e.message:String(e)},500)}});
