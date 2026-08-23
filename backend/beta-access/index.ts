import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.102.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const normalize=(value:unknown)=>String(value??"").trim();
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const strongPassword=(value:string)=>value.length>=10&&/[a-z]/.test(value)&&/[A-Z]/.test(value)&&/\d/.test(value);

function serviceKey(){
  const map=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(map){try{const parsed=JSON.parse(map);if(parsed?.default)return String(parsed.default)}catch(_){}}
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
}

function requestIp(req:Request){
  return normalize(req.headers.get("x-forwarded-for")?.split(",")[0]||req.headers.get("cf-connecting-ip")||"unknown").slice(0,80);
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Método não permitido."},405);
  try{
    const url=Deno.env.get("SUPABASE_URL")||"",key=serviceKey();
    if(!url||!key)return json({error:"Cadastro beta temporariamente indisponível.",code:"beta_unavailable"},503);
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    let body:Record<string,unknown>={};
    try{body=await req.json()}catch(_){return json({error:"Dados inválidos."},400)}
    const action=normalize(body.action||"status").toLowerCase();
    if(!["status","register"].includes(action))return json({error:"Ação inválida."},400);

    const ip=requestIp(req);
    const limit=action==="register"?6:30;
    const {data:allowed,error:rateError}=await admin.rpc("consume_public_rate_limit",{p_key:`beta:${action}:${ip}`,p_limit:limit,p_window_seconds:3600});
    if(rateError)console.error("beta rate limit",rateError);
    if(allowed===false)return json({error:"Muitas tentativas. Aguarde uma hora e tente novamente.",code:"rate_limited"},429);

    const {data:settings,error:settingsError}=await admin.from("platform_settings")
      .select("beta_enabled,beta_capacity,terms_version,privacy_version").eq("id",1).single();
    if(settingsError)throw settingsError;
    const {count,error:countError}=await admin.from("beta_participants")
      .select("user_id",{count:"exact",head:true}).in("status",["registered","active"]);
    if(countError)throw countError;
    const capacity=Math.max(0,Number(settings.beta_capacity||0)),used=Number(count||0),remaining=Math.max(0,capacity-used);
    if(action==="status")return json({ok:true,enabled:!!settings.beta_enabled,capacity,remaining,full:remaining===0,termsVersion:settings.terms_version,privacyVersion:settings.privacy_version});

    if(!settings.beta_enabled)return json({error:"As inscrições para o beta estão pausadas.",code:"beta_paused"},403);
    if(remaining===0)return json({error:"As 3 vagas iniciais do beta já foram preenchidas.",code:"beta_full"},409);

    const invite=normalize(body.invite_code).toUpperCase();
    const {data:expected,error:secretError}=await admin.rpc("get_platform_integration_secret",{p_provider:"beta_invite"});
    if(secretError||!expected){console.error("beta invite unavailable",secretError);return json({error:"Cadastro beta temporariamente indisponível.",code:"beta_unavailable"},503)}
    if(invite!==normalize(expected).toUpperCase())return json({error:"Código de convite inválido.",code:"invalid_invite"},403);

    const fullName=normalize(body.full_name).replace(/\s+/g," ").slice(0,120);
    const studioName=normalize(body.studio_name).replace(/\s+/g," ").slice(0,120);
    const referralCode=normalize(body.referral_code).toUpperCase().slice(0,40);
    const email=normalize(body.email).toLowerCase().slice(0,254);
    const password=String(body.password??"");
    const acceptedTerms=body.accepted_terms===true,acceptedPrivacy=body.accepted_privacy===true;
    if(fullName.length<3||studioName.length<2)return json({error:"Informe seu nome e o nome do estúdio."},400);
    if(!emailPattern.test(email))return json({error:"Informe um e-mail válido."},400);
    if(!strongPassword(password))return json({error:"Use 10 ou mais caracteres, com maiúscula, minúscula e número."},400);
    if(!acceptedTerms||!acceptedPrivacy)return json({error:"Aceite os Termos e a Política de Privacidade para participar."},400);
    if(normalize(body.terms_version)!==settings.terms_version||normalize(body.privacy_version)!==settings.privacy_version)
      return json({error:"Os documentos foram atualizados. Recarregue a página e aceite novamente.",code:"legal_version_changed"},409);

    const {data:existing}=await admin.from("beta_participants").select("user_id,status").eq("email",email).maybeSingle();
    if(existing)return json({error:"Este e-mail já está inscrito. Use a aba Entrar.",code:"already_registered"},409);

    const acceptedAt=new Date().toISOString();
    const {data:created,error:createError}=await admin.auth.admin.createUser({
      email,password,email_confirm:true,
      user_metadata:{full_name:fullName,studio_name:studioName,referral_code:referralCode,terms_accepted:true,privacy_accepted:true,terms_version:settings.terms_version,privacy_version:settings.privacy_version,legal_accepted_at:acceptedAt,registration_source:"beta_external"}
    });
    if(createError){
      if(/already|registered|exists/i.test(createError.message))return json({error:"Este e-mail já possui conta. Use a aba Entrar.",code:"account_exists"},409);
      throw createError;
    }
    const user=created.user;
    if(!user)throw new Error("Não foi possível criar o acesso.");
    const {error:participantError}=await admin.from("beta_participants").insert({user_id:user.id,email,full_name:fullName,studio_name:studioName,status:"registered"});
    if(participantError){await admin.auth.admin.deleteUser(user.id);throw participantError}
    return json({ok:true,message:"Conta beta criada. Você já pode entrar.",remaining:Math.max(0,remaining-1)});
  }catch(error){
    console.error("beta-access",error);
    return json({error:"Não foi possível concluir o cadastro. Tente novamente.",code:"beta_registration_failed"},500);
  }
});
