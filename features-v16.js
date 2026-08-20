(()=>{
'use strict';

const VERSION='RC16';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const db=()=>window.IntornaCloud?.client||window.INTORNA_SUPABASE||window.supabaseClient||window.sb||null;
const studioId=()=>window.INTORNA_CTX?.studioId||null;

let installed=false;
let busy=false;
let statusData={followups:[],insights:[],due:0,upcoming:0,whatsapp:null};
let settings=null;
let selectedOpp=null;
let selectedSuggestion=null;
let lastUpdated=null;
let timer=null;
let activeTab='priorities';

function toast(msg){
  if(window.toast){window.toast(msg);return}
  let el=$('#ip16Toast');
  if(!el){
    el=document.createElement('div');
    el.id='ip16Toast';
    el.className='ip16-toast';
    document.body.appendChild(el);
  }
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t=setTimeout(()=>el.classList.remove('show'),2600);
}

async function freshSession(){
  const client=db();
  if(!client)throw new Error('Supabase não disponível.');
  let {data,error}=await client.auth.getSession();
  if(error)throw error;
  let session=data?.session||null;
  if(!session)throw new Error('Sua sessão expirou. Entre novamente no Intorná Pixels.');
  const exp=Number(session.expires_at||0)*1000;
  if(!exp||exp-Date.now()<120000){
    const r=await client.auth.refreshSession();
    if(r.error)throw r.error;
    session=r.data?.session||null;
    if(!session)throw new Error('Não foi possível renovar sua sessão.');
  }
  return session;
}

async function invoke(action,extra={}){
  const client=db(),sid=studioId();
  if(!client||!sid)throw new Error('Sessão do estúdio não encontrada.');
  await freshSession();

  let call=await client.functions.invoke('sales-assistant',{
    body:{action,studioId:sid,...extra}
  });

  const unauthorized=
    call.error?.context?.status===401 ||
    /401|jwt|expired|unauthorized/i.test(String(call.error?.message||call.error||''));

  if(unauthorized){
    const r=await client.auth.refreshSession();
    if(r.error||!r.data?.session)throw new Error('Sua sessão expirou. Entre novamente.');
    call=await client.functions.invoke('sales-assistant',{
      body:{action,studioId:sid,...extra}
    });
  }

  if(call.error)throw call.error;
  if(call.data?.error)throw new Error(call.data.error);
  return call.data;
}

function opps(){
  return window.IntornaRC13?.data?.()?.opportunities ||
         window.IntornaRC13Data?.opportunities || [];
}

function rc15(){
  return window.IntornaRC15?.state?.()||{};
}

function defaultSettings(){
  return {
    enabled:true,auto_prepare:false,stop_on_reply:true,stop_on_payment:true,
    reply_analysis_enabled:true,reply_auto_draft:true,contact_cooldown_hours:24,
    max_followups:3,daily_capacity:10,auto_send:false
  };
}

function styles(){
  if($('#ip16Styles'))return;
  const s=document.createElement('style');
  s.id='ip16Styles';
  s.textContent=`
    /* RC16 consolida as camadas antigas numa experiência única. */
    #sales-radar>.card>.ip13-head,
    #sales-radar>.card>.ip13-radar-grid,
    #sales-radar>.card>.ip13-filters,
    #sales-radar>.card>#ip13RadarList,
    #ip14Autopilot,
    #ip15SalesMachine{display:none!important}
    #ip15Dash{display:none!important}

    .ip16-center{display:grid;gap:12px}
    .ip16-hero{border:1px solid rgba(99,102,241,.28);background:linear-gradient(135deg,rgba(37,99,235,.09),rgba(124,58,237,.11));border-radius:18px;padding:16px}
    .ip16-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
    .ip16-head h2,.ip16-head h3{margin:2px 0 5px}
    .ip16-kicker{font-size:11px;font-weight:950;letter-spacing:.09em;color:#6d5bd0;text-transform:uppercase}
    .ip16-sub{font-size:12px;opacity:.72;line-height:1.45}
    .ip16-sync{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
    .ip16-last{font-size:10px;opacity:.68}
    .ip16-dot{width:9px;height:9px;border-radius:50%;background:#22c55e;display:inline-block}
    .ip16-dot.busy{background:#f59e0b;animation:ip16pulse .8s infinite alternate}
    @keyframes ip16pulse{from{opacity:.45}to{opacity:1}}
    .ip16-btn{border:0;border-radius:10px;padding:9px 11px;font-size:12px;font-weight:900;cursor:pointer}
    .ip16-btn.primary{background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff}
    .ip16-btn.dark{background:#111827;color:#fff}
    .ip16-btn.good{background:#dcfce7;color:#166534}
    .ip16-btn.warn{background:#fef3c7;color:#92400e}
    .ip16-btn.ghost{background:#eef2f7;color:#26364d}
    .ip16-btn.danger{background:#fee2e2;color:#991b1b}
    .ip16-btn:disabled{opacity:.55;cursor:not-allowed}

    .ip16-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-top:13px}
    .ip16-stat{border:1px solid rgba(148,163,184,.27);border-radius:13px;padding:11px;background:rgba(255,255,255,.035)}
    .ip16-stat small{display:block;opacity:.66;margin-bottom:4px}
    .ip16-stat b{font-size:20px}

    .ip16-next{margin-top:12px;border-left:4px solid #7c3aed;border-radius:12px;padding:11px 13px;background:rgba(124,58,237,.07)}
    .ip16-next b{display:block;margin-bottom:3px}
    .ip16-next span{font-size:12px;opacity:.78}

    .ip16-tabs{display:flex;gap:7px;flex-wrap:wrap;border-bottom:1px solid rgba(148,163,184,.22);padding-bottom:9px}
    .ip16-tab{border:1px solid rgba(148,163,184,.30);background:transparent;border-radius:999px;padding:8px 11px;font-weight:900;font-size:12px;cursor:pointer}
    .ip16-tab.active{background:#111827;color:#fff;border-color:#111827}
    .ip16-badge{display:inline-flex;min-width:20px;height:20px;padding:0 6px;align-items:center;justify-content:center;border-radius:999px;background:#ede9fe;color:#5b21b6;font-size:10px;font-weight:950}

    .ip16-panel{display:none}
    .ip16-panel.active{display:block}
    .ip16-grid2{display:grid;grid-template-columns:1.08fr .92fr;gap:12px}
    .ip16-card{border:1px solid rgba(148,163,184,.28);border-radius:15px;padding:13px;background:rgba(255,255,255,.025)}
    .ip16-list{display:grid;gap:8px;margin-top:10px}
    .ip16-row{border:1px solid rgba(148,163,184,.24);border-radius:12px;padding:10px}
    .ip16-row-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}
    .ip16-row-title{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
    .ip16-row-title b{font-size:13px}
    .ip16-meta{font-size:11px;opacity:.70;line-height:1.45;margin-top:4px}
    .ip16-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
    .ip16-score{padding:4px 7px;border-radius:999px;font-size:10px;font-weight:950}
    .ip16-score.hot{background:#fee2e2;color:#991b1b}
    .ip16-score.warm{background:#fef3c7;color:#92400e}
    .ip16-score.cold{background:#e0f2fe;color:#075985}
    .ip16-empty{padding:22px;text-align:center;border:1px dashed rgba(148,163,184,.35);border-radius:12px;opacity:.70}

    .ip16-compose{position:sticky;top:10px}
    .ip16-field{display:grid;gap:5px;margin-top:9px}
    .ip16-field label{font-size:11px;font-weight:900}
    .ip16-field textarea,.ip16-field input,.ip16-field select{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#111827}
    .ip16-field textarea{min-height:150px;resize:vertical}

    .ip16-reply{border-left:4px solid #2563eb}
    .ip16-reply.urgent{border-left-color:#dc2626}
    .ip16-intent{display:inline-flex;padding:4px 7px;border-radius:999px;font-size:10px;font-weight:950;background:#e0f2fe;color:#075985}
    .ip16-sentiment{font-size:10px;font-weight:900}
    .ip16-draft{margin-top:8px;background:rgba(37,99,235,.06);border-radius:10px;padding:9px;font-size:11px;line-height:1.5}
    .ip16-rec{margin-top:7px;font-size:11px;line-height:1.45}
    .ip16-rec b{display:block;margin-bottom:2px}

    .ip16-queue-head{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:10px}
    .ip16-mini{border:1px solid rgba(148,163,184,.24);border-radius:11px;padding:9px}
    .ip16-mini small{display:block;opacity:.65}
    .ip16-mini b{font-size:17px}

    .ip16-settings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px}
    .ip16-toggle{display:flex;justify-content:space-between;gap:8px;align-items:center;border:1px solid rgba(148,163,184,.25);border-radius:10px;padding:9px}
    .ip16-toggle span{font-size:11px;font-weight:900}
    .ip16-note{font-size:10px;opacity:.68;line-height:1.45;margin-top:8px}

    .ip16-dash{margin-top:12px;border-top:1px solid rgba(148,163,184,.18);padding-top:12px}
    .ip16-dash-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:9px}
    .ip16-toast{position:fixed;right:18px;bottom:18px;background:#111827;color:#fff;padding:12px 16px;border-radius:12px;display:none;z-index:17000}
    .ip16-toast.show{display:block}

    @media(max-width:950px){
      .ip16-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
      .ip16-grid2{grid-template-columns:1fr}
      .ip16-compose{position:static}
      .ip16-dash-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    }
    @media(max-width:560px){
      .ip16-settings,.ip16-queue-head{grid-template-columns:1fr}
      .ip16-stats{grid-template-columns:1fr 1fr}
    }
  `;
  document.head.appendChild(s);
}

function center(){
  const card=$('#sales-radar>.card');
  if(!card||$('#ip16Center'))return;

  const host=document.createElement('div');
  host.id='ip16Center';
  host.className='ip16-center';
  host.innerHTML=`
    <div class="ip16-hero">
      <div class="ip16-head">
        <div>
          <div class="ip16-kicker">INTORNÁ PIXELS • ${VERSION}</div>
          <h2>⚡ Central Inteligente de Vendas</h2>
          <div class="ip16-sub">Uma única central para oportunidades, respostas dos clientes, fila comercial e regras automáticas.</div>
        </div>
        <div class="ip16-sync">
          <span class="ip16-dot" id="ip16Dot"></span>
          <span class="ip16-last" id="ip16Last">Ainda não atualizado</span>
          <button class="ip16-btn primary" id="ip16Refresh">⟳ Atualizar tudo</button>
        </div>
      </div>

      <div class="ip16-stats">
        <div class="ip16-stat"><small>Potencial aberto</small><b id="ip16Potential">R$ 0</b></div>
        <div class="ip16-stat"><small>Previsão ponderada</small><b id="ip16Forecast">R$ 0</b></div>
        <div class="ip16-stat"><small>Respostas aguardando</small><b id="ip16Replies">0</b></div>
        <div class="ip16-stat"><small>Follow-ups ativos</small><b id="ip16QueueCount">0</b></div>
        <div class="ip16-stat"><small>Conversão 30d</small><b id="ip16Conversion">0%</b></div>
      </div>

      <div class="ip16-next" id="ip16Next">
        <b>Próxima melhor ação</b>
        <span>Atualizando inteligência comercial…</span>
      </div>
    </div>

    <div class="ip16-tabs">
      <button class="ip16-tab active" data-ip16-tab="priorities">🔥 Prioridades <span class="ip16-badge" id="ip16TabOpps">0</span></button>
      <button class="ip16-tab" data-ip16-tab="replies">💬 Respostas <span class="ip16-badge" id="ip16TabReplies">0</span></button>
      <button class="ip16-tab" data-ip16-tab="queue">⏰ Fila <span class="ip16-badge" id="ip16TabQueue">0</span></button>
      <button class="ip16-tab" data-ip16-tab="rules">⚙️ Regras</button>
    </div>

    <div class="ip16-panel active" data-ip16-panel="priorities">
      <div class="ip16-grid2">
        <div class="ip16-card">
          <div class="ip16-head">
            <div><div class="ip16-kicker">OPORTUNIDADES</div><h3>Quem merece atenção agora</h3></div>
            <span class="ip16-badge">Lead Score</span>
          </div>
          <div class="ip16-list" id="ip16OppList"></div>
        </div>

        <div class="ip16-card ip16-compose">
          <div class="ip16-kicker">VENDEDOR IA</div>
          <h3>Próxima abordagem</h3>
          <div class="ip16-sub" id="ip16ComposeInfo">Escolha uma oportunidade ao lado.</div>
          <div class="ip16-field">
            <label>Mensagem</label>
            <textarea id="ip16Message" placeholder="A mensagem será preparada aqui."></textarea>
          </div>
          <div class="ip16-actions">
            <button class="ip16-btn primary" id="ip16Generate">✨ Gerar com IA</button>
            <button class="ip16-btn ghost" id="ip16Copy">Copiar</button>
            <button class="ip16-btn dark" id="ip16Whats">WhatsApp</button>
          </div>
          <div class="ip16-actions">
            <button class="ip16-btn good" data-ip16-schedule="now">Agendar agora</button>
            <button class="ip16-btn warn" data-ip16-schedule="2h">Em 2h</button>
            <button class="ip16-btn ghost" data-ip16-schedule="tomorrow">Amanhã 09h</button>
          </div>
        </div>
      </div>
    </div>

    <div class="ip16-panel" data-ip16-panel="replies">
      <div class="ip16-card">
        <div class="ip16-head">
          <div>
            <div class="ip16-kicker">INTELIGÊNCIA DE RESPOSTAS</div>
            <h3>O cliente respondeu. O que fazer agora?</h3>
            <div class="ip16-sub">Follow-ups são interrompidos automaticamente e a IA classifica intenção, urgência e próxima ação.</div>
          </div>
          <span class="ip16-badge" id="ip16WaStatus">WhatsApp manual</span>
        </div>
        <div class="ip16-list" id="ip16ReplyList"></div>
      </div>
    </div>

    <div class="ip16-panel" data-ip16-panel="queue">
      <div class="ip16-card">
        <div class="ip16-head">
          <div><div class="ip16-kicker">FILA COMERCIAL</div><h3>Follow-ups ativos</h3></div>
          <span class="ip16-badge">Antiduplicação ativa</span>
        </div>
        <div class="ip16-queue-head">
          <div class="ip16-mini"><small>Vencidos/agora</small><b id="ip16Due">0</b></div>
          <div class="ip16-mini"><small>Próximos 7 dias</small><b id="ip16Upcoming">0</b></div>
          <div class="ip16-mini"><small>Proteção</small><b style="font-size:12px">1 contato/tipo</b></div>
        </div>
        <div class="ip16-list" id="ip16QueueList"></div>
      </div>
    </div>

    <div class="ip16-panel" data-ip16-panel="rules">
      <div class="ip16-card">
        <div class="ip16-head">
          <div>
            <div class="ip16-kicker">PILOTO AUTOMÁTICO</div>
            <h3>Regras comerciais</h3>
          </div>
          <span class="ip16-badge" id="ip16RuleStatus">Assistido</span>
        </div>

        <div class="ip16-settings">
          <div class="ip16-toggle"><span>Piloto habilitado</span><input type="checkbox" id="ip16Enabled"></div>
          <div class="ip16-toggle"><span>Preparar fila automaticamente</span><input type="checkbox" id="ip16AutoPrepare"></div>
          <div class="ip16-toggle"><span>Parar quando responder</span><input type="checkbox" id="ip16StopReply"></div>
          <div class="ip16-toggle"><span>Parar quando pagar</span><input type="checkbox" id="ip16StopPayment"></div>
          <div class="ip16-toggle"><span>Analisar respostas com IA</span><input type="checkbox" id="ip16ReplyAnalysis"></div>
          <div class="ip16-toggle"><span>Criar rascunho de resposta</span><input type="checkbox" id="ip16ReplyDraft"></div>

          <div class="ip16-field"><label>Janela sem repetir abordagem (horas)</label><input type="number" min="1" max="168" id="ip16Cooldown"></div>
          <div class="ip16-field"><label>Capacidade diária</label><input type="number" min="1" max="100" id="ip16Capacity"></div>
          <div class="ip16-field"><label>Máximo de follow-ups</label><input type="number" min="1" max="10" id="ip16MaxFollow"></div>
        </div>

        <div class="ip16-actions">
          <button class="ip16-btn good" id="ip16SaveRules">Salvar regras</button>
          <button class="ip16-btn primary" id="ip16Prepare">⚡ Preparar oportunidades agora</button>
        </div>
        <div class="ip16-note">O Intorná já pode decidir o que preparar e o que interromper. O disparo totalmente automático continua bloqueado até o WhatsApp oficial estar conectado e validado.</div>
      </div>
    </div>
  `;

  card.prepend(host);

  $('#ip16Refresh').onclick=()=>refreshAll(true);
  $('#ip16Generate').onclick=generateSelected;
  $('#ip16Copy').onclick=copySelected;
  $('#ip16Whats').onclick=openSelectedWhats;
  $('#ip16SaveRules').onclick=saveRules;
  $('#ip16Prepare').onclick=async()=>{
    await window.IntornaRC15?.prepare?.();
    await refreshAll(true);
  };
  $$('[data-ip16-schedule]').forEach(b=>b.onclick=()=>queueSelected(b.dataset.ip16Schedule));
  $$('[data-ip16-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.ip16Tab));
}

function dashboard(){
  const card=$('#ip13SalesDash');
  if(!card||$('#ip16Dash'))return;
  const d=document.createElement('div');
  d.id='ip16Dash';
  d.className='ip16-dash';
  d.innerHTML=`
    <div class="ip16-head">
      <div>
        <div class="ip16-kicker">RC16 • CENTRAL DE VENDAS</div>
        <b id="ip16DashNext">Atualizando próxima ação…</b>
      </div>
      <div class="ip16-sync">
        <span class="ip16-last" id="ip16DashLast">—</span>
        <button class="ip16-btn primary" id="ip16DashOpen">Abrir Central</button>
      </div>
    </div>
    <div class="ip16-dash-grid">
      <div class="ip16-mini"><small>Potencial</small><b id="ip16DashPotential">R$ 0</b></div>
      <div class="ip16-mini"><small>Previsão</small><b id="ip16DashForecast">R$ 0</b></div>
      <div class="ip16-mini"><small>Respostas</small><b id="ip16DashReplies">0</b></div>
      <div class="ip16-mini"><small>Fila ativa</small><b id="ip16DashQueue">0</b></div>
    </div>
  `;
  card.appendChild(d);
  $('#ip16DashOpen').onclick=()=>window.goPage?.('sales-radar');
}

function switchTab(tab){
  activeTab=tab;
  $$('[data-ip16-tab]').forEach(b=>b.classList.toggle('active',b.dataset.ip16Tab===tab));
  $$('[data-ip16-panel]').forEach(p=>p.classList.toggle('active',p.dataset.ip16Panel===tab));
}

function scheduleAt(mode){
  const d=new Date();
  if(mode==='now')return d.toISOString();
  if(mode==='2h'){d.setHours(d.getHours()+2);return d.toISOString()}
  d.setDate(d.getDate()+1);d.setHours(9,0,0,0);return d.toISOString();
}

function fmt(v){
  try{return new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return '—'}
}

function labelIntent(v){
  return ({
    interested:'Interessado',
    pricing:'Preço',
    scheduling:'Agendamento',
    payment:'Pagamento',
    objection:'Objeção',
    not_interested:'Não interessado',
    support:'Atendimento humano',
    media:'Mídia',
    other:'Outro'
  })[v]||'Analisando';
}

function labelSent(v){
  return v==='positive'?'😊 Positivo':v==='negative'?'⚠️ Negativo':'😐 Neutro';
}

function render(){
  const list=opps();
  const s15=rc15();
  const metrics=s15.metrics||{};
  const readyInsights=(statusData.insights||[]).filter(x=>x.status==='ready'||x.status==='pending'||x.status==='error');
  const followups=statusData.followups||[];
  const potential=list.reduce((a,o)=>a+num(o.value),0);
  const forecast=num(metrics.forecast);
  const conversion=num(metrics.conversion);
  const nextReply=readyInsights.find(x=>x.status==='ready'&&num(x.urgency)>=70);
  const nextOpp=list[0]||null;

  $('#ip16Potential').textContent=money(potential);
  $('#ip16Forecast').textContent=money(forecast);
  $('#ip16Replies').textContent=readyInsights.length;
  $('#ip16QueueCount').textContent=followups.length;
  $('#ip16Conversion').textContent=`${conversion.toFixed(1).replace('.',',')}%`;

  $('#ip16TabOpps').textContent=list.length;
  $('#ip16TabReplies').textContent=readyInsights.length;
  $('#ip16TabQueue').textContent=followups.length;

  $('#ip16DashPotential').textContent=money(potential);
  $('#ip16DashForecast').textContent=money(forecast);
  $('#ip16DashReplies').textContent=readyInsights.length;
  $('#ip16DashQueue').textContent=followups.length;

  const next=$('#ip16Next');
  if(nextReply){
    const c=Array.isArray(nextReply.clients)?nextReply.clients[0]:nextReply.clients;
    next.innerHTML=`<b>💬 ${safe(c?.name||'Cliente')} respondeu • ${safe(labelIntent(nextReply.intent))}</b><span>${safe(nextReply.recommended_action||'Responder ao cliente.')}</span>`;
    $('#ip16DashNext').textContent=`Responder ${c?.name||'cliente'}: ${labelIntent(nextReply.intent)}`;
  }else if(nextOpp){
    next.innerHTML=`<b>${nextOpp.temperature==='hot'?'🔥':nextOpp.temperature==='warm'?'🟠':'🔵'} ${safe(nextOpp.clientName)} — ${safe(nextOpp.title)}</b><span>${safe(nextOpp.nextAction||nextOpp.reason||'Trabalhar oportunidade.')}</span>`;
    $('#ip16DashNext').textContent=`Prioridade: ${nextOpp.clientName} • ${nextOpp.title}`;
  }else{
    next.innerHTML='<b>Próxima melhor ação</b><span>Nenhuma prioridade crítica detectada agora.</span>';
    $('#ip16DashNext').textContent='Nenhuma prioridade crítica agora';
  }

  $('#ip16WaStatus').textContent=statusData.whatsapp?.status==='connected'?'WhatsApp conectado':'WhatsApp manual';

  renderOpps();
  renderReplies();
  renderQueue();
  renderRules();
  renderLast();
}

function renderOpps(){
  const host=$('#ip16OppList');
  if(!host)return;
  const list=opps().slice(0,12);
  host.innerHTML=list.length?list.map(o=>`
    <div class="ip16-row">
      <div class="ip16-row-top">
        <div>
          <div class="ip16-row-title">
            <b>${safe(o.clientName)}</b>
            <span class="ip16-score ${safe(o.temperature)}">${o.temperature==='hot'?'Quente':o.temperature==='warm'?'Morno':'Frio'} • ${num(o.score)}</span>
          </div>
          <div class="ip16-meta"><b>${safe(o.title)}</b><br>${safe(o.reason||'')}<br>Potencial: <b>${money(o.value)}</b></div>
        </div>
        <button class="ip16-btn primary" data-ip16-work="${safe(o.key)}">Trabalhar</button>
      </div>
    </div>
  `).join(''):'<div class="ip16-empty">Nenhuma oportunidade urgente encontrada agora.</div>';

  $$('[data-ip16-work]',host).forEach(b=>b.onclick=()=>{
    selectedOpp=opps().find(o=>o.key===b.dataset.ip16Work)||null;
    selectedSuggestion=null;
    $('#ip16Message').value='';
    $('#ip16ComposeInfo').textContent=selectedOpp?`${selectedOpp.clientName} • ${selectedOpp.title} • ${money(selectedOpp.value)}`:'Escolha uma oportunidade.';
    generateSelected();
  });
}

async function generateSelected(){
  if(!selectedOpp){toast('Escolha uma oportunidade primeiro.');return}
  const btn=$('#ip16Generate');
  btn.disabled=true;btn.textContent='Gerando…';
  try{
    const d=await invoke('suggest',{opportunity:selectedOpp});
    selectedSuggestion=d;
    $('#ip16Message').value=d.message||'';
    toast(d.aiUsed?'Mensagem gerada com IA.':'Mensagem inteligente preparada.');
  }catch(e){toast(e.message||'Não foi possível gerar a mensagem.')}
  finally{btn.disabled=false;btn.textContent='✨ Gerar com IA'}
}

async function copySelected(){
  const text=$('#ip16Message')?.value?.trim();
  if(!text){toast('Nenhuma mensagem para copiar.');return}
  await navigator.clipboard.writeText(text);
  toast('Mensagem copiada.');
}

function openSelectedWhats(){
  if(!selectedOpp){toast('Escolha uma oportunidade.');return}
  const text=$('#ip16Message')?.value?.trim();
  if(!text){toast('Gere a mensagem primeiro.');return}
  const p=String(selectedOpp.whatsapp||'').replace(/\D/g,'');
  if(!p){toast('Cliente sem WhatsApp cadastrado.');return}
  const n=p.startsWith('55')?p:`55${p}`;
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(text)}`,'_blank','noopener');
}

async function queueSelected(mode){
  if(!selectedOpp){toast('Escolha uma oportunidade.');return}
  let text=$('#ip16Message')?.value?.trim();
  if(!text){await generateSelected();text=$('#ip16Message')?.value?.trim()}
  if(!text)return;
  try{
    const d=await invoke('queue',{
      opportunityKey:selectedOpp.key,
      clientId:selectedOpp.clientId||null,
      orderId:selectedOpp.orderId||null,
      kind:selectedOpp.type||'followup',
      message:text,
      aiGenerated:!!selectedSuggestion?.aiUsed,
      scheduledFor:scheduleAt(mode)
    });
    if(d.skipped){
      toast(d.reason==='payment_priority'?'Contato não criado: cobrança tem prioridade.':'Contato duplicado evitado automaticamente.');
    }else if(d.deduplicated){
      toast('Follow-up existente atualizado, sem duplicar contato.');
    }else{
      toast('Follow-up colocado na fila.');
    }
    await refreshAll(false);
  }catch(e){toast(e.message||'Não foi possível agendar.')}
}

function renderReplies(){
  const host=$('#ip16ReplyList');
  if(!host)return;
  const list=statusData.insights||[];
  host.innerHTML=list.length?list.map(i=>{
    const c=Array.isArray(i.clients)?i.clients[0]:i.clients;
    const urgent=num(i.urgency)>=70;
    return `
      <div class="ip16-row ip16-reply ${urgent?'urgent':''}">
        <div class="ip16-row-top">
          <div>
            <div class="ip16-row-title">
              <b>${safe(c?.name||'Cliente')}</b>
              <span class="ip16-intent">${safe(labelIntent(i.intent))}</span>
              ${i.status==='pending'?'<span class="ip16-badge">Analisando</span>':''}
              ${i.status==='error'?'<span class="ip16-badge">Reanalisar</span>':''}
            </div>
            <div class="ip16-meta">${safe(labelSent(i.sentiment))} • Urgência ${num(i.urgency)}/100 • ${fmt(i.created_at)}</div>
          </div>
          ${i.ai_used?'<span class="ip16-badge">✨ IA</span>':''}
        </div>
        <div class="ip16-rec"><b>Resumo</b>${safe(i.summary||'Resposta recebida.')}</div>
        <div class="ip16-rec"><b>Próxima ação</b>${safe(i.recommended_action||'Analisar a conversa.')}</div>
        ${i.draft_response?`<div class="ip16-draft">${safe(i.draft_response)}</div>`:''}
        <div class="ip16-actions">
          ${(i.status==='pending'||i.status==='error')?`<button class="ip16-btn primary" data-ip16-analyze="${safe(i.message_id)}">Analisar agora</button>`:''}
          ${i.draft_response?`<button class="ip16-btn ghost" data-ip16-copy-reply="${safe(i.id)}">Copiar resposta</button>`:''}
          ${c?.whatsapp&&i.draft_response?`<button class="ip16-btn dark" data-ip16-wa-reply="${safe(i.id)}" data-phone="${safe(c.whatsapp)}">WhatsApp</button>`:''}
          <button class="ip16-btn good" data-ip16-handle="${safe(i.id)}">Resolvido</button>
          <button class="ip16-btn ghost" data-ip16-reanalyze="${safe(i.message_id)}">Reanalisar</button>
        </div>
      </div>
    `;
  }).join(''):`<div class="ip16-empty">Nenhuma resposta aguardando análise.<br><small>Quando o WhatsApp oficial receber uma resposta vinculada a um cliente, ela aparecerá aqui automaticamente.</small></div>`;

  $$('[data-ip16-analyze],[data-ip16-reanalyze]',host).forEach(b=>b.onclick=()=>analyzeMessage(b.dataset.ip16Analyze||b.dataset.ip16Reanalyze));
  $$('[data-ip16-copy-reply]',host).forEach(b=>b.onclick=async()=>{
    const i=(statusData.insights||[]).find(x=>x.id===b.dataset.ip16CopyReply);
    if(i?.draft_response){await navigator.clipboard.writeText(i.draft_response);toast('Resposta copiada.')}
  });
  $$('[data-ip16-wa-reply]',host).forEach(b=>b.onclick=()=>{
    const i=(statusData.insights||[]).find(x=>x.id===b.dataset.ip16WaReply);
    const p=String(b.dataset.phone||'').replace(/\D/g,'');
    const n=p.startsWith('55')?p:`55${p}`;
    if(i?.draft_response)window.open(`https://wa.me/${n}?text=${encodeURIComponent(i.draft_response)}`,'_blank','noopener');
  });
  $$('[data-ip16-handle]',host).forEach(b=>b.onclick=()=>handleInsight(b.dataset.ip16Handle));
}

