import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.102.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json"}});
class HttpError extends Error{status:number;code:string;constructor(message:string,status=400,code="request_failed"){super(message);this.status=status;this.code=code}}
function secretKey(){const m=Deno.env.get("SUPABASE_SECRET_KEYS");if(m){try{const p=JSON.parse(m);if(p?.default)return p.default as string}catch(_){}}return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""}
function referralCode(){return "PIX"+crypto.randomUUID().replace(/-/g,"").slice(0,8).toUpperCase()}
function roleRank(role:string){return ({owner:0,admin:1,operator:2} as Record<string,number>)[role]??9}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  const url=Deno.env.get("SUPABASE_URL")||"",secret=secretKey();
  if(!token||!url||!secret)return json({error:"Sessão ausente."},401);
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:authData,error:authError}=await admin.auth.getUser(token);const user=authData.user;
  if(authError||!user)return json({error:"Sessão inválida."},401);
  let payload:Record<string,unknown>={};try{payload=await req.json()}catch(_){ }
  const fullName=String(payload.full_name||user.user_metadata?.full_name||"").trim();
  const phone=String(payload.phone||user.user_metadata?.phone||"").trim();
  const requestedStudio=String(payload.studio_name||user.user_metadata?.studio_name||"").trim();
  const referral=String(payload.referral_code||user.user_metadata?.referral_code||"").trim().toUpperCase();
  const now=new Date().toISOString(),repaired:string[]=[];

  const {data:currentAdmin,error:adminError}=await admin.from("platform_admins").select("user_id").eq("user_id",user.id).maybeSingle();
  if(adminError)throw adminError;
  const isAdmin=!!currentAdmin;
  const {data:memberships,error:membershipError}=await admin.from("studio_members")
    .select("studio_id,role,active,studios(id,name,owner_user_id,whatsapp,city,plan_id,status,billing_status,trial_ends_at,next_billing_at,settings,created_at)")
    .eq("user_id",user.id).eq("active",true);
  if(membershipError)throw membershipError;
  const rows=(memberships||[]).filter((x:any)=>x?.studio_id&&x?.studios).sort((a:any,b:any)=>{
    const ao=a.studios?.owner_user_id===user.id?0:1,bo=b.studios?.owner_user_id===user.id?0:1;
    if(ao!==bo)return ao-bo;const rr=roleRank(String(a.role))-roleRank(String(b.role));if(rr!==0)return rr;
    return String(a.studio_id).localeCompare(String(b.studio_id));
  });
  let studioId=rows[0]?.studio_id||null,studio:any=rows[0]?.studios||null;

  if(!studioId){
    const {data:owned,error:ownedError}=await admin.from("studios").select("*").eq("owner_user_id",user.id).order("created_at",{ascending:true}).limit(1).maybeSingle();
    if(ownedError)throw ownedError;
    if(owned){studioId=owned.id;studio=owned;const {error:e}=await admin.from("studio_members").upsert({studio_id:studioId,user_id:user.id,role:"owner",active:true},{onConflict:"studio_id,user_id"});if(e)throw e;repaired.push("membership")}
  }

  let betaParticipant:any=null;
  if(!studioId&&!isAdmin){
    const {data,error}=await admin.from("beta_participants").select("user_id,studio_id,status,studio_name").eq("user_id",user.id).maybeSingle();
    if(error)throw error;betaParticipant=data;
    if(!betaParticipant||!["registered","active"].includes(String(betaParticipant.status)))
      throw new HttpError("Este beta é exclusivo para convidados. Solicite seu código de acesso.",403,"beta_invite_required");
  }

  const {error:profileError}=await admin.from("profiles").upsert({id:user.id,full_name:fullName,phone:phone||null,email:user.email||null,updated_at:now},{onConflict:"id"});
  if(profileError)throw profileError;

  if(!studioId){
    const studioName=requestedStudio||String(betaParticipant?.studio_name||"").trim()||"Meu Estúdio";
    const {data:created,error:studioError}=await admin.from("studios").insert({
      name:studioName,owner_user_id:user.id,plan_id:isAdmin?"studio":"free",status:"active",billing_status:"free",trial_ends_at:null,
      settings:{onboarded:true,internal_owner:isAdmin,controlled_beta:!isAdmin,beta_started_at:now}
    }).select("*").single();
    if(studioError)throw studioError;
    studioId=created.id;studio=created;
    const {error:memberError}=await admin.from("studio_members").upsert({studio_id:studioId,user_id:user.id,role:"owner",active:true},{onConflict:"studio_id,user_id"});if(memberError)throw memberError;
    if(!isAdmin){const {error:betaError}=await admin.from("beta_participants").update({studio_id:studioId,status:"active",updated_at:now}).eq("user_id",user.id);if(betaError)throw betaError}
    repaired.push("studio_membership");
    await admin.from("production_settings").upsert({studio_id:studioId},{onConflict:"studio_id"});
    await admin.from("audit_logs").insert({studio_id:studioId,user_id:user.id,event:isAdmin?"platform_bootstrap":"beta_studio_activation",payload:{email:user.email,studio_name:studioName}});
    if(referral){
      const {data:refCode}=await admin.from("referral_codes").select("studio_id,code,reward_value").eq("code",referral).eq("active",true).maybeSingle();
      if(refCode&&refCode.studio_id!==studioId)await admin.from("referrals").insert({referrer_studio_id:refCode.studio_id,referred_studio_id:studioId,referral_code:refCode.code,status:"pending",reward_value:Number(refCode.reward_value||19.90)}).then(()=>{}).catch(()=>{});
    }
  }

  if(!studioId||!studio)throw new Error("Não foi possível concluir a vinculação do estúdio.");
  const {data:prod}=await admin.from("production_settings").select("studio_id").eq("studio_id",studioId).maybeSingle();
  if(!prod)await admin.from("production_settings").insert({studio_id:studioId});
  const {data:ownCode}=await admin.from("referral_codes").select("code").eq("studio_id",studioId).maybeSingle();
  if(!ownCode){let candidate=referralCode();for(let i=0;i<3;i++){const {error:e}=await admin.from("referral_codes").insert({studio_id:studioId,code:candidate});if(!e)break;if(e.code!=="23505")break;candidate=referralCode()}}
  return json({ok:true,user_id:user.id,is_platform_admin:isAdmin,studio_id:studioId,studio,repaired,beta:!isAdmin});
 }catch(e){
  console.error("bootstrap-account",e);
  if(e instanceof HttpError)return json({error:e.message,code:e.code},e.status);
  return json({error:e instanceof Error?e.message:String(e)},500);
 }
});
