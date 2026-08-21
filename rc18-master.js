(()=>{
'use strict';

const VERSION='RC18';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[m]));

let ctx=null;
let state={
  configured:false,
  baseUrl:'',
  webhookUrl:'',
  connection:null,
  sessions:null,
  loading:false
};

function toast(msg){
  if(window.toast){ window.toast(msg); return; }
  let t=$('#rc18Toast');
  if(!t){
    t=document.createElement('div');
    t.id='rc18Toast';
    t.className='rc18-toast';
    document.body.appendChild(t);
  }
  t.textContent=msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t=setTimeout(()=>t.classList.remove('show'),3000);
}

function addStyles(){
  if($('#rc18MasterStyles')) return;
  const s=document.createElement('style');
  s.id='rc18MasterStyles';
  s.textContent=`
    .rc18-nav-master{background:linear-gradient(135deg,rgba(245,158,11,.16),rgba(124,58,237,.14))!important;border:1px solid rgba(245,158,11,.24)!important}
    .rc18-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .rc18-hero{background:linear-gradient(135deg,#111b38,#182650);color:#fff;border:0}
    .rc18-kicker{font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:#fbbf24}
    .rc18-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
    .rc18-status{display:inline-flex;align-items:center;gap:7px;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:900;background:#eef2f7;color:#475569}
    .rc18-status.ok{background:#dcfce7;color:#166534}
    .rc18-status.warn{background:#fef3c7;color:#92400e}
    .rc18-status.bad{background:#fee2e2;color:#991b1b}
    .rc18-dot{width:8px;height:8px;border-radius:50%;background:currentColor}
    .rc18-form{display:grid;gap:10px;margin-top:14px}
    .rc18-form label{font-size:12px;font-weight:800}
    .rc18-form input{width:100%;box-sizing:border-box}
    .rc18-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    .rc18-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;word-break:break-all}
    .rc18-note{border:1px solid var(--line);border-radius:12px;padding:12px;margin-top:12px;background:rgba(148,163,184,.06)}
    .rc18-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
    .rc18-kpi{border:1px solid var(--line);border-radius:12px;padding:12px}
    .rc18-kpi small{display:block;color:var(--muted);margin-bottom:4px}
    .rc18-kpi b{font-size:18px}
    .rc18-toast{position:fixed;right:18px;bottom:18px;z-index:20000;background:#111827;color:#fff;padding:12px 16px;border-radius:12px;display:none;box-shadow:0 14px 38px rgba(0,0,0,.25)}
    .rc18-toast.show{display:block}
    .rc18-overview-card{border:1px solid rgba(245,158,11,.28)!important;background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(124,58,237,.07))!important}
    @media(max-width:900px){.rc18-grid{grid-template-columns:1fr}.rc18-kpis{grid-template-columns:1fr}}
  `;
  document.head.appendChild(s);
}

async function freshSession(){
  const c=window.IntornaCloud?.client;
  if(!c) throw new Error('Supabase não disponível.');
  let {data,error}=await c.auth.getSession();
  if(error) throw error;
  let session=data?.session;
  if(!session) throw new Error('Sessão expirada. Entre novamente.');
  const exp=Number(session.expires_at||0)*1000;
  if(!exp || exp-Date.now()<120000){
    const r=await c.auth.refreshSession();
    if(r.error || !r.data?.session) throw r.error || new Error('Não foi possível renovar a sessão.');
    session=r.data.session;
  }
  return session;
}

async function functionError(error){
  let msg=String(error?.message||'Falha no backend.');
  try{
    const c=error?.context;
    if(c && typeof c.clone==='function'){
      const d=await c.clone().json();
      msg=String(d?.error||msg);
    }
  }catch(_){}
  return new Error(msg);
}

async function connect(action,extra={}){
  const c=window.IntornaCloud.client;
  await freshSession();
  let r=await c.functions.invoke('waha-connect',{
    body:{action,studioId:ctx?.studioId||null,...extra}
  });
  if(r.error) throw await functionError(r.error);
  if(r.data?.error) throw new Error(String(r.data.error));
  return r.data||{};
}

function openMyStudio(){
  localStorage.removeItem('intorna_impersonate_studio');
  location.href='/app/';
}
window.rc18OpenMyStudio=openMyStudio;