async function analyzeMessage(messageId){
  try{
    toast('Analisando resposta…');
    await invoke('analyze_message',{messageId});
    await refreshAll(false);
    toast('Resposta analisada.');
  }catch(e){toast(e.message||'Não foi possível analisar.')}
}

async function handleInsight(id){
  try{
    await invoke('handle_insight',{id,status:'handled'});
    await refreshAll(false);
    toast('Resposta marcada como resolvida.');
  }catch(e){toast(e.message||'Não foi possível concluir.')}
}

function renderQueue(){
  $('#ip16Due').textContent=num(statusData.due);
  $('#ip16Upcoming').textContent=num(statusData.upcoming);
  const host=$('#ip16QueueList');
  if(!host)return;
  const list=statusData.followups||[];
  host.innerHTML=list.length?list.map(f=>{
    const c=Array.isArray(f.clients)?f.clients[0]:f.clients;
    const due=new Date(f.scheduled_for)<=new Date();
    return `
      <div class="ip16-row">
        <div class="ip16-row-top">
          <div>
            <div class="ip16-row-title"><b>${safe(c?.name||'Cliente')}</b><span class="ip16-badge">${safe(f.kind)}</span></div>
            <div class="ip16-meta">${due?'🔴 Agora/atrasado':'🕒 '+fmt(f.scheduled_for)}${f.ai_generated?' • ✨ IA':''}</div>
          </div>
        </div>
        <div class="ip16-meta" style="margin-top:7px">${safe(f.message||'')}</div>
        <div class="ip16-actions">
          ${c?.whatsapp?`<button class="ip16-btn dark" data-ip16-qwa="${safe(f.id)}" data-phone="${safe(c.whatsapp)}">WhatsApp</button>`:''}
          <button class="ip16-btn good" data-ip16-qdone="${safe(f.id)}">Concluir</button>
          <button class="ip16-btn ghost" data-ip16-qcancel="${safe(f.id)}">Cancelar</button>
        </div>
      </div>
    `;
  }).join(''):'<div class="ip16-empty">Nenhum follow-up ativo.</div>';

  $$('[data-ip16-qwa]',host).forEach(b=>b.onclick=()=>{
    const f=list.find(x=>x.id===b.dataset.ip16Qwa);
    const p=String(b.dataset.phone||'').replace(/\D/g,'');
    const n=p.startsWith('55')?p:`55${p}`;
    if(f)window.open(`https://wa.me/${n}?text=${encodeURIComponent(f.message||'')}`,'_blank','noopener');
  });
  $$('[data-ip16-qdone]',host).forEach(b=>b.onclick=()=>updateFollowup('complete',b.dataset.ip16Qdone));
  $$('[data-ip16-qcancel]',host).forEach(b=>b.onclick=()=>updateFollowup('cancel',b.dataset.ip16Qcancel));
}

