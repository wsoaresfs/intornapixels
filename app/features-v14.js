(()=>{
'use strict';

const VERSION='RC14';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const client=()=>window.IntornaCloud?.client||window.INTORNA_SUPABASE||window.supabaseClient||window.sb||null;
const studioId=()=>window.INTORNA_CTX?.studioId||null;

let statusData=null;
let selected=null;
let lastSuggestion=null;
let installed=false;
let timer=null;

function toast(msg){
  if(window.toast){window.toast(msg);return}
  let el=$('#ip14Toast');
  if(!el){
    el=document.createElement('div');
    el.id='ip14Toast';
    el.className='ip14-toast';
    document.body.appendChild(el);
  }
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t=setTimeout(()=>el.classList.remove('show'),2500);
}

async function freshSession(db){
  let {data,error}=await db.auth.getSession();
  if(error)throw error;
  let session=data?.session||null;
  if(!session)throw new Error('Sua sessão expirou. Entre novamente no Intorná Pixels.');

  const expiresAt=Number(session.expires_at||0)*1000;
  if(!expiresAt || expiresAt-Date.now()<120000){
    const r=await db.auth.refreshSession();
    if(r.error)throw r.error;
    session=r.data?.session||null;
    if(!session)throw new Error('Não foi possível renovar sua sessão. Entre novamente.');
  }
  return session;
}

async function invoke(action,extra={}){
  const db=client(),sid=studioId();
  if(!db||!sid)throw new Error('Sessão do estúdio não encontrada.');

  await freshSession(db);

  let call=await db.functions.invoke('sales-assistant',{
    body:{action,studioId:sid,...extra}
  });

  const is401=call.error && (
    call.error?.context?.status===401 ||
    /401|jwt|expired|unauthorized/i.test(String(call.error?.message||call.error))
  );

  if(is401){
    const r=await db.auth.refreshSession();
    if(r.error||!r.data?.session){
      throw new Error('Sua sessão expirou. Entre novamente no Intorná Pixels.');
    }
    call=await db.functions.invoke('sales-assistant',{
      body:{action,studioId:sid,...extra}
    });
  }

  if(call.error)throw call.error;
  if(call.data?.error)throw new Error(call.data.error);
  return call.data;
}

function styles(){
  if($('#ip14Styles'))return;
  const s=document.createElement('style');
  s.id='ip14Styles';
  s.textContent=`
    .ip14-wrap{margin-top:14px;display:grid;grid-template-columns:1.08fr .92fr;gap:12px}
    .ip14-card{border:1px solid rgba(148,163,184,.28);border-radius:16px;padding:15px;background:rgba(255,255,255,.025)}
    .ip14-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .ip14-head h3{margin:2px 0 5px}
    .ip14-kicker{font-size:11px;font-weight:900;letter-spacing:.08em;color:#6d5bd0}
    .ip14-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:11px 0}
    .ip14-stat{border:1px solid rgba(148,163,184,.25);border-radius:12px;padding:10px}
    .ip14-stat small{display:block;opacity:.65}
    .ip14-stat b{font-size:18px}
    .ip14-field{display:grid;gap:5px;margin-top:10px}
    .ip14-field label{font-size:12px;font-weight:850}
    .ip14-field select,.ip14-field textarea{width:100%;border:1px solid #cbd5e1;border-radius:11px;padding:10px;background:#fff;color:#111827}
    .ip14-field textarea{min-height:132px;resize:vertical}
    .ip14-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
    .ip14-btn{border:0;border-radius:10px;padding:9px 11px;font-size:12px;font-weight:900;cursor:pointer}
    .ip14-btn.primary{background:linear-gradient(135deg,#2563eb,#7c3aed);color:white}
    .ip14-btn.dark{background:#111827;color:white}
    .ip14-btn.ghost{background:#eef2f7;color:#26364d}
    .ip14-btn.good{background:#dcfce7;color:#166534}
    .ip14-btn.warn{background:#fef3c7;color:#92400e}
    .ip14-btn:disabled{opacity:.5;cursor:not-allowed}
    .ip14-ai-badge{display:inline-flex;gap:5px;align-items:center;padding:5px 8px;border-radius:999px;background:#ede9fe;color:#5b21b6;font-size:11px;font-weight:900}
    .ip14-queue{display:grid;gap:8px;margin-top:10px}
    .ip14-item{border:1px solid rgba(148,163,184,.25);border-radius:12px;padding:10px}
    .ip14-item-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
    .ip14-item small{opacity:.68}
    .ip14-message{margin-top:6px;font-size:12px;line-height:1.45;opacity:.8}
    .ip14-empty{border:1px dashed rgba(148,163,184,.35);border-radius:12px;padding:18px;text-align:center;opacity:.7}
    .ip14-banner{margin-top:12px;border-radius:14px;padding:12px 14px;background:linear-gradient(135deg,rgba(37,99,235,.09),rgba(124,58,237,.09));border:1px solid rgba(124,58,237,.18)}
    .ip14-banner b{display:block;margin-bottom:3px}
    .ip14-toast{position:fixed;right:18px;bottom:18px;background:#111827;color:#fff;padding:12px 16px;border-radius:12px;display:none;z-index:15000}
    .ip14-toast.show{display:block}
    @media(max-width:900px){.ip14-wrap{grid-template-columns:1fr}.ip14-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:560px){.ip14-grid{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(s);
}

function getOpps(){
  return window.IntornaRC13?.data?.()?.opportunities||window.IntornaRC13Data?.opportunities||[];
}

function scheduleAt(mode){
  const d=new Date();
  if(mode==='now')return d.toISOString();
  if(mode==='2h'){d.setHours(d.getHours()+2);return d.toISOString()}
  if(mode==='tomorrow'){
    d.setDate(d.getDate()+1);
    d.setHours(9,0,0,0);
    return d.toISOString();
  }
  return d.toISOString();
}

function panel(){
  const page=$('#sales-radar .card');
  if(!page||$('#ip14Autopilot'))return;

  const host=document.createElement('div');
  host.id='ip14Autopilot';
  host.innerHTML=`
    <div class="ip14-banner">
      <b>🤖 ${VERSION} — Piloto Automático de Vendas</b>
      O Radar encontra a oportunidade; o Vendedor IA prepara a abordagem; a fila organiza o follow-up para não deixar dinheiro parado.
    </div>

    <div class="ip14-wrap">
      <div class="ip14-card">
        <div class="ip14-head">
          <div>
            <div class="ip14-kicker">VENDEDOR IA</div>
            <h3>Gerar abordagem comercial</h3>
            <small class="muted">A IA usa o contexto da oportunidade sem inventar preço ou desconto.</small>
          </div>
          <span class="ip14-ai-badge" id="ip14AiBadge">✨ IA segura</span>
        </div>

        <div class="ip14-field">
          <label>Oportunidade</label>
          <select id="ip14OppSelect"><option value="">Nenhuma oportunidade disponível</option></select>
        </div>

        <div class="ip14-field">
          <label>Mensagem sugerida</label>
          <textarea id="ip14Message" placeholder="Selecione uma oportunidade e clique em Gerar com IA."></textarea>
        </div>

        <div class="ip14-actions">
          <button class="ip14-btn primary" id="ip14Generate">✨ Gerar com IA</button>
          <button class="ip14-btn ghost" id="ip14Copy">Copiar</button>
          <button class="ip14-btn dark" id="ip14Whats">Abrir WhatsApp</button>
        </div>

        <div class="ip14-actions">
          <button class="ip14-btn good" data-ip14-queue="now">Agendar agora</button>
          <button class="ip14-btn warn" data-ip14-queue="2h">Em 2 horas</button>
          <button class="ip14-btn ghost" data-ip14-queue="tomorrow">Amanhã 09h</button>
        </div>
      </div>

      <div class="ip14-card">
        <div class="ip14-head">
          <div>
            <div class="ip14-kicker">FILA COMERCIAL</div>
            <h3>Follow-ups programados</h3>
            <small class="muted">Organiza as próximas ações; nenhuma mensagem é enviada escondida.</small>
          </div>
          <button class="ip14-btn ghost" id="ip14Refresh">Atualizar</button>
        </div>

        <div class="ip14-grid">
          <div class="ip14-stat"><small>Vencidos/agora</small><b id="ip14Due">0</b></div>
          <div class="ip14-stat"><small>Próximos 7 dias</small><b id="ip14Upcoming">0</b></div>
          <div class="ip14-stat"><small>WhatsApp</small><b id="ip14Wa">—</b></div>
        </div>

        <div class="ip14-actions">
          <button class="ip14-btn primary" id="ip14BuildQueue">⚡ Preparar fila de hoje</button>
        </div>

        <div class="ip14-queue" id="ip14Queue">
          <div class="ip14-empty">Nenhum follow-up programado.</div>
        </div>
      </div>
    </div>
  `;

  const filters=$('.ip13-filters',page);
  if(filters)filters.before(host);
  else page.appendChild(host);

  $('#ip14Generate').onclick=generate;
  $('#ip14Copy').onclick=copyMessage;
  $('#ip14Whats').onclick=openWhats;
  $('#ip14Refresh').onclick=refreshStatus;
  $('#ip14BuildQueue').onclick=buildTodayQueue;
  $('#ip14OppSelect').onchange=selectOpp;
  $$('[data-ip14-queue]').forEach(b=>b.onclick=()=>queueCurrent(b.dataset.ip14Queue));
}

function populateOpps(){
  const sel=$('#ip14OppSelect');
  if(!sel)return;
  const opps=getOpps();

  const current=sel.value;
  sel.innerHTML=opps.length
    ?'<option value="">Selecione uma oportunidade</option>'+opps.map(o=>`<option value="${safe(o.key)}">${o.temperature==='hot'?'🔥':o.temperature==='warm'?'🟠':'🔵'} ${safe(o.clientName)} — ${safe(o.title)} — ${money(o.value)}</option>`).join('')
    :'<option value="">Nenhuma oportunidade disponível</option>';

  if(current&&opps.some(o=>o.key===current))sel.value=current;
}

function selectOpp(){
  const key=$('#ip14OppSelect')?.value;
  selected=getOpps().find(o=>o.key===key)||null;
  lastSuggestion=null;
  $('#ip14Message').value='';
  if(selected){
    $('#ip14Message').placeholder=`Próxima ação: ${selected.nextAction||'Fazer contato.'}`;
  }
}

async function generate(){
  if(!selected){toast('Selecione uma oportunidade.');return}
  const btn=$('#ip14Generate');
  btn.disabled=true;btn.textContent='Gerando…';
  try{
    const d=await invoke('suggest',{opportunity:selected});
    lastSuggestion=d;
    $('#ip14Message').value=d.message||'';
    $('#ip14AiBadge').textContent=d.aiUsed?'✨ Gerado com IA':'⚙️ Mensagem inteligente';
    toast('Abordagem preparada.');
  }catch(e){
    toast(e.message||'Falha ao gerar abordagem.');
  }finally{
    btn.disabled=false;btn.textContent='✨ Gerar com IA';
  }
}

async function copyMessage(){
  const text=$('#ip14Message')?.value?.trim();
  if(!text){toast('Gere uma mensagem primeiro.');return}
  await navigator.clipboard.writeText(text);
  toast('Mensagem copiada.');
}

function openWhats(){
  if(!selected){toast('Selecione uma oportunidade.');return}
  const text=$('#ip14Message')?.value?.trim();
  if(!text){toast('Gere uma mensagem primeiro.');return}
  const p=String(selected.whatsapp||'').replace(/\D/g,'');
  if(!p){toast('Cliente sem WhatsApp cadastrado.');return}
  const number=p.startsWith('55')?p:`55${p}`;
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`,'_blank','noopener');
}

async function queueCurrent(mode){
  if(!selected){toast('Selecione uma oportunidade.');return}
  let text=$('#ip14Message')?.value?.trim();
  if(!text){
    await generate();
    text=$('#ip14Message')?.value?.trim();
  }
  if(!text)return;

  try{
    await invoke('queue',{
      opportunityKey:selected.key,
      clientId:selected.clientId||null,
      orderId:selected.orderId||null,
      kind:selected.type||'followup',
      message:text,
      aiGenerated:!!lastSuggestion?.aiUsed,
      scheduledFor:scheduleAt(mode)
    });
    toast(mode==='now'?'Follow-up colocado para agora.':mode==='2h'?'Follow-up agendado para 2h.':'Follow-up agendado para amanhã.');
    await refreshStatus();
  }catch(e){
    toast(e.message||'Não foi possível agendar.');
  }
}

async function buildTodayQueue(){
  const opps=getOpps().filter(o=>o.whatsapp&&(o.temperature==='hot'||o.temperature==='warm')).slice(0,5);
  if(!opps.length){toast('Ainda não há oportunidades quentes/mornas com WhatsApp.');return}

  const btn=$('#ip14BuildQueue');
  btn.disabled=true;btn.textContent='Preparando…';
  let ok=0;
  try{
    for(let i=0;i<opps.length;i++){
      const o=opps[i];
      const sug=await invoke('suggest',{opportunity:o});
      const when=new Date(Date.now()+i*30*60000).toISOString();
      await invoke('queue',{
        opportunityKey:o.key,
        clientId:o.clientId||null,
        orderId:o.orderId||null,
        kind:o.type||'followup',
        message:sug.message,
        aiGenerated:!!sug.aiUsed,
        scheduledFor:when
      });
      ok++;
    }
    toast(`${ok} follow-up(s) preparados para hoje.`);
    await refreshStatus();
  }catch(e){
    toast(e.message||'A fila foi preparada parcialmente.');
    await refreshStatus();
  }finally{
    btn.disabled=false;btn.textContent='⚡ Preparar fila de hoje';
  }
}

function fmtDate(v){
  try{return new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return '—'}
}

function renderQueue(){
  $('#ip14Due').textContent=Number(statusData?.due||0);
  $('#ip14Upcoming').textContent=Number(statusData?.upcoming||0);
  $('#ip14Wa').textContent=statusData?.whatsapp?.status==='connected'?'Conectado':'Manual';

  const list=statusData?.followups||[];
  const host=$('#ip14Queue');
  if(!host)return;

  host.innerHTML=list.length?list.slice(0,12).map(f=>{
    const c=Array.isArray(f.clients)?f.clients[0]:f.clients;
    const due=new Date(f.scheduled_for)<=new Date();
    return `
      <div class="ip14-item">
        <div class="ip14-item-top">
          <div>
            <b>${safe(c?.name||'Cliente')}</b>
            <div><small>${due?'🔴 Agora/atrasado':'🕒 '+fmtDate(f.scheduled_for)} • ${safe(f.kind)}</small></div>
          </div>
          ${f.ai_generated?'<span class="ip14-ai-badge">✨ IA</span>':''}
        </div>
        <div class="ip14-message">${safe(f.message||'')}</div>
        <div class="ip14-actions">
          ${c?.whatsapp?`<button class="ip14-btn dark" data-ip14-open="${safe(f.id)}" data-phone="${safe(c.whatsapp)}">WhatsApp</button>`:''}
          <button class="ip14-btn good" data-ip14-complete="${safe(f.id)}">Concluir</button>
          <button class="ip14-btn ghost" data-ip14-cancel="${safe(f.id)}">Cancelar</button>
        </div>
      </div>
    `;
  }).join(''):'<div class="ip14-empty">Nenhum follow-up programado.</div>';

  $$('[data-ip14-open]',host).forEach(b=>b.onclick=()=>{
    const f=list.find(x=>x.id===b.dataset.ip14Open);
    if(!f)return;
    const p=String(b.dataset.phone||'').replace(/\D/g,'');
    const n=p.startsWith('55')?p:`55${p}`;
    window.open(`https://wa.me/${n}?text=${encodeURIComponent(f.message||'')}`,'_blank','noopener');
  });
  $$('[data-ip14-complete]',host).forEach(b=>b.onclick=()=>updateFollowup('complete',b.dataset.ip14Complete));
  $$('[data-ip14-cancel]',host).forEach(b=>b.onclick=()=>updateFollowup('cancel',b.dataset.ip14Cancel));
}

async function updateFollowup(action,id){
  try{
    await invoke(action,{id});
    toast(action==='complete'?'Follow-up concluído.':'Follow-up cancelado.');
    await refreshStatus();
  }catch(e){toast(e.message||'Não foi possível atualizar.')}
}

async function refreshStatus(){
  try{
    statusData=await invoke('status');
    renderQueue();
  }catch(e){
    statusData=null;
    const host=$('#ip14Queue');
    if(host)host.innerHTML=`<div class="ip14-empty">${safe(e.message||'Não foi possível carregar a fila.')}</div>`;
  }
}

function hookRadarRefresh(){
  const original=window.IntornaRC13?.refresh;
  if(!original||original.__ip14)return;
  const wrapped=async(...args)=>{
    const r=await original(...args);
    setTimeout(populateOpps,80);
    return r;
  };
  wrapped.__ip14=true;
  window.IntornaRC13.refresh=wrapped;
}

function install(){
  if(installed)return;
  if(!$('#sales-radar')||!window.IntornaRC13)return;
  installed=true;
  styles();
  panel();
  populateOpps();
  hookRadarRefresh();
  refreshStatus();

  timer=setInterval(()=>{
    populateOpps();
    refreshStatus();
  },60000);

  window.IntornaRC14={
    version:VERSION,
    refresh:refreshStatus,
    queue:()=>statusData,
    generate
  };
}

const boot=setInterval(()=>{
  install();
  if(installed)clearInterval(boot);
},300);

setTimeout(()=>clearInterval(boot),20000);
window.addEventListener('beforeunload',()=>{if(timer)clearInterval(timer)});

})();


/* =========================================================
   RC15 — MÁQUINA AUTOMÁTICA DE VENDAS
   ========================================================= */
(()=>{
  if(document.querySelector('script[data-intorna-v15]')) return;
  const s=document.createElement('script');
  s.src='features-v15.js';
  s.async=false;
  s.dataset.intornaV15='1';
  document.body.appendChild(s);
})();