function addNavigation(){
  const nav=$('.nav');
  if(!nav || $('#rc18MyStudioBtn')) return;

  const my=document.createElement('button');
  my.id='rc18MyStudioBtn';
  my.className='rc18-nav-master';
  my.innerHTML='<span class="ico">📸</span><span class="label">Meu Estúdio</span>';
  my.onclick=openMyStudio;

  const first=nav.querySelector('button[data-page="overview"]');
  if(first?.nextSibling) nav.insertBefore(my,first.nextSibling);
  else nav.prepend(my);

  const waha=document.createElement('button');
  waha.id='rc18WahaNav';
  waha.dataset.page='rc18waha';
  waha.innerHTML='<span class="ico">📱</span><span class="label">Infra WAHA</span>';
  waha.onclick=()=>{
    window.goPage?.('rc18waha');
    loadStatus();
  };

  const settings=nav.querySelector('button[data-page="settings"]');
  if(settings) nav.insertBefore(waha,settings);
  else nav.appendChild(waha);
}

function addOverviewCard(){
  const grid=$('#overview .grid');
  if(!grid || $('#rc18OverviewCard')) return;
  const card=document.createElement('div');
  card.id='rc18OverviewCard';
  card.className='card one rc18-overview-card';
  card.innerHTML=`
    <div class="rc18-kicker">MODO MASTER DUAL</div>
    <h2>📸 Venda suas próprias fotos</h2>
    <p>Use a mesma conta Master para administrar a plataforma e operar seu próprio estúdio, sem misturar os dados dos clientes SaaS.</p>
    <div class="row">
      <button class="btn gold" id="rc18OverviewStudio">Abrir Meu Estúdio</button>
      <button class="btn outline" id="rc18OverviewWaha">Infra WAHA</button>
    </div>
  `;
  grid.appendChild(card);
  $('#rc18OverviewStudio').onclick=openMyStudio;
  $('#rc18OverviewWaha').onclick=()=>{
    window.goPage?.('rc18waha');
    loadStatus();
  };
}

function addWahaPage(){
  const container=$('.container');
  if(!container || $('#rc18waha')) return;
  const page=document.createElement('section');
  page.className='page';
  page.id='rc18waha';
  page.innerHTML=`
    <div class="grid">
      <div class="card two rc18-hero">
        <div class="rc18-head">
          <div>
            <div class="rc18-kicker">INTORNÁ PIXELS • ${VERSION}</div>
            <h2>📱 Infraestrutura WhatsApp WAHA</h2>
            <p>Configuração global da plataforma. Cada estúdio continua com sua própria sessão e QR Code.</p>
          </div>
          <span class="rc18-status warn" id="rc18WahaMain"><span class="rc18-dot"></span> Verificando</span>
        </div>
      </div>

      <div class="card one">
        <div class="rc18-head">
          <div>
            <h2>Servidor WAHA</h2>
            <p class="muted">A API Key é enviada direto ao backend e protegida no Vault. Ela não fica salva no navegador.</p>
          </div>
          <span class="rc18-status bad" id="rc18WahaServer"><span class="rc18-dot"></span> Não configurado</span>
        </div>

        <div class="rc18-form">
          <div>
            <label>URL HTTPS do servidor WAHA</label>
            <input id="rc18WahaUrl" placeholder="https://seu-servidor.trycloudflare.com">
          </div>
          <div>
            <label>WAHA API Key</label>
            <input id="rc18WahaKey" type="password" autocomplete="new-password" placeholder="Cole a chave aqui">
          </div>
        </div>

        <div class="rc18-actions">
          <button class="btn primary" id="rc18SaveWaha">Validar e salvar</button>
          <button class="btn ghost" id="rc18RefreshWaha">Atualizar diagnóstico</button>
        </div>

        <div class="rc18-note">
          <b>Webhook:</b>
          <div class="rc18-code" id="rc18Webhook">—</div>
        </div>
      </div>

      <div class="card one">
        <h2>Diagnóstico</h2>
        <div class="rc18-kpis">
          <div class="rc18-kpi"><small>Servidor</small><b id="rc18DiagServer">—</b></div>
          <div class="rc18-kpi"><small>Sessões</small><b id="rc18DiagSessions">—</b></div>
          <div class="rc18-kpi"><small>Seu WhatsApp</small><b id="rc18DiagPhone">—</b></div>
        </div>
        <div class="rc18-note" id="rc18TunnelNote">
          O endereço gratuito <b>trycloudflare.com</b> é adequado para demonstração. Se o PC ou o túnel reiniciar, a URL pode mudar.
        </div>
        <div class="rc18-actions">
          <button class="btn gold" id="rc18OpenStudio">📸 Abrir Meu Estúdio</button>
        </div>
      </div>
    </div>
  `;
  container.appendChild(page);

  $('#rc18SaveWaha').onclick=saveServer;
  $('#rc18RefreshWaha').onclick=()=>loadStatus(false);
  $('#rc18OpenStudio').onclick=openMyStudio;
}

