(()=>{
'use strict';

const VERSION='RC13';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[m]));
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const db=()=>window.IntornaCloud?.client||window.INTORNA_SUPABASE||window.supabaseClient||window.sb||null;
const studioId=()=>window.INTORNA_CTX?.studioId||null;

let data=null;
let currentFilter='all';
let refreshTimer=null;
let installed=false;

function toast(msg){
  if(window.toast){window.toast(msg);return}
  let el=$('#ip13Toast');
  if(!el){
    el=document.createElement('div');
    el.id='ip13Toast';
    el.className='ip13-toast';
    document.body.appendChild(el);
  }
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t=setTimeout(()=>el.classList.remove('show'),2600);
}

function temperatureLabel(t){
  return t==='hot'?'Quente':t==='warm'?'Morno':'Frio';
}

function typeLabel(t){
  return ({
    payment:'Pagamento',
    upsell:'Upsell',
    lead:'Lead',
    date:'Data importante',
    followup:'Follow-up'
  })[t]||'Oportunidade';
}

function iconFor(t){
  return ({
    payment:'💳',
    upsell:'📸',
    lead:'🔥',
    date:'🎂',
    followup:'💬'
  })[t]||'💰';
}

function messageFor(o){
  const first=String(o.clientName||'cliente').trim().split(/\s+/)[0]||'cliente';

  if(o.type==='payment'){
    return `Olá, ${first}! 😊 Passando para facilitar a conclusão do seu pedido ${o.orderLabel||''}. Vi que o pagamento ainda está pendente. Se quiser, eu te envio novamente a forma de pagamento por aqui.`;
  }

  if(o.type==='upsell'){
    return `Olá, ${first}! ✨ Separei algumas opções extras do seu ensaio que ficaram muito boas. Posso te mostrar as prévias e montar um combo especial para liberar as fotos sem marca-d'água.`;
  }

  if(o.type==='lead'){
    return `Olá, ${first}! 😊 Vi seu interesse no nosso trabalho e posso te ajudar a escolher o melhor pacote para o ensaio. Se me disser o estilo que você quer, eu já te indico a opção mais adequada.`;
  }

  if(o.type==='date'){
    return `Olá, ${first}! 🎉 Sua data especial está chegando e lembrei de você. Se quiser, posso montar uma proposta de ensaio pensada para essa ocasião e te mostrar algumas ideias.`;
  }

  if(o.type==='followup'){
    return `Olá, ${first}! 😊 Para começarmos seu ensaio, só preciso das fotos de referência. Assim que você me enviar, já conseguimos avançar com a produção.`;
  }

  return `Olá, ${first}! 😊 Posso te ajudar a avançar com seu ensaio?`;
}

async function invoke(action='radar',extra={}){
  const client=db();
  const sid=studioId();

  if(!client||!sid){
    throw new Error('Sessão do estúdio não encontrada.');
  }

  const {data:result,error}=await client.functions.invoke('sales-radar',{
    body:{action,studioId:sid,...extra}
  });

  if(error)throw error;
  if(result?.error)throw new Error(result.error);
  return result;
}

