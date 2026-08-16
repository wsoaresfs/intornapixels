import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.102.0";

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json'}});
function sk(){const m=Deno.env.get('SUPABASE_SECRET_KEYS');if(m){try{const p=JSON.parse(m);if(p?.default)return p.default as string}catch(_){}}return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''}
function fromB64(b64:string){const bin=atob(b64),a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a}
function toB64(bytes:Uint8Array){let out='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)out+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));return btoa(out)}
const aspectFor=(size:string)=>size==='1024x1024'?'1:1':size==='1536x1024'?'3:2':'2:3';
const googleSizeFor=(quality:string)=>quality==='high'?'4K':quality==='low'?'1K':'2K';

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Método não permitido'},405);
  let jobId:string|null=null;
  try{
    const bearer=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    const url=Deno.env.get('SUPABASE_URL')||'',secret=sk();
    if(!bearer||!url||!secret)return json({error:'Sessão inválida'},401);
    const service=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:ue}=await service.auth.getUser(bearer);
    if(ue||!user)return json({error:'Sessão inválida'},401);

    const b=await req.json();
    const studioId=String(b.studioId||''),orderId=b.orderId?String(b.orderId):null,prompt=String(b.prompt||'').trim();
    let quantity=Math.max(1,Math.min(4,Number(b.quantity||1)));
    const size=['1024x1024','1024x1536','1536x1024'].includes(String(b.size))?String(b.size):'1024x1536';
    const quality=['low','medium','high'].includes(String(b.quality))?String(b.quality):'medium';
    if(!studioId||!prompt)return json({error:'Estúdio e prompt são obrigatórios'},400);

    const [{data:member},{data:pa}]=await Promise.all([
      service.from('studio_members').select('role').eq('studio_id',studioId).eq('user_id',user.id).eq('active',true).maybeSingle(),
      service.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle()
    ]);
    if(!member&&!pa)return json({error:'Sem acesso ao estúdio'},403);

    const [{data:studio},{data:cfg}]=await Promise.all([
      service.from('studios').select('id,plan_id').eq('id',studioId).single(),
      service.from('platform_integrations').select('*').eq('id',1).single()
    ]);
    if(!studio)return json({error:'Estúdio não encontrado'},404);
    const {data:plan}=await service.from('plans').select('ai_image_limit').eq('id',studio.plan_id).single();
    const month=new Date().toISOString().slice(0,7)+'-01';
    const {data:usage}=await service.from('ai_usage_monthly').select('images_generated').eq('studio_id',studioId).eq('month',month).maybeSingle();
    const used=Number(usage?.images_generated||0),limit=Number(plan?.ai_image_limit||0);
    if(!pa&&(limit<=0||used+quantity>limit))return json({error:`Limite mensal de imagens atingido (${used}/${limit}). Faça upgrade ou aguarde o próximo ciclo.`},402);

    let requested=String(b.provider||'auto').toLowerCase();
    if(!['auto','openai','google','google_pro'].includes(requested))requested='auto';
    let provider=requested==='auto'?String(cfg?.image_provider_default||'auto'):requested;
    const [{data:openaiVault},{data:googleVault}]=await Promise.all([
      service.rpc('get_platform_integration_secret',{p_provider:'openai'}),
      service.rpc('get_platform_integration_secret',{p_provider:'google'})
    ]);
    const openai=String(openaiVault||Deno.env.get('OPENAI_API_KEY')||'');
    const google=String(googleVault||Deno.env.get('GEMINI_API_KEY')||Deno.env.get('GOOGLE_API_KEY')||'');
    if(provider==='auto')provider=openai?'openai':google?'google':'openai';
    if(provider==='openai'&&!openai)return json({error:'OpenAI ainda não foi conectada no Admin Master.'},503);
    if((provider==='google'||provider==='google_pro')&&!google)return json({error:'Google Gemini ainda não foi conectado no Admin Master.'},503);

    const refs=Array.isArray(b.referencePaths)?b.referencePaths.map(String).slice(0,4):[];
    const identity=refs.length?`\n\nPRESERVAÇÃO DE IDENTIDADE — PRIORIDADE ABSOLUTA: use as imagens fornecidas exclusivamente como âncora de identidade do cliente. Preserve fielmente rosto, idade aparente, tom de pele, cabelo, corpo, proporções e características individuais. Não afine o rosto, não altere peso, idade, etnia, nariz, olhos, boca, cabelo ou biotipo. Mantenha a mesma pessoa de forma natural e fotorealista.`:'';
    const finalPrompt=prompt+identity;
    const model=provider==='openai'?String(cfg?.openai_model||'gpt-image-1'):provider==='google_pro'?String(cfg?.google_pro_model||'gemini-3-pro-image'):String(cfg?.google_model||'gemini-3.1-flash-image');

    const {data:job,error:je}=await service.from('ai_generation_jobs').insert({studio_id:studioId,order_id:orderId,requested_by:user.id,model,prompt:finalPrompt,size,quality,quantity,reference_paths:refs,status:'processing'}).select('*').single();
    if(je)throw je;jobId=job.id;

    const generated:{b64:string,mime:string}[]=[];
    let providerUsage:any={};

    if(provider==='openai'){
      let response:any;
      if(refs.length===0){
        const rr=await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{'Authorization':`Bearer ${openai}`,'Content-Type':'application/json'},body:JSON.stringify({model,prompt:finalPrompt,n:quantity,size,quality,output_format:'png'})});
        response=await rr.json();if(!rr.ok)throw new Error(response?.error?.message||'Falha ao gerar imagem na OpenAI.');
      }else{
        const form=new FormData();form.append('model',model);form.append('prompt',finalPrompt);form.append('n',String(quantity));form.append('size',size);form.append('quality',quality);form.append('output_format','png');form.append('input_fidelity','high');
        for(let i=0;i<refs.length;i++){const {data,error}=await service.storage.from('intorna-media').download(refs[i]);if(error||!data)throw new Error('Não foi possível carregar uma imagem de referência.');form.append('image',data,`reference-${i+1}.png`)}
        const rr=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{'Authorization':`Bearer ${openai}`},body:form});response=await rr.json();if(!rr.ok)throw new Error(response?.error?.message||'Falha ao editar/gerar imagem com referências.');
      }
      for(const item of response.data||[]){if(item?.b64_json)generated.push({b64:item.b64_json,mime:'image/png'});}
      providerUsage=response.usage||{};
    }else{
      const inputs:any[]=[{type:'text',text:finalPrompt}];
      for(const path of refs){
        const {data,error}=await service.storage.from('intorna-media').download(path);if(error||!data)throw new Error('Não foi possível carregar uma imagem de referência.');
        const ab=await data.arrayBuffer();inputs.push({type:'image',mime_type:data.type||'image/png',data:toB64(new Uint8Array(ab))});
      }
      const callOne=async()=>{
        const rr=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'x-goog-api-key':google,'Content-Type':'application/json'},body:JSON.stringify({model,input:inputs,response_format:{type:'image',mime_type:'image/png',aspect_ratio:aspectFor(size),image_size:googleSizeFor(quality)}})});
        const d=await rr.json();if(!rr.ok)throw new Error(d?.error?.message||`Falha ao gerar imagem no Google (${rr.status}).`);
        const images:{b64:string,mime:string}[]=[];
        for(const step of d?.steps||[]){if(step?.type!=='model_output')continue;for(const part of step?.content||[]){if(part?.type==='image'&&part?.data)images.push({b64:part.data,mime:part.mime_type||'image/png'});}}
        if(!images.length&&d?.output_image?.data)images.push({b64:d.output_image.data,mime:d.output_image.mime_type||'image/png'});
        return {images,usage:d?.usage||d?.usage_metadata||{}};
      };
      for(let i=0;i<quantity;i++){const r=await callOne();if(r.images[0])generated.push(r.images[0]);providerUsage=r.usage||providerUsage;}
    }

    if(!generated.length)throw new Error('O provedor não retornou nenhuma imagem.');
    quantity=Math.min(quantity,generated.length);
    const outputs:string[]=[],urls:string[]=[];
    for(let i=0;i<quantity;i++){
      const item=generated[i],path=`${studioId}/${orderId||'general'}/generated/${job.id}-${i+1}.png`;
      const {error}=await service.storage.from('intorna-media').upload(path,fromB64(item.b64),{contentType:item.mime||'image/png',upsert:false});if(error)throw error;
      outputs.push(path);
      const {data:signed}=await service.storage.from('intorna-media').createSignedUrl(path,3600);if(signed?.signedUrl)urls.push(signed.signedUrl);
      if(orderId&&b.addToGallery!==false)await service.from('gallery_items').insert({studio_id:studioId,order_id:orderId,label:`IA ${i+1}`,source:'generated',kind:b.kind==='extra'?'extra':'contracted',preview_path:path,final_path:path,price:b.kind==='extra'?Number(b.price||0):0,status:'draft',position:Number(b.position||0)+i,metadata:{ai_job_id:job.id,provider,model}});
    }

    const usagePayload={provider,model,...(providerUsage||{})};
    await service.from('ai_generation_jobs').update({status:'completed',output_paths:outputs,usage:usagePayload,completed_at:new Date().toISOString()}).eq('id',job.id);
    await service.from('ai_usage_monthly').upsert({studio_id:studioId,month,images_generated:used+quantity,updated_at:new Date().toISOString()},{onConflict:'studio_id,month'});
    await service.from('audit_logs').insert({studio_id:studioId,user_id:user.id,event:'ai_images_generated',payload:{job_id:job.id,provider,model,quantity,size,quality,with_references:refs.length>0}});
    return json({ok:true,jobId:job.id,provider,model,images:urls,paths:outputs,usage:{used:used+quantity,limit}});
  }catch(e){
    console.error(e);
    if(jobId){try{const url=Deno.env.get('SUPABASE_URL')||'',secret=sk();if(url&&secret){const s=createClient(url,secret);await s.from('ai_generation_jobs').update({status:'failed',error_message:e instanceof Error?e.message:String(e),completed_at:new Date().toISOString()}).eq('id',jobId)}}catch(_){}}
    return json({error:e instanceof Error?e.message:String(e)},500);
  }
});