async function sessionCount(){
  try{
    const c=window.IntornaCloud.client;
    const {count,error}=await c.from('waha_connections').select('id',{count:'exact',head:true});
    if(error) throw error;
    return Number(count||0);
  }catch(_){
    return null;
  }
}

function render(){
  const configured=!!state.configured;
  const conn=state.connection||{};
  const status=String(conn.status||'STOPPED').toUpperCase();
  const working=status==='WORKING';

  const server=$('#rc18WahaServer');
  const main=$('#rc18WahaMain');
  if(server){
    server.className=`rc18-status ${configured?'ok':'bad'}`;
    server.innerHTML=`<span class="rc18-dot"></span> ${configured?'Configurado':'Não configurado'}`;
  }
  if(main){
    main.className=`rc18-status ${working?'ok':configured?'warn':'bad'}`;
    main.innerHTML=`<span class="rc18-dot"></span> ${working?'Operacional':configured?'Servidor salvo':'Configuração necessária'}`;
  }

  if($('#rc18WahaUrl') && state.baseUrl) $('#rc18WahaUrl').value=state.baseUrl;
  if($('#rc18Webhook')) $('#rc18Webhook').textContent=state.webhookUrl||'—';
  if($('#rc18DiagServer')) $('#rc18DiagServer').textContent=configured?'Online/configurado':'Pendente';
  if($('#rc18DiagSessions')) $('#rc18DiagSessions').textContent=state.sessions===null?'—':String(state.sessions);
  if($('#rc18DiagPhone')){
    $('#rc18DiagPhone').textContent=working?(conn.phone||conn.push_name||'Conectado'):'Ainda não conectado';
  }

  const note=$('#rc18TunnelNote');
  if(note){
    const quick=/trycloudflare\.com/i.test(state.baseUrl||'');
    note.innerHTML=quick
      ?'🟡 <b>Modo demonstração R$0:</b> Quick Tunnel Cloudflare ativo. Se o PC ou o túnel reiniciar, a URL pode mudar.'
      :'🟢 Servidor HTTPS configurado. Para produção 24h, mantenha o WAHA e o túnel/servidor permanentemente ativos.';
  }
}

async function loadStatus(showToast=false){
  if(state.loading) return;
  state.loading=true;
  try{
    const [d,count]=await Promise.all([connect('status'),sessionCount()]);
    state.configured=!!d.platformConfigured;
    state.baseUrl=d.platformBaseUrl||'';
    state.webhookUrl=d.webhookUrl||'';
    state.connection=d.connection||null;
    state.sessions=count;
    render();
    if(showToast) toast('Diagnóstico atualizado.');
  }catch(e){
    console.warn('RC18 WAHA status',e);
    toast(e.message||'Não foi possível consultar o WAHA.');
  }finally{
    state.loading=false;
  }
}

async function saveServer(){
  const btn=$('#rc18SaveWaha');
  const url=$('#rc18WahaUrl')?.value.trim()||'';
  const key=$('#rc18WahaKey')?.value.trim()||'';
  if(!url || !key){
    toast('Informe a URL e a API Key do WAHA.');
    return;
  }
  btn.disabled=true;
  btn.textContent='Validando…';
  try{
    const d=await connect('save_platform',{baseUrl:url,apiKey:key});
    $('#rc18WahaKey').value='';
    toast(d.message||'Servidor WAHA salvo.');
    await loadStatus(false);
  }catch(e){
    toast(e.message||'Falha ao validar o servidor WAHA.');
  }finally{
    btn.disabled=false;
    btn.textContent='Validar e salvar';
  }
}

async function install(){
  if(window.__INTORNA_RC18_MASTER__) return;
  const ready=
    window.IntornaCloud?.client &&
    window.goPage &&
    window.openOperation &&
    $('.nav') &&
    $('.container') &&
    ($('#cfgBrand')?.value || $('#adminName')?.textContent!=='Administrador');

  if(!ready) return false;

  window.__INTORNA_RC18_MASTER__=true;
  addStyles();

  try{
    ctx=await window.IntornaCloud.requireAdmin();
    if(!ctx) return true;
  }catch(e){
    console.warn('RC18 admin context',e);
    return true;
  }

  addNavigation();
  addOverviewCard();
  addWahaPage();
  loadStatus(false);

  window.IntornaRC18Master={
    version:VERSION,
    openMyStudio,
    refreshWaha:()=>loadStatus(true),
    state:()=>({...state})
  };

  return true;
}

let tries=0;
const boot=setInterval(async()=>{
  tries++;
  const ok=await install();
  if(ok || tries>80) clearInterval(boot);
},250);

})();
