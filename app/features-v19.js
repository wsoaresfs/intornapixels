(()=>{
'use strict';

const VERSION='RC19';
const ctx=window.INTORNA_CTX;
const db=window.IntornaCloud?.client;
if(!ctx||!db)return;

const sid=ctx.studioId;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const one=v=>Array.isArray(v)?(v[0]||null):(v||null);
const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmt=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})};
const shortTime=v=>{if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})};
const cleanPhone=v=>String(v||'').replace(/\D/g,'');

let state={
  tab:'priorities',
  radar:{totals:{count:0,value:0,hot:0,warm:0,cold:0},opportunities:[],marketing:{}},
  followups:[],
  insights:[],
  settings:null,
  waha:{platformConfigured:false,connection:null,webhookUrl:'',platformBaseUrl:''},
  conversations:[],
  clients:[],
  currentId:null,
  messages:[],
  currentInsight:null,
  suggestions:{},
  realtime:'connecting',
  loading:false,
  waBusy:false,
  qrData:null
};

let realtimeChannel=null;
let refreshTimer=null;
let statusTimer=null;
let waPollTimer=null;
let convDebounce=null;
let msgDebounce=null;
let insightDebounce=null;
let autoPreparing=false;

function toast(msg){window.toast?.(msg)}

function addStyles(){
  if($('#ip19Styles'))return;
  const s=document.createElement('style');s.id='ip19Styles';s.textContent=`
    .ip19-wrap{display:grid;gap:14px}
    .ip19-hero{border:0!important;background:linear-gradient(135deg,#0b132b,#202c66)!important;color:#fff!important;overflow:hidden;position:relative}
    .ip19-hero:after{content:"";position:absolute;width:260px;height:260px;border-radius:50%;right:-100px;top:-130px;background:rgba(124,58,237,.28)}
    .ip19-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;position:relative;z-index:1}
    .ip19-kicker{font-size:11px;font-weight:950;letter-spacing:.1em;text-transform:uppercase;color:#fbbf24}
    .ip19-head h2,.ip19-head h3{margin:4px 0 5px}.ip19-sub{font-size:12px;line-height:1.55;opacity:.76}
    .ip19-status{display:inline-flex;align-items:center;gap:7px;border-radius:999px;padding:7px 10px;font-size:10px;font-weight:950;background:#eef2f7;color:#475569;white-space:nowrap}
    .ip19-status.ok{background:#dcfce7;color:#166534}.ip19-status.warn{background:#fef3c7;color:#92400e}.ip19-status.bad{background:#fee2e2;color:#991b1b}.ip19-status.info{background:#dbeafe;color:#1d4ed8}
    .ip19-dot{width:8px;height:8px;border-radius:50%;background:currentColor}
    .ip19-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.ip19-kpi{border:1px solid var(--line);border-radius:14px;padding:12px;background:var(--card,#fff)}
    .ip19-kpi small{display:block;color:var(--muted);margin-bottom:5px;font-size:10px}.ip19-kpi b{font-size:20px}.ip19-kpi span{display:block;font-size:10px;color:var(--muted);margin-top:3px}
    .ip19-tabs{display:flex;gap:7px;flex-wrap:wrap;padding:6px;border:1px solid var(--line);border-radius:14px;background:rgba(148,163,184,.06)}
    .ip19-tab{border:0;background:transparent;border-radius:10px;padding:9px 12px;font-weight:850;font-size:12px;cursor:pointer;color:inherit}.ip19-tab.active{background:#fff;color:#111827;box-shadow:0 3px 12px rgba(15,23,42,.1)}
    .ip19-panel{display:none}.ip19-panel.active{display:block}
    .ip19-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ip19-card{border:1px solid var(--line);border-radius:15px;padding:13px;background:var(--card,#fff)}
    .ip19-list{display:grid;gap:9px}.ip19-row{border:1px solid rgba(148,163,184,.28);border-radius:13px;padding:11px}.ip19-row.hot{border-left:4px solid #ef4444}.ip19-row.warm{border-left:4px solid #f59e0b}.ip19-row.cold{border-left:4px solid #3b82f6}
    .ip19-rowtop{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap}.ip19-row p{font-size:11px;line-height:1.5;margin:6px 0}.ip19-row small{color:var(--muted)}
    .ip19-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.ip19-btn{border:0;border-radius:9px;padding:8px 10px;font-size:11px;font-weight:900;cursor:pointer}.ip19-btn:disabled{opacity:.45;cursor:not-allowed}
    .ip19-btn.primary{background:#2563eb;color:#fff}.ip19-btn.green{background:#16a34a;color:#fff}.ip19-btn.gold{background:#f59e0b;color:#111827}.ip19-btn.ghost{background:#eef2f7;color:#334155}.ip19-btn.danger{background:#fee2e2;color:#991b1b}.ip19-btn.dark{background:#111827;color:#fff}
    .ip19-suggestion{margin-top:9px;padding:10px;border-radius:11px;background:#f8fafc;border:1px dashed #cbd5e1;font-size:11px;line-height:1.55;white-space:pre-wrap}
    .ip19-inbox{display:grid;grid-template-columns:minmax(270px,.78fr) minmax(390px,1.45fr);gap:12px;min-height:620px}.ip19-convs,.ip19-chat{border:1px solid var(--line);border-radius:15px;background:var(--card,#fff);overflow:hidden}
    .ip19-convhead,.ip19-chathead{padding:12px;border-bottom:1px solid var(--line)}.ip19-search{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:10px;margin-top:8px}
    .ip19-convlist{max-height:545px;overflow:auto}.ip19-conv{display:grid;grid-template-columns:39px 1fr auto;gap:9px;padding:11px;border-bottom:1px solid rgba(148,163,184,.18);cursor:pointer}.ip19-conv:hover,.ip19-conv.active{background:#f8fafc}
    .ip19-avatar{width:39px;height:39px;border-radius:50%;display:grid;place-items:center;background:#e0e7ff;color:#4338ca;font-weight:950}.ip19-preview{font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px}.ip19-unread{min-width:20px;height:20px;border-radius:999px;background:#2563eb;color:#fff;display:grid;place-items:center;font-size:9px;font-weight:950;padding:0 5px}
    .ip19-chat{display:grid;grid-template-rows:auto auto 1fr auto}.ip19-chatmeta{padding:9px 12px;background:#f8fafc;border-bottom:1px solid var(--line);font-size:10px}.ip19-messages{padding:14px;overflow:auto;max-height:430px;min-height:300px;background:linear-gradient(rgba(248,250,252,.9),rgba(248,250,252,.9))}
    .ip19-bubble{max-width:78%;padding:9px 11px;border-radius:13px;margin:6px 0;font-size:11px;line-height:1.5;box-shadow:0 1px 2px rgba(0,0,0,.05)}.ip19-bubble.in{background:#fff;border:1px solid #e2e8f0}.ip19-bubble.out{background:#dcfce7;margin-left:auto}.ip19-bubble small{display:block;margin-top:4px;color:#64748b;text-align:right;font-size:9px}
    .ip19-insight{margin:10px 12px 0;padding:10px;border:1px solid #c7d2fe;background:#eef2ff;border-radius:11px;font-size:10px}.ip19-insight b{color:#3730a3}
    .ip19-compose{padding:11px;border-top:1px solid var(--line);background:#fff}.ip19-compose textarea{width:100%;min-height:74px;resize:vertical;border:1px solid #cbd5e1;border-radius:11px;padding:10px;font:inherit}
    .ip19-context{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}.ip19-context select{padding:8px;border:1px solid #cbd5e1;border-radius:9px;max-width:260px}
    .ip19-empty{padding:24px;text-align:center;color:var(--muted);font-size:11px}.ip19-qr{text-align:center;margin-top:10px;padding:12px;border:1px dashed #cbd5e1;border-radius:12px}.ip19-qr img{width:min(290px,100%);background:#fff;padding:10px;border-radius:12px}
    .ip19-formgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.ip19-field{display:grid;gap:5px}.ip19-field label{font-size:10px;font-weight:850}.ip19-field input,.ip19-field select{padding:9px;border:1px solid #cbd5e1;border-radius:9px}
    .ip19-note{padding:10px;border:1px solid rgba(148,163,184,.28);border-radius:11px;background:#f8fafc;font-size:10px;line-height:1.5}.ip19-live{animation:ip19pulse 1.8s infinite}@keyframes ip19pulse{0%,100%{opacity:1}50%{opacity:.55}}
    @media(max-width:1100px){.ip19-kpis{grid-template-columns:repeat(3,1fr)}.ip19-inbox{grid-template-columns:1fr;min-height:0}.ip19-convlist{max-height:300px}.ip19-messages{max-height:420px}}
    @media(max-width:700px){.ip19-kpis{grid-template-columns:1fr 1fr}.ip19-grid2,.ip19-formgrid{grid-template-columns:1fr}.ip19-bubble{max-width:90%}}
  `;document.head.appendChild(s);
}

