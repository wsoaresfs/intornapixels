(()=>{
'use strict';

const VERSION='RC17';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const db=()=>window.IntornaCloud?.client||window.INTORNA_SUPABASE||window.supabaseClient||window.sb||null;
const studioId=()=>window.INTORNA_CTX?.studioId||null;

let installed=false;
let state={
  isPlatformAdmin:false,
  platformConfigured:false,
  platformBaseUrl:'',
  connection:null,
  webhookUrl:'',
  conversations:[],
  loading:false,
  qr:null,
  polling:null
};

function toast(msg){
  if(window.toast){window.toast(msg);return}
  let el=$('#ip17Toast');
  if(!el){
    el=document.createElement('div');
    el.id='ip17Toast';
    el.className='ip17-toast';
    document.body.appendChild(el);
  }
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t=setTimeout(()=>el.classList.remove('show'),3000);
}

async function freshSession(){
  const c=db();
  if(!c)throw new Error('Supabase não disponível.');
  let {data,error}=await c.auth.getSession();
  if(error)throw error;
  let s=data?.session||null;
  if(!s)throw new Error('Sua sessão expirou. Entre novamente.');
  const exp=Number(s.expires_at||0)*1000;
  if(!exp||exp-Date.now()<120000){
    const r=await c.auth.refreshSession();
    if(r.error)throw r.error;
    s=r.data?.session||null;
    if(!s)throw new Error('Não foi possível renovar sua sessão.');
  }
  return s;
}

async function parseFnError(error){
  let msg=String(error?.message||'Falha no backend.');
  try{
    const ctx=error?.context;
    if(ctx&&typeof ctx.clone==='function'){
      const d=await ctx.clone().json();
      msg=String(d?.error||msg);
    }
  }catch(_){}
  return new Error(msg);
}

async function invoke(name,body){
  const c=db();
  await freshSession();
  let call=await c.functions.invoke(name,{body});
  const unauthorized=
    call.error?.context?.status===401 ||
    /401|jwt|expired|unauthorized/i.test(String(call.error?.message||call.error||''));

  if(unauthorized){
    const r=await c.auth.refreshSession();
    if(r.error||!r.data?.session)throw new Error('Sua sessão expirou. Entre novamente.');
    call=await c.functions.invoke(name,{body});
  }
  if(call.error)throw await parseFnError(call.error);
  if(call.data?.error)throw new Error(String(call.data.error));
  return call.data;
}

const connect=(action,extra={})=>invoke('waha-connect',{action,studioId:studioId(),...extra});
const send=(action,extra={})=>invoke('waha-send',{action,studioId:studioId(),...extra});

function statusLabel(v){
  const x=String(v||'STOPPED').toUpperCase();
  return ({
    WORKING:'Conectado',
    SCAN_QR_CODE:'Aguardando QR',
    STARTING:'Iniciando',
    STOPPED:'Desconectado',
    FAILED:'Falhou'
  })[x]||x;
}

function styles(){
  if($('#ip17WahaStyles'))return;
  const s=document.createElement('style');
  s.id='ip17WahaStyles';
  s.textContent=`
    .ip17w-wrap{display:grid;gap:12px}
    .ip17w-hero{border:1px solid rgba(34,197,94,.28);background:linear-gradient(135deg,rgba(34,197,94,.08),rgba(37,99,235,.07));border-radius:16px;padding:14px}
    .ip17w-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .ip17w-head h3{margin:2px 0 5px}
    .ip17w-kicker{font-size:11px;font-weight:950;letter-spacing:.09em;color:#15803d;text-transform:uppercase}
    .ip17w-sub{font-size:11px;opacity:.72;line-height:1.5}
    .ip17w-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .ip17w-card{border:1px solid rgba(148,163,184,.28);border-radius:15px;padding:13px;background:rgba(255,255,255,.025)}
    .ip17w-status{display:inline-flex;gap:6px;align-items:center;padding:6px 9px;border-radius:999px;font-size:10px;font-weight:950}
    .ip17w-status.ok{background:#dcfce7;color:#166534}
    .ip17w-status.warn{background:#fef3c7;color:#92400e}
    .ip17w-status.bad{background:#fee2e2;color:#991b1b}
    .ip17w-dot{width:8px;height:8px;border-radius:50%;background:currentColor}
    .ip17w-progress{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:10px}
    .ip17w-step{border:1px solid rgba(148,163,184,.25);border-radius:10px;padding:8px;font-size:10px}
    .ip17w-step b{display:block;margin-bottom:2px}
    .ip17w-step.ok{background:#f0fdf4;border-color:#86efac}
    .ip17w-form{display:grid;gap:9px;margin-top:10px}
    .ip17w-field{display:grid;gap:5px}
    .ip17w-field label{font-size:11px;font-weight:900}
    .ip17w-field input{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#111827}
    .ip17w-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
    .ip17w-btn{border:0;border-radius:10px;padding:9px 11px;font-size:12px;font-weight:900;cursor:pointer}
    .ip17w-btn.primary{background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff}
    .ip17w-btn.blue{background:#2563eb;color:#fff}
    .ip17w-btn.dark{background:#111827;color:#fff}
    .ip17w-btn.ghost{background:#eef2f7;color:#26364d}
    .ip17w-btn.warn{background:#fef3c7;color:#92400e}
    .ip17w-btn.danger{background:#fee2e2;color:#991b1b}
    .ip17w-btn:disabled{opacity:.5;cursor:not-allowed}
    .ip17w-note{margin-top:9px;padding:9px;border:1px solid rgba(148,163,184,.24);border-radius:10px;font-size:10px;line-height:1.5}
    .ip17w-code{font-family:monospace;font-size:10px;word-break:break-all}
    .ip17w-qr{text-align:center;padding:12px;margin-top:10px;border:1px dashed rgba(148,163,184,.35);border-radius:12px}
    .ip17w-qr img{width:min(280px,100%);background:#fff;padding:10px;border-radius:12px}
    .ip17w-list{display:grid;gap:8px;margin-top:10px}
    .ip17w-row{border:1px solid rgba(148,163,184,.24);border-radius:12px;padding:10px}
    .ip17w-rowtop{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap}
    .ip17w-row b{font-size:12px}
    .ip17w-row small{display:block;opacity:.66;margin-top:3px}
    .ip17w-msg{font-size:10px;line-height:1.45;opacity:.78;margin-top:6px}
    .ip17w-empty{padding:18px;text-align:center;border:1px dashed rgba(148,163,184,.35);border-radius:12px;opacity:.7}
    .ip17w-warning{background:#fff7ed;border-color:#fed7aa}
    .ip17w-toast{position:fixed;right:18px;bottom:18px;background:#111827;color:#fff;padding:12px 16px;border-radius:12px;display:none;z-index:18000}
    .ip17w-toast.show{display:block}
    @media(max-width:900px){.ip17w-grid2{grid-template-columns:1fr}.ip17w-progress{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(s);
}

function panelHtml(){
  return `
    <div class="ip17w-wrap">
      <div class="ip17w-hero">
        <div class="ip17w-head">
          <div>
            <div class="ip17w-kicker">INTORNÁ PIXELS • RC17 • WAHA</div>
            <h3>📱 WhatsApp conectado à Máquina de Vendas</h3>
            <div class="ip17w-sub">1 servidor WAHA da plataforma + 1 sessão isolada por estúdio. Respostas alimentam a IA e interrompem follow-ups automaticamente.</div>
          </div>
          <span class="ip17w-status warn" id="ip17wMain"><span class="ip17w-dot"></span> Verificando</span>
        </div>
        <div class="ip17w-progress">
          <div class="ip17w-step" id="ip17wStepServer"><b>1. Servidor WAHA</b>Pendente</div>
          <div class="ip17w-step" id="ip17wStepSession"><b>2. Sessão</b>Pendente</div>
          <div class="ip17w-step" id="ip17wStepPhone"><b>3. WhatsApp</b>Pendente</div>
          <div class="ip17w-step" id="ip17wStepAi"><b>4. Vendas + IA</b>Pronto</div>
        </div>
      </div>

      <div class="ip17w-grid2">
        <div class="ip17w-card">
          <div class="ip17w-head">
            <div>
              <div class="ip17w-kicker">INFRAESTRUTURA</div>
              <h3>Servidor WAHA</h3>
              <div class="ip17w-sub">Configurado uma vez pelo Master. A API Key fica protegida no Vault.</div>
            </div>
            <span class="ip17w-status bad" id="ip17wServerStatus"><span class="ip17w-dot"></span> Não configurado</span>
          </div>

          <div id="ip17wAdminServer" style="display:none">
            <div class="ip17w-form">
              <div class="ip17w-field"><label>URL HTTPS do servidor WAHA</label><input id="ip17wBaseUrl" placeholder="https://waha.seudominio.com"></div>
              <div class="ip17w-field"><label>WAHA API Key</label><input id="ip17wApiKey" type="password" autocomplete="new-password" placeholder="Digite somente aqui no Intorná"></div>
            </div>
            <div class="ip17w-actions">
              <button class="ip17w-btn primary" id="ip17wSaveServer">Validar e salvar servidor</button>
            </div>
          </div>

          <div id="ip17wServerViewer" class="ip17w-note" style="display:none">A infraestrutura WAHA é gerenciada pelo Master da plataforma.</div>
          <div class="ip17w-note ip17w-warning">WAHA precisa rodar em um servidor Docker persistente com HTTPS. Não hospede a sessão do WhatsApp no navegador nem no Vercel.</div>
          <div class="ip17w-note"><b>Webhook seguro:</b><div class="ip17w-code" id="ip17wWebhook">—</div></div>
        </div>

        <div class="ip17w-card">
          <div class="ip17w-head">
            <div>
              <div class="ip17w-kicker">WHATSAPP DO ESTÚDIO</div>
              <h3>Conectar por QR Code</h3>
              <div class="ip17w-sub">Cada estúdio possui uma sessão exclusiva.</div>
            </div>
            <span class="ip17w-status bad" id="ip17wSessionStatus"><span class="ip17w-dot"></span> Desconectado</span>
          </div>

          <div id="ip17wPhoneInfo" class="ip17w-note" style="display:none">
            <b id="ip17wPush">WhatsApp</b><br>
            Número: <span id="ip17wPhone">—</span><br>
            Sessão: <span class="ip17w-code" id="ip17wSessionName"></span>
          </div>

          <div class="ip17w-actions">
            <button class="ip17w-btn primary" id="ip17wStart">Iniciar WhatsApp</button>
            <button class="ip17w-btn blue" id="ip17wQr">Mostrar QR Code</button>
            <button class="ip17w-btn ghost" id="ip17wTest">Testar conexão</button>
            <button class="ip17w-btn warn" id="ip17wRestart">Reiniciar</button>
            <button class="ip17w-btn danger" id="ip17wLogout">Desconectar número</button>
          </div>

          <div class="ip17w-qr" id="ip17wQrBox" style="display:none">
            <div id="ip17wQrLoading">Gerando QR Code…</div>
            <img id="ip17wQrImg" alt="QR Code do WhatsApp" style="display:none">
            <div class="ip17w-sub" style="margin-top:8px">No celular: WhatsApp → Aparelhos conectados → Conectar aparelho.</div>
          </div>
        </div>
      </div>

      <div class="ip17w-grid2">
        <div class="ip17w-card">
          <div class="ip17w-head">
            <div>
              <div class="ip17w-kicker">FILA DE VENDAS</div>
              <h3>Follow-ups pelo WAHA</h3>
              <div class="ip17w-sub">Mensagens continuam controladas nesta fase; cada envio é registrado no histórico comercial.</div>
            </div>
            <span class="ip17w-status warn"><span class="ip17w-dot"></span> Antispam ativo</span>
          </div>
          <div class="ip17w-list" id="ip17wQueue"></div>
        </div>

        <div class="ip17w-card">
          <div class="ip17w-head">
            <div>
              <div class="ip17w-kicker">INBOX INTELIGENTE</div>
              <h3>Conversas recentes</h3>
              <div class="ip17w-sub">As respostas reais entram aqui, param sequências e são analisadas pela IA da Central.</div>
            </div>
            <button class="ip17w-btn ghost" id="ip17wRefreshInbox">Atualizar</button>
          </div>
          <div class="ip17w-list" id="ip17wInbox"></div>
        </div>
      </div>
    </div>
  `;
}

function addTab(){
  const tabs=$('.ip16-tabs');
  if(!tabs||$('[data-ip16-tab="waha"]'))return;
  const b=document.createElement('button');
  b.className='ip16-tab';
  b.dataset.ip16Tab='waha';
  b.innerHTML='📱 WhatsApp WAHA <span class="ip16-badge" id="ip17wTab">!</span>';
  tabs.appendChild(b);

  const p=document.createElement('div');
  p.className='ip16-panel';
  p.dataset.ip16Panel='waha';
  p.innerHTML=panelHtml();
  tabs.parentElement.appendChild(p);

  b.onclick=()=>{
    $$('[data-ip16-tab]').forEach(x=>x.classList.toggle('active',x===b));
    $$('[data-ip16-panel]').forEach(x=>x.classList.toggle('active',x===p));
  };

  bind();
}

function bind(){
  $('#ip17wSaveServer').onclick=saveServer;
  $('#ip17wStart').onclick=startSession;
  $('#ip17wQr').onclick=loadQr;
  $('#ip17wTest').onclick=testSession;
  $('#ip17wRestart').onclick=restartSession;
  $('#ip17wLogout').onclick=logoutSession;
  $('#ip17wRefreshInbox').onclick=loadInbox;
}

function setStep(id,ok,text){
  const el=$(id);
  if(!el)return;
  el.classList.toggle('ok',!!ok);
  const title=$('b',el)?.outerHTML||'';
  el.innerHTML=title+safe(text);
}

function isWorking(){
  return String(state.connection?.status||'').toUpperCase()==='WORKING';
}

function render(){
  const c=state.connection||{};
  const status=String(c.status||'STOPPED').toUpperCase();
  const working=status==='WORKING';
  const scanning=status==='SCAN_QR_CODE';
  const starting=status==='STARTING';

  $('#ip17wAdminServer').style.display=state.isPlatformAdmin?'block':'none';
  $('#ip17wServerViewer').style.display=state.isPlatformAdmin?'none':'block';
  if(state.isPlatformAdmin&&state.platformBaseUrl)$('#ip17wBaseUrl').value=state.platformBaseUrl;
  $('#ip17wWebhook').textContent=state.webhookUrl||'—';

  const ss=$('#ip17wServerStatus');
  ss.className=`ip17w-status ${state.platformConfigured?'ok':'bad'}`;
  ss.innerHTML=`<span class="ip17w-dot"></span> ${state.platformConfigured?'Configurado':'Não configurado'}`;

  const cs=$('#ip17wSessionStatus');
  cs.className=`ip17w-status ${working?'ok':(scanning||starting)?'warn':'bad'}`;
  cs.innerHTML=`<span class="ip17w-dot"></span> ${safe(statusLabel(status))}`;

  const main=$('#ip17wMain');
  main.className=`ip17w-status ${working?'ok':state.platformConfigured?'warn':'bad'}`;
  main.innerHTML=`<span class="ip17w-dot"></span> ${working?'Operacional':state.platformConfigured?'Aguardando conexão':'Servidor necessário'}`;

  setStep('#ip17wStepServer',state.platformConfigured,state.platformConfigured?'Configurado':'Pendente');
  setStep('#ip17wStepSession',!!c.session_name||!!c.session, c.session_name||c.session?'Criada':'Pendente');
  setStep('#ip17wStepPhone',working,working?'Conectado':scanning?'Escaneie o QR':'Pendente');
  setStep('#ip17wStepAi',true,'Ativa');

  $('#ip17wPhoneInfo').style.display=(c.session_name||c.session||working)?'block':'none';
  $('#ip17wPush').textContent=c.push_name||c.pushName||'WhatsApp';
  $('#ip17wPhone').textContent=c.phone||'—';
  $('#ip17wSessionName').textContent=c.session_name||c.session||'—';

  $('#ip17wStart').disabled=!state.platformConfigured||working||starting;
  $('#ip17wQr').disabled=!state.platformConfigured||working;
  $('#ip17wTest').disabled=!state.platformConfigured||!c.session_name&&!c.session;
  $('#ip17wRestart').disabled=!state.platformConfigured||!c.session_name&&!c.session;
  $('#ip17wLogout').disabled=!state.platformConfigured||!c.session_name&&!c.session;

  $('#ip17wTab').textContent=working?'✓':scanning?'QR':'!';
  if($('#ip16WaStatus'))$('#ip16WaStatus').textContent=working?'WAHA conectado':'WhatsApp manual';

  renderQueue();
  renderInbox();
}

async function loadStatus(silent=false){
  if(state.loading)return;
  state.loading=true;
  try{
    const d=await connect('status');
    state.isPlatformAdmin=!!d.isPlatformAdmin;
    state.platformConfigured=!!d.platformConfigured;
    state.platformBaseUrl=d.platformBaseUrl||'';
    state.connection=d.connection||null;
    state.webhookUrl=d.webhookUrl||'';
    render();

    const st=String(state.connection?.status||'').toUpperCase();
    if(['STARTING','SCAN_QR_CODE'].includes(st))startPolling();
    else stopPolling();

    if(st==='SCAN_QR_CODE'&&$('#ip17wQrBox')?.style.display!=='none'){
      await loadQr(true);
    }
  }catch(e){
    if(!silent)toast(e.message||'Não foi possível verificar o WAHA.');
  }finally{
    state.loading=false;
  }
}

async function saveServer(){
  const btn=$('#ip17wSaveServer');
  btn.disabled=true;btn.textContent='Validando…';
  try{
    const d=await connect('save_platform',{
      baseUrl:$('#ip17wBaseUrl').value.trim(),
      apiKey:$('#ip17wApiKey').value.trim()
    });
    $('#ip17wApiKey').value='';
    toast(d.message||'Servidor WAHA salvo.');
    await loadStatus();
  }catch(e){toast(e.message||'Falha ao salvar o WAHA.')}
  finally{btn.disabled=false;btn.textContent='Validar e salvar servidor'}
}

async function startSession(){
  const btn=$('#ip17wStart');
  btn.disabled=true;btn.textContent='Iniciando…';
  try{
    await connect('start');
    toast('Sessão criada. Preparando QR Code…');
    $('#ip17wQrBox').style.display='block';
    await loadStatus(true);
    setTimeout(()=>loadQr(true),900);
    startPolling();
  }catch(e){toast(e.message||'Falha ao iniciar a sessão.')}
  finally{btn.disabled=false;btn.textContent='Iniciar WhatsApp'}
}

async function loadQr(silent=false){
  const box=$('#ip17wQrBox'),img=$('#ip17wQrImg'),loading=$('#ip17wQrLoading');
  box.style.display='block';img.style.display='none';loading.style.display='block';
  try{
    const d=await connect('qr');
    if(d.working){
      box.style.display='none';
      await loadStatus(true);
      if(!silent)toast('WhatsApp já está conectado.');
      return;
    }
    if(!d.data)throw new Error('QR Code ainda não está disponível. Aguarde alguns segundos.');
    img.src=d.data;
    img.style.display='inline-block';
    loading.style.display='none';
  }catch(e){
    loading.textContent=e.message||'QR Code indisponível.';
    if(!silent)toast(e.message||'Não foi possível carregar o QR.');
  }
}

async function testSession(){
  try{
    const d=await connect('test');
    toast(d.message||'Teste concluído.');
    await loadStatus(true);
  }catch(e){toast(e.message||'Falha no teste.')}
}

async function restartSession(){
  try{
    await connect('restart');
    toast('Sessão reiniciada.');
    $('#ip17wQrBox').style.display='block';
    await loadStatus(true);
    startPolling();
  }catch(e){toast(e.message||'Não foi possível reiniciar.')}
}

async function logoutSession(){
  if(!confirm('Desconectar este número do WhatsApp no Intorná?'))return;
  try{
    await connect('logout');
    state.qr=null;
    $('#ip17wQrBox').style.display='none';
    toast('Número desconectado.');
    await loadStatus(true);
  }catch(e){toast(e.message||'Não foi possível desconectar.')}
}

function followups(){
  return window.IntornaRC16?.status?.()?.followups||[];
}

function renderQueue(){
  const host=$('#ip17wQueue');
  if(!host)return;
  const list=followups().slice(0,12);
  if(!list.length){
    host.innerHTML='<div class="ip17w-empty">Nenhum follow-up ativo agora.</div>';
    return;
  }

  host.innerHTML=list.map(f=>{
    const c=Array.isArray(f.clients)?f.clients[0]:f.clients;
    return `
      <div class="ip17w-row">
        <div class="ip17w-rowtop">
          <div>
            <b>${safe(c?.name||'Cliente')} • ${safe(f.kind||'follow-up')}</b>
            <small>${f.ai_generated?'✨ IA • ':''}${safe(f.status||'queued')}</small>
          </div>
          <button class="ip17w-btn primary" data-ip17w-send="${safe(f.id)}" ${isWorking()?'':'disabled'}>Enviar pelo WAHA</button>
        </div>
        <div class="ip17w-msg">${safe(f.message||'')}</div>
      </div>
    `;
  }).join('');

  $$('[data-ip17w-send]',host).forEach(b=>b.onclick=()=>sendFollowup(b.dataset.ip17wSend,b));
}

async function sendFollowup(id,btn){
  btn.disabled=true;const old=btn.textContent;btn.textContent='Enviando…';
  try{
    await send('send_followup',{followupId:id});
    toast('Mensagem enviada pelo WhatsApp.');
    await window.IntornaRC16?.refresh?.();
    setTimeout(async()=>{await loadStatus(true);await loadInbox();},350);
  }catch(e){toast(e.message||'Falha ao enviar.')}
  finally{btn.disabled=false;btn.textContent=old}
}

async function loadInbox(){
  const c=db(),sid=studioId();
  if(!c||!sid)return;
  try{
    await freshSession();
    const {data,error}=await c.from('whatsapp_conversations')
      .select('id,status,stage,unread_count,last_message_at,last_customer_message_at,last_message_preview,whatsapp_contacts(id,client_id,phone,profile_name,clients(name,whatsapp))')
      .eq('studio_id',sid)
      .order('last_message_at',{ascending:false})
      .limit(20);
    if(error)throw error;
    state.conversations=data||[];
    renderInbox();
  }catch(e){console.warn('RC17 inbox',e)}
}

function renderInbox(){
  const host=$('#ip17wInbox');
  if(!host)return;
  const list=state.conversations||[];
  if(!list.length){
    host.innerHTML='<div class="ip17w-empty">Nenhuma conversa recebida ainda.<br><small>Depois que o número estiver conectado, as respostas reais aparecerão aqui.</small></div>';
    return;
  }
  host.innerHTML=list.map(x=>{
    const ct=Array.isArray(x.whatsapp_contacts)?x.whatsapp_contacts[0]:x.whatsapp_contacts;
    const cl=Array.isArray(ct?.clients)?ct.clients[0]:ct?.clients;
    const name=cl?.name||ct?.profile_name||ct?.phone||'Contato';
    return `
      <div class="ip17w-row">
        <div class="ip17w-rowtop">
          <div>
            <b>${safe(name)}</b>
            <small>${Number(x.unread_count||0)>0?`🔵 ${Number(x.unread_count)} não lida(s) • `:''}${x.last_message_at?new Date(x.last_message_at).toLocaleString('pt-BR'):''}</small>
          </div>
          ${Number(x.unread_count||0)>0?'<span class="ip16-badge">Responder</span>':''}
        </div>
        <div class="ip17w-msg">${safe(x.last_message_preview||'')}</div>
      </div>
    `;
  }).join('');
}

function startPolling(){
  if(state.polling)return;
  state.polling=setInterval(async()=>{
    await loadStatus(true);
    const st=String(state.connection?.status||'').toUpperCase();
    if(st==='WORKING'){
      $('#ip17wQrBox').style.display='none';
      await loadInbox();
      stopPolling();
      toast('WhatsApp conectado com sucesso.');
    }
  },5000);
}

function stopPolling(){
  if(state.polling){
    clearInterval(state.polling);
    state.polling=null;
  }
}

function updateRc(){
  const k=$('.ip16-kicker','#ip16Center');
  if(k)k.textContent='INTORNÁ PIXELS • RC17 • WAHA';
  const pill=$('.nav [data-page="sales-radar"] .pill');
  if(pill)pill.textContent='RC17';
}

function install(){
  if(installed)return;
  if(!$('#ip16Center')||!window.IntornaRC16)return;
  installed=true;
  styles();
  addTab();
  updateRc();
  loadStatus();
  loadInbox();

  const original=window.IntornaRC16.refresh;
  if(original&&!original.__ip17w){
    const wrapped=async(...args)=>{
      const r=await original(...args);
      setTimeout(()=>{
        renderQueue();
        loadStatus(true);
        loadInbox();
      },180);
      return r;
    };
    wrapped.__ip17w=true;
    window.IntornaRC16.refresh=wrapped;
  }

  window.IntornaRC17={
    version:VERSION,
    provider:'waha',
    refresh:async()=>{await loadStatus();await loadInbox()},
    state:()=>state
  };
}

const boot=setInterval(()=>{
  install();
  if(installed)clearInterval(boot);
},350);

setTimeout(()=>clearInterval(boot),20000);
window.addEventListener('beforeunload',stopPolling);

})();