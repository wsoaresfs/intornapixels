(()=>{
'use strict';
if(window.__INTORNA_ADMIN_BETA__)return;
const $=(s,r=document)=>r.querySelector(s),safe=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmt=v=>v?new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';
function styles(){const s=document.createElement('style');s.textContent='.ip24-admin-hero{background:linear-gradient(135deg,#111827,#4c1d95)!important;color:#fff}.ip24-admin-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}.ip24-admin-kpi{padding:14px;border:1px solid #e2e8f0;border-radius:13px;background:#fff}.ip24-admin-kpi b{display:block;font-size:28px}.ip24-admin-table{width:100%;border-collapse:collapse}.ip24-admin-table th,.ip24-admin-table td{text-align:left;padding:10px;border-bottom:1px solid #e2e8f0;font-size:12px}.ip24-status{display:inline-flex;padding:5px 8px;border-radius:999px;background:#dcfce7;color:#166534;font-size:10px;font-weight:900}@media(max-width:750px){.ip24-admin-kpis{grid-template-columns:1fr 1fr}}';document.head.appendChild(s)}
async function load(){
 const db=window.IntornaCloud?.client;if(!db)return;
 const [participants,campaigns,tickets]=await Promise.all([
  db.from('beta_participants').select('*').order('joined_at',{ascending:true}),
  db.from('creative_campaigns').select('id,studio_id,status,latest_version,created_at'),
  db.from('support_tickets').select('id,studio_id,status,subject,created_at').ilike('subject','%beta%')
 ]);
 for(const result of [participants,campaigns,tickets])if(result.error)throw result.error;
 const rows=participants.data||[],creative=campaigns.data||[],feedback=tickets.data||[],active=rows.filter(x=>x.status==='active').length;
 $('#ip24AdminKpis').innerHTML=`<div class="ip24-admin-kpi"><small>Vagas ocupadas</small><b>${rows.length}/3</b></div><div class="ip24-admin-kpi"><small>Ativaram estúdio</small><b>${active}</b></div><div class="ip24-admin-kpi"><small>Criativos salvos</small><b>${creative.length}</b></div><div class="ip24-admin-kpi"><small>Feedbacks</small><b>${feedback.length}</b></div>`;
 $('#ip24AdminBody').innerHTML=rows.length?rows.map(p=>{const count=creative.filter(c=>c.studio_id===p.studio_id).length,versions=creative.filter(c=>c.studio_id===p.studio_id).reduce((n,c)=>n+Number(c.latest_version||0),0),open=feedback.filter(t=>t.studio_id===p.studio_id&&t.status!=='closed').length;return `<tr><td><b>${safe(p.full_name)}</b><br><small>${safe(p.email)}</small></td><td>${safe(p.studio_name)}</td><td><span class="ip24-status">${safe(p.status)}</span></td><td>${count} campanha(s) • ${versions} versão(ões)</td><td>${open}</td><td>${fmt(p.joined_at)}</td></tr>`}).join(''):'<tr><td colspan="6">Nenhum participante inscrito.</td></tr>';
}
function install(){
 if(window.__INTORNA_ADMIN_BETA__||!window.IntornaCloud?.client||!$('.nav')||!$('.main .container'))return false;
 window.__INTORNA_ADMIN_BETA__=true;styles();const nav=$('.nav'),button=document.createElement('button');button.dataset.page='beta';button.innerHTML='<span class="ico">🧪</span><span class="label">Beta</span><span class="pill" style="margin-left:auto">3</span>';nav.insertBefore(button,nav.querySelector('[data-page="subscriptions"]')||null);
 const page=document.createElement('section');page.className='page';page.id='beta';page.innerHTML='<div class="grid"><div class="card two ip24-admin-hero"><h2>Beta externo RC22.4</h2><p>Três participantes, sem cobrança, com foco no fluxo Assunto → Arte → Meta → V2.</p><button class="btn gold" id="ip24AdminRefresh">Atualizar acompanhamento</button></div><div class="card two"><h2>Acompanhamento</h2><div id="ip24AdminKpis" class="ip24-admin-kpis"></div><div class="table-wrap"><table class="ip24-admin-table"><thead><tr><th>Participante</th><th>Estúdio</th><th>Status</th><th>Criativos</th><th>Feedback aberto</th><th>Entrada</th></tr></thead><tbody id="ip24AdminBody"></tbody></table></div></div></div>';$('.main .container').appendChild(page);button.onclick=()=>{window.goPage?.('beta');load().catch(e=>window.toast?.(e.message))};$('#ip24AdminRefresh').onclick=()=>load().then(()=>window.toast?.('Beta atualizado.')).catch(e=>window.toast?.(e.message));load().catch(console.warn);return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>80)clearInterval(timer)},250);
})();