async function freshSession(){
  let {data,error}=await db.auth.getSession();if(error)throw error;let session=data?.session;if(!session)throw new Error('Sua sessão expirou. Entre novamente.');
  const exp=Number(session.expires_at||0)*1000;if(!exp||exp-Date.now()<120000){const r=await db.auth.refreshSession();if(r.error||!r.data?.session)throw r.error||new Error('Não foi possível renovar a sessão.');session=r.data.session}return session;
}
async function fnError(error){let msg=String(error?.message||'Falha no backend.');try{const c=error?.context;if(c&&typeof c.clone==='function'){const d=await c.clone().json();msg=String(d?.error||msg)}}catch{}return new Error(msg)}
async function invoke(name,body){await freshSession();let r=await db.functions.invoke(name,{body});const unauth=r.error?.context?.status===401||/401|jwt|expired|unauthorized/i.test(String(r.error?.message||''));if(unauth){const rr=await db.auth.refreshSession();if(rr.error||!rr.data?.session)throw new Error('Sua sessão expirou. Entre novamente.');r=await db.functions.invoke(name,{body})}if(r.error)throw await fnError(r.error);if(r.data?.error)throw new Error(String(r.data.error));return r.data||{}}
const sales=(action,extra={})=>invoke('sales-assistant',{action,studioId:sid,...extra});
const radar=(action='radar',extra={})=>invoke('sales-radar',{action,studioId:sid,...extra});
const waha=(action,extra={})=>invoke('waha-connect',{action,studioId:sid,...extra});
const send=(action,extra={})=>invoke('waha-send',{action,studioId:sid,...extra});

function addNavAndPage(){
  const nav=$('.nav');const container=$('.container');if(!nav||!container)return false;
  let btn=nav.querySelector('[data-page="sales-radar"]');
  if(!btn){btn=document.createElement('button');btn.dataset.page='sales-radar';btn.innerHTML='<span class="ico">🧠</span><span class="label">Central de Vendas</span><span class="pill" style="margin-left:auto">RC19</span>';const ass=nav.querySelector('[data-page="assinatura"]');nav.insertBefore(btn,ass||null);btn.onclick=()=>window.goPage?.('sales-radar')}
  if(!$('#sales-radar')){const page=document.createElement('section');page.className='page';page.id='sales-radar';page.innerHTML=pageHtml();container.appendChild(page)}
  repurposeWhatsappNav();bind();return true;
}

function repurposeWhatsappNav(){
  const old=$('.nav button[data-page="whatsapp"]');if(!old||old.dataset.ip19Done)return;
  const n=old.cloneNode(true);n.removeAttribute('data-page');n.dataset.ip19Done='1';const label=$('.label',n);if(label)label.textContent='Inbox WhatsApp';const ico=$('.ico',n);if(ico)ico.textContent='💬';n.onclick=()=>{window.goPage?.('sales-radar');setTab('inbox')};old.replaceWith(n);
}

