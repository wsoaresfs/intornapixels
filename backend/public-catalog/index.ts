import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.102.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean=(value:unknown)=>String(value??"").trim();

function serviceKey(){
  const map=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(map){try{const parsed=JSON.parse(map);if(parsed?.default)return String(parsed.default)}catch(_){}}
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
}
function requestIp(req:Request){return clean(req.headers.get("x-forwarded-for")?.split(",")[0]||req.headers.get("cf-connecting-ip")||"unknown").slice(0,80)}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Método não permitido."},405);
  try{
    const url=Deno.env.get("SUPABASE_URL")||"",key=serviceKey();
    if(!url||!key)return json({error:"Catálogo temporariamente indisponível."},503);
    const service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    let body:Record<string,unknown>={};try{body=await req.json()}catch(_){return json({error:"Dados inválidos."},400)}
    const token=clean(body.token).toLowerCase();
    if(!uuid.test(token))return json({error:"Link de catálogo inválido.",code:"invalid_catalog_link"},404);

    const {data:allowed,error:rateError}=await service.rpc("consume_public_rate_limit",{
      p_key:`catalog:${requestIp(req)}:${token.slice(0,8)}`,p_limit:120,p_window_seconds:3600
    });
    if(rateError)console.error("catalog rate limit",rateError);
    if(allowed===false)return json({error:"Muitos acessos. Aguarde alguns minutos e tente novamente."},429);

    const {data:catalog,error:catalogError}=await service.from("sample_catalogs")
      .select("id,studio_id,title,catalog_type,description,whatsapp_message,watermark_enabled,watermark_text,studios(name,whatsapp,settings)")
      .eq("public_token",token).eq("status","published").maybeSingle();
    if(catalogError)throw catalogError;
    if(!catalog)return json({error:"Este catálogo não está disponível.",code:"catalog_unavailable"},404);

    const {data:items,error:itemsError}=await service.from("sample_catalog_items")
      .select("id,title,essay_type,description,image_path,sort_order")
      .eq("catalog_id",catalog.id).eq("studio_id",catalog.studio_id).eq("active",true)
      .order("sort_order").order("created_at");
    if(itemsError)throw itemsError;

    const safePrefix=`${catalog.studio_id}/catalogs/`;
    const publicItems=[];
    for(const item of items||[]){
      if(!String(item.image_path||"").startsWith(safePrefix))continue;
      const {data:signed,error:signedError}=await service.storage.from("intorna-media").createSignedUrl(item.image_path,3600);
      if(signedError||!signed?.signedUrl){console.error("catalog sign",signedError);continue}
      publicItems.push({id:item.id,title:item.title,essayType:item.essay_type,description:item.description,sortOrder:item.sort_order,imageUrl:signed.signedUrl});
    }
    service.rpc("record_sample_catalog_view",{p_catalog_id:catalog.id}).then(()=>{}).catch(()=>{});
    const studio=Array.isArray(catalog.studios)?catalog.studios[0]:catalog.studios;
    const settings=studio?.settings?.operational||{};
    return json({ok:true,catalog:{title:catalog.title,type:catalog.catalog_type,description:catalog.description,watermarkEnabled:catalog.watermark_enabled,watermarkText:catalog.watermark_text,whatsappMessage:catalog.whatsapp_message},studio:{name:studio?.name||"Estúdio",whatsapp:studio?.whatsapp||settings.whatsapp||""},items:publicItems});
  }catch(error){
    console.error("public-catalog",error);
    return json({error:"Não foi possível abrir o catálogo agora."},500);
  }
});
