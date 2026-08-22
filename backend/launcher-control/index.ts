import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.102.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
function sk(){const m=Deno.env.get("SUPABASE_SECRET_KEYS");if(m){try{const p=JSON.parse(m);if(p?.default)return p.default as string}catch(_){}}return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Método não permitido"},405);
 try{
  const bearer=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");const url=Deno.env.get("SUPABASE_URL")||"",secret=sk();if(!bearer||!url||!secret)return json({error:"Sessão inválida"},401);
  const s=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});const {data:{user},error:ue}=await s.auth.getUser(bearer);if(ue||!user)return json({error:"Sessão inválida"},401);
  const {data:pa}=await s.from("platform_admins").select("user_id").eq("user_id",user.id).maybeSingle();if(!pa)return json({error:"Acesso Master necessário"},403);
  const b=await req.json().catch(()=>({})),action=String(b.action||"status");
  if(action==="status"){
    await s.from("launcher_agents").update({status:"revoked"}).eq("status","pending").lt("pair_expires_at",new Date().toISOString());
    const [{data:agents},{data:jobs},{data:settings}]=await Promise.all([
      s.from("launcher_agents").select("id,label,status,pair_code,pair_expires_at,last_seen_at,last_tunnel_url,last_status,activated_at,created_at").order("created_at",{ascending:false}).limit(20),
      s.from("launcher_jobs").select("id,agent_id,action,status,result,error_message,claimed_at,completed_at,created_at").order("created_at",{ascending:false}).limit(30),
      s.from("platform_integrations").select("waha_base_url").eq("id",1).maybeSingle(),
    ]);
    const now=Date.now();const out=(agents||[]).map((a:any)=>({...a,online:a.status==="active"&&a.last_seen_at&&(now-new Date(a.last_seen_at).getTime())<45000,pair_code:a.status==="pending"?a.pair_code:null}));
    return json({ok:true,agents:out,jobs:jobs||[],wahaBaseUrl:settings?.waha_base_url||""});
  }
  if(action==="approve_pair"){
    const pair=String(b.pairCode||"").replace(/\D/g,"").slice(0,6);if(!/^[0-9]{6}$/.test(pair))return json({error:"Código inválido"},400);
    const {data:agent}=await s.from("launcher_agents").select("id,label,pair_expires_at").eq("pair_code",pair).eq("status","pending").gt("pair_expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(1).maybeSingle();if(!agent)return json({error:"Código não encontrado ou expirado"},404);
    await s.from("launcher_agents").update({status:"revoked"}).eq("status","active").neq("id",agent.id);
    const {data:active,error}=await s.from("launcher_agents").update({status:"active",activated_by:user.id,activated_at:new Date().toISOString()}).eq("id",agent.id).select("id,label,status,activated_at").single();if(error)throw error;
    await s.from("audit_logs").insert({studio_id:null,user_id:user.id,event:"launcher_paired",payload:{agent_id:agent.id,label:agent.label}});
    return json({ok:true,agent:active});
  }
  if(action==="queue"){
    const allowed=["status","start_stack","renew_tunnel","restart_waha","diagnose"];const task=String(b.task||"");if(!allowed.includes(task))return json({error:"Ação não permitida"},400);
    let q=s.from("launcher_agents").select("id,label,last_seen_at,status").eq("status","active").order("last_seen_at",{ascending:false}).limit(1);const {data:agent}=await q.maybeSingle();if(!agent)return json({error:"Nenhum Intorná Launcher ativo. Faça o pareamento primeiro."},409);
    const {data:existing}=await s.from("launcher_jobs").select("id,action,status,created_at").eq("agent_id",agent.id).eq("action",task).in("status",["queued","claimed"]).order("created_at",{ascending:false}).limit(1).maybeSingle();if(existing)return json({ok:true,reused:true,job:existing});
    const {data:job,error}=await s.from("launcher_jobs").insert({agent_id:agent.id,action:task,status:"queued",requested_by:user.id,payload:typeof b.payload==="object"&&b.payload?b.payload:{}}).select("*").single();if(error)throw error;
    await s.from("audit_logs").insert({studio_id:null,user_id:user.id,event:"launcher_job_queued",payload:{agent_id:agent.id,job_id:job.id,action:task}});
    return json({ok:true,job,agent:{id:agent.id,label:agent.label,last_seen_at:agent.last_seen_at}});
  }
  if(action==="revoke"){
    const id=String(b.agentId||"");const {error}=await s.from("launcher_agents").update({status:"revoked"}).eq("id",id);if(error)throw error;await s.from("launcher_jobs").update({status:"cancelled"}).eq("agent_id",id).in("status",["queued","claimed"]);return json({ok:true});
  }
  if(action==="cancel_job"){
    const id=String(b.jobId||"");await s.from("launcher_jobs").update({status:"cancelled"}).eq("id",id).eq("status","queued");return json({ok:true});
  }
  return json({error:"Ação desconhecida"},400);
 }catch(e){console.error("launcher-control",e);return json({error:e instanceof Error?e.message:String(e)},500)}
});