function pageHtml(){return `
<div class="ip19-wrap" id="ip19Center">
  <div class="card ip19-hero"><div class="ip19-head"><div><div class="ip19-kicker">INTORNÁ PIXELS • RC19 • OPERAÇÃO BLINDADA</div><h2>🧠 Central Inteligente de Vendas</h2><div class="ip19-sub">Radar comercial, Inbox WhatsApp em tempo real, IA de respostas, follow-ups e WAHA/GOWS em um único lugar.</div></div><div class="ip19-actions"><span class="ip19-status info" id="ip19Realtime"><span class="ip19-dot"></span> Conectando ao tempo real</span><button class="ip19-btn ghost" id="ip19Refresh">↻ Atualizar tudo</button></div></div></div>
  <div class="ip19-kpis"><div class="ip19-kpi"><small>Potencial em aberto</small><b id="ip19Potential">R$ 0,00</b><span>oportunidades do radar</span></div><div class="ip19-kpi"><small>Prioridades quentes</small><b id="ip19Hot">0</b><span>ação imediata</span></div><div class="ip19-kpi"><small>Mensagens não lidas</small><b id="ip19Unread">0</b><span>Inbox em tempo real</span></div><div class="ip19-kpi"><small>Follow-ups na fila</small><b id="ip19QueueKpi">0</b><span>controle antispam</span></div><div class="ip19-kpi"><small>WhatsApp</small><b id="ip19WaKpi">—</b><span id="ip19WaEngine">GOWS</span></div></div>
  <div class="ip19-tabs" id="ip19Tabs"><button class="ip19-tab active" data-ip19tab="priorities">🔥 Prioridades</button><button class="ip19-tab" data-ip19tab="inbox">💬 Inbox em Tempo Real <span id="ip19TabUnread"></span></button><button class="ip19-tab" data-ip19tab="queue">🗓️ Fila</button><button class="ip19-tab" data-ip19tab="rules">⚙️ Regras</button><button class="ip19-tab" data-ip19tab="waha">📱 WhatsApp WAHA</button></div>
  <div class="ip19-panel active" data-ip19panel="priorities"><div class="ip19-card"><div class="ip19-head"><div><h3>Oportunidades priorizadas</h3><div class="ip19-sub">A IA ajuda a preparar a mensagem; o envio continua sob seu controle.</div></div><span class="ip19-status warn"><span class="ip19-dot"></span> Antispam ativo</span></div><div class="ip19-list" id="ip19Priorities"></div></div></div>
  <div class="ip19-panel" data-ip19panel="inbox"><div class="ip19-inbox"><div class="ip19-convs"><div class="ip19-convhead"><div class="ip19-head"><div><b>Conversas</b><div class="ip19-sub">Atualização automática</div></div><span class="ip19-status info" id="ip19InboxLive"><span class="ip19-dot"></span> LIVE</span></div><input class="ip19-search" id="ip19ConvSearch" placeholder="Buscar nome, telefone ou mensagem"></div><div class="ip19-convlist" id="ip19ConvList"></div></div><div class="ip19-chat"><div class="ip19-chathead" id="ip19ChatHead"><b>Selecione uma conversa</b><div class="ip19-sub">O histórico completo aparecerá aqui.</div></div><div id="ip19Insight"></div><div class="ip19-messages" id="ip19Messages"><div class="ip19-empty">Nenhuma conversa selecionada.</div></div><div class="ip19-compose"><textarea id="ip19Composer" placeholder="Digite sua resposta..." disabled></textarea><div class="ip19-context"><select id="ip19LinkClient" disabled><option value="">Sem cliente vinculado</option></select><button class="ip19-btn ghost" id="ip19Analyze" disabled>✨ Analisar última resposta</button><button class="ip19-btn green" id="ip19Send" disabled>Enviar pelo WhatsApp</button></div></div></div></div></div>
  <div class="ip19-panel" data-ip19panel="queue"><div class="ip19-card"><div class="ip19-head"><div><h3>Fila de follow-ups</h3><div class="ip19-sub">Mensagens preparadas pela Central. Respostas do cliente cancelam a sequência quando a regra estiver ativa.</div></div></div><div class="ip19-list" id="ip19Queue"></div></div></div>
  <div class="ip19-panel" data-ip19panel="rules"><div class="ip19-grid2"><div class="ip19-card"><h3>Regras de proteção</h3><div class="ip19-formgrid"><div class="ip19-field"><label>Automação comercial</label><select id="ip19Enabled"><option value="true">Ativa</option><option value="false">Pausada</option></select></div><div class="ip19-field"><label>Preparar follow-ups</label><select id="ip19AutoPrepare"><option value="false">Manual</option><option value="true">Automático</option></select></div><div class="ip19-field"><label>Parar quando cliente responder</label><select id="ip19StopReply"><option value="true">Sim</option><option value="false">Não</option></select></div><div class="ip19-field"><label>Parar após pagamento</label><select id="ip19StopPayment"><option value="true">Sim</option><option value="false">Não</option></select></div><div class="ip19-field"><label>Analisar respostas com IA</label><select id="ip19ReplyAnalysis"><option value="true">Sim</option><option value="false">Não</option></select></div><div class="ip19-field"><label>Sugerir rascunho de resposta</label><select id="ip19ReplyDraft"><option value="true">Sim</option><option value="false">Não</option></select></div></div></div><div class="ip19-card"><h3>Cadência</h3><div class="ip19-formgrid"><div class="ip19-field"><label>Lead: horas para follow-up</label><input id="ip19LeadHours" type="number" min="1" max="168"></div><div class="ip19-field"><label>Pagamento: horas</label><input id="ip19PayHours" type="number" min="1" max="168"></div><div class="ip19-field"><label>Upsell: horas</label><input id="ip19UpsellHours" type="number" min="1" max="720"></div><div class="ip19-field"><label>Reativação: dias</label><input id="ip19ReactDays" type="number" min="1" max="365"></div><div class="ip19-field"><label>Máximo de contatos</label><input id="ip19MaxFollow" type="number" min="1" max="10"></div><div class="ip19-field"><label>Capacidade diária</label><input id="ip19Capacity" type="number" min="1" max="200"></div><div class="ip19-field"><label>Início do atendimento</label><input id="ip19BizStart" type="time"></div><div class="ip19-field"><label>Fim do atendimento</label><input id="ip19BizEnd" type="time"></div><div class="ip19-field"><label>Cooldown por cliente (h)</label><input id="ip19Cooldown" type="number" min="1" max="720"></div></div><div class="ip19-actions"><button class="ip19-btn primary" id="ip19SaveRules">Salvar regras</button><button class="ip19-btn gold" id="ip19PrepareNow">⚡ Preparar fila agora</button></div><div class="ip19-note" style="margin-top:10px">Por segurança, disparo autônomo em massa permanece bloqueado nesta RC. A Central prepara e organiza; o envio WAHA é rastreável e controlado.</div></div></div></div>
  <div class="ip19-panel" data-ip19panel="waha"><div class="ip19-grid2"><div class="ip19-card"><div class="ip19-head"><div><div class="ip19-kicker">MOTOR WHATSAPP</div><h3>WAHA + GOWS</h3><div class="ip19-sub">Sessão isolada deste estúdio, protegida pelo backend.</div></div><span class="ip19-status warn" id="ip19WaStatus"><span class="ip19-dot"></span> Verificando</span></div><div id="ip19WaInfo" class="ip19-note" style="margin-top:10px">Carregando...</div><div class="ip19-actions"><button class="ip19-btn primary" id="ip19WaStart">Iniciar</button><button class="ip19-btn ghost" id="ip19WaTest">Testar conexão</button><button class="ip19-btn gold" id="ip19WaQr">Mostrar QR Code</button><button class="ip19-btn ghost" id="ip19WaRestart">Reiniciar</button><button class="ip19-btn danger" id="ip19WaLogout">Desconectar</button></div><div class="ip19-qr" id="ip19QrBox" style="display:none"><div id="ip19QrMsg">Gerando QR Code...</div><img id="ip19QrImg" alt="QR Code WhatsApp" style="display:none"><div class="ip19-sub" style="margin-top:8px">WhatsApp → Aparelhos conectados → Conectar aparelho.</div></div></div><div class="ip19-card"><h3>Saúde da integração</h3><div id="ip19WaHealth" class="ip19-list"></div><div class="ip19-note" style="margin-top:10px"><b>Modo R$0:</b> se estiver usando Quick Tunnel, o notebook, Docker, WAHA e a janela do Cloudflare precisam permanecer ligados. A URL do túnel pode mudar após reiniciar.</div></div></div></div>
</div>`}