function styles(){
  if($('#ip13Styles'))return;
  const s=document.createElement('style');
  s.id='ip13Styles';
  s.textContent=`
  .ip13-dashboard-card,.ip13-marketing-card{grid-column:1/-1}
  .ip13-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}
  .ip13-head h2,.ip13-head h3{margin:0 0 5px}
  .ip13-kicker{font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#6d5bd0}
  .ip13-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:14px 0}
  .ip13-stat{border:1px solid rgba(148,163,184,.26);border-radius:14px;padding:12px;background:rgba(255,255,255,.03)}
  .ip13-stat small{display:block;opacity:.68;margin-bottom:3px}
  .ip13-stat b{font-size:21px}
  .ip13-opps{display:grid;gap:9px}
  .ip13-opp{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(130px,.7fr) auto;gap:12px;align-items:center;border:1px solid rgba(148,163,184,.24);border-radius:14px;padding:12px}
  .ip13-opp-main{display:flex;gap:10px;align-items:flex-start}
  .ip13-opp-icon{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:#f3f4f6;font-size:20px;flex:none}
  .ip13-opp-title{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
  .ip13-opp-title b{font-size:14px}
  .ip13-meta{font-size:12px;opacity:.72;line-height:1.4;margin-top:3px}
  .ip13-value{text-align:right}
  .ip13-value b{display:block;font-size:17px}
  .ip13-value small{opacity:.65}
  .ip13-score{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:900}
  .ip13-score.hot{background:#fee2e2;color:#991b1b}
  .ip13-score.warm{background:#fef3c7;color:#92400e}
  .ip13-score.cold{background:#e0f2fe;color:#075985}
  .ip13-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
  .ip13-btn{border:0;border-radius:10px;padding:9px 11px;font-weight:900;cursor:pointer;font-size:12px}
  .ip13-btn.primary{background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff}
  .ip13-btn.ghost{background:#eef2f7;color:#26364d}
  .ip13-btn.good{background:#dcfce7;color:#166534}
  .ip13-btn.warn{background:#fef3c7;color:#92400e}
  .ip13-btn:disabled{opacity:.55;cursor:not-allowed}
  .ip13-empty{padding:24px;text-align:center;border:1px dashed rgba(148,163,184,.35);border-radius:14px;opacity:.72}
  .ip13-filters{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}
  .ip13-filter{border:1px solid rgba(148,163,184,.35);background:transparent;border-radius:999px;padding:8px 11px;font-weight:800;cursor:pointer}
  .ip13-filter.active{background:#111827;color:#fff;border-color:#111827}
  .ip13-marketing-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:12px}
  .ip13-chart{height:150px;display:flex;align-items:flex-end;gap:7px;padding:18px 4px 24px;margin-top:10px;border-top:1px solid rgba(148,163,184,.22)}
  .ip13-bar{flex:1;min-width:8px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,#7c3aed,#2563eb);position:relative}
  .ip13-bar span{position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);font-size:9px;opacity:.62;white-space:nowrap}
  .ip13-bar em{display:none}
  .ip13-bar:hover em{display:block;position:absolute;left:50%;bottom:calc(100% + 6px);transform:translateX(-50%);background:#111827;color:white;border-radius:8px;padding:5px 7px;font-size:10px;white-space:nowrap;font-style:normal;z-index:4}
  .ip13-radar-page{padding-bottom:30px}
  .ip13-radar-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}
  .ip13-radar-list{display:grid;gap:10px}
  .ip13-modal-wrap{position:fixed;inset:0;background:rgba(4,8,20,.74);display:none;align-items:center;justify-content:center;padding:18px;z-index:12000}
  .ip13-modal-wrap.show{display:flex}
  .ip13-modal{width:min(620px,100%);background:#fff;color:#111827;border-radius:18px;padding:18px;box-shadow:0 24px 80px rgba(0,0,0,.35)}
  .ip13-modal h3{margin:0 0 5px}
  .ip13-modal textarea{width:100%;min-height:150px;border:1px solid #cbd5e1;border-radius:12px;padding:12px;margin-top:10px}
  .ip13-modal-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:12px}
  .ip13-toast{position:fixed;right:18px;bottom:18px;background:#111827;color:#fff;padding:12px 16px;border-radius:12px;display:none;z-index:13000}
  .ip13-toast.show{display:block}
  @media(max-width:900px){
    .ip13-summary,.ip13-marketing-grid,.ip13-radar-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    .ip13-opp{grid-template-columns:1fr}
    .ip13-value{text-align:left}
    .ip13-actions{justify-content:flex-start}
  }
  @media(max-width:560px){
    .ip13-summary,.ip13-marketing-grid,.ip13-radar-grid{grid-template-columns:1fr 1fr}
  }
  `;
  document.head.appendChild(s);
}

function modal(){
  if($('#ip13ModalWrap'))return;
  const w=document.createElement('div');
  w.id='ip13ModalWrap';
  w.className='ip13-modal-wrap';
  w.innerHTML='<div class="ip13-modal" id="ip13Modal"></div>';
  w.addEventListener('click',e=>{if(e.target===w)closeModal()});
  document.body.appendChild(w);
}

function closeModal(){
  $('#ip13ModalWrap')?.classList.remove('show');
}

