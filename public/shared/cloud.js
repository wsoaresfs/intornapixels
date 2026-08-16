(function(global){
  'use strict';
  const cfg=global.INTORNA_BACKEND||{};
  if(!global.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey){
    console.error('Intorná Cloud: configuração do Supabase ausente.');
    return;
  }
  const client=global.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  const KEY='intorna_pixels_saas_v1';
  const PACKAGE_MAP={
    essencial:{name:'Essencial',photos:3},premium:{name:'Premium',photos:6},gold:{name:'Gold',photos:10},platinum:{name:'Platinum',photos:20}
  };
  const defaults={brand:'Meu Estúdio',whatsapp:'',pix:'',deadline:'24 horas',delivery:'Olá, {cliente}! Seu ensaio está pronto. Obrigado por confiar no nosso trabalho.',plan:'free',watermarkText:'PRÉVIA • {marca}',watermarkOpacity:32,watermarkPosition:'diagonal',watermarkSize:10,extraPhotoPrice:4.90,bundle3Price:12.90,bundle5Price:19.90};
  const statusToDb={'Aguardando fotos':'aguardando_fotos','Pagamento pendente':'pagamento_pendente','Em produção':'em_producao','Em revisão':'em_revisao','Pronto para entrega':'pronto','Entregue':'entregue','Cancelado':'cancelado'};
  const statusFromDb={aguardando_fotos:'Aguardando fotos',pagamento_pendente:'Pagamento pendente',em_producao:'Em produção',em_revisao:'Em revisão',pronto:'Pronto para entrega',entregue:'Entregue',cancelado:'Cancelado'};
  const payToDb={Pendente:'pending',Parcial:'confirmed',Pago:'received'};
  const payFromDb={pending:'Pendente',confirmed:'Parcial',received:'Pago',overdue:'Pendente',refunded:'Pendente',cancelled:'Pendente',failed:'Pendente'};
  const isUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
  const uuid=()=>crypto.randomUUID();
  const clone=v=>JSON.parse(JSON.stringify(v));
  let syncTimer=null;
  let syncRunning=false;
  let nativeSet=localStorage.setItem.bind(localStorage);

  async function getSession(){const {data,error}=await client.auth.getSession();if(error)throw error;return data.session}
  async function getUser(){const {data,error}=await client.auth.getUser();if(error)throw error;return data.user}
  async function bootstrap(profile={}){let result=await client.functions.invoke('bootstrap-account',{body:profile});if(result.error){const status=result.error?.context?.status||result.error?.status||0;if(Number(status)===401||String(result.error.message||'').includes('401')){await client.auth.refreshSession().catch(()=>null);result=await client.functions.invoke('bootstrap-account',{body:profile})}}if(result.error)throw result.error;if(result.data?.error)throw new Error(result.data.error);return result.data}
  async function isAdmin(userId){const {data,error}=await client.from('platform_admins').select('user_id').eq('user_id',userId).maybeSingle();if(error)throw error;return !!data}
  async function getMembership(userId){const {data,error}=await client.from('studio_members').select('studio_id,role,active,studios(id,name,whatsapp,city,plan_id,status,billing_status,trial_ends_at,next_billing_at,settings)').eq('user_id',userId).eq('active',true).limit(1);if(error)throw error;return data?.[0]||null}
  async function context(profile={}){
    const session=await getSession();
    if(!session)return null;
    const user=session.user;
    const boot=await bootstrap(profile);
    const admin=boot?.is_platform_admin??await isAdmin(user.id);
    const member=await getMembership(user.id);
    return {session,user,isAdmin:!!admin,member,studioId:member?.studio_id||boot?.studio_id||null,studio:member?.studios||boot?.studio||null};
  }
  async function route(profile={}){const ctx=await context(profile);if(!ctx)return '/portal/';return ctx.isAdmin?'/admin/':'/app/'}
  async function requireStudio(){
    const ctx=await context();
    if(!ctx){location.replace('/portal/');return null}
    const impersonate=ctx.isAdmin?localStorage.getItem('intorna_impersonate_studio'):null;
    if(impersonate){
      const {data,error}=await client.from('studios').select('id,name,whatsapp,city,plan_id,status,billing_status,trial_ends_at,next_billing_at,settings,created_at').eq('id',impersonate).single();
      if(error){localStorage.removeItem('intorna_impersonate_studio');throw error}
      ctx.studioId=data.id;ctx.studio=data;ctx.impersonating=true;
    }
    if(!ctx.studioId||!ctx.studio){location.replace('/portal/');return null}
    if(['blocked','cancelled'].includes(ctx.studio.status)&&!ctx.isAdmin){await client.auth.signOut();alert('Esta conta não está liberada. Entre em contato com o suporte.');location.replace('/portal/');return null}
    return ctx;
  }
  async function requireAdmin(){
    const ctx=await context();
    if(!ctx){location.replace('/portal/');return null}
    if(!ctx.isAdmin){location.replace('/app/');return null}
    return ctx;
  }
  async function signOut(){await client.auth.signOut();localStorage.removeItem(KEY);localStorage.removeItem('intorna_impersonate_studio');location.href='/portal/'}

  function normalizeWorkspace(ws){
    ws=ws&&typeof ws==='object'?ws:{config:{},clients:[],orders:[],checklists:{}};
    ws.config={...defaults,...(ws.config||{})};
    ws.clients=Array.isArray(ws.clients)?ws.clients:[];ws.orders=Array.isArray(ws.orders)?ws.orders:[];ws.checklists=ws.checklists||{};
    const clientMap=new Map();
    ws.clients.forEach(c=>{if(!isUuid(c.id)){const old=c.id;c.id=uuid();clientMap.set(old,c.id)}});
    const orderMap=new Map();
    ws.orders.forEach(o=>{if(clientMap.has(o.clientId))o.clientId=clientMap.get(o.clientId);if(!isUuid(o.id)){const old=o.id;o.id=uuid();orderMap.set(old,o.id)};(o.extraSales||[]).forEach(s=>{if(!isUuid(s.id))s.id=uuid()})});
    if(orderMap.size){const next={};Object.entries(ws.checklists).forEach(([k,v])=>next[orderMap.get(k)||k]=v);ws.checklists=next}
    return ws;
  }

  async function fetchWorkspace(ctx){
    const sid=ctx.studioId;
    const [studioR,clientsR,ordersR,salesR,checksR]=await Promise.all([
      client.from('studios').select('*').eq('id',sid).single(),
      client.from('clients').select('*').eq('studio_id',sid).order('created_at'),
      client.from('orders').select('*').eq('studio_id',sid).order('created_at'),
      client.from('extra_sales').select('*').eq('studio_id',sid).order('created_at'),
      client.from('checklists').select('*').eq('studio_id',sid)
    ]);
    for(const r of [studioR,clientsR,ordersR,salesR,checksR])if(r.error)throw r.error;
    const studio=studioR.data,salesBy={};
    (salesR.data||[]).forEach(s=>{(salesBy[s.order_id]??=[]).push({id:s.id,qty:Number(s.quantity),value:Number(s.amount),payment:s.payment_status==='received'?'Pago':'Pendente',createdAt:s.created_at})});
    const checklists={};(checksR.data||[]).forEach(c=>checklists[c.order_id]=Array.isArray(c.items)?c.items:(c.items?.checked||[]));
    return normalizeWorkspace({
      config:{...defaults,...(studio.settings?.operational||{}),brand:studio.name,whatsapp:studio.whatsapp||studio.settings?.operational?.whatsapp||'',plan:studio.plan_id},
      clients:(clientsR.data||[]).map(c=>({id:c.id,name:c.name,email:c.email||'',whatsapp:c.whatsapp||'',city:c.city||'',importantDate:c.important_date||'',notes:c.notes||'',whatsappStage:c.whatsapp_stage||'novo_lead',lastContactAt:c.last_contact_at||'',lastContactNote:c.last_contact_note||'',createdAt:c.created_at})),
      orders:(ordersR.data||[]).map(o=>({id:o.id,clientId:o.client_id,packageId:o.package_id||String(o.package_name||'essencial').toLowerCase(),type:o.essay_type||'',format:o.format||'4:5',payment:payFromDb[o.payment_status]||'Pendente',paymentMethod:o.payment_method||'Pix',status:statusFromDb[o.status]||'Aguardando fotos',deadline:o.deadline_at||'',extras:Array.isArray(o.extras)?o.extras:[],notes:o.notes||'',extraOfferQty:Number(o.extra_offer_qty||0),extraStrategy:o.extra_strategy||'avulsa',watermarkExtras:o.watermark_extras!==false,extraSales:salesBy[o.id]||[],total:Number(o.order_value||0),createdAt:o.created_at})),
      checklists,createdAt:studio.created_at
    });
  }

  async function syncWorkspace(ctx,workspace){
    if(syncRunning){clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncWorkspace(ctx,workspace).catch(console.error),300);return;}syncRunning=true;
    try{
      const ws=normalizeWorkspace(workspace),sid=ctx.studioId;
      nativeSet(KEY,JSON.stringify(ws));
      const studioSettings={...(ctx.studio?.settings||{}),operational:ws.config};
      let r=await client.from('studios').update({name:ws.config.brand||ctx.studio?.name||'Meu Estúdio',whatsapp:ws.config.whatsapp||null,settings:studioSettings}).eq('id',sid);if(r.error)throw r.error;
      const clientRows=ws.clients.map(c=>({id:c.id,studio_id:sid,name:c.name,email:c.email||null,whatsapp:c.whatsapp||null,city:c.city||null,important_date:c.importantDate||null,notes:c.notes||null,whatsapp_stage:c.whatsappStage||'novo_lead',last_contact_at:c.lastContactAt||null,last_contact_note:c.lastContactNote||null,created_at:c.createdAt||new Date().toISOString()}));
      if(clientRows.length){r=await client.from('clients').upsert(clientRows,{onConflict:'id'});if(r.error)throw r.error}
      const clientIds=clientRows.map(x=>x.id);let rem=await client.from('clients').select('id').eq('studio_id',sid);if(rem.error)throw rem.error;const delClients=(rem.data||[]).map(x=>x.id).filter(id=>!clientIds.includes(id));if(delClients.length){r=await client.from('clients').delete().in('id',delClients);if(r.error)throw r.error}
      const orderRows=ws.orders.map(o=>{const p=PACKAGE_MAP[o.packageId]||{name:o.packageId||'Pacote',photos:0};return {id:o.id,studio_id:sid,client_id:o.clientId,package_id:o.packageId||null,package_name:p.name,included_photos:p.photos,order_value:Number(o.total||0),essay_type:o.type||null,format:o.format||'4:5',status:statusToDb[o.status]||'aguardando_fotos',payment_status:payToDb[o.payment]||'pending',payment_method:o.paymentMethod||null,deadline_at:o.deadline||null,extra_offer_qty:Number(o.extraOfferQty||0),extra_strategy:o.extraStrategy||'avulsa',watermark_extras:o.watermarkExtras!==false,extras:Array.isArray(o.extras)?o.extras:[],notes:o.notes||null,created_at:o.createdAt||new Date().toISOString()}});
      if(orderRows.length){r=await client.from('orders').upsert(orderRows,{onConflict:'id'});if(r.error)throw r.error}
      rem=await client.from('orders').select('id').eq('studio_id',sid);if(rem.error)throw rem.error;const orderIds=orderRows.map(x=>x.id),delOrders=(rem.data||[]).map(x=>x.id).filter(id=>!orderIds.includes(id));if(delOrders.length){r=await client.from('orders').delete().in('id',delOrders);if(r.error)throw r.error}
      const saleRows=[];ws.orders.forEach(o=>(o.extraSales||[]).forEach(s=>saleRows.push({id:s.id,studio_id:sid,order_id:o.id,quantity:Number(s.qty||1),amount:Number(s.value||0),payment_status:s.payment==='Pago'?'received':'pending',created_at:s.createdAt||new Date().toISOString()})));
      if(saleRows.length){r=await client.from('extra_sales').upsert(saleRows,{onConflict:'id'});if(r.error)throw r.error}
      rem=await client.from('extra_sales').select('id').eq('studio_id',sid);if(rem.error)throw rem.error;const saleIds=saleRows.map(x=>x.id),delSales=(rem.data||[]).map(x=>x.id).filter(id=>!saleIds.includes(id));if(delSales.length){r=await client.from('extra_sales').delete().in('id',delSales);if(r.error)throw r.error}
      const checkRows=Object.entries(ws.checklists||{}).filter(([oid])=>orderIds.includes(oid)).map(([oid,items])=>({studio_id:sid,order_id:oid,items,completed:Array.isArray(items)&&items.length>=15,updated_at:new Date().toISOString()}));
      if(checkRows.length){r=await client.from('checklists').upsert(checkRows,{onConflict:'order_id'});if(r.error)throw r.error}
      rem=await client.from('checklists').select('order_id').eq('studio_id',sid);if(rem.error)throw rem.error;const checkIds=checkRows.map(x=>x.order_id),delChecks=(rem.data||[]).map(x=>x.order_id).filter(id=>!checkIds.includes(id));if(delChecks.length){r=await client.from('checklists').delete().in('order_id',delChecks);if(r.error)throw r.error}
      ctx.studio={...(ctx.studio||{}),name:ws.config.brand,settings:studioSettings};
    }finally{syncRunning=false}
  }

  async function hydrateWorkspace(ctx){
    // Cloud accounts must always hydrate from the authenticated studio.
    // Never auto-import the generic browser cache: it may belong to a
    // different account/studio previously used on the same device.
    // Manual backup import remains available from the app settings.
    return await fetchWorkspace(ctx);
  }
  function installWorkspaceSync(ctx){
    if(global.__intornaCloudPatched)return;global.__intornaCloudPatched=true;
    const original=localStorage.setItem.bind(localStorage);nativeSet=original;
    localStorage.setItem=function(key,value){original(key,value);if(key===KEY){clearTimeout(syncTimer);syncTimer=setTimeout(()=>{try{syncWorkspace(ctx,JSON.parse(value)).catch(e=>{console.error(e);global.toast?.('Falha ao sincronizar com o banco.')})}catch(e){console.error(e)}},450)}};
  }
  async function listTickets(ctx){const {data,error}=await client.from('support_tickets').select('*').eq('studio_id',ctx.studioId).order('created_at',{ascending:false});if(error)throw error;return data||[]}
  async function sendTicket(ctx,{subject,message,priority}){const {error}=await client.from('support_tickets').insert({studio_id:ctx.studioId,opened_by:ctx.user.id,subject,message,priority});if(error)throw error}
  async function notices(ctx){const {data,error}=await client.from('announcements').select('*').eq('active',true).order('created_at',{ascending:false});if(error)throw error;return (data||[]).filter(n=>n.audience==='all'||n.audience===ctx.studio?.plan_id)}
  async function invokeFunction(name,body={}){const {data,error}=await client.functions.invoke(name,{body});if(data?.error)throw new Error(data.error);if(error)throw error;return data}
  async function adminAction(action,payload={}){return invokeFunction('admin-control',{action,...payload})}
  async function createSubscription(ctx,planId,billingType='PIX'){return invokeFunction('create-asaas-subscription',{studioId:ctx.studioId,planId,billingType})}
  async function listSubscriptions(ctx){const {data,error}=await client.from('subscriptions').select('*').eq('studio_id',ctx.studioId).order('created_at',{ascending:false});if(error)throw error;return data||[]}
  async function listBillingPayments(ctx){const {data,error}=await client.from('payments').select('*').eq('studio_id',ctx.studioId).order('created_at',{ascending:false});if(error)throw error;return data||[]}
  async function cancelSubscription(subscriptionId){return invokeFunction('cancel-asaas-subscription',{subscriptionId})}

  global.IntornaCloud={client,cfg,KEY,defaults,getSession,getUser,bootstrap,isAdmin,getMembership,context,route,requireStudio,requireAdmin,signOut,normalizeWorkspace,hydrateWorkspace,syncWorkspace,installWorkspaceSync,listTickets,sendTicket,notices,adminAction,createSubscription,listSubscriptions,listBillingPayments,cancelSubscription};
})(window);
