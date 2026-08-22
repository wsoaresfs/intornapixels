import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.102.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});

function secretKey(){
  const value=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(value){try{const keys=JSON.parse(value);if(keys?.default)return String(keys.default)}catch{}}
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Método não permitido"},405);
  try{
    const bearer=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
    const url=Deno.env.get("SUPABASE_URL")||"",adminKey=secretKey();
    if(!bearer||!url||!adminKey)return json({error:"Sessão inválida"},401);

    const service=createClient(url,adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:userError}=await service.auth.getUser(bearer);
    if(userError||!user)return json({error:"Sessão inválida"},401);

    const body=await req.json().catch(()=>({}));
    const action=String(body.action||"status");

    if(action==="status"){
      const {data,error}=await service.rpc("get_user_ai_secret_status",{p_user_id:user.id,p_provider:"openai"});
      if(error)throw error;
      return json({ok:true,credential:data||{configured:false,provider:"openai"}});
    }

    if(action==="save"){
      const apiKey=String(body.apiKey||"").trim();
      if(apiKey.length<20||!apiKey.startsWith("sk-"))return json({error:"Informe uma chave OpenAI válida."},400);

      const {data,error}=await service.rpc("set_user_ai_secret",{p_user_id:user.id,p_provider:"openai",p_value:apiKey});
      if(error)throw error;
      await service.from("audit_logs").insert({studio_id:null,user_id:user.id,event:"user_openai_key_saved",payload:{provider:"openai"}});
      return json({ok:true,credential:data});
    }

    if(action==="delete"){
      const {data,error}=await service.rpc("delete_user_ai_secret",{p_user_id:user.id,p_provider:"openai"});
      if(error)throw error;
      await service.from("audit_logs").insert({studio_id:null,user_id:user.id,event:"user_openai_key_deleted",payload:{provider:"openai"}});
      return json({ok:true,deleted:!!data,credential:{configured:false,provider:"openai"}});
    }

    return json({error:"Ação desconhecida"},400);
  }catch(error){
    console.error("ai-credentials",error instanceof Error?error.message:String(error));
    return json({error:"Não foi possível atualizar sua configuração de IA."},500);
  }
});