function openWork(o){
  const m=$('#ip13Modal');
  const msg=messageFor(o);

  m.innerHTML=`
    <div class="ip13-kicker">PRÓXIMA AÇÃO RECOMENDADA</div>
    <h3>${safe(o.clientName)} • ${safe(o.title)}</h3>
    <div class="ip13-meta">${safe(o.reason)}</div>
    <textarea id="ip13Message">${safe(msg)}</textarea>
    <div class="ip13-modal-actions">
      <button class="ip13-btn ghost" id="ip13Close">Fechar</button>
      <button class="ip13-btn ghost" id="ip13Copy">Copiar</button>
      <button class="ip13-btn warn" id="ip13Snooze">Adiar 24h</button>
      <button class="ip13-btn good" id="ip13Done">Concluir</button>
      ${o.whatsapp?'<button class="ip13-btn primary" id="ip13Whats">Abrir WhatsApp</button>':''}
    </div>
  `;

  $('#ip13Close').onclick=closeModal;
  $('#ip13Copy').onclick=async()=>{
    await navigator.clipboard.writeText($('#ip13Message').value);
    toast('Mensagem copiada.');
  };
  $('#ip13Snooze').onclick=async()=>{
    await mark(o.key,'snoozed',24);
    closeModal();
  };
  $('#ip13Done').onclick=async()=>{
    await mark(o.key,'completed');
    closeModal();
  };

  if(o.whatsapp){
    $('#ip13Whats').onclick=()=>{
      const phone=String(o.whatsapp).replace(/\D/g,'');
      const normalized=phone.startsWith('55')?phone:`55${phone}`;
      window.open(`https://wa.me/${normalized}?text=${encodeURIComponent($('#ip13Message').value)}`,'_blank','noopener');
    };
  }

  $('#ip13ModalWrap').classList.add('show');
}

async function mark(key,status,hours){
  try{
    await invoke('mark',{key,status,hours});
    toast(status==='completed'?'Oportunidade concluída.':'Oportunidade adiada.');
    await refresh();
  }catch(e){
    toast(e.message||'Não foi possível atualizar.');
  }
}

function oppHtml(o,compact=false){
  return `
    <div class="ip13-opp">
      <div class="ip13-opp-main">
        <div class="ip13-opp-icon">${iconFor(o.type)}</div>
        <div>
          <div class="ip13-opp-title">
            <b>${safe(o.clientName)}</b>
            <span class="ip13-score ${safe(o.temperature)}">${temperatureLabel(o.temperature)} • ${o.score}</span>
            <span class="pill">${safe(typeLabel(o.type))}</span>
          </div>
          <div class="ip13-meta">
            <b>${safe(o.title)}</b>${o.orderLabel?` • ${safe(o.orderLabel)}`:''}<br>
            ${safe(o.reason)}
          </div>
        </div>
      </div>
      <div class="ip13-value">
        <small>Potencial</small>
        <b>${money(o.value)}</b>
      </div>
      <div class="ip13-actions">
        <button class="ip13-btn primary" data-work="${safe(o.key)}">Trabalhar</button>
        ${compact?'':`<button class="ip13-btn warn" data-snooze="${safe(o.key)}">24h</button><button class="ip13-btn good" data-done="${safe(o.key)}">Concluir</button>`}
      </div>
    </div>
  `;
}

function bindOppActions(root=document){
  $$('[data-work]',root).forEach(b=>{
    b.onclick=()=>{
      const o=data?.opportunities?.find(x=>x.key===b.dataset.work);
      if(o)openWork(o);
    };
  });

  $$('[data-snooze]',root).forEach(b=>{
    b.onclick=()=>mark(b.dataset.snooze,'snoozed',24);
  });

  $$('[data-done]',root).forEach(b=>{
    b.onclick=()=>mark(b.dataset.done,'completed');
  });
}

