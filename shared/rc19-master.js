(()=>{
'use strict';

const VERSION='RC19';
const $=(s,r=document)=>r.querySelector(s);
let ctx=null;
let busy=false;
let state={platform:null,connection:null,baseUrl:'',webhookUrl:''};

function toast(msg){if(window.toast){window.toast(msg);return}alert(msg)}
function engineLabel(v){
  const s=typeof v==='string'?v:JSON.stringify(v||{});
  if(/"gows"[\s\S]*"connected":true/i.test(s)||/gows/i.test(s))return 'GOWS';
  if(/webjs/i.test(s))return 'WEBJS';
  return s?'Ativo':'—';
}
async function freshSession(){
  const c=window.IntornaCloud?.client;if(!c)throw new Error('Supabase indisponível.');
  let {data,error}=await c.auth.getSession();if(error)throw error;
  let session=data?.session;if(!session)throw new Error('Sessão expirada.');
  if(Number(session.expires_at||0)*1000-Date.now()<120000){
    const r=await c.auth.refreshSession();if(r.error||!r.data?.session)throw r.error||new Error('Não foi possível renovar a sessão.');
    session=r.data.session;
  }
  return session;
}
async function parseFn(error){
  let msg=String(error?.message||'Falha no backend.');
  try{const x=error?.context;if(x?.clone){const d=await x.clone().json();msg=String(d?.error||msg)}}catch{}
  return new Error(msg);
}
async function connect(action,extra={}){
  await freshSession();
  const c=window.IntornaCloud.client;
  const r=await c.functions.invoke('waha-connect',{body:{action,studioId:ctx?.studioId,...extra}});
  if(r.error)throw await parseFn(r.error);
  if(r.data?.error)throw new Error(String(r.data.error));
  return r.data||{};
}
function openMyStudio(){
  localStorage.removeItem('intorna_impersonate_studio');
  location.href='/app/';
}
window.rc19OpenMyStudio=openMyStudio;

function styles(){
  if($('#rc19MasterStyles'))return;
  const s=document.createElement('style');s.id='rc19MasterStyles';
  s.textContent=`
  .rc19-master-nav{background:linear-gradient(135deg,rgba(245,158,11,.16),rgba(124,58,237,.14))!important;border:1px solid rgba(245,158,11,.24)!important}
  .rc19-hero{background:linear-gradient(135deg,#0b132b,#1d2f62);color:#fff;border:0}
  .rc19-kicker{font-size:11px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;color:#fbbf24}
  .rc19-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
  .rc19-status{display:inline-flex;align-items:center;gap:7px;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:900;background:#eef2f7;color:#475569}
  .rc19-status.ok{background:#dcfce7;color:#166534}.rc19-status.warn{background:#fef3c7;color:#92400e}.rc19-status.bad{background:#fee2e2;color:#991b1b}
  .rc19-dot{width:8px;height:8px;border-radius:50%;background:currentColor}
  .rc19-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}
  .rc19-kpi{border:1px solid var(--line);border-radius:12px;padding:12px}.rc19-kpi small{display:block;color:var(--muted);margin-bottom:5px}.rc19-kpi b{font-size:18px}
  .rc19-form{display:grid;gap:10px}.rc19-form input{width:100%}.rc19-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
  .rc19-note{border:1px solid var(--line);border-radius:12px;padding:12px;margin-top:12px;background:rgba(148,163,184,.06)}
  .rc19-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;word-break:break-all}
  @media(max-width:900px){.rc19-kpis{grid-template-columns:1fr 1fr}}`;
  document.head.appendChild(s);
}
function addNav(){
  const nav=$('.nav');if(!nav||$('#rc19MyStudio'))return;
  const my=document.createElement('button');my.id='rc19MyStudio';my.className='rc19-master-nav';
  my.innerHTML='<span class="ico">📸</span><span class="label">Meu Estúdio</span>';my.onclick=openMyStudio;
  const first=nav.querySelector('[data-page="overview"]');first?.after(my);

  const wa=document.createElement('button');wa.id='rc19Infra';wa.dataset.page='rc19waha';
  wa.innerHTML='<span class="ico">📱</span><span class="label">Infra WAHA</span>';
  wa.onclick=()=>{window.goPage?.('rc19waha');loadAll(true)};
  const settings=nav.querySelector('[data-page="settings"]');settings?nav.insertBefore(wa,settings):nav.appendChild(wa);
}
function addOverview(){
  const grid=$('#overview .grid');if(!grid||$('#rc19Overview'))return;
  const c=document.createElement('div');c.id='rc19Overview';c.className='card one';
  c.style.cssText='border:1px solid rgba(245,158,11,.28);background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(124,58,237,.07))';
  c.innerHTML=`<div class="rc19-kicker">RC19 • MASTER DUAL</div><h2>📸 Plataforma + seu próprio estúdio</h2><p>Administre os clientes SaaS e opere suas vendas de fotos em ambientes separados.</p><div class="row"><button class="btn gold" id="rc19OverviewOpen">Abrir Meu Estúdio</button><button class="btn outline" id="rc19OverviewInfra">Infra WAHA</button></div>`;
  grid.appendChild(c);
  $('#rc19OverviewOpen').onclick=openMyStudio;
  $('#rc19OverviewInfra').onclick=()=>{window.goPage?.('rc19waha');loadAll(true)};
}
function addPage(){
  const container=$('.container');if(!container||$('#rc19waha'))return;
  const p=document.createElement('section');p.className='page';p.id='rc19waha';
  p.innerHTML=`
  <div class="grid">
    <div class="card two rc19-hero"><div class="rc19-head"><div><div class="rc19-kicker">INTORNÁ PIXELS • RC19</div><h2>📱 Infraestrutura WAHA blindada</h2><p>Servidor global, sessões isoladas por estúdio e motor GOWS recomendado.</p></div><span id="rc19Main" class="rc19-status warn"><span class="rc19-dot"></span> Verificando</span></div></div>
    <div class="card one">
      <h2>Servidor WAHA</h2>
      <p class="muted">Para trocar somente a URL do Quick Tunnel, deixe a API Key vazia. A chave já salva permanece protegida no Vault.</p>
      <div class="rc19-form">
        <div><label>URL HTTPS</label><input id="rc19Url" placeholder="https://...trycloudflare.com"></div>
        <div><label>API Key — somente primeira configuração ou troca</label><input id="rc19Key" type="password" autocomplete="new-password" placeholder="Deixe vazio para manter a chave atual"></div>
      </div>
      <div class="rc19-actions"><button class="btn primary" id="rc19Save">Validar e salvar</button><button class="btn ghost" id="rc19Refresh">Atualizar diagnóstico</button></div>
      <div class="rc19-note"><b>Webhook seguro</b><div id="rc19Webhook" class="rc19-code">—</div></div>
    </div>
    <div class="card one">
      <h2>Diagnóstico da plataforma</h2>
      <div class="rc19-kpis">
        <div class="rc19-kpi"><small>Servidor</small><b id="rc19Server">—</b></div>
        <div class="rc19-kpi"><small>Sessões</small><b id="rc19Sessions">—</b></div>
        <div class="rc19-kpi"><small>Conectadas</small><b id="rc19Working">—</b></div>
        <div class="rc19-kpi"><small>Motor do seu número</small><b id="rc19Engine">—</b></div>
      </div>
      <div id="rc19Tunnel" class="rc19-note">Carregando…</div>
      <div class="rc19-actions"><button class="btn gold" id="rc19Open">📸 Abrir Meu Estúdio</button></div>
    </div>
  </div>`;
  container.appendChild(p);
  $('#rc19Save').onclick=save;
  $('#rc19Refresh').onclick=()=>loadAll(true);
  $('#rc19Open').onclick=openMyStudio;
}
function render(){
  const pf=state.platform||{},c=state.connection||{};
  const configured=!!pf.platformConfigured;
  const st=String(c.status||'STOPPED').toUpperCase(),working=st==='WORKING';
  if($('#rc19Url')&&state.baseUrl)$('#rc19Url').value=state.baseUrl;
  if($('#rc19Webhook'))$('#rc19Webhook').textContent=state.webhookUrl||pf.webhookUrl||'—';
  $('#rc19Server').textContent=configured?'Online':'Pendente';
  $('#rc19Sessions').textContent=configured?String(pf.sessions??0):'—';
  $('#rc19Working').textContent=configured?String(pf.working??0):'—';
  $('#rc19Engine').textContent=working?engineLabel(c.engine):'—';
  const main=$('#rc19Main');main.className=`rc19-status ${working?'ok':configured?'warn':'bad'}`;
  main.innerHTML=`<span class="rc19-dot"></span> ${working?'Seu WhatsApp operacional':configured?'Servidor online':'Configuração necessária'}`;
  const quick=/trycloudflare\.com/i.test(state.baseUrl||'');
  $('#rc19Tunnel').innerHTML=quick
    ?'🟡 <b>Demonstração R$0:</b> Quick Tunnel ativo. Se o notebook/túnel reiniciar, atualize somente a URL aqui; a API Key pode ficar em branco.'
    :'🟢 Endpoint HTTPS persistente configurado.';
}
async function loadAll(show=false){
  if(busy)return;busy=true;
  try{
    const [pf,st]=await Promise.all([connect('platform_status'),connect('status')]);
    state.platform=pf;state.connection=st.connection||null;state.baseUrl=pf.baseUrl||st.platformBaseUrl||'';state.webhookUrl=pf.webhookUrl||st.webhookUrl||'';
    render();if(show)toast('Diagnóstico atualizado.');
  }catch(e){console.warn(e);toast(e.message||'Falha no diagnóstico.')}finally{busy=false}
}
async function save(){
  const btn=$('#rc19Save'),baseUrl=$('#rc19Url').value.trim(),apiKey=$('#rc19Key').value.trim();
  if(!baseUrl)return toast('Informe a URL HTTPS do WAHA.');
  btn.disabled=true;btn.textContent='Validando…';
  try{
    const d=await connect('save_platform',{baseUrl,apiKey});
    $('#rc19Key').value='';toast(d.message||'Servidor salvo.');await loadAll(false);
  }catch(e){toast(e.message||'Falha ao salvar.')}finally{btn.disabled=false;btn.textContent='Validar e salvar'}
}
async function install(){
  if(window.__INTORNA_RC19_MASTER__)return true;
  if(!window.IntornaCloud?.client||!window.goPage||!$('.nav')||!$('.container'))return false;
  try{ctx=await window.IntornaCloud.requireAdmin();if(!ctx)return true}catch(e){console.warn(e);return false}
  window.__INTORNA_RC19_MASTER__=true;styles();addNav();addOverview();addPage();loadAll(false);
  window.IntornaRC19Master={version:VERSION,openMyStudio,refresh:()=>loadAll(true)};
  return true;
}
let tries=0;const boot=setInterval(async()=>{tries++;if(await install()||tries>100)clearInterval(boot)},250);
})();