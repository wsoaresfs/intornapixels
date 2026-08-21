(function(global){
'use strict';

const cfg=global.INTORNA_BACKEND||{};
if(!global.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey){
  console.error('Intorná Cloud: configuração Supabase ausente.');
  return;
}

const client=global.supabase.createClient(
  cfg.supabaseUrl,
  cfg.supabasePublishableKey,
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
);

const KEY='intorna_pixels_saas_v1';

const defaults={
  brand:'Meu Estúdio',
  whatsapp:'',
  pix:'',
  deadline:'24 horas',
  delivery:'Olá, {cliente}! Seu ensaio está pronto. Obrigado por confiar no nosso trabalho.',
  plan:'free',
  watermarkText:'PRÉVIA • {marca}',
  watermarkOpacity:32,
  watermarkPosition:'diagonal',
  watermarkSize:10,
  extraPhotoPrice:4.90,
  bundle3Price:12.90,
  bundle5Price:19.90
};

const PACKAGE_MAP={
  essencial:{name:'Essencial',photos:3},
  premium:{name:'Premium',photos:6},
  gold:{name:'Gold',photos:10},
  platinum:{name:'Platinum',photos:20}
};

const statusFromDb={
  aguardando_fotos:'Aguardando fotos',
  pagamento_pendente:'Pagamento pendente',
  em_producao:'Em produção',
  em_revisao:'Em revisão',
  pronto:'Pronto para entrega',
  entregue:'Entregue',
  cancelado:'Cancelado'
};

const payFromDb={
  pending:'Pendente',
  confirmed:'Parcial',
  received:'Pago',
  overdue:'Pendente',
  refunded:'Pendente',
  cancelled:'Pendente',
  failed:'Pendente'
};

const isUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
const clone=v=>JSON.parse(JSON.stringify(v));
const uuid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function getSession(){
  const {data,error}=await client.auth.getSession();
  if(error)throw error;
  return data.session;
}

async function getUser(){
  const {data,error}=await client.auth.getUser();
  if(error)throw error;
  return data.user;
}

async function invokeFunction(name,body={}){
  const {data,error}=await client.functions.invoke(name,{body});
  if(data?.error)throw new Error(String(data.error));
  if(error)throw error;
  return data||{};
}

async function bootstrap(profile={}){
  return invokeFunction('bootstrap-account',profile);
}

async function isAdmin(userId){
  const {data,error}=await client.from('platform_admins').select('user_id').eq('user_id',userId).maybeSingle();
  if(error)throw error;
  return !!data;
}

function roleRank(role){
  return ({owner:0,admin:1,manager:2,member:3})[String(role||'')]??9;
}

async function getMembership(userId){
  const {data,error}=await client
    .from('studio_members')
    .select('studio_id,role,active,studios(id,name,owner_user_id,whatsapp,city,plan_id,status,billing_status,trial_ends_at,next_billing_at,settings,created_at)')
    .eq('user_id',userId)
    .eq('active',true);
  if(error)throw error;

  const rows=(data||[]).filter(x=>x?.studio_id&&x?.studios);
  rows.sort((a,b)=>{
    const ao=a.studios?.owner_user_id===userId?0:1;
    const bo=b.studios?.owner_user_id===userId?0:1;
    if(ao!==bo)return ao-bo;
    const rr=roleRank(a.role)-roleRank(b.role);
    if(rr!==0)return rr;
    return String(a.studio_id).localeCompare(String(b.studio_id));
  });
  return rows[0]||null;
}

async function context(profile={}){
  const session=await getSession();
  if(!session)return null;
  const user=session.user;

  let boot=null;
  try{boot=await bootstrap(profile)}catch(e){console.warn('RC19 bootstrap',e)}

  const admin=boot?.is_platform_admin??await isAdmin(user.id);
  let member=await getMembership(user.id);

  if(!member&&boot?.studio_id){
    const {data:studio,error}=await client
      .from('studios')
      .select('id,name,owner_user_id,whatsapp,city,plan_id,status,billing_status,trial_ends_at,next_billing_at,settings,created_at')
      .eq('id',boot.studio_id)
      .maybeSingle();
    if(!error&&studio)member={studio_id:studio.id,role:'owner',active:true,studios:studio};
  }

  return {
    session,
    user,
    isAdmin:!!admin,
    member,
    studioId:member?.studio_id||boot?.studio_id||null,
    studio:member?.studios||boot?.studio||null
  };
}

async function route(profile={}){
  const ctx=await context(profile);
  if(!ctx)return '/portal/';
  return ctx.isAdmin?'/admin/':'/app/';
}

async function requireStudio(){
  const ctx=await context();
  if(!ctx){location.replace('/portal/');return null}

  const impersonate=ctx.isAdmin?localStorage.getItem('intorna_impersonate_studio'):null;
  if(impersonate){
    const {data,error}=await client
      .from('studios')
      .select('id,name,owner_user_id,whatsapp,city,plan_id,status,billing_status,trial_ends_at,next_billing_at,settings,created_at')
      .eq('id',impersonate)
      .single();

    if(error){
      localStorage.removeItem('intorna_impersonate_studio');
      throw error;
    }
    ctx.studioId=data.id;
    ctx.studio=data;
    ctx.impersonating=true;
  }else{
    const member=await getMembership(ctx.user.id);
    if(member){
      ctx.member=member;
      ctx.studioId=member.studio_id;
      ctx.studio=member.studios;
      ctx.impersonating=false;
    }
  }

  if(!ctx.studioId||!ctx.studio){
    location.replace('/portal/');
    return null;
  }

  if(['blocked','cancelled'].includes(String(ctx.studio.status))&&!ctx.isAdmin){
    await client.auth.signOut();
    alert('Esta conta não está liberada. Entre em contato com o suporte.');
    location.replace('/portal/');
    return null;
  }
  return ctx;
}

async function requireAdmin(){
  const ctx=await context();
  if(!ctx){location.replace('/portal/');return null}
  if(!ctx.isAdmin){location.replace('/app/');return null}
  return ctx;
}

async function signOut(){
  await client.auth.signOut();
  localStorage.removeItem(KEY);
  localStorage.removeItem('intorna_impersonate_studio');
  location.href='/portal/';
}

function normalizeWorkspace(ws){
  ws=ws&&typeof ws==='object'?ws:{config:{},clients:[],orders:[],checklists:{}};
  ws.config={...defaults,...(ws.config||{})};
  ws.clients=Array.isArray(ws.clients)?ws.clients:[];
  ws.orders=Array.isArray(ws.orders)?ws.orders:[];
  ws.checklists=ws.checklists&&typeof ws.checklists==='object'?ws.checklists:{};

  const clientMap=new Map();
  ws.clients.forEach(c=>{
    if(!isUuid(c.id)){const old=c.id;c.id=uuid();clientMap.set(old,c.id)}
  });

  const orderMap=new Map();
  ws.orders.forEach(o=>{
    if(clientMap.has(o.clientId))o.clientId=clientMap.get(o.clientId);
    if(!isUuid(o.id)){const old=o.id;o.id=uuid();orderMap.set(old,o.id)}
    o.extraSales=Array.isArray(o.extraSales)?o.extraSales:[];
    o.extraSales.forEach(s=>{if(!isUuid(s.id))s.id=uuid()});
  });

  if(clientMap.size){
    const crm={};
    Object.entries(ws.config.crm||{}).forEach(([k,v])=>crm[clientMap.get(k)||k]=v);
    ws.config.crm=crm;
    if(Array.isArray(ws.config.quotes)){
      ws.config.quotes.forEach(q=>{
        if(clientMap.has(q.clientId))q.clientId=clientMap.get(q.clientId);
      });
    }
  }

  if(orderMap.size){
    const checks={};
    Object.entries(ws.checklists).forEach(([k,v])=>checks[orderMap.get(k)||k]=v);
    ws.checklists=checks;

    const paid={};
    Object.entries(ws.config.orderPaymentDates||{}).forEach(([k,v])=>paid[orderMap.get(k)||k]=v);
    ws.config.orderPaymentDates=paid;

    if(Array.isArray(ws.config.quotes)){
      ws.config.quotes.forEach(q=>{
        if(orderMap.has(q.orderId))q.orderId=orderMap.get(q.orderId);
      });
    }
  }
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

  const studio=studioR.data;
  const salesBy={};
  (salesR.data||[]).forEach(s=>{
    (salesBy[s.order_id]??=[]).push({
      id:s.id,
      qty:Number(s.quantity||0),
      value:Number(s.amount||0),
      payment:s.payment_status==='received'?'Pago':'Pendente',
      createdAt:s.created_at
    });
  });

  const checklists={};
  (checksR.data||[]).forEach(c=>{
    checklists[c.order_id]=Array.isArray(c.items)?c.items:(c.items?.checked||[]);
  });

  return normalizeWorkspace({
    config:{
      ...defaults,
      ...(studio.settings?.operational||{}),
      brand:studio.name,
      whatsapp:studio.whatsapp||studio.settings?.operational?.whatsapp||'',
      plan:studio.plan_id
    },
    clients:(clientsR.data||[]).map(c=>({
      id:c.id,
      name:c.name,
      email:c.email||'',
      whatsapp:c.whatsapp||'',
      city:c.city||'',
      importantDate:c.important_date||'',
      notes:c.notes||'',
      whatsappStage:c.whatsapp_stage||'novo_lead',
      lastContactAt:c.last_contact_at||null,
      lastContactNote:c.last_contact_note||'',
      createdAt:c.created_at
    })),
    orders:(ordersR.data||[]).map(o=>({
      id:o.id,
      clientId:o.client_id,
      packageId:o.package_id||String(o.package_name||'essencial').toLowerCase(),
      type:o.essay_type||'',
      format:o.format||'4:5',
      payment:payFromDb[o.payment_status]||'Pendente',
      paymentMethod:o.payment_method||'Pix',
      status:statusFromDb[o.status]||'Aguardando fotos',
      deadline:o.deadline_at||'',
      extras:Array.isArray(o.extras)?o.extras:[],
      notes:o.notes||'',
      extraOfferQty:Number(o.extra_offer_qty||0),
      extraStrategy:o.extra_strategy||'avulsa',
      watermarkExtras:o.watermark_extras!==false,
      extraSales:salesBy[o.id]||[],
      total:Number(o.order_value||0),
      createdAt:o.created_at
    })),
    checklists,
    createdAt:studio.created_at
  });
}

async function fallbackSync(){
  throw new Error('Camada segura de sincronização ainda não foi instalada.');
}
fallbackSync.__rc19Fallback=true;

function fallbackInstall(){
  console.warn('RC19: sincronização segura será instalada pelo bootstrap-cloud.');
}
fallbackInstall.__rc19Fallback=true;

async function hydrateWorkspace(ctx){
  const remote=await fetchWorkspace(ctx);
  let legacy=null;
  try{legacy=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}

  const remoteEmpty=!remote.clients.length&&!remote.orders.length;
  const legacyHasData=legacy&&((legacy.clients||[]).length||(legacy.orders||[]).length);

  if(remoteEmpty&&legacyHasData){
    const migrated=normalizeWorkspace(clone(legacy));
    migrated.config={...defaults,...migrated.config,brand:ctx.studio.name,plan:ctx.studio.plan_id};

    const sync=global.IntornaCloud?.syncWorkspace;
    if(sync&&!sync.__rc19Fallback){
      await sync(ctx,migrated);
    }else{
      console.warn('RC19: migração local aguardando camada delta segura.');
    }
    return migrated;
  }
  return remote;
}

async function notices(ctx){
  const {data,error}=await client.from('announcements').select('*').eq('active',true).order('created_at',{ascending:false});
  if(error)throw error;
  return (data||[]).filter(n=>n.audience==='all'||n.audience===ctx.studio?.plan_id);
}

async function listTickets(ctx){
  const {data,error}=await client.from('support_tickets').select('*').eq('studio_id',ctx.studioId).order('created_at',{ascending:false});
  if(error)throw error;
  return data||[];
}

async function sendTicket(ctx,{subject,message,priority}){
  const {error}=await client.from('support_tickets').insert({
    studio_id:ctx.studioId,
    opened_by:ctx.user.id,
    subject,
    message,
    priority
  });
  if(error)throw error;
}

async function adminAction(action,payload={}){
  return invokeFunction('admin-control',{action,...payload});
}

async function createSubscription(ctx,planId,billingType='PIX'){
  return invokeFunction('create-asaas-subscription',{studioId:ctx.studioId,planId,billingType});
}

async function listSubscriptions(ctx){
  const {data,error}=await client.from('subscriptions').select('*').eq('studio_id',ctx.studioId).order('created_at',{ascending:false});
  if(error)throw error;
  return data||[];
}

async function listBillingPayments(ctx){
  const {data,error}=await client.from('payments').select('*').eq('studio_id',ctx.studioId).order('created_at',{ascending:false});
  if(error)throw error;
  return data||[];
}

async function cancelSubscription(subscriptionId){
  return invokeFunction('cancel-asaas-subscription',{subscriptionId});
}

global.IntornaCloud={
  client,
  cfg,
  KEY,
  defaults,
  getSession,
  getUser,
  bootstrap,
  isAdmin,
  getMembership,
  context,
  route,
  requireStudio,
  requireAdmin,
  signOut,
  normalizeWorkspace,
  fetchWorkspace,
  hydrateWorkspace,
  syncWorkspace:fallbackSync,
  installWorkspaceSync:fallbackInstall,
  listTickets,
  sendTicket,
  notices,
  invokeFunction,
  adminAction,
  createSubscription,
  listSubscriptions,
  listBillingPayments,
  cancelSubscription
};

})(window);