function bind(){
  $$('#ip19Tabs [data-ip19tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.ip19tab));
  $('#ip19Refresh').onclick=()=>refreshAll(true);
  $('#ip19ConvSearch').oninput=renderConversations;
  $('#ip19Send').onclick=sendCurrent;
  $('#ip19Composer').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendCurrent()}});
  $('#ip19LinkClient').onchange=linkClient;
  $('#ip19Analyze').onclick=analyzeCurrent;
  $('#ip19SaveRules').onclick=saveRules;
  $('#ip19PrepareNow').onclick=()=>autoPrepare(true);
  $('#ip19WaStart').onclick=()=>waOperation('start');
  $('#ip19WaTest').onclick=()=>waOperation('test');
  $('#ip19WaQr').onclick=showQr;
  $('#ip19WaRestart').onclick=()=>{if(confirm('Reiniciar a sessão WhatsApp? Use apenas se a conexão estiver com problema.'))waOperation('restart')};
  $('#ip19WaLogout').onclick=()=>{if(confirm('Desconectar este número do Intorná Pixels?'))waOperation('logout')};
}

function setTab(tab){state.tab=tab;$$('[data-ip19tab]').forEach(b=>b.classList.toggle('active',b.dataset.ip19tab===tab));$$('[data-ip19panel]').forEach(p=>p.classList.toggle('active',p.dataset.ip19panel===tab));if(tab==='inbox'){loadConversations();if(state.currentId)loadMessages(state.currentId)}if(tab==='waha')loadWaha()}
window.ip19SetTab=setTab;

function wahaWorking(){return String(state.waha.connection?.status||'').toUpperCase()==='WORKING'}
function wahaStatusLabel(st){return ({WORKING:'Conectado',SCAN_QR_CODE:'Aguardando QR',STARTING:'Iniciando',STOPPED:'Desconectado',FAILED:'Falhou'})[String(st||'STOPPED').toUpperCase()]||String(st||'Desconectado')}
function engineName(){const e=String(state.waha.connection?.engine||'').toUpperCase();return e.includes('GOWS')?'GOWS':e.includes('WEBJS')?'WEBJS':(wahaWorking()?'GOWS':'—')}

function renderKpis(){
  const t=state.radar.totals||{};const unread=state.conversations.reduce((n,c)=>n+Number(c.unread_count||0),0);
  $('#ip19Potential').textContent=money(t.value||0);$('#ip19Hot').textContent=Number(t.hot||0);$('#ip19Unread').textContent=unread;$('#ip19QueueKpi').textContent=state.followups.length;$('#ip19WaKpi').textContent=wahaWorking()?'Conectado':'Offline';$('#ip19WaEngine').textContent=engineName();
  $('#ip19TabUnread').textContent=unread?`(${unread})`:'';
}

function renderPriorities(){
  const host=$('#ip19Priorities');const list=state.radar.opportunities||[];
  if(!list.length){host.innerHTML='<div class="ip19-empty">Nenhuma oportunidade urgente agora.</div>';return}
  host.innerHTML=list.slice(0,50).map(o=>{const sug=state.suggestions[o.key];const disabled=!o.clientId||!cleanPhone(o.whatsapp);return `<div class="ip19-row ${safe(o.temperature||'cold')}"><div class="ip19-rowtop"><div><span class="ip19-status ${o.temperature==='hot'?'bad':o.temperature==='warm'?'warn':'info'}"><span class="ip19-dot"></span>${o.temperature==='hot'?'QUENTE':o.temperature==='warm'?'MORNO':'FRIO'} • ${Number(o.score||0)} pts</span><h3 style="margin:7px 0 2px">${safe(o.clientName||'Cliente')} — ${safe(o.title||'Oportunidade')}</h3><small>${safe(o.orderLabel||'')}</small></div><b>${money(o.value||0)}</b></div><p>${safe(o.reason||'')}</p><small><b>Próxima ação:</b> ${safe(o.nextAction||'Entrar em contato.')}</small><div class="ip19-actions"><button class="ip19-btn primary" data-ip19-suggest="${safe(o.key)}" ${disabled?'disabled':''}>✨ Mensagem IA</button><button class="ip19-btn ghost" data-ip19-snooze="${safe(o.key)}">Adiar 24h</button><button class="ip19-btn danger" data-ip19-dismiss="${safe(o.key)}">Dispensar</button></div>${sug?`<div class="ip19-suggestion">${safe(sug.message)}<div class="ip19-actions"><button class="ip19-btn green" data-ip19-sendop="${safe(o.key)}" ${wahaWorking()?'':'disabled'}>Enviar agora pelo WAHA</button><button class="ip19-btn gold" data-ip19-queueop="${safe(o.key)}">Agendar +2h</button><button class="ip19-btn ghost" data-ip19-copyop="${safe(o.key)}">Copiar</button></div></div>`:''}</div>`}).join('');
  $$('[data-ip19-suggest]',host).forEach(b=>b.onclick=()=>suggestOpportunity(b.dataset.ip19Suggest,b));
  $$('[data-ip19-snooze]',host).forEach(b=>b.onclick=()=>markOpportunity(b.dataset.ip19Snooze,'snoozed',24));
  $$('[data-ip19-dismiss]',host).forEach(b=>b.onclick=()=>markOpportunity(b.dataset.ip19Dismiss,'dismissed'));
  $$('[data-ip19-sendop]',host).forEach(b=>b.onclick=()=>sendOpportunity(b.dataset.ip19Sendop,b));
  $$('[data-ip19-queueop]',host).forEach(b=>b.onclick=()=>queueOpportunity(b.dataset.ip19Queueop,b));
  $$('[data-ip19-copyop]',host).forEach(b=>b.onclick=()=>{const x=state.suggestions[b.dataset.ip19Copyop];if(x?.message)navigator.clipboard.writeText(x.message).then(()=>toast('Mensagem copiada.'))});
}
async function suggestOpportunity(key,btn){const op=(state.radar.opportunities||[]).find(x=>x.key===key);if(!op)return;const old=btn.textContent;btn.disabled=true;btn.textContent='Criando...';try{const d=await sales('suggest',{opportunity:op});state.suggestions[key]=d;renderPriorities()}catch(e){toast(e.message||'Falha ao gerar mensagem.')}finally{if(document.body.contains(btn)){btn.disabled=false;btn.textContent=old}}}
async function markOpportunity(key,status,hours){try{await radar('mark',{key,status,hours});await loadRadar();toast(status==='snoozed'?'Oportunidade adiada.':'Oportunidade atualizada.')}catch(e){toast(e.message||'Falha ao atualizar oportunidade.')}}
async function sendOpportunity(key,btn){const op=(state.radar.opportunities||[]).find(x=>x.key===key),s=state.suggestions[key];if(!op||!s?.message)return;btn.disabled=true;try{await send('send_text',{clientId:op.clientId,text:s.message});await radar('mark',{key,status:'completed'}).catch(()=>{});toast('Mensagem enviada pelo WhatsApp.');await Promise.all([loadRadar(),loadConversations(),loadAssistant()])}catch(e){toast(e.message||'Falha ao enviar mensagem.')}finally{btn.disabled=false}}
async function queueOpportunity(key,btn){const op=(state.radar.opportunities||[]).find(x=>x.key===key),s=state.suggestions[key];if(!op||!s?.message)return;btn.disabled=true;try{await sales('queue',{opportunityKey:key,clientId:op.clientId,orderId:op.orderId||null,kind:op.type||'followup',message:s.message,aiGenerated:!!s.aiUsed,scheduledFor:new Date(Date.now()+2*3600000).toISOString()});await radar('mark',{key,status:'snoozed',hours:24}).catch(()=>{});toast('Follow-up agendado para daqui a 2 horas.');await Promise.all([loadAssistant(),loadRadar()])}catch(e){toast(e.message||'Falha ao agendar.')}finally{btn.disabled=false}}