function dashboardShell(){
  const grid=$('#dashboard .grid');
  if(!grid||$('#ip13SalesDash'))return;

  const card=document.createElement('div');
  card.id='ip13SalesDash';
  card.className='card ip13-dashboard-card';
  card.innerHTML=`
    <div class="ip13-head">
      <div>
        <div class="ip13-kicker">INTORNÁ PIXELS • ${VERSION}</div>
        <h2>💰 Oportunidades de venda hoje</h2>
        <div class="muted">O sistema procura dinheiro parado na sua base e indica a próxima ação.</div>
      </div>
      <div class="row">
        <button class="ip13-btn ghost" id="ip13RefreshDash">Atualizar</button>
        <button class="ip13-btn primary" id="ip13OpenRadar">Trabalhar oportunidades</button>
      </div>
    </div>
    <div class="ip13-summary">
      <div class="ip13-stat"><small>Potencial</small><b id="ip13Potential">R$ 0</b></div>
      <div class="ip13-stat"><small>🔥 Quentes</small><b id="ip13Hot">0</b></div>
      <div class="ip13-stat"><small>💬 Follow-ups</small><b id="ip13Follow">0</b></div>
      <div class="ip13-stat"><small>💳 Pagamentos</small><b id="ip13Payments">0</b></div>
      <div class="ip13-stat"><small>📸 Upsells</small><b id="ip13Upsells">0</b></div>
    </div>
    <div class="ip13-opps" id="ip13TopOpps">
      <div class="ip13-empty">Carregando oportunidades…</div>
    </div>
  `;

  const quarters=grid.querySelectorAll('.quarter');
  if(quarters.length>=4)quarters[3].after(card);
  else grid.prepend(card);

  const marketing=document.createElement('div');
  marketing.id='ip13MarketingDash';
  marketing.className='card ip13-marketing-card';
  marketing.innerHTML=`
    <div class="ip13-head">
      <div>
        <div class="ip13-kicker">MARKETING • 30 DIAS</div>
        <h2>📈 Tráfego pago no Dashboard</h2>
        <div class="muted">Investimento, leads, vendas e retorno sem sair do painel principal.</div>
      </div>
      <button class="ip13-btn ghost" id="ip13GoMarketing">Ver Marketing completo</button>
    </div>
    <div class="ip13-marketing-grid">
      <div class="ip13-stat"><small>Investimento</small><b id="ip13MSpend">R$ 0</b></div>
      <div class="ip13-stat"><small>Leads</small><b id="ip13MLeads">0</b></div>
      <div class="ip13-stat"><small>Vendas</small><b id="ip13MSales">0</b></div>
      <div class="ip13-stat"><small>Receita atribuída</small><b id="ip13MRevenue">R$ 0</b></div>
      <div class="ip13-stat"><small>ROAS</small><b id="ip13MRoas">0,00x</b></div>
    </div>
    <div class="ip13-chart" id="ip13MChart">
      <div class="ip13-empty" style="width:100%">Aguardando dados de tráfego.</div>
    </div>
  `;
  card.after(marketing);

  $('#ip13RefreshDash').onclick=refresh;
  $('#ip13OpenRadar').onclick=()=>window.goPage?.('sales-radar');
  $('#ip13GoMarketing').onclick=()=>window.goPage?.('marketing');
}

function radarPage(){
  if($('#sales-radar'))return;

  const container=$('.container');
  if(!container)return;

  const section=document.createElement('section');
  section.className='page ip13-radar-page';
  section.id='sales-radar';
  section.innerHTML=`
    <div class="card">
      <div class="ip13-head">
        <div>
          <div class="ip13-kicker">INTORNÁ PIXELS • ${VERSION}</div>
          <h2>Radar de Oportunidades</h2>
          <div class="muted">Prioridade comercial automática para saber quem abordar, por quê e quanto pode valer.</div>
        </div>
        <button class="ip13-btn ghost" id="ip13RadarRefresh">Atualizar radar</button>
      </div>

      <div class="ip13-radar-grid">
        <div class="ip13-stat"><small>Potencial total</small><b id="ip13RValue">R$ 0</b></div>
        <div class="ip13-stat"><small>Oportunidades</small><b id="ip13RCount">0</b></div>
        <div class="ip13-stat"><small>Quentes</small><b id="ip13RHot">0</b></div>
        <div class="ip13-stat"><small>Ticket médio</small><b id="ip13RTicket">R$ 0</b></div>
      </div>

      <div class="ip13-filters">
        <button class="ip13-filter active" data-ip13-filter="all">Todas</button>
        <button class="ip13-filter" data-ip13-filter="hot">🔥 Quentes</button>
        <button class="ip13-filter" data-ip13-filter="payment">💳 Pagamentos</button>
        <button class="ip13-filter" data-ip13-filter="lead">💬 Leads e follow-ups</button>
        <button class="ip13-filter" data-ip13-filter="upsell">📸 Upsells</button>
        <button class="ip13-filter" data-ip13-filter="date">🎂 Datas</button>
      </div>

      <div class="ip13-radar-list" id="ip13RadarList">
        <div class="ip13-empty">Carregando radar…</div>
      </div>
    </div>
  `;

  container.appendChild(section);

  const nav=$('.nav');
  if(nav&&!$('.nav [data-page="sales-radar"]')){
    const b=document.createElement('button');
    b.type='button';
    b.dataset.page='sales-radar';
    b.innerHTML='<span class="ico">💰</span><span class="label">Radar de Vendas</span><span class="pill">RC13</span>';
    const config=$('.nav [data-page="config"]');
    if(config)nav.insertBefore(b,config);
    else nav.appendChild(b);
    b.addEventListener('click',()=>window.goPage?.('sales-radar'));
  }

  $('#ip13RadarRefresh').onclick=refresh;

  $$('[data-ip13-filter]').forEach(b=>{
    b.onclick=()=>{
      currentFilter=b.dataset.ip13Filter;
      $$('[data-ip13-filter]').forEach(x=>x.classList.toggle('active',x===b));
      renderRadar();
    };
  });
}