async function updateFollowup(action,id){
  try{
    await invoke(action,{id});
    await refreshAll(false);
    toast(action==='complete'?'Follow-up concluído.':'Follow-up cancelado.');
  }catch(e){toast(e.message||'Não foi possível atualizar.')}
}

function renderRules(){
  const s={...defaultSettings(),...(settings||rc15().settings||{})};
  $('#ip16Enabled').checked=!!s.enabled;
  $('#ip16AutoPrepare').checked=!!s.auto_prepare;
  $('#ip16StopReply').checked=!!s.stop_on_reply;
  $('#ip16StopPayment').checked=!!s.stop_on_payment;
  $('#ip16ReplyAnalysis').checked=s.reply_analysis_enabled!==false;
  $('#ip16ReplyDraft').checked=s.reply_auto_draft!==false;
  $('#ip16Cooldown').value=num(s.contact_cooldown_hours)||24;
  $('#ip16Capacity').value=num(s.daily_capacity)||10;
  $('#ip16MaxFollow').value=num(s.max_followups)||3;
  $('#ip16RuleStatus').textContent=s.enabled?(s.auto_prepare?'Automático':'Assistido'):'Desligado';
}

async function saveRules(){
  const client=db(),sid=studioId();
  if(!client||!sid)return;
  const btn=$('#ip16SaveRules');
  btn.disabled=true;
  try{
    const session=await freshSession();
    const current={...defaultSettings(),...(settings||rc15().settings||{})};
    const payload={
      ...current,
      studio_id:sid,
      enabled:$('#ip16Enabled').checked,
      auto_prepare:$('#ip16AutoPrepare').checked,
      stop_on_reply:$('#ip16StopReply').checked,
      stop_on_payment:$('#ip16StopPayment').checked,
      reply_analysis_enabled:$('#ip16ReplyAnalysis').checked,
      reply_auto_draft:$('#ip16ReplyDraft').checked,
      contact_cooldown_hours:Math.max(1,Math.min(168,num($('#ip16Cooldown').value)||24)),
      daily_capacity:Math.max(1,Math.min(100,num($('#ip16Capacity').value)||10)),
      max_followups:Math.max(1,Math.min(10,num($('#ip16MaxFollow').value)||3)),
      auto_send:false,
      updated_by:session.user.id,
      updated_at:new Date().toISOString()
    };
    const {data,error}=await client.from('sales_automation_settings').upsert(payload,{onConflict:'studio_id'}).select('*').single();
    if(error)throw error;
    settings=data;
    renderRules();
    toast('Regras salvas.');
  }catch(e){toast(e.message||'Não foi possível salvar as regras.')}
  finally{btn.disabled=false}
}

