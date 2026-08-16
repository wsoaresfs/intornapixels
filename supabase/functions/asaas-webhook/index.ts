import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.102.0";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const statusMap:Record<string,string>={PENDING:'pending',CONFIRMED:'confirmed',RECEIVED:'received',OVERDUE:'overdue',REFUNDED:'refunded',REFUND_REQUESTED:'refunded',DELETED:'cancelled',CHARGEBACK_REQUESTED:'failed',CHARGEBACK_DISPUTE:'failed'};
function secretKey(){const modern=Deno.env.get('SUPABASE_SECRET_KEYS');if(modern){try{const p=JSON.parse(modern);if(p?.default)return p.default as string}catch(_){}}return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''}
Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json({ok:false},405);
  try{
    const url=Deno.env.get('SUPABASE_URL')||'',secret=secretKey();
    if(!url||!secret)return json({error:'Backend incompleto'},503);
    const service=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:vaultToken}=await service.rpc('get_platform_integration_secret',{p_provider:'asaas_webhook'});
    const expected=String(vaultToken||Deno.env.get('ASAAS_WEBHOOK_TOKEN')||'');
    const received=req.headers.get('asaas-access-token')||'';
    if(!expected||received!==expected)return json({error:'Webhook não autorizado'},401);
    const payload=await req.json();
    const event=String(payload.event||'UNKNOWN');
    const payment=payload.payment||{};
    const eventKey=String(payload.id||`${event}:${payment.id||crypto.randomUUID()}`);
    const {error:idemErr}=await service.from('webhook_events').insert({provider:'asaas',event_key:eventKey,payload});
    if(idemErr&&String(idemErr.code)==='23505')return json({ok:true,duplicate:true});
    if(idemErr)return json({error:idemErr.message},500);
    if(!payment.id)return json({ok:true,ignored:true});

    const rawStatus=String(payment.status||'');
    const mapped=statusMap[rawStatus]||(event.includes('OVERDUE')?'overdue':event.includes('RECEIVED')?'received':event.includes('CONFIRMED')?'confirmed':'pending');
    const billingType=String(payment.billingType||'');
    const settled=mapped==='received'||(mapped==='confirmed'&&billingType!=='PIX');
    const paidAt=settled?(payment.paymentDate?`${payment.paymentDate}T12:00:00Z`:new Date().toISOString()):null;

    const {data:clientPayment}=await service.from('client_payments').select('*').eq('provider_payment_id',payment.id).maybeSingle();
    if(clientPayment){
      const wasSettled=['confirmed','received'].includes(String(clientPayment.status));
      await service.from('client_payments').update({status:mapped,billing_type:billingType||clientPayment.billing_type,due_date:payment.dueDate||clientPayment.due_date,paid_at:paidAt,invoice_url:payment.invoiceUrl||payment.bankSlipUrl||clientPayment.invoice_url,raw:payment}).eq('id',clientPayment.id);
      if(settled&&!wasSettled){
        const {data:order}=await service.from('orders').select('order_value').eq('id',clientPayment.order_id).single();
        if(clientPayment.purchase_type==='upgrade'){
          const up=Array.isArray(clientPayment.items)?clientPayment.items[0]:null;
          if(up?.target_package)await service.from('orders').update({package_id:up.target_package,package_name:up.name,included_photos:Number(up.included_photos||0),order_value:Number(order?.order_value||0)+Number(clientPayment.amount||0)}).eq('id',clientPayment.order_id);
        }else{
          const itemIds=Array.isArray(clientPayment.items)?clientPayment.items.map((x:any)=>String(x.id||'')).filter(Boolean):[];
          if(itemIds.length)await service.from('gallery_items').update({status:'released',sold_at:new Date().toISOString()}).eq('order_id',clientPayment.order_id).in('id',itemIds);
          if(order)await service.from('orders').update({order_value:Number(order.order_value||0)+Number(clientPayment.amount||0)}).eq('id',clientPayment.order_id);
        }
      }
      await service.from('audit_logs').insert({studio_id:clientPayment.studio_id,user_id:null,event:`asaas_client_${event.toLowerCase()}`,payload:{client_payment_id:clientPayment.id,payment_id:payment.id,status:mapped}});
      return json({ok:true,client_payment:true,settled});
    }

    let studioId:string|null=String(payment.externalReference||'').startsWith('client_payment:')?null:(payment.externalReference||null);
    let subscriptionUuid:string|null=null;
    let targetPlan:string|null=null;
    if(payment.subscription){
      const {data:sub}=await service.from('subscriptions').select('id,studio_id,plan_id').eq('provider_subscription_id',payment.subscription).maybeSingle();
      if(sub){subscriptionUuid=sub.id;studioId=sub.studio_id;targetPlan=sub.plan_id}
    }
    if(!studioId)return json({ok:true,ignored:'studio_not_resolved'});

    const {error:payErr}=await service.from('payments').upsert({
      studio_id:studioId,subscription_id:subscriptionUuid,provider:'asaas',provider_payment_id:payment.id,
      amount:Number(payment.value||0),status:mapped,billing_type:billingType||null,due_date:payment.dueDate||null,
      paid_at:paidAt,invoice_url:payment.invoiceUrl||payment.bankSlipUrl||null,raw:payment
    },{onConflict:'provider_payment_id'});
    if(payErr)throw payErr;

    if(subscriptionUuid){
      const subUpdates:Record<string,unknown>={status:settled?'active':mapped};
      if(payment.dueDate)subUpdates.next_due_date=payment.dueDate;
      await service.from('subscriptions').update(subUpdates).eq('id',subscriptionUuid);
    }
    if(settled){
      const updates:Record<string,unknown>={billing_status:'paid',status:'active'};
      if(targetPlan)updates.plan_id=targetPlan;
      await service.from('studios').update(updates).eq('id',studioId);
      const {data:ref}=await service.from('referrals').select('id').eq('referred_studio_id',studioId).eq('status','pending').maybeSingle();
      if(ref)await service.from('referrals').update({status:'qualified',qualified_at:new Date().toISOString()}).eq('id',ref.id);
    }else if(mapped==='overdue'){
      await service.from('studios').update({billing_status:'overdue'}).eq('id',studioId);
    }else if(['refunded','failed','cancelled'].includes(mapped)){
      await service.from('studios').update({billing_status:mapped==='cancelled'?'cancelled':'overdue',status:'blocked'}).eq('id',studioId);
    }
    await service.from('audit_logs').insert({studio_id:studioId,user_id:null,event:`asaas_${event.toLowerCase()}`,payload:{payment_id:payment.id,status:mapped}});
    return json({ok:true,settled});
  }catch(e){console.error(e);return json({error:e instanceof Error?e.message:String(e)},500)}
});
