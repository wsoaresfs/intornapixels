(function(global){
  'use strict';
  const PLATFORM_KEY='intorna_pixels_platform_v3';
  const SESSION_KEY='intorna_pixels_session_v3';
  const ACTIVE_STUDIO_KEY='intorna_pixels_active_studio_v3';
  const LEGACY_KEY='intorna_pixels_saas_v1';
  const now=()=>new Date().toISOString();
  const plusDays=(days)=>{const d=new Date();d.setDate(d.getDate()+days);return d.toISOString()};
  const uid=(prefix='id')=>`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const clone=(v)=>JSON.parse(JSON.stringify(v));
  const defaultPlans=[
    {id:'free',name:'Gratuito',price:0,orderLimit:10,clientLimit:5,userLimit:1,active:true,features:['Até 10 ensaios/mês','Até 5 clientes','CRM básico','Gerador básico']},
    {id:'start',name:'Start',price:19.90,orderLimit:30,clientLimit:9999,userLimit:1,active:true,features:['Até 30 ensaios/mês','Clientes ilimitados','AI Director','Financeiro básico','Marca-d’água em lote']},
    {id:'pro',name:'Pro',price:39.90,orderLimit:150,clientLimit:9999,userLimit:2,active:true,features:['Até 150 ensaios/mês','Biblioteca completa','Dashboard financeiro','WhatsApp','Upsell de fotos extras']},
    {id:'studio',name:'Studio',price:69.90,orderLimit:9999,clientLimit:9999,userLimit:5,active:true,features:['Limite elevado','Marca personalizada','Até 5 usuários','Relatórios','Suporte prioritário']}
  ];
  const blankWorkspace=(brand='Meu Estúdio',plan='free')=>({
    config:{brand,whatsapp:'',pix:'',deadline:'24 horas',delivery:'Olá, {cliente}! Seu ensaio está pronto. Obrigado por confiar no nosso trabalho.',plan,watermarkText:'PRÉVIA • {marca}',watermarkOpacity:32,watermarkPosition:'diagonal',watermarkSize:10,extraPhotoPrice:4.90,bundle3Price:12.90,bundle5Price:19.90},
    clients:[],orders:[],checklists:{},createdAt:now()
  });
  function seed(){
    let legacy=null;
    try{legacy=JSON.parse(localStorage.getItem(LEGACY_KEY)||'null')}catch{}
    const workspace=legacy&&typeof legacy==='object'?legacy:blankWorkspace('Transforma Foto Studio','studio');
    workspace.config={...blankWorkspace().config,...(workspace.config||{}),brand:'Transforma Foto Studio',plan:'studio'};
    return {
      version:3,
      createdAt:now(),
      admins:[{id:'admin_root',name:'Wagner',email:'admin@intornapixels.com.br',password:'Admin@2026',role:'superadmin',active:true,createdAt:now()}],
      studios:[{id:'studio_principal',name:'Transforma Foto Studio',ownerName:'Wagner',email:'studio@intornapixels.com.br',password:'Studio@2026',whatsapp:'',city:'Santa Maria de Jetibá/ES',plan:'studio',status:'active',billingStatus:'paid',nextBillingAt:plusDays(30),trialEndsAt:'',createdAt:now(),notes:'Conta principal da operação.',workspace}],
      plans:clone(defaultPlans),coupons:[],notices:[{id:uid('notice'),title:'Bem-vindo à Intorná Pixels',body:'A Central Administrativa e a área operacional estão ativas nesta versão.',audience:'all',active:true,createdAt:now()}],tickets:[],logs:[{id:uid('log'),at:now(),type:'system',message:'Plataforma v3 inicializada.',studioId:null}],
      settings:{brand:'Intorná Pixels',supportEmail:'suporte@intornapixels.com.br',supportWhatsapp:'',pix:'',trialDays:7,maintenance:false,maintenanceMessage:'Estamos realizando uma atualização rápida. Tente novamente em alguns minutos.'}
    };
  }
  function ensure(){
    let data=null;
    try{data=JSON.parse(localStorage.getItem(PLATFORM_KEY)||'null')}catch{}
    if(!data||typeof data!=='object')data=seed();
    data.plans=Array.isArray(data.plans)&&data.plans.length?data.plans:clone(defaultPlans);
    data.admins=Array.isArray(data.admins)&&data.admins.length?data.admins:seed().admins;
    data.studios=Array.isArray(data.studios)?data.studios:[];
    data.coupons=Array.isArray(data.coupons)?data.coupons:[];
    data.notices=Array.isArray(data.notices)?data.notices:[];
    data.tickets=Array.isArray(data.tickets)?data.tickets:[];
    data.logs=Array.isArray(data.logs)?data.logs:[];
    data.settings={...seed().settings,...(data.settings||{})};
    data.studios.forEach(s=>{s.workspace=s.workspace||blankWorkspace(s.name,s.plan);s.workspace.config={...blankWorkspace().config,...(s.workspace.config||{}),brand:s.name,plan:s.plan};});
    save(data);return data;
  }
  function save(data){localStorage.setItem(PLATFORM_KEY,JSON.stringify(data));return data}
  function session(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
  function setSession(value){if(value)localStorage.setItem(SESSION_KEY,JSON.stringify(value));else localStorage.removeItem(SESSION_KEY)}
  function logout(){setSession(null);localStorage.removeItem(ACTIVE_STUDIO_KEY)}
  function log(data,type,message,studioId=null){data.logs.unshift({id:uid('log'),at:now(),type,message,studioId});data.logs=data.logs.slice(0,500)}
  function plan(data,id){return data.plans.find(p=>p.id===id)||data.plans[0]}
  function studio(data,id){return data.studios.find(s=>s.id===id)}
  function activeStudioId(){return localStorage.getItem(ACTIVE_STUDIO_KEY)||''}
  function setActiveStudio(id){localStorage.setItem(ACTIVE_STUDIO_KEY,id)}
  function monthlyOrders(workspace){const n=new Date();return (workspace?.orders||[]).filter(o=>{const d=new Date(o.createdAt);return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear()}).length}
  function mrr(data){return data.studios.filter(s=>s.status==='active'&&s.billingStatus==='paid').reduce((t,s)=>t+Number(plan(data,s.plan).price||0),0)}
  function login(email,password){
    const data=ensure();const e=String(email||'').trim().toLowerCase();
    const admin=data.admins.find(a=>a.active&&a.email.toLowerCase()===e&&a.password===password);
    if(admin){const ses={role:'admin',userId:admin.id,name:admin.name,at:now()};setSession(ses);log(data,'auth',`Administrador ${admin.name} entrou.`);save(data);return {ok:true,session:ses,redirect:'/admin/'}}
    const s=data.studios.find(x=>x.email.toLowerCase()===e&&x.password===password);
    if(!s)return {ok:false,message:'E-mail ou senha inválidos.'};
    if(['blocked','cancelled'].includes(s.status))return {ok:false,message:s.status==='blocked'?'A conta está bloqueada. Fale com o suporte.':'A assinatura foi cancelada.'};
    if(data.settings.maintenance)return {ok:false,message:data.settings.maintenanceMessage};
    const ses={role:'studio',studioId:s.id,userId:s.id,name:s.ownerName||s.name,at:now()};setActiveStudio(s.id);setSession(ses);log(data,'auth',`Estúdio ${s.name} entrou.`,s.id);save(data);return {ok:true,session:ses,redirect:'/app/'}
  }
  function requireRole(role){const s=session();return !!s&&s.role===role}
  global.IntornaPlatform={PLATFORM_KEY,SESSION_KEY,ACTIVE_STUDIO_KEY,LEGACY_KEY,defaultPlans,blankWorkspace,ensure,save,session,setSession,logout,log,plan,studio,activeStudioId,setActiveStudio,monthlyOrders,mrr,login,requireRole,uid,now,plusDays,clone};
})(window);