async function loadRadar(){try{state.radar=await radar('radar');renderPriorities();renderKpis()}catch(e){console.warn('RC19 radar',e);toast(e.message||'Radar indisponível.')}}
async function loadAssistant(){try{const d=await sales('status');state.followups=d.followups||[];state.insights=d.insights||[];renderQueue();if(state.currentId)renderInsight();renderKpis()}catch(e){console.warn('RC19 assistant',e)}}

function renderQueue(){const host=$('#ip19Queue');if(!host)return;const list=state.followups||[];if(!list.length){host.innerHTML='<div class="ip19-empty">Nenhum follow-up ativo agora.</div>';return}host.innerHTML=list.map(f=>{const c=one(f.clients);return `<div class="ip19-row"><div class="ip19-rowtop"><div><b>${safe(c?.name||'Cliente')} • ${safe(f.kind||'follow-up')}</b><small>${f.ai_generated?'✨ IA • ':''}${fmt(f.scheduled_for)}</small></div><span class="ip19-status ${new Date(f.scheduled_for)<=new Date()?'warn':'info'}"><span class="ip19-dot"></span>${new Date(f.scheduled_for)<=new Date()?'Pronto':'Agendado'}</span></div><p>${safe(f.message||'')}</p><div class="ip19-actions"><button class="ip19-btn green" data-ip19-sendfollow="${f.id}" ${wahaWorking()?'':'disabled'}>Enviar pelo WAHA</button><button class="ip19-btn danger" data-ip19-cancelfollow="${f.id}">Cancelar</button></div></div>`}).join('');$$('[data-ip19-sendfollow]',host).forEach(b=>b.onclick=()=>sendFollowup(b.dataset.ip19Sendfollow,b));$$('[data-ip19-cancelfollow]',host).forEach(b=>b.onclick=()=>cancelFollowup(b.dataset.ip19Cancelfollow,b))}
async function sendFollowup(id,btn){btn.disabled=true;try{await send('send_followup',{followupId:id});toast('Follow-up enviado.');await Promise.all([loadAssistant(),loadConversations()])}catch(e){toast(e.message||'Falha ao enviar follow-up.')}finally{btn.disabled=false}}
async function cancelFollowup(id,btn){btn.disabled=true;try{await sales('cancel',{id});toast('Follow-up cancelado.');await loadAssistant()}catch(e){toast(e.message||'Falha ao cancelar.')}finally{btn.disabled=false}}

