import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.102.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
function serviceKey(){const raw=Deno.env.get("SUPABASE_SECRET_KEYS");if(raw){try{const keys=JSON.parse(raw);if(keys?.default)return String(keys.default)}catch{}}return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""}
const clean=(value:unknown)=>String(value??'').trim();

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  try{
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,''),url=Deno.env.get('SUPABASE_URL')||'',secret=serviceKey();
    if(!token||!url||!secret)return json({error:'Sessão ausente.'},401);
    const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:userError}=await db.auth.getUser(token);
    if(userError||!user)return json({error:'Sessão inválida.'},401);
    const {data:admin,error:adminError}=await db.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle();
    if(adminError||!admin)return json({error:'Acesso restrito ao administrador da plataforma.'},403);
    const payload=await req.json().catch(()=>({})),action=clean(payload.action);

    if(action==='create_studio'){
      const email=clean(payload.email).toLowerCase(),password=clean(payload.password),name=clean(payload.name),ownerName=clean(payload.owner_name);
      if(!email||!name||password.length<8)return json({error:'Informe estúdio, e-mail e senha com no mínimo 8 caracteres.'},400);
      const {data:created,error:createError}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:ownerName,studio_name:name}});
      if(createError||!created.user)throw createError||new Error('Não foi possível criar o usuário.');
      const ownerId=created.user.id,trialDays=Math.max(0,Math.min(365,Number(payload.trial_days??7))),trial=new Date();trial.setDate(trial.getDate()+trialDays);
      try{
        let result=await db.from('profiles').upsert({id:ownerId,full_name:ownerName,email,phone:clean(payload.whatsapp)||null},{onConflict:'id'});if(result.error)throw result.error;
        const settings={admin_notes:clean(payload.admin_notes)};
        const studioRow={name,owner_user_id:ownerId,whatsapp:clean(payload.whatsapp)||null,city:clean(payload.city)||null,plan_id:clean(payload.plan_id)||'free',status:clean(payload.status)||'trial',billing_status:clean(payload.billing_status)||'free',trial_ends_at:trialDays?trial.toISOString():null,next_billing_at:payload.next_billing_at||null,settings};
        const {data:studio,error:studioError}=await db.from('studios').insert(studioRow).select('*').single();if(studioError)throw studioError;
        result=await db.from('studio_members').insert({studio_id:studio.id,user_id:ownerId,role:'owner',active:true});if(result.error)throw result.error;
        await db.from('audit_logs').insert({studio_id:studio.id,user_id:user.id,event:'admin_studio_created',payload:{owner_user_id:ownerId,email}});
        return json({ok:true,studio});
      }catch(error){await db.auth.admin.deleteUser(ownerId).catch(()=>{});throw error}
    }

    const studioId=clean(payload.studio_id);
    if(['update_studio','reset_password','delete_studio'].includes(action)&&!studioId)return json({error:'Estúdio não informado.'},400);
    const {data:studio,error:studioError}=studioId?await db.from('studios').select('*').eq('id',studioId).single():{data:null,error:null};
    if(studioId&&(studioError||!studio))return json({error:'Estúdio não encontrado.'},404);

    if(action==='update_studio'){
      const allowed=['name','whatsapp','city','plan_id','status','billing_status','next_billing_at'],updates:Record<string,unknown>={};
      for(const key of allowed)if(Object.prototype.hasOwnProperty.call(payload,key))updates[key]=payload[key]||null;
      if(Object.prototype.hasOwnProperty.call(payload,'admin_notes'))updates.settings={...(studio.settings||{}),admin_notes:clean(payload.admin_notes)};
      if(Object.keys(updates).length){const {error}=await db.from('studios').update(updates).eq('id',studioId);if(error)throw error}
      const ownerUpdates:Record<string,unknown>={};if(payload.owner_name!==undefined)ownerUpdates.full_name=clean(payload.owner_name);if(payload.email!==undefined)ownerUpdates.email=clean(payload.email).toLowerCase();
      if(Object.keys(ownerUpdates).length){const {error}=await db.from('profiles').update(ownerUpdates).eq('id',studio.owner_user_id);if(error)throw error}
      const authUpdates:Record<string,unknown>={};if(payload.email)authUpdates.email=clean(payload.email).toLowerCase();if(payload.password)authUpdates.password=clean(payload.password);if(payload.owner_name)authUpdates.user_metadata={full_name:clean(payload.owner_name)};
      if(Object.keys(authUpdates).length){const {error}=await db.auth.admin.updateUserById(studio.owner_user_id,authUpdates);if(error)throw error}
      await db.from('audit_logs').insert({studio_id:studioId,user_id:user.id,event:'admin_studio_updated',payload:{fields:Object.keys(updates)}});
      return json({ok:true});
    }
    if(action==='reset_password'){
      const password=clean(payload.password);if(password.length<8)return json({error:'A senha precisa ter no mínimo 8 caracteres.'},400);
      const {error}=await db.auth.admin.updateUserById(studio.owner_user_id,{password});if(error)throw error;
      await db.from('audit_logs').insert({studio_id:studioId,user_id:user.id,event:'admin_password_reset',payload:{}});return json({ok:true});
    }
    if(action==='delete_studio'){
      const ownerId=studio.owner_user_id;const {error}=await db.from('studios').delete().eq('id',studioId);if(error)throw error;
      if(payload.delete_owner_user===true){const {error:deleteError}=await db.auth.admin.deleteUser(ownerId);if(deleteError)throw deleteError}
      return json({ok:true});
    }
    if(action==='ticket_update'){
      const ticketId=clean(payload.ticket_id);if(!ticketId)return json({error:'Chamado não informado.'},400);
      const updates:Record<string,unknown>={};if(payload.status!==undefined)updates.status=payload.status;if(payload.admin_response!==undefined)updates.admin_response=clean(payload.admin_response);
      const {error}=await db.from('support_tickets').update(updates).eq('id',ticketId);if(error)throw error;return json({ok:true});
    }
    return json({error:'Ação administrativa desconhecida.'},400);
  }catch(error){console.error(error);return json({error:error instanceof Error?error.message:'Falha administrativa.'},500)}
});
