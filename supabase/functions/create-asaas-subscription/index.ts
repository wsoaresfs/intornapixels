import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.102.0";

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const ALLOWED=new Set(['UNDEFINED','BOLETO','CREDIT_CARD','PIX']);

function secretKey(){
  const modern=Deno.env.get('SUPABASE_SECRET_KEYS');
  if(modern){try{const parsed=JSON.parse(modern);if(parsed?.default)return parsed.default as string}catch(_){}}
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
}
function asaasHeaders(apiKey:string){return {'Content-Type':'application/json','access_token':apiKey,'User-Agent':'IntornaPixels/1.0 (Supabase Edge Functions)'}}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Método não permitido'},405);
  try{
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    const url=Deno.env.get('SUPABASE_URL')||'';
    const secret=secretKey();
    if(!token)return json({error:'Não autenticado'},401);
    if(!url||!secret)return json({error:'Backend Supabase incompleto'},503);
    const service=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:userErr}=await service.auth.getUser(token);
    if(userErr||!user)return json({error:'Sessão inválida'},401);

    const body=await req.json();
    const studioId=String(body.studioId||'');
    const planId=String(body.planId||'');
    const billingType=String(body.billingType||'PIX').toUpperCase();
    const nextDueDate=body.nextDueDate?String(body.nextDueDate):undefined;
    if(!studioId||!planId)return json({error:'studioId e planId são obrigatórios'},400);
    if(!ALLOWED.has(billingType))return json({error:'Forma de pagamento inválida'},400);

    const {data:member}=await service.from('studio_members').select('role').eq('studio_id',studioId).eq('user_id',user.id).eq('active',true).maybeSingle();
    const {data:platformAdmin}=await service.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle();
    if(!platformAdmin&&!['owner','admin'].includes(member?.role||''))return json({error:'Apenas o proprietário ou administrador pode contratar um plano'},403);

    const [{data:studio,error:studioErr},{data:plan,error:planErr}]=await Promise.all([
      service.from('studios').select('*').eq('id',studioId).single(),
      service.from('plans').select('*').eq('id',planId).eq('active',true).single()
    ]);
    if(studioErr||planErr||!studio||!plan)return json({error:'Estúdio ou plano inválido'},404);
    if(Number(plan.price)<=0)return json({error:'O plano gratuito não requer cobrança'},400);

    const {data:existing}=await service.from('subscriptions').select('*').eq('studio_id',studioId).in('status',['pending','ACTIVE','active']).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(existing){
      if(existing.plan_id===planId)return json({error:'Já existe uma assinatura deste plano em andamento. Conclua ou cancele a cobrança atual.'},409);
      return json({error:'Já existe uma assinatura ativa ou pendente. Cancele-a antes de trocar de plano.'},409);
    }

    const apiKey=Deno.env.get('ASAAS_API_KEY')||'';
    const base=Deno.env.get('ASAAS_BASE_URL')||'https://api-sandbox.asaas.com/v3';
    if(!apiKey)return json({error:'Asaas ainda não foi configurado. Adicione ASAAS_API_KEY nos Secrets do Supabase.'},503);
    const headers=asaasHeaders(apiKey);

    let customerId=studio.asaas_customer_id as string|null;
    if(!customerId){
      const customerPayload={name:studio.name,email:user.email||undefined,mobilePhone:studio.whatsapp||undefined,externalReference:studio.id};
      const response=await fetch(`${base}/customers`,{method:'POST',headers,body:JSON.stringify(customerPayload)});
      const customer=await response.json();
      if(!response.ok)return json({error:'Falha ao cadastrar o assinante no Asaas',detail:customer},502);
      customerId=customer.id;
      const {error:updateCustomerErr}=await service.from('studios').update({asaas_customer_id:customerId}).eq('id',studio.id);
      if(updateCustomerErr)throw updateCustomerErr;
    }

    const due=nextDueDate||new Date(Date.now()+24*60*60*1000).toISOString().slice(0,10);
    const providerPayload={customer:customerId,billingType,nextDueDate:due,value:Number(plan.price),cycle:'MONTHLY',description:`Intorná Pixels — Plano ${plan.name}`,externalReference:studio.id};
    const response=await fetch(`${base}/subscriptions`,{method:'POST',headers,body:JSON.stringify(providerPayload)});
    const asaasSub=await response.json();
    if(!response.ok)return json({error:'Falha ao criar assinatura no Asaas',detail:asaasSub},502);

    const {data:subscription,error:subErr}=await service.from('subscriptions').insert({
      studio_id:studio.id,plan_id:plan.id,provider:'asaas',provider_subscription_id:asaasSub.id,
      billing_type:billingType,amount:Number(plan.price),cycle:'MONTHLY',status:'pending',next_due_date:due,metadata:asaasSub
    }).select().single();
    if(subErr)return json({error:'Assinatura criada no Asaas, mas houve erro ao registrar no Intorná Pixels',detail:subErr.message},500);

    await service.from('studios').update({billing_status:'pending',next_billing_at:`${due}T12:00:00Z`}).eq('id',studio.id);

    let firstPayment:any=null;
    let pix:any=null;
    try{
      const payResponse=await fetch(`${base}/subscriptions/${asaasSub.id}/payments`,{headers});
      const payments=await payResponse.json();
      if(payResponse.ok&&Array.isArray(payments?.data)&&payments.data.length){
        firstPayment=payments.data[0];
        await service.from('payments').upsert({
          studio_id:studio.id,subscription_id:subscription.id,provider:'asaas',provider_payment_id:firstPayment.id,
          amount:Number(firstPayment.value||plan.price),status:'pending',billing_type:firstPayment.billingType||billingType,
          due_date:firstPayment.dueDate||due,invoice_url:firstPayment.invoiceUrl||firstPayment.bankSlipUrl||null,raw:firstPayment
        },{onConflict:'provider_payment_id'});
        if(['PIX','BOLETO','UNDEFINED'].includes(billingType)){
          const qrResponse=await fetch(`${base}/payments/${firstPayment.id}/pixQrCode`,{headers});
          if(qrResponse.ok)pix=await qrResponse.json();
        }
      }
    }catch(e){console.warn('initial payment lookup',e)}

    return json({
      ok:true,
      subscription,
      provider:{id:asaasSub.id,status:asaasSub.status||null},
      checkout:{
        paymentId:firstPayment?.id||null,
        dueDate:firstPayment?.dueDate||due,
        invoiceUrl:firstPayment?.invoiceUrl||firstPayment?.bankSlipUrl||null,
        billingType:firstPayment?.billingType||billingType,
        pixPayload:pix?.payload||null,
        pixEncodedImage:pix?.encodedImage||null,
        pixExpirationDate:pix?.expirationDate||null
      }
    });
  }catch(e){console.error(e);return json({error:e instanceof Error?e.message:String(e)},500)}
});