async function loadClients(){const {data,error}=await db.from('clients').select('id,name,whatsapp').eq('studio_id',sid).order('name');if(!error)state.clients=data||[]}
async function loadConversations(){
  try{const {data,error}=await db.from('whatsapp_conversations').select('id,contact_id,order_id,status,stage,unread_count,last_message_at,last_customer_message_at,last_message_preview,whatsapp_contacts(id,client_id,wa_id,phone,profile_name,clients(id,name,whatsapp))').eq('studio_id',sid).order('last_message_at',{ascending:false,nullsFirst:false}).limit(100);if(error)throw error;state.conversations=data||[];renderConversations();renderKpis();if(state.currentId&&!state.conversations.some(x=>x.id===state.currentId)){state.currentId=null;state.messages=[];renderChat()}}catch(e){console.warn('RC19 conversations',e)}
}
function convContact(c){return one(c?.whatsapp_contacts)||{}}
function convClient(c){return one(convContact(c)?.clients)||null}
function convName(c){const ct=convContact(c),cl=convClient(c);return cl?.name||ct.profile_name||(ct.phone?`+${cleanPhone(ct.phone)}`:'Contato')}
function renderConversations(){const host=$('#ip19ConvList');if(!host)return;const q=String($('#ip19ConvSearch')?.value||'').toLowerCase().trim();const rows=state.conversations.filter(c=>`${convName(c)} ${convContact(c).phone||''} ${c.last_message_preview||''}`.toLowerCase().includes(q));host.innerHTML=rows.length?rows.map(c=>{const name=convName(c),u=Number(c.unread_count||0);return `<div class="ip19-conv ${c.id===state.currentId?'active':''}" data-ip19-conv="${c.id}"><div class="ip19-avatar">${safe((name[0]||'?').toUpperCase())}</div><div style="min-width:0"><b style="font-size:11px">${safe(name)}</b><div class="ip19-preview">${safe(c.last_message_preview||'Sem mensagens')}</div></div>${u?`<span class="ip19-unread">${u}</span>`:`<small>${shortTime(c.last_message_at)}</small>`}</div>`}).join(''):'<div class="ip19-empty">Nenhuma conversa encontrada.</div>';$$('[data-ip19-conv]',host).forEach(el=>el.onclick=()=>selectConversation(el.dataset.ip19Conv))}
async function selectConversation(id){state.currentId=id;renderConversations();await loadMessages(id);await send('mark_read',{conversationId:id}).catch(()=>{});const c=state.conversations.find(x=>x.id===id);if(c)c.unread_count=0;renderConversations();renderKpis()}
async function loadMessages(id=state.currentId){if(!id)return;try{const {data,error}=await db.from('whatsapp_messages').select('id,conversation_id,contact_id,provider_message_id,direction,message_type,body,status,error_message,message_at,created_at').eq('studio_id',sid).eq('conversation_id',id).order('message_at',{ascending:false}).limit(150);if(error)throw error;state.messages=(data||[]).reverse();await loadCurrentInsight();renderChat()}catch(e){console.warn('RC19 messages',e)}}
async function loadCurrentInsight(){state.currentInsight=null;const last=[...state.messages].reverse().find(m=>m.direction==='inbound');if(!last)return;const {data}=await db.from('sales_reply_insights').select('*').eq('studio_id',sid).eq('message_id',last.id).maybeSingle();state.currentInsight=data||null}
function renderChat(){
  const c=state.conversations.find(x=>x.id===state.currentId);const head=$('#ip19ChatHead'),box=$('#ip19Messages'),composer=$('#ip19Composer'),sendBtn=$('#ip19Send'),analyze=$('#ip19Analyze'),select=$('#ip19LinkClient');
  if(!c){head.innerHTML='<b>Selecione uma conversa</b><div class="ip19-sub">O histórico completo aparecerá aqui.</div>';box.innerHTML='<div class="ip19-empty">Nenhuma conversa selecionada.</div>';composer.disabled=true;sendBtn.disabled=true;analyze.disabled=true;select.disabled=true;$('#ip19Insight').innerHTML='';return}
  const ct=convContact(c),cl=convClient(c);head.innerHTML=`<div class="ip19-head"><div><b>${safe(convName(c))}</b><div class="ip19-sub">${ct.phone?`+${safe(cleanPhone(ct.phone))}`:''} • ${safe(c.stage||'novo_lead')} • ${safe(c.status||'open')}</div></div><span class="ip19-status ${wahaWorking()?'ok':'bad'}"><span class="ip19-dot"></span>${wahaWorking()?'WhatsApp online':'WhatsApp offline'}</span></div>`;
  box.innerHTML=state.messages.length?state.messages.map(m=>`<div class="ip19-bubble ${m.direction==='outbound'?'out':'in'}"><div>${safe(m.body||`[${m.message_type||'mídia'}]`)}</div><small>${fmt(m.message_at)}${m.direction==='outbound'?` • ${safe(m.status||'sent')}`:''}</small></div>`).join(''):'<div class="ip19-empty">Nenhuma mensagem nesta conversa.</div>';box.scrollTop=box.scrollHeight;
  composer.disabled=!wahaWorking();sendBtn.disabled=!wahaWorking();analyze.disabled=![...state.messages].reverse().some(m=>m.direction==='inbound');select.disabled=false;select.innerHTML='<option value="">Sem cliente vinculado</option>'+state.clients.map(x=>`<option value="${x.id}" ${x.id===(ct.client_id||cl?.id)?'selected':''}>${safe(x.name)}</option>`).join('');renderInsight();
}
function renderInsight(){const host=$('#ip19Insight');if(!host)return;const i=state.currentInsight;if(!i){host.innerHTML='';return}host.innerHTML=`<div class="ip19-insight"><div class="ip19-head"><div><b>✨ IA comercial</b> • ${safe(i.intent||'other')} • urgência ${Number(i.urgency||0)}/100</div>${i.ai_used?'<span class="ip19-status ok"><span class="ip19-dot"></span> IA</span>':''}</div><div style="margin-top:5px"><b>Resumo:</b> ${safe(i.summary||'')}</div><div><b>Ação sugerida:</b> ${safe(i.recommended_action||'')}</div>${i.draft_response?`<div class="ip19-suggestion">${safe(i.draft_response)}<div class="ip19-actions"><button class="ip19-btn primary" id="ip19UseDraft">Usar rascunho</button></div></div>`:''}</div>`;$('#ip19UseDraft')?.addEventListener('click',()=>{const c=$('#ip19Composer');c.value=i.draft_response||'';c.focus()})}
async function sendCurrent(){const id=state.currentId,text=$('#ip19Composer').value.trim();if(!id||!text)return;const btn=$('#ip19Send');btn.disabled=true;btn.textContent='Enviando...';try{await send('send_conversation',{conversationId:id,text});$('#ip19Composer').value='';await loadMessages(id);await loadConversations();toast('Mensagem enviada pelo WhatsApp.')}catch(e){toast(e.message||'Falha ao enviar mensagem.')}finally{btn.textContent='Enviar pelo WhatsApp';btn.disabled=!wahaWorking()}}
async function linkClient(){const c=state.conversations.find(x=>x.id===state.currentId);if(!c)return;const id=$('#ip19LinkClient').value||null,ct=convContact(c);try{const {error}=await db.from('whatsapp_contacts').update({client_id:id}).eq('studio_id',sid).eq('id',ct.id);if(error)throw error;toast(id?'Cliente vinculado.':'Vínculo removido.');await Promise.all([loadConversations(),loadAssistant()]);if(state.currentId)await loadMessages(state.currentId)}catch(e){toast(e.message||'Falha ao vincular cliente.')}}
async function analyzeCurrent(){const last=[...state.messages].reverse().find(m=>m.direction==='inbound');if(!last)return;const btn=$('#ip19Analyze');btn.disabled=true;btn.textContent='Analisando...';try{await sales('analyze_message',{messageId:last.id});await loadCurrentInsight();renderInsight();toast('Resposta analisada.')}catch(e){toast(e.message||'Não foi possível analisar.')}finally{btn.disabled=false;btn.textContent='✨ Analisar última resposta'}}