function renderMarketing(){
  const m=data?.marketing||{};
  $('#ip13MSpend').textContent=money(m.spend);
  $('#ip13MLeads').textContent=num(m.leads);
  $('#ip13MSales').textContent=num(m.conversions);
  $('#ip13MRevenue').textContent=money(m.revenue);
  $('#ip13MRoas').textContent=`${num(m.roas).toFixed(2)}x`;

  const chart=$('#ip13MChart');
  const days=Array.isArray(m.days)?m.days:[];
  if(!days.length){
    chart.innerHTML='<div class="ip13-empty" style="width:100%">Aguardando conexão e dados reais de tráfego pago.</div>';
    return;
  }

  const max=Math.max(1,...days.map(d=>Math.max(num(d.revenue),num(d.spend))));
  chart.innerHTML=days.map(d=>{
    const h=Math.max(4,num(d.revenue)/max*100);
    return `<div class="ip13-bar" style="height:${h}%"><em>${safe(d.date)} • Receita ${money(d.revenue)} • Invest. ${money(d.spend)}</em><span>${safe(String(d.date).slice(5))}</span></div>`;
  }).join('');
}

function renderDashboard(){
  const t=data?.totals||{};
  $('#ip13Potential').textContent=money(t.value);
  $('#ip13Hot').textContent=num(t.hot);
  $('#ip13Follow').textContent=num(t.followups);
  $('#ip13Payments').textContent=num(t.payments);
  $('#ip13Upsells').textContent=num(t.upsells);

  const list=$('#ip13TopOpps');
  const items=(data?.opportunities||[]).slice(0,4);
  list.innerHTML=items.length
    ?items.map(o=>oppHtml(o,true)).join('')
    :'<div class="ip13-empty">Nenhuma oportunidade urgente encontrada agora. 🎉</div>';

  bindOppActions(list);
  renderMarketing();
}

function filteredOpps(){
  const all=data?.opportunities||[];

  if(currentFilter==='all')return all;
  if(currentFilter==='hot')return all.filter(o=>o.temperature==='hot');
  if(currentFilter==='lead')return all.filter(o=>o.type==='lead'||o.type==='followup');
  return all.filter(o=>o.type===currentFilter);
}

function renderRadar(){
  const t=data?.totals||{};
  $('#ip13RValue').textContent=money(t.value);
  $('#ip13RCount').textContent=num(t.count);
  $('#ip13RHot').textContent=num(t.hot);
  $('#ip13RTicket').textContent=money(data?.avgTicket||0);

  const items=filteredOpps();
  const list=$('#ip13RadarList');

  list.innerHTML=items.length
    ?items.map(o=>oppHtml(o,false)).join('')
    :'<div class="ip13-empty">Nenhuma oportunidade neste filtro.</div>';

  bindOppActions(list);
}

async function refresh(){
  const dash=$('#ip13TopOpps');
  const radar=$('#ip13RadarList');

  if(!data){
    if(dash)dash.innerHTML='<div class="ip13-empty">Analisando clientes, pedidos e pagamentos…</div>';
    if(radar)radar.innerHTML='<div class="ip13-empty">Analisando sua base comercial…</div>';
  }

  try{
    data=await invoke('radar');
    renderDashboard();
    renderRadar();
    window.IntornaRC13Data=data;
  }catch(e){
    const msg=safe(e.message||'Não foi possível carregar o Radar.');
    if(dash)dash.innerHTML=`<div class="ip13-empty">${msg}</div>`;
    if(radar)radar.innerHTML=`<div class="ip13-empty">${msg}</div>`;
    console.error('RC13 sales radar',e);
  }
}

function install(){
  if(installed)return;
  if(!$('#dashboard')||!$('.container'))return;

  installed=true;
  styles();
  modal();
  dashboardShell();
  radarPage();
  refresh();

  refreshTimer=setInterval(refresh,60000);

  window.IntornaRC13={
    version:VERSION,
    refresh,
    data:()=>data
  };
}

const timer=setInterval(()=>{
  install();
  if(installed)clearInterval(timer);
},250);

setTimeout(()=>clearInterval(timer),15000);

window.addEventListener('beforeunload',()=>{
  if(refreshTimer)clearInterval(refreshTimer);
});

})();