async function loadSettings(){
  const client=db(),sid=studioId();
  if(!client||!sid)return;
  const {data,error}=await client.from('sales_automation_settings').select('*').eq('studio_id',sid).maybeSingle();
  if(!error&&data)settings=data;
}

async function processPending(){
  const pending=(statusData.insights||[]).filter(x=>x.status==='pending').slice(0,3);
  if(!pending.length)return;
  for(const i of pending){
    try{await invoke('analyze_message',{messageId:i.message_id})}catch(e){console.warn('RC16 pending insight',e)}
  }
  if(pending.length){
    try{statusData=await invoke('status')}catch(e){console.warn('RC16 status after analysis',e)}
  }
}

async function refreshAll(manual=false){
  if(busy)return;
  busy=true;
  const btn=$('#ip16Refresh');
  const dot=$('#ip16Dot');
  if(btn){btn.disabled=true;btn.textContent='⟳ Atualizando…'}
  dot?.classList.add('busy');

  let errors=0;
  try{
    await freshSession();

    const jobs=[];
    if(window.IntornaRC13?.refresh)jobs.push(window.IntornaRC13.refresh());
    if(window.IntornaRC14?.refresh)jobs.push(window.IntornaRC14.refresh());
    if(window.IntornaRC15?.refresh)jobs.push(window.IntornaRC15.refresh());

    const results=await Promise.allSettled(jobs);
    errors+=results.filter(r=>r.status==='rejected').length;

    try{statusData=await invoke('status')}catch(e){errors++;console.error(e)}
    await loadSettings();
    await processPending();

    lastUpdated=new Date();
    render();

    if(manual){
      toast(errors?'Atualização concluída com alguns avisos.':'Dados atualizados com sucesso.');
    }
  }catch(e){
    errors++;
    console.error('RC16 refresh',e);
    toast(e.message||'Não foi possível atualizar tudo.');
  }finally{
    busy=false;
    if(btn){btn.disabled=false;btn.textContent='⟳ Atualizar tudo'}
    dot?.classList.remove('busy');
    renderLast();
  }
}

function renderLast(){
  const text=lastUpdated?`Última atualização: ${lastUpdated.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'Ainda não atualizado';
  if($('#ip16Last'))$('#ip16Last').textContent=text;
  if($('#ip16DashLast'))$('#ip16DashLast').textContent=text;
}

function updateMenu(){
  const nav=$('.nav [data-page="sales-radar"]');
  if(!nav)return;
  const label=$('.label',nav),pill=$('.pill',nav);
  if(label)label.textContent='Central de Vendas';
  if(pill)pill.textContent='RC16';
}

function install(){
  if(installed)return;
  if(!$('#sales-radar')||!window.IntornaRC13)return;
  installed=true;
  styles();
  center();
  dashboard();
  updateMenu();
  refreshAll(false);
  timer=setInterval(()=>refreshAll(false),120000);
  window.IntornaRC16={version:VERSION,refresh:()=>refreshAll(true),status:()=>statusData};
}

const boot=setInterval(()=>{
  install();
  if(installed)clearInterval(boot);
},350);

setTimeout(()=>clearInterval(boot),20000);
window.addEventListener('beforeunload',()=>{if(timer)clearInterval(timer)});

})();