function defaultSettings(){return {enabled:true,auto_prepare:false,stop_on_reply:true,stop_on_payment:true,lead_followup_hours:2,payment_recovery_hours:4,upsell_delay_hours:24,reactivation_days:45,max_followups:3,daily_capacity:10,business_start:'08:00',business_end:'19:00',reply_analysis_enabled:true,reply_auto_draft:true,contact_cooldown_hours:24}}
async function loadSettings(){const {data,error}=await db.from('sales_automation_settings').select('*').eq('studio_id',sid).maybeSingle();if(error){console.warn(error);return}state.settings={...defaultSettings(),...(data||{})};renderRules()}
function renderRules(){const s=state.settings||defaultSettings();const val=(id,v)=>{const e=$(id);if(e)e.value=String(v??'')};val('#ip19Enabled',s.enabled);val('#ip19AutoPrepare',s.auto_prepare);val('#ip19StopReply',s.stop_on_reply);val('#ip19StopPayment',s.stop_on_payment);val('#ip19ReplyAnalysis',s.reply_analysis_enabled);val('#ip19ReplyDraft',s.reply_auto_draft);val('#ip19LeadHours',s.lead_followup_hours);val('#ip19PayHours',s.payment_recovery_hours);val('#ip19UpsellHours',s.upsell_delay_hours);val('#ip19ReactDays',s.reactivation_days);val('#ip19MaxFollow',s.max_followups);val('#ip19Capacity',s.daily_capacity);val('#ip19BizStart',String(s.business_start||'08:00').slice(0,5));val('#ip19BizEnd',String(s.business_end||'19:00').slice(0,5));val('#ip19Cooldown',s.contact_cooldown_hours)}
async function saveRules(){const b=v=>String(v)==='true',n=(id,min,max)=>Math.max(min,Math.min(max,Number($(id).value)||min));const row={studio_id:sid,enabled:b($('#ip19Enabled').value),auto_prepare:b($('#ip19AutoPrepare').value),stop_on_reply:b($('#ip19StopReply').value),stop_on_payment:b($('#ip19StopPayment').value),reply_analysis_enabled:b($('#ip19ReplyAnalysis').value),reply_auto_draft:b($('#ip19ReplyDraft').value),lead_followup_hours:n('#ip19LeadHours',1,168),payment_recovery_hours:n('#ip19PayHours',1,168),upsell_delay_hours:n('#ip19UpsellHours',1,720),reactivation_days:n('#ip19ReactDays',1,365),max_followups:n('#ip19MaxFollow',1,10),daily_capacity:n('#ip19Capacity',1,200),business_start:$('#ip19BizStart').value||'08:00',business_end:$('#ip19BizEnd').value||'19:00',contact_cooldown_hours:n('#ip19Cooldown',1,720),auto_send:false,updated_by:ctx.user.id,updated_at:new Date().toISOString()};const btn=$('#ip19SaveRules');btn.disabled=true;try{const {error}=await db.from('sales_automation_settings').upsert(row,{onConflict:'studio_id'});if(error)throw error;state.settings={...(state.settings||{}),...row};toast('Regras da Central salvas.')}catch(e){toast(e.message||'Falha ao salvar regras.')}finally{btn.disabled=false}}


async function autoPrepare(force=false){
  if(autoPreparing)return;
  const s={...defaultSettings(),...(state.settings||{})};
  if(!s.enabled)return;
  if(!force&&!s.auto_prepare)return;

  const day=new Date().toISOString().slice(0,10);
  const marker=`intorna_rc19_autoprep_${sid}_${day}`;
  if(!force&&localStorage.getItem(marker)==='1')return;

  const activeKeys=new Set((state.followups||[])
    .filter(f=>['queued','ready'].includes(String(f.status)))
    .map(f=>String(f.opportunity_key)));

  const candidates=(state.radar.opportunities||[])
    .filter(o=>o.clientId&&cleanPhone(o.whatsapp)&&(o.temperature==='hot'||o.temperature==='warm')&&!activeKeys.has(String(o.key)))
    .slice(0,Math.max(1,Math.min(25,Number(s.daily_capacity)||10)));

  if(!candidates.length){
    if(!force)localStorage.setItem(marker,'1');
    if(force)toast('Não há novas oportunidades quentes ou mornas para preparar.');
    return;
  }

  autoPreparing=true;
  const btn=$('#ip19PrepareNow');
  if(btn){btn.disabled=true;btn.textContent='Preparando...'}
  let done=0,skipped=0;
  try{
    for(let i=0;i<candidates.length;i++){
      const o=candidates[i];
      const suggestion=await sales('suggest',{opportunity:o});
      const queued=await sales('queue',{
        opportunityKey:o.key,
        clientId:o.clientId,
        orderId:o.orderId||null,
        kind:o.type||'followup',
        message:suggestion.message,
        aiGenerated:!!suggestion.aiUsed,
        scheduledFor:new Date(Date.now()+(10+i*30)*60000).toISOString()
      });
      if(queued?.skipped)skipped++;else done++;
    }
    localStorage.setItem(marker,'1');
    await loadAssistant();
    toast(`${done} oportunidade(s) preparada(s)${skipped?` • ${skipped} já protegida(s) por regra`:''}.`);
  }catch(e){
    console.error('RC19 auto prepare',e);
    toast(e.message||'A preparação foi concluída parcialmente.');
  }finally{
    autoPreparing=false;
    if(btn){btn.disabled=false;btn.textContent='⚡ Preparar fila agora'}
  }
}

