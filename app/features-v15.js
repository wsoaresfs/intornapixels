(()=>{
'use strict';

const VERSION='RC15';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const pct=v=>`${Number(v||0).toFixed(1).replace('.',',')}%`;
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const db=()=>window.IntornaCloud?.client||window.INTORNA_SUPABASE||window.supabaseClient||window.sb||null;
const studioId=()=>window.INTORNA_CTX?.studioId||null;

let state={
  clients:[],orders:[],extras:[],payments:[],activities:[],followups:[],
  settings:null,whatsapp:null,metrics:null,loading:false
};
let installed=false;
let refreshTimer=null;
let autoPreparing=false;

function toast(msg){
  if(window.toast){window.toast(msg);return}
  let el=$('#ip15Toast');
  if(!el){
    el=document.createElement('div');
    el.id='ip15Toast';
    el.className='ip15-toast';
    document.body.appendChild(el);
  }
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t=setTimeout(()=>el.classList.remove('show'),2800);
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

async function callAssistant(action,extra={}){
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

function weights(t){
  return t==='hot'?.70:t==='warm'?.40:.15;
}

function styles(){
  if($('#ip15Styles'))return;
  const s=document.createElement('style');
  s.id='ip15Styles';
  s.textContent=`
    .ip15-shell{margin-top:14px}
    .ip15-hero{border:1px solid rgba(99,102,241,.28);background:linear-gradient(135deg,rgba(37,99,235,.08),rgba(124,58,237,.10));border-radius:16px;padding:15px}
    .ip15-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .ip15-head h3,.ip15-head h4{margin:2px 0 5px}
    .ip15-kicker{font-size:11px;font-weight:900;letter-spacing:.09em;color:#6d5bd0;text-transform:uppercase}
    .ip15-grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:12px}
    .ip15-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}
    .ip15-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
    .ip15-stat,.ip15-card{border:1px solid rgba(148,163,184,.27);border-radius:14px;background:rgba(255,255,255,.025);padding:12px}
    .ip15-stat small{display:block;opacity:.66;margin-bottom:4px}
    .ip15-stat b{font-size:20px}
    .ip15-stat em{display:block;font-size:10px;opacity:.6;font-style:normal;margin-top:3px}
    .ip15-funnel{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:10px}
    .ip15-stage{border:1px solid rgba(148,163,184,.25);border-radius:12px;padding:10px;text-align:center;position:relative}
    .ip15-stage b{font-size:21px;display:block}
    .ip15-stage small{opacity:.68}
    .ip15-stage:not(:last-child):after{content:'→';position:absolute;right:-9px;top:50%;transform:translateY(-50%);font-weight:900;opacity:.45;z-index:2}
    .ip15-action{border-left:4px solid #7c3aed;padding:11px 12px;border-radius:10px;background:rgba(124,58,237,.07);margin-top:10px}
    .ip15-action b{display:block;margin-bottom:3px}
    .ip15-btn{border:0;border-radius:10px;padding:9px 11px;font-size:12px;font-weight:900;cursor:pointer}
    .ip15-btn.primary{background:linear-gradient(135deg,#2563eb,#7c3aed);color:white}
    .ip15-btn.dark{background:#111827;color:white}
    .ip15-btn.good{background:#dcfce7;color:#166534}
    .ip15-btn.warn{background:#fef3c7;color:#92400e}
    .ip15-btn.ghost{background:#eef2f7;color:#26364d}
    .ip15-btn:disabled{opacity:.55;cursor:not-allowed}
    .ip15-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
    .ip15-recovery{display:grid;gap:7px;margin-top:9px}
    .ip15-recovery-row{display:grid;grid-template-columns:1fr auto auto;gap:9px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(148,163,184,.18)}
    .ip15-recovery-row:last-child{border-bottom:0}
    .ip15-badge{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:900;background:#ede9fe;color:#5b21b6}
    .ip15-settings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px}
    .ip15-field{display:grid;gap:5px}
    .ip15-field label{font-size:11px;font-weight:850}
    .ip15-field input[type=number],.ip15-field input[type=time],.ip15-field select{width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#111827}
    .ip15-toggle{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid rgba(148,163,184,.24);padding:9px;border-radius:10px}
    .ip15-toggle span{font-size:12px;font-weight:800}
    .ip15-history-select{width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:9px;margin-top:8px}
    .ip15-timeline{display:grid;gap:8px;margin-top:10px;max-height:330px;overflow:auto}
    .ip15-event{display:grid;grid-template-columns:10px 1fr;gap:9px}
    .ip15-dot{width:9px;height:9px;border-radius:50%;background:#7c3aed;margin-top:5px}
    .ip15-event b{font-size:12px}
    .ip15-event small{display:block;opacity:.65;margin-top:2px}
    .ip15-event p{margin:3px 0 0;font-size:11px;opacity:.78}
    .ip15-empty{padding:18px;text-align:center;border:1px dashed rgba(148,163,184,.35);border-radius:12px;opacity:.7}
    .ip15-stop{display:flex;gap:6px;align-items:center;font-size:11px;font-weight:800;color:#166534}
    .ip15-dash{margin-top:12px;border-top:1px solid rgba(148,163,184,.18);padding-top:12px}
    .ip15-toast{position:fixed;right:18px;bottom:18px;background:#111827;color:#fff;padding:12px 16px;border-radius:12px;display:none;z-index:16000}
    .ip15-toast.show{display:block}
    @media(max-width:950px){
      .ip15-grid4,.ip15-funnel{grid-template-columns:repeat(2,minmax(0,1fr))}
      .ip15-grid3{grid-template-columns:1fr}
      .ip15-grid2{grid-template-columns:1fr}
      .ip15-stage:after{display:none}
    }
    @media(max-width:560px){
      .ip15-grid4,.ip15-funnel,.ip15-settings{grid-template-columns:1fr 1fr}
      .ip15-recovery-row{grid-template-columns:1fr auto}
      .ip15-recovery-row .ip15-btn{grid-column:1/-1}
    }
  `;
  document.head.appendChild(s);
}

function radarShell(){
  const page=$('#sales-radar .card');
  if(!page||$('#ip15SalesMachine'))return;

  const host=document.createElement('div');
  host.id='ip15SalesMachine';
  host.className='ip15-shell';
  host.innerHTML=`
    <div class="ip15-hero">
      <div class="ip15-head">
        <div>
          <div class="ip15-kicker">INTORNÁ PIXELS • RC15</div>
          <h3>⚡ Máquina Automática de Vendas</h3>
          <div class="muted">O sistema identifica dinheiro parado, prepara a próxima ação e interrompe follow-ups quando o cliente responde ou paga.</div>
        </div>
        <div class="ip15-stop">● Regras automáticas no backend</div>
      </div>

      <div class="ip15-grid4">
        <div class="ip15-stat"><small>Potencial aberto</small><b id="ip15OpenValue">R$ 0</b><em>oportunidades do Radar</em></div>
        <div class="ip15-stat"><small>Previsão ponderada</small><b id="ip15Forecast">R$ 0</b><em>pela temperatura dos leads</em></div>
        <div class="ip15-stat"><small>Conversão 30 dias</small><b id="ip15Conversion">0%</b><em>lead → pagamento</em></div>
        <div class="ip15-stat"><small>Follow-ups parados</small><b id="ip15Stopped">0</b><em>por resposta/pagamento</em></div>
      </div>
    </div>

    <div class="ip15-grid2">
      <div class="ip15-card">
        <div class="ip15-head">
          <div><div class="ip15-kicker">FUNIL COMERCIAL</div><h4>Últimos 30 dias</h4></div>
          <span class="ip15-badge" id="ip15Revenue30">R$ 0</span>
        </div>
        <div class="ip15-funnel">
          <div class="ip15-stage"><b id="ip15FLeads">0</b><small>Leads</small></div>
          <div class="ip15-stage"><b id="ip15FOrders">0</b><small>Pedidos</small></div>
          <div class="ip15-stage"><b id="ip15FPaid">0</b><small>Pagos</small></div>
          <div class="ip15-stage"><b id="ip15FDelivered">0</b><small>Entregues</small></div>
        </div>
        <div class="ip15-action" id="ip15NextAction">
          <b>Próxima melhor ação</b>
          <span>Nenhuma oportunidade prioritária agora.</span>
        </div>
        <div class="ip15-actions">
          <button class="ip15-btn primary" id="ip15WorkNext">Trabalhar prioridade</button>
          <button class="ip15-btn ghost" id="ip15Refresh">Atualizar inteligência</button>
        </div>
      </div>

      <div class="ip15-card">
        <div class="ip15-head">
          <div><div class="ip15-kicker">RECUPERAÇÃO</div><h4>Dinheiro esperando conversão</h4></div>
          <span class="ip15-badge">automático</span>
        </div>
        <div class="ip15-recovery" id="ip15Recovery"></div>
        <div class="ip15-actions">
          <button class="ip15-btn primary" id="ip15PrepareNow">⚡ Preparar recuperação agora</button>
        </div>
      </div>
    </div>

    <div class="ip15-grid2">
      <div class="ip15-card">
        <div class="ip15-head">
          <div><div class="ip15-kicker">PILOTO AUTOMÁTICO</div><h4>Regras comerciais</h4></div>
          <span class="ip15-badge" id="ip15PilotStatus">Manual</span>
        </div>

        <div class="ip15-settings">
          <div class="ip15-toggle"><span>Piloto habilitado</span><input type="checkbox" id="ip15Enabled"></div>
          <div class="ip15-toggle"><span>Preparar fila automaticamente</span><input type="checkbox" id="ip15AutoPrepare"></div>
          <div class="ip15-toggle"><span>Parar quando responder</span><input type="checkbox" id="ip15StopReply"></div>
          <div class="ip15-toggle"><span>Parar quando pagar</span><input type="checkbox" id="ip15StopPayment"></div>

          <div class="ip15-field"><label>Follow-up de lead (horas)</label><input type="number" min="1" max="168" id="ip15LeadHours"></div>
          <div class="ip15-field"><label>Recuperação de pagamento (horas)</label><input type="number" min="1" max="168" id="ip15PayHours"></div>
          <div class="ip15-field"><label>Upsell após entrega (horas)</label><input type="number" min="1" max="720" id="ip15UpsellHours"></div>
          <div class="ip15-field"><label>Reativar cliente após (dias)</label><input type="number" min="7" max="3650" id="ip15ReactDays"></div>
          <div class="ip15-field"><label>Máximo de follow-ups</label><input type="number" min="1" max="10" id="ip15MaxFollow"></div>
          <div class="ip15-field"><label>Capacidade diária</label><input type="number" min="1" max="100" id="ip15Capacity"></div>
        </div>

        <div class="ip15-actions">
          <button class="ip15-btn good" id="ip15SaveSettings">Salvar regras</button>
        </div>
        <div class="muted" style="font-size:10px;margin-top:7px">O envio automático permanece bloqueado nesta RC. A preparação pode ser automática; o envio continua controlado até o WhatsApp oficial estar totalmente configurado.</div>
      </div>

      <div class="ip15-card">
        <div class="ip15-head">
          <div><div class="ip15-kicker">HISTÓRICO COMERCIAL</div><h4>Linha do tempo do cliente</h4></div>
          <span class="ip15-badge">CRM vivo</span>
        </div>
        <select class="ip15-history-select" id="ip15HistoryClient"><option value="">Todos os clientes</option></select>
        <div class="ip15-timeline" id="ip15Timeline"><div class="ip15-empty">Carregando histórico…</div></div>
      </div>
    </div>
  `;

  const filters=$('.ip13-filters',page);
  if(filters)filters.before(host);
  else page.appendChild(host);

  $('#ip15Refresh').onclick=load;
  $('#ip15SaveSettings').onclick=saveSettings;
  $('#ip15PrepareNow').onclick=()=>autoPrepare(true);
  $('#ip15WorkNext').onclick=workNext;
  $('#ip15HistoryClient').onchange=renderTimeline;
}

function dashboardShell(){
  const card=$('#ip13SalesDash');
  if(!card||$('#ip15Dash'))return;
  const d=document.createElement('div');
  d.id='ip15Dash';
  d.className='ip15-dash';
  d.innerHTML=`
    <div class="ip15-head">
      <div><div class="ip15-kicker">RC15 • INTELIGÊNCIA COMERCIAL</div><b>Próxima melhor ação</b></div>
      <button class="ip15-btn primary" id="ip15DashWork">Abrir máquina de vendas</button>
    </div>
    <div class="ip15-grid3">
      <div class="ip15-stat"><small>Previsão de receita</small><b id="ip15DashForecast">R$ 0</b></div>
      <div class="ip15-stat"><small>Conversão 30d</small><b id="ip15DashConversion">0%</b></div>
      <div class="ip15-stat"><small>Prioridade</small><b id="ip15DashPriority" style="font-size:14px">Sem prioridade</b></div>
    </div>
  `;
  card.appendChild(d);
  $('#ip15DashWork').onclick=()=>window.goPage?.('sales-radar');
}

async function getRows(promise){
  try{
    const r=await promise;
    if(r.error){console.warn('RC15 query',r.error);return []}
    return r.data||[];
  }catch(e){console.warn('RC15 query',e);return []}
}

async function load(){
  if(state.loading)return;
  state.loading=true;
  try{
    await freshSession();
    const client=db(),sid=studioId();
    if(!client||!sid)return;

    const [
      clients,orders,extras,payments,activities,followups,settingsRows,waRows
    ]=await Promise.all([
      getRows(client.from('clients').select('id,name,whatsapp,created_at,updated_at,last_contact_at,whatsapp_stage').eq('studio_id',sid).order('created_at',{ascending:false})),
      getRows(client.from('orders').select('id,client_id,package_name,order_value,status,payment_status,created_at,updated_at,extra_offer_qty').eq('studio_id',sid).order('created_at',{ascending:false})),
      getRows(client.from('extra_sales').select('id,order_id,quantity,amount,payment_status,created_at').eq('studio_id',sid).order('created_at',{ascending:false})),
      getRows(client.from('client_payments').select('id,order_id,amount,status,paid_at,created_at,updated_at').eq('studio_id',sid).order('created_at',{ascending:false})),
      getRows(client.from('sales_activities').select('id,client_id,order_id,activity_type,title,detail,amount,metadata,created_at').eq('studio_id',sid).order('created_at',{ascending:false}).limit(150)),
      getRows(client.from('sales_followups').select('id,client_id,order_id,opportunity_key,kind,status,scheduled_for,stop_reason,completed_at,created_at').eq('studio_id',sid).order('created_at',{ascending:false}).limit(200)),
      getRows(client.from('sales_automation_settings').select('*').eq('studio_id',sid).limit(1)),
      getRows(client.from('whatsapp_connections').select('status,display_phone_number,business_name').eq('studio_id',sid).limit(1))
    ]);

    state.clients=clients;state.orders=orders;state.extras=extras;state.payments=payments;
    state.activities=activities;state.followups=followups;
    state.settings=settingsRows[0]||defaults();
    state.whatsapp=waRows[0]||null;
    state.metrics=compute();
    render();
    await autoPrepare(false);
  }catch(e){
    console.error('RC15 load',e);
    toast(e.message||'Não foi possível atualizar a inteligência comercial.');
  }finally{
    state.loading=false;
  }
}

function defaults(){
  return {
    enabled:true,auto_prepare:false,stop_on_reply:true,stop_on_payment:true,
    lead_followup_hours:2,payment_recovery_hours:4,upsell_delay_hours:24,
    reactivation_days:45,max_followups:3,daily_capacity:10,auto_send:false
  };
}

function compute(){
  const now=Date.now(),since=now-30*86400000;
  const recent=(v)=>new Date(v||0).getTime()>=since;

  const leads=state.clients.filter(x=>recent(x.created_at)).length;
  const orders=state.orders.filter(x=>recent(x.created_at)).length;
  const paidOrders=state.orders.filter(x=>recent(x.created_at)&&String(x.payment_status)==='received');
  const delivered=state.orders.filter(x=>recent(x.updated_at||x.created_at)&&String(x.status)==='entregue').length;

  const orderRevenue=paidOrders.reduce((a,x)=>a+num(x.order_value),0);
  const extraRevenue=state.extras
    .filter(x=>String(x.payment_status)==='received'&&recent(x.created_at))
    .reduce((a,x)=>a+num(x.amount),0);

  const list=opps();
  const open=list.reduce((a,o)=>a+num(o.value),0);
  const forecast=list.reduce((a,o)=>a+num(o.value)*weights(o.temperature),0);
  const conversion=leads?Math.min(100,(paidOrders.length/leads)*100):0;

  const stopped=state.followups.filter(x=>
    ['customer_replied','payment_received'].includes(String(x.stop_reason||'')) &&
    recent(x.completed_at||x.created_at)
  ).length;

  const byType=(type)=>list.filter(o=>o.type===type);
  const recover={
    payment:byType('payment'),
    lead:list.filter(o=>o.type==='lead'||o.type==='followup'),
    upsell:byType('upsell'),
    date:byType('date')
  };

  return {
    leads,orders,paid:paidOrders.length,delivered,
    revenue30:orderRevenue+extraRevenue,
    open,forecast,conversion,stopped,recover,
    next:list[0]||null
  };
}

function sum(list){return (list||[]).reduce((a,o)=>a+num(o.value),0)}

function render(){
  const m=state.metrics||compute();

  $('#ip15OpenValue').textContent=money(m.open);
  $('#ip15Forecast').textContent=money(m.forecast);
  $('#ip15Conversion').textContent=pct(m.conversion);
  $('#ip15Stopped').textContent=m.stopped;
  $('#ip15Revenue30').textContent=`Receita: ${money(m.revenue30)}`;
  $('#ip15FLeads').textContent=m.leads;
  $('#ip15FOrders').textContent=m.orders;
  $('#ip15FPaid').textContent=m.paid;
  $('#ip15FDelivered').textContent=m.delivered;

  $('#ip15DashForecast').textContent=money(m.forecast);
  $('#ip15DashConversion').textContent=pct(m.conversion);
  $('#ip15DashPriority').textContent=m.next?`${m.next.clientName} • ${m.next.title}`:'Sem prioridade';

  const next=$('#ip15NextAction');
  if(m.next){
    next.innerHTML=`
      <b>${m.next.temperature==='hot'?'🔥':m.next.temperature==='warm'?'🟠':'🔵'} ${safe(m.next.clientName)} — ${safe(m.next.title)}</b>
      <span>${safe(m.next.nextAction||m.next.reason||'Fazer contato comercial.')}</span>
      <small style="display:block;margin-top:4px;opacity:.68">Potencial ${money(m.next.value)} • Score ${num(m.next.score)}</small>
    `;
    $('#ip15WorkNext').disabled=false;
  }else{
    next.innerHTML='<b>Próxima melhor ação</b><span>Nenhuma oportunidade prioritária agora.</span>';
    $('#ip15WorkNext').disabled=true;
  }

  const rows=[
    ['💳 Pagamentos',m.recover.payment,'payment'],
    ['💬 Leads / follow-ups',m.recover.lead,'lead'],
    ['📸 Upsells',m.recover.upsell,'upsell'],
    ['🎂 Datas importantes',m.recover.date,'date']
  ];
  $('#ip15Recovery').innerHTML=rows.map(([label,list,filter])=>`
    <div class="ip15-recovery-row">
      <div><b>${label}</b><div class="muted" style="font-size:10px">${list.length} oportunidade(s)</div></div>
      <b>${money(sum(list))}</b>
      <button class="ip15-btn ghost" data-ip15-filter="${filter}">Ver</button>
    </div>
  `).join('');
  $$('[data-ip15-filter]').forEach(b=>b.onclick=()=>openFilter(b.dataset.ip15Filter));

  renderSettings();
  renderClientSelect();
  renderTimeline();
}

function renderSettings(){
  const s={...defaults(),...(state.settings||{})};
  $('#ip15Enabled').checked=!!s.enabled;
  $('#ip15AutoPrepare').checked=!!s.auto_prepare;
  $('#ip15StopReply').checked=!!s.stop_on_reply;
  $('#ip15StopPayment').checked=!!s.stop_on_payment;
  $('#ip15LeadHours').value=s.lead_followup_hours;
  $('#ip15PayHours').value=s.payment_recovery_hours;
  $('#ip15UpsellHours').value=s.upsell_delay_hours;
  $('#ip15ReactDays').value=s.reactivation_days;
  $('#ip15MaxFollow').value=s.max_followups;
  $('#ip15Capacity').value=s.daily_capacity;
  $('#ip15PilotStatus').textContent=s.enabled?(s.auto_prepare?'Automático':'Assistido'):'Desligado';
}

async function saveSettings(){
  const client=db(),sid=studioId();
  if(!client||!sid)return;
  const btn=$('#ip15SaveSettings');
  btn.disabled=true;
  try{
    const session=await freshSession();
    const payload={
      studio_id:sid,
      enabled:$('#ip15Enabled').checked,
      auto_prepare:$('#ip15AutoPrepare').checked,
      stop_on_reply:$('#ip15StopReply').checked,
      stop_on_payment:$('#ip15StopPayment').checked,
      lead_followup_hours:Math.max(1,Math.min(168,num($('#ip15LeadHours').value)||2)),
      payment_recovery_hours:Math.max(1,Math.min(168,num($('#ip15PayHours').value)||4)),
      upsell_delay_hours:Math.max(1,Math.min(720,num($('#ip15UpsellHours').value)||24)),
      reactivation_days:Math.max(7,Math.min(3650,num($('#ip15ReactDays').value)||45)),
      max_followups:Math.max(1,Math.min(10,num($('#ip15MaxFollow').value)||3)),
      daily_capacity:Math.max(1,Math.min(100,num($('#ip15Capacity').value)||10)),
      auto_send:false,
      updated_by:session.user.id,
      updated_at:new Date().toISOString()
    };
    const {data,error}=await client.from('sales_automation_settings').upsert(payload,{onConflict:'studio_id'}).select('*').single();
    if(error)throw error;
    state.settings=data;
    renderSettings();
    toast('Regras da máquina de vendas salvas.');
    if(data.auto_prepare)await autoPrepare(true);
  }catch(e){
    toast(e.message||'Não foi possível salvar as regras.');
  }finally{btn.disabled=false}
}

function renderClientSelect(){
  const sel=$('#ip15HistoryClient');
  if(!sel)return;
  const cur=sel.value;
  sel.innerHTML='<option value="">Todos os clientes</option>'+state.clients
    .slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR'))
    .map(c=>`<option value="${safe(c.id)}">${safe(c.name||'Cliente')}</option>`).join('');
  if(cur&&state.clients.some(c=>c.id===cur))sel.value=cur;
}

function eventIcon(type){
  return ({
    lead_created:'👤',order_created:'🧾',payment_received:'💳',
    customer_replied:'💬',order_ready:'✅',order_delivered:'📦',
    upsell_received:'📸',followup_queued:'⏰'
  })[type]||'•';
}

function renderTimeline(){
  const host=$('#ip15Timeline');
  if(!host)return;
  const clientId=$('#ip15HistoryClient')?.value||'';
  const map=new Map(state.clients.map(c=>[c.id,c]));
  const items=state.activities
    .filter(a=>!clientId||a.client_id===clientId)
    .slice(0,40);

  host.innerHTML=items.length?items.map(a=>{
    const c=map.get(a.client_id);
    return `
      <div class="ip15-event">
        <div class="ip15-dot"></div>
        <div>
          <b>${eventIcon(a.activity_type)} ${safe(a.title)}${c?` • ${safe(c.name)}`:''}</b>
          <small>${new Date(a.created_at).toLocaleString('pt-BR')}</small>
          ${a.detail?`<p>${safe(a.detail)}</p>`:''}
          ${num(a.amount)>0?`<p><b>${money(a.amount)}</b></p>`:''}
        </div>
      </div>
    `;
  }).join(''):'<div class="ip15-empty">Ainda não há eventos comerciais neste filtro.</div>';
}

function workNext(){
  const o=state.metrics?.next;
  if(!o)return;
  const sel=$('#ip14OppSelect');
  if(sel){
    sel.value=o.key;
    sel.dispatchEvent(new Event('change',{bubbles:true}));
    sel.scrollIntoView({behavior:'smooth',block:'center'});
  }
}

function openFilter(filter){
  const btn=
    filter==='lead'
      ? $('[data-ip13-filter="lead"]')
      : $(`[data-ip13-filter="${filter}"]`);
  if(btn){
    btn.click();
    btn.scrollIntoView({behavior:'smooth',block:'center'});
  }
}

async function autoPrepare(force=false){
  if(autoPreparing)return;
  const s={...defaults(),...(state.settings||{})};
  if(!s.enabled)return;
  if(!force&&!s.auto_prepare)return;

  const sid=studioId();
  const day=new Date().toISOString().slice(0,10);
  const marker=`intorna_rc15_autoprep_${sid}_${day}`;
  if(!force&&localStorage.getItem(marker)==='1')return;

  const queuedKeys=new Set(state.followups
    .filter(f=>['queued','ready'].includes(String(f.status)))
    .map(f=>String(f.opportunity_key)));

  const candidates=opps()
    .filter(o=>o.whatsapp&&(o.temperature==='hot'||o.temperature==='warm')&&!queuedKeys.has(String(o.key)))
    .slice(0,Math.min(10,Math.max(1,num(s.daily_capacity)||10)));

  if(!candidates.length){
    if(!force)localStorage.setItem(marker,'1');
    if(force)toast('Não há novas oportunidades quentes/mornas para preparar.');
    return;
  }

  autoPreparing=true;
  const btn=$('#ip15PrepareNow');
  if(btn){btn.disabled=true;btn.textContent='Preparando…'}
  let done=0;
  try{
    for(let i=0;i<candidates.length;i++){
      const o=candidates[i];
      const suggestion=await callAssistant('suggest',{opportunity:o});
      const when=new Date(Date.now()+(10+i*30)*60000).toISOString();
      await callAssistant('queue',{
        opportunityKey:o.key,
        clientId:o.clientId||null,
        orderId:o.orderId||null,
        kind:o.type||'followup',
        message:suggestion.message,
        aiGenerated:!!suggestion.aiUsed,
        scheduledFor:when
      });
      done++;
    }
    localStorage.setItem(marker,'1');
    toast(`${done} oportunidade(s) preparadas na fila comercial.`);
    await window.IntornaRC14?.refresh?.();
    setTimeout(load,300);
  }catch(e){
    console.error('RC15 auto prepare',e);
    toast(e.message||'A recuperação foi preparada parcialmente.');
  }finally{
    autoPreparing=false;
    if(btn){btn.disabled=false;btn.textContent='⚡ Preparar recuperação agora'}
  }
}

function updateMenu(){
  const nav=$('.nav [data-page="sales-radar"]');
  if(!nav)return;
  const label=$('.label',nav);
  const pill=$('.pill',nav);
  if(label)label.textContent='Máquina de Vendas';
  if(pill)pill.textContent='RC15';
}

function install(){
  if(installed)return;
  if(!$('#sales-radar')||!window.IntornaRC13)return;
  installed=true;
  styles();
  radarShell();
  dashboardShell();
  updateMenu();
  load();

  refreshTimer=setInterval(load,120000);

  window.IntornaRC15={
    version:VERSION,
    refresh:load,
    state:()=>state,
    prepare:()=>autoPrepare(true)
  };
}

const boot=setInterval(()=>{
  install();
  if(installed)clearInterval(boot);
},350);

setTimeout(()=>clearInterval(boot),20000);
window.addEventListener('beforeunload',()=>{if(refreshTimer)clearInterval(refreshTimer)});

})();