async function loadWaha(){try{const d=await waha('status');state.waha={platformConfigured:!!d.platformConfigured,connection:d.connection||null,webhookUrl:d.webhookUrl||'',platformBaseUrl:d.platformBaseUrl||''};renderWaha();renderKpis()}catch(e){console.warn('RC19 WAHA',e);renderWaha()}}
function renderWaha(){const c=state.waha.connection||{},st=String(c.status||'STOPPED').toUpperCase(),working=st==='WORKING';const p=$('#ip19WaStatus');if(p){p.className=`ip19-status ${working?'ok':['STARTING','SCAN_QR_CODE'].includes(st)?'warn':'bad'}`;p.innerHTML=`<span class="ip19-dot"></span>${safe(wahaStatusLabel(st))}`};const info=$('#ip19WaInfo');if(info)info.innerHTML=`<b>${safe(c.push_name||c.pushName||'WhatsApp do estúdio')}</b><br>Número: ${c.phone?`+${safe(cleanPhone(c.phone))}`:'—'}<br>Sessão: <code>${safe(c.session_name||c.session||'—')}</code><br>Motor: <b>${safe(engineName())}</b>${c.last_error?`<br><span style="color:#b91c1c">${safe(c.last_error)}</span>`:''}`;const health=$('#ip19WaHealth');if(health)health.innerHTML=`<div class="ip19-row"><b>Servidor WAHA</b><p>${state.waha.platformConfigured?'Configurado no backend':'Configuração pendente'}</p></div><div class="ip19-row"><b>Motor recomendado</b><p>${engineName()==='GOWS'?'✅ GOWS ativo — sem Chromium/Puppeteer':'⚠️ '+engineName()}</p></div><div class="ip19-row"><b>Inbox em tempo real</b><p>${state.realtime==='SUBSCRIBED'?'✅ Supabase Realtime conectado':'🟡 '+safe(state.realtime)}</p></div><div class="ip19-row"><b>Webhook</b><p style="word-break:break-all">${safe(state.waha.webhookUrl||'—')}</p></div>`;const start=$('#ip19WaStart'),qr=$('#ip19WaQr'),test=$('#ip19WaTest'),restart=$('#ip19WaRestart'),logout=$('#ip19WaLogout');if(start)start.disabled=state.waBusy||working||st==='STARTING'||!state.waha.platformConfigured;if(qr)qr.disabled=state.waBusy||working||!state.waha.platformConfigured;if(test)test.disabled=state.waBusy||!c.session_name&&!c.session;if(restart)restart.disabled=state.waBusy||!c.session_name&&!c.session;if(logout)logout.disabled=state.waBusy||!c.session_name&&!c.session;if(working){state.qrData=null;const box=$('#ip19QrBox');if(box)box.style.display='none';stopWaPolling()}renderChat();renderQueue();renderKpis()}
function setWaBusy(v){state.waBusy=v;renderWaha()}
async function waOperation(action){if(state.waBusy)return;setWaBusy(true);try{const d=await waha(action);if(d.message)toast(d.message);else toast(action==='start'?'WhatsApp iniciando...':action==='restart'?'Sessão reiniciada.':action==='logout'?'Número desconectado.':'Teste concluído.');await loadWaha();const st=String(state.waha.connection?.status||'').toUpperCase();if(['STARTING','SCAN_QR_CODE'].includes(st))startWaPolling()}catch(e){toast(e.message||'Falha na operação do WhatsApp.')}finally{setWaBusy(false)}}
async function showQr(){if(state.waBusy)return;setWaBusy(true);const box=$('#ip19QrBox'),img=$('#ip19QrImg'),msg=$('#ip19QrMsg');box.style.display='block';if(!state.qrData){img.style.display='none';msg.style.display='block';msg.textContent='Gerando QR Code...'}try{const d=await waha('qr');if(d.working){toast('WhatsApp já está conectado.');await loadWaha();return}if(!d.data)throw new Error('QR ainda não disponível.');state.qrData=d.data;img.src=d.data;img.style.display='inline-block';msg.style.display='none';startWaPolling()}catch(e){msg.textContent=e.message||'QR indisponível.';toast(e.message||'Não foi possível gerar o QR.')}finally{setWaBusy(false)}}
function startWaPolling(){if(waPollTimer)return;waPollTimer=setInterval(async()=>{await loadWaha();const st=String(state.waha.connection?.status||'').toUpperCase();if(!['STARTING','SCAN_QR_CODE'].includes(st))stopWaPolling()},5000)}
function stopWaPolling(){if(waPollTimer){clearInterval(waPollTimer);waPollTimer=null}}

function installRealtime(){if(realtimeChannel)return;const name=`ip19:${sid}:${Date.now()}`;realtimeChannel=db.channel(name)
  .on('postgres_changes',{event:'*',schema:'public',table:'whatsapp_conversations',filter:`studio_id=eq.${sid}`},()=>scheduleConversations())
  .on('postgres_changes',{event:'*',schema:'public',table:'whatsapp_messages',filter:`studio_id=eq.${sid}`},payload=>{scheduleConversations();if(payload.new?.conversation_id===state.currentId||payload.old?.conversation_id===state.currentId)scheduleMessages();if(payload.eventType==='INSERT'&&payload.new?.direction==='inbound')toast('💬 Nova mensagem recebida no WhatsApp.')})
  .on('postgres_changes',{event:'*',schema:'public',table:'sales_reply_insights',filter:`studio_id=eq.${sid}`},()=>scheduleInsight())
  .on('postgres_changes',{event:'*',schema:'public',table:'sales_followups',filter:`studio_id=eq.${sid}`},()=>scheduleAssistant())
  .on('postgres_changes',{event:'*',schema:'public',table:'waha_connections',filter:`studio_id=eq.${sid}`},payload=>{if(payload.new){state.waha.connection={...(state.waha.connection||{}),...payload.new};renderWaha()}})
  .subscribe(status=>{state.realtime=status;renderRealtime()})}
function renderRealtime(){const e=$('#ip19Realtime'),live=$('#ip19InboxLive');const ok=state.realtime==='SUBSCRIBED';if(e){e.className=`ip19-status ${ok?'ok':'warn'} ${ok?'ip19-live':''}`;e.innerHTML=`<span class="ip19-dot"></span>${ok?'Tempo real ativo':'Conectando ao tempo real'}`};if(live){live.className=`ip19-status ${ok?'ok':'warn'}`;live.innerHTML=`<span class="ip19-dot"></span>${ok?'LIVE':'Conectando'}`};renderWaha()}
function scheduleConversations(){clearTimeout(convDebounce);convDebounce=setTimeout(()=>loadConversations(),180)}
function scheduleMessages(){clearTimeout(msgDebounce);msgDebounce=setTimeout(()=>state.currentId&&loadMessages(state.currentId),160)}
function scheduleInsight(){clearTimeout(insightDebounce);insightDebounce=setTimeout(async()=>{if(state.currentId){await loadCurrentInsight();renderInsight()}await loadAssistant()},220)}
function scheduleAssistant(){clearTimeout(insightDebounce);insightDebounce=setTimeout(()=>loadAssistant(),180)}

async function refreshAll(show=true){if(state.loading)return;state.loading=true;const b=$('#ip19Refresh');if(b){b.disabled=true;b.textContent='Atualizando...'}try{await Promise.allSettled([loadClients(),loadRadar(),loadAssistant(),loadSettings(),loadWaha(),loadConversations()]);if(state.currentId)await loadMessages(state.currentId);await autoPrepare(false);if(show)toast('Central atualizada.')}finally{state.loading=false;if(b){b.disabled=false;b.textContent='↻ Atualizar tudo'}}}

function teardown(){if(realtimeChannel){db.removeChannel(realtimeChannel);realtimeChannel=null}clearInterval(refreshTimer);clearInterval(statusTimer);stopWaPolling();clearTimeout(convDebounce);clearTimeout(msgDebounce);clearTimeout(insightDebounce)}

function install(){if(window.__INTORNA_RC19__)return;if(!addNavAndPage())return;window.__INTORNA_RC19__=true;addStyles();installRealtime();refreshAll(false);refreshTimer=setInterval(()=>Promise.allSettled([loadRadar(),loadAssistant()]),120000);statusTimer=setInterval(()=>loadWaha(),60000);window.addEventListener('beforeunload',teardown);window.IntornaRC19={version:VERSION,refresh:()=>refreshAll(true),openInbox:()=>{window.goPage?.('sales-radar');setTab('inbox')},state:()=>state}}

let tries=0;const boot=setInterval(()=>{tries++;if(window.INTORNA_CTX&&window.IntornaCloud?.client&&$('.nav')&&$('.container')){install();if(window.__INTORNA_RC19__)clearInterval(boot)}if(tries>80)clearInterval(boot)},250);
})();
