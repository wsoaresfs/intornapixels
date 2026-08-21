(()=>{
'use strict';
const VERSION='RC20';
const ctx=window.INTORNA_CTX,db=window.IntornaCloud?.client;
if(!ctx||!db)return;
const sid=ctx.studioId,$=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const one=v=>Array.isArray(v)?(v[0]||null):(v||null);
const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmt=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})};
let state={jobs:[],orders:[],settings:{},refs:{},assets:[],currentJob:null,loading:false,generating:new Set(),realtime:'connecting'};
let channel=null,refreshTimer=null,observer=null;

function toast(m){window.toast?.(m)}
async function invoke(body){
  let r=await db.functions.invoke('production-director',{body});
  if(r.error?.context?.status===401){const x=await db.auth.refreshSession();if(!x.error)r=await db.functions.invoke('production-director',{body})}
  if(r.error){let msg=r.error.message;try{const c=r.error.context;if(c?.clone){const j=await c.clone().json();msg=j?.error||msg}}catch{}throw new Error(msg)}
  if(r.data?.error)throw new Error(String(r.data.error));return r.data||{};
}
function statusLabel(v){
 const m={draft:'Rascunho',awaiting_references:'Aguardando referências',awaiting_briefing:'Aguardando briefing',ready_to_generate:'Pronto para gerar',generating:'Gerando',ai_review:'Revisão IA',human_review:'Revisão humana',approved:'Aprovado',published:'Na galeria',delivered:'Entregue',error:'Erro',redo:'Refação',ready:'Pronto',failed:'Falhou',cancelled:'Cancelado',completed:'Concluído'};
 return m[String(v||'')]||String(v||'—');
}
function statusClass(v){v=String(v||'');return ['approved','published','completed','delivered'].includes(v)?'ok':['generating','ai_review','human_review','ready','ready_to_generate'].includes(v)?'warn':['failed','error','cancelled'].includes(v)?'bad':'info'}
function orderName(o){return one(o?.clients)?.name||one(o?.orders)?.clients?.name||'Cliente'}
function orderType(o){return o?.essay_type||one(o?.orders)?.essay_type||'Ensaio'}
function activeJobFor(orderId){return state.jobs.find(j=>j.order_id===orderId&&['queued','validating','ready','generating','ai_review','human_review','approved','published'].includes(String(j.status)))||null}

function addStyles(){
 if($('#ip20Styles'))return;
 const s=document.createElement('style');s.id='ip20Styles';s.textContent=`
 #production-center .ip20-wrap{display:flex;flex-direction:column;gap:14px;width:100%}
 .ip20-hero{background:linear-gradient(135deg,#111827,#312e81)!important;color:#fff!important;border:0!important;position:relative;overflow:hidden}
 .ip20-hero:after{content:"";position:absolute;right:-90px;top:-110px;width:260px;height:260px;border-radius:50%;background:rgba(124,58,237,.32)}
 .ip20-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;position:relative;z-index:1}
 .ip20-kicker{font-size:11px;font-weight:950;letter-spacing:.11em;color:#fbbf24;text-transform:uppercase}.ip20-sub{font-size:12px;line-height:1.55;opacity:.78}
 .ip20-actions{display:flex;gap:7px;flex-wrap:wrap}.ip20-btn{border:0;border-radius:10px;padding:9px 11px;font-size:11px;font-weight:900;cursor:pointer}.ip20-btn:disabled{opacity:.45;cursor:not-allowed}
 .ip20-btn.primary{background:#2563eb;color:white}.ip20-btn.green{background:#16a34a;color:white}.ip20-btn.gold{background:#f59e0b;color:#111827}.ip20-btn.ghost{background:#eef2f7;color:#334155}.ip20-btn.danger{background:#fee2e2;color:#991b1b}.ip20-btn.dark{background:#111827;color:white}
 .ip20-status{display:inline-flex;gap:6px;align-items:center;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:900;background:#eef2f7;color:#475569}.ip20-status.ok{background:#dcfce7;color:#166534}.ip20-status.warn{background:#fef3c7;color:#92400e}.ip20-status.bad{background:#fee2e2;color:#991b1b}.ip20-status.info{background:#dbeafe;color:#1d4ed8}
 .ip20-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.ip20-kpi{border:1px solid var(--line);border-radius:14px;padding:12px;background:var(--card,#fff)}.ip20-kpi small{display:block;color:var(--muted);font-size:10px}.ip20-kpi b{display:block;font-size:21px;margin-top:4px}
 .ip20-tabs{display:flex;gap:7px;flex-wrap:wrap;padding:6px;border:1px solid var(--line);border-radius:14px;background:rgba(148,163,184,.06)}.ip20-tab{border:0;background:transparent;border-radius:10px;padding:9px 12px;font-weight:900;font-size:12px;cursor:pointer}.ip20-tab.active{background:#fff;box-shadow:0 3px 12px rgba(15,23,42,.1)}
 .ip20-panel{display:none}.ip20-panel.active{display:block}.ip20-card{border:1px solid var(--line);border-radius:15px;padding:13px;background:var(--card,#fff)}.ip20-list{display:grid;gap:10px}
 .ip20-row{border:1px solid rgba(148,163,184,.28);border-radius:13px;padding:12px}.ip20-rowtop{display:flex;justify-content:space-between;gap:9px;align-items:flex-start;flex-wrap:wrap}.ip20-row p{font-size:11px;line-height:1.5;margin:6px 0}
 .ip20-progress{height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:8px}.ip20-progress span{display:block;height:100%;background:linear-gradient(90deg,#2563eb,#7c3aed)}
 .ip20-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ip20-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ip20-field{display:grid;gap:5px}.ip20-field label{font-size:10px;font-weight:900}.ip20-field select,.ip20-field input{padding:9px;border:1px solid #cbd5e1;border-radius:9px}
 .ip20-reviewgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.ip20-asset{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff}.ip20-asset img{width:100%;aspect-ratio:4/5;object-fit:cover;display:block;background:#eef2f7}.ip20-assetbody{padding:10px}
 .ip20-prompt{white-space:pre-wrap;max-height:170px;overflow:auto;padding:10px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;font-size:10px;line-height:1.5;margin-top:8px}
 .ip20-empty{padding:26px;text-align:center;color:var(--muted);font-size:11px}.ip20-live{animation:ip20pulse 1.8s infinite}@keyframes ip20pulse{50%{opacity:.55}}
 .ip20-order-ai{margin-left:4px}
 @media(max-width:1050px){.ip20-kpis{grid-template-columns:repeat(3,1fr)}.ip20-reviewgrid{grid-template-columns:repeat(2,1fr)}}
 @media(max-width:700px){.ip20-kpis{grid-template-columns:repeat(2,1fr)}.ip20-grid2,.ip20-form{grid-template-columns:1fr}.ip20-reviewgrid{grid-template-columns:1fr}.ip20-tabs .ip20-tab{flex:1 1 calc(50% - 7px)}}
 @media(max-width:430px){.ip20-kpis{grid-template-columns:1fr}.ip20-tabs .ip20-tab{flex:1 1 100%}}
 `;document.head.appendChild(s);
}
function pageHtml(){return `
<div class="ip20-wrap">
 <div class="card ip20-hero"><div class="ip20-head"><div><div class="ip20-kicker">INTORNÁ PIXELS • RC20 • ALMA DO PRODUTO</div><h2>✨ Motor Automático de Ensaios</h2><div class="ip20-sub">Referências → Diretor IA → geração em lotes → revisão → galeria. Tudo vinculado ao pedido e ao cliente.</div></div><div class="ip20-actions"><span id="ip20Live" class="ip20-status warn"><span>●</span> Conectando</span><button id="ip20Batch" class="ip20-btn gold">⚡ Produção em lote</button><button id="ip20Refresh" class="ip20-btn ghost">↻ Atualizar</button></div></div></div>
 <div class="ip20-kpis"><div class="ip20-kpi"><small>Aguardando referências</small><b id="ip20KRefs">0</b></div><div class="ip20-kpi"><small>Prontos para gerar</small><b id="ip20KReady">0</b></div><div class="ip20-kpi"><small>Em geração</small><b id="ip20KGenerating">0</b></div><div class="ip20-kpi"><small>Aguardando revisão</small><b id="ip20KReview">0</b></div><div class="ip20-kpi"><small>Publicados</small><b id="ip20KPublished">0</b></div></div>
 <div class="ip20-tabs"><button class="ip20-tab active" data-ip20tab="queue">🧠 Fila IA</button><button class="ip20-tab" data-ip20tab="review">✅ Revisão</button><button class="ip20-tab" data-ip20tab="settings">⚙️ Automação</button></div>
 <div class="ip20-panel active" data-ip20panel="queue"><div class="ip20-grid2"><div class="ip20-card"><div class="ip20-head"><div><h3>Pedidos</h3><div class="ip20-sub">Prepare o briefing e deixe o Diretor IA montar o prompt automaticamente.</div></div></div><div class="ip20-list" id="ip20Orders"></div></div><div class="ip20-card"><h3>Jobs de geração</h3><div class="ip20-list" id="ip20Jobs"></div></div></div></div>
 <div class="ip20-panel" data-ip20panel="review"><div class="ip20-card"><div class="ip20-head"><div><h3>Revisão humana protegida</h3><div class="ip20-sub">Nada é entregue automaticamente sem aprovação. Extras ficam retidos até receberem proteção/marca-d’água.</div></div><button id="ip20Publish" class="ip20-btn green" disabled>Publicar aprovadas</button></div><div id="ip20ReviewInfo" class="ip20-empty">Abra um job em “Revisar imagens”.</div><div class="ip20-reviewgrid" id="ip20Assets"></div></div></div>
 <div class="ip20-panel" data-ip20panel="settings"><div class="ip20-card"><h3>Regras do Motor IA</h3><div class="ip20-form"><div class="ip20-field"><label>Modo padrão</label><select id="ip20Mode"><option value="assisted">Assistido</option><option value="automatic">Automático</option><option value="batch">Lote</option></select></div><div class="ip20-field"><label>Mínimo de referências</label><input id="ip20MinRefs" type="number" min="1" max="8"></div><div class="ip20-field"><label>Provedor</label><select id="ip20Provider"><option value="auto">Automático</option><option value="openai">OpenAI</option><option value="google">Google</option><option value="google_pro">Google Pro</option></select></div><div class="ip20-field"><label>Qualidade</label><select id="ip20Quality"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></div><div class="ip20-field"><label>Tamanho</label><select id="ip20Size"><option value="1024x1536">Vertical</option><option value="1024x1024">Quadrado</option><option value="1536x1024">Horizontal</option></select></div><div class="ip20-field"><label>Pedidos por lote</label><input id="ip20BatchLimit" type="number" min="1" max="20"></div><div class="ip20-field"><label>Revisão humana obrigatória</label><select id="ip20ReviewRequired"><option value="true">Sim</option><option value="false">Não</option></select></div><div class="ip20-field"><label>Marca-d’água automática nas extras</label><select id="ip20Watermark"><option value="true">Sim</option><option value="false">Não</option></select></div></div><div class="ip20-actions" style="margin-top:12px"><button id="ip20SaveSettings" class="ip20-btn primary">Salvar automação</button></div><div class="ip20-prompt">Modo Assistido: prepara e espera sua confirmação.\\nModo Automático: ao iniciar um job, continua gerando os lotes até completar o pacote.\\nModo Lote: processa vários pedidos sequencialmente respeitando limite e cota de IA.</div></div></div>
</div>`}
function addPage(){
 const nav=$('.nav'),container=$('.container');if(!nav||!container)return false;
 if(!nav.querySelector('[data-page="production-center"]')){
  const b=document.createElement('button');b.dataset.page='production-center';b.innerHTML='<span class="ico">✨</span><span class="label">Produção IA</span><span class="pill" style="margin-left:auto">RC20</span>';
  const sales=nav.querySelector('[data-page="sales-radar"]'),director=nav.querySelector('[data-page="director"]');
  if(sales)nav.insertBefore(b,sales);else if(director)director.after(b);else nav.appendChild(b);b.onclick=()=>window.goPage?.('production-center');
 }
 if(!$('#production-center')){const p=document.createElement('section');p.id='production-center';p.className='page';p.innerHTML=pageHtml();container.appendChild(p)}
 return true;
}
function bind(){
 $$('[data-ip20tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.ip20tab));
 $('#ip20Refresh').onclick=()=>loadAll(true);$('#ip20Batch').onclick=runBatch;$('#ip20SaveSettings').onclick=saveSettings;$('#ip20Publish').onclick=publishCurrent;
}
function setTab(t){$$('[data-ip20tab]').forEach(b=>b.classList.toggle('active',b.dataset.ip20tab===t));$$('[data-ip20panel]').forEach(p=>p.classList.toggle('active',p.dataset.ip20panel===t))}
function renderKpis(){
 const os=state.orders||[],js=state.jobs||[];
 $('#ip20KRefs').textContent=os.filter(o=>o.production_status==='awaiting_references').length;
 $('#ip20KReady').textContent=js.filter(j=>j.status==='ready').length;
 $('#ip20KGenerating').textContent=js.filter(j=>j.status==='generating').length;
 $('#ip20KReview').textContent=js.filter(j=>j.status==='human_review').length;
 $('#ip20KPublished').textContent=js.filter(j=>j.status==='published').length;
}
function renderOrders(){
 const host=$('#ip20Orders');if(!host)return;const rows=(state.orders||[]).filter(o=>o.production_status!=='delivered');
 if(!rows.length){host.innerHTML='<div class="ip20-empty">Nenhum pedido aguardando produção.</div>';return}
 host.innerHTML=rows.map(o=>{
   const j=activeJobFor(o.id),refs=Number(state.refs[o.id]||0),st=j?.status||o.production_status||'draft';
   const canPrepare=!j&&!['published','delivered'].includes(o.production_status);
   return `<div class="ip20-row"><div class="ip20-rowtop"><div><span class="ip20-status ${statusClass(st)}">${safe(statusLabel(st))}</span><h3 style="margin:7px 0 2px">${safe(orderName(o))} • ${safe(orderType(o))}</h3><small>${safe(o.package_name||'Pacote')} • ${refs} referência(s) • prioridade ${Number(o.production_priority||50)}</small></div></div><div class="ip20-actions" style="margin-top:9px">${canPrepare?`<button class="ip20-btn primary" data-ip20-prepare="${o.id}">✨ Preparar ensaio</button>`:''}${j?`<button class="ip20-btn ghost" data-ip20-openjob="${j.id}">Abrir produção</button>`:''}</div></div>`;
 }).join('');
 $$('[data-ip20-prepare]',host).forEach(b=>b.onclick=()=>prepareOrder(b.dataset.ip20Prepare,b));
 $$('[data-ip20-openjob]',host).forEach(b=>b.onclick=()=>openJob(b.dataset.ip20Openjob));
}
function renderJobs(){
 const host=$('#ip20Jobs');if(!host)return;const rows=state.jobs||[];
 if(!rows.length){host.innerHTML='<div class="ip20-empty">Nenhum job criado. Prepare um pedido para começar.</div>';return}
 host.innerHTML=rows.map(j=>{
  const o=one(j.orders)||{},total=Number(j.quantity||0),done=Number(j.generated_count||0),pct=total?Math.round(done/total*100):0,busy=state.generating.has(j.id);
  return `<div class="ip20-row"><div class="ip20-rowtop"><div><span class="ip20-status ${statusClass(j.status)}">${safe(statusLabel(j.status))}</span><h3 style="margin:7px 0 2px">${safe(one(o.clients)?.name||'Cliente')} • ${safe(o.essay_type||'Ensaio')}</h3><small>${safe(j.mode)} • ${done}/${total} imagens • ${safe(j.provider)} • ${safe(j.quality)}</small></div><b>${pct}%</b></div><div class="ip20-progress"><span style="width:${pct}%"></span></div>${j.error_message?`<p style="color:#b91c1c">${safe(j.error_message)}</p>`:''}<div class="ip20-actions">${j.status==='ready'?`<button class="ip20-btn green" data-ip20-generate="${j.id}" ${busy?'disabled':''}>${busy?'Gerando…':'🚀 Gerar automaticamente'}</button>`:''}${['human_review','approved','published'].includes(j.status)?`<button class="ip20-btn primary" data-ip20-review="${j.id}">✅ Revisar imagens</button>`:''}<button class="ip20-btn ghost" data-ip20-prompt="${j.id}">Copiar prompt</button>${!['published','completed','cancelled'].includes(j.status)?`<button class="ip20-btn danger" data-ip20-cancel="${j.id}">Cancelar</button>`:''}</div></div>`;
 }).join('');
 $$('[data-ip20-generate]',host).forEach(b=>b.onclick=()=>generateLoop(b.dataset.ip20Generate,b));
 $$('[data-ip20-review]',host).forEach(b=>b.onclick=()=>openReview(b.dataset.ip20Review));
 $$('[data-ip20-prompt]',host).forEach(b=>b.onclick=()=>{const j=state.jobs.find(x=>x.id===b.dataset.ip20Prompt);navigator.clipboard.writeText(j?.prompt||'').then(()=>toast('Prompt do Diretor IA copiado.'))});
 $$('[data-ip20-cancel]',host).forEach(b=>b.onclick=()=>cancelJob(b.dataset.ip20Cancel,b));
}
async function prepareOrder(id,btn){
 btn&&(btn.disabled=true);try{const d=await invoke({action:'prepare',orderId:id,mode:state.settings.generation_mode||'assisted'});if(!d.ready){toast(`Faltando: ${(d.missing||[]).join(', ')}`)}else{toast(d.reused?'Produção já estava preparada.':'Diretor IA preparou o ensaio.');await loadAll(false);if((d.job?.mode==='automatic')&&d.job?.id)generateLoop(d.job.id)}}catch(e){toast(e.message||'Falha ao preparar ensaio.')}finally{btn&&(btn.disabled=false)}
}
async function generateLoop(jobId,btn){
 if(state.generating.has(jobId))return;state.generating.add(jobId);renderJobs();let loops=0;
 try{
  while(loops<12){loops++;const d=await invoke({action:'generate',jobId});toast(d.done?'Geração concluída.':`Geradas ${d.generated_now||0} imagem(ns). Restam ${d.remaining||0}.`);await loadAll(false);if(d.done)break;await new Promise(r=>setTimeout(r,900))}
  const j=state.jobs.find(x=>x.id===jobId);if(j?.status==='human_review'){await openReview(jobId);toast('Ensaio pronto para revisão.')}
 }catch(e){toast(e.message||'Falha durante a geração.')}finally{state.generating.delete(jobId);renderJobs()}
}
async function cancelJob(id,btn){if(!confirm('Cancelar este job de produção?'))return;btn.disabled=true;try{await invoke({action:'cancel',jobId:id});await loadAll(false);toast('Produção cancelada.')}catch(e){toast(e.message)}finally{btn.disabled=false}}
function openJob(id){const j=state.jobs.find(x=>x.id===id);if(!j)return;if(['human_review','approved','published'].includes(j.status))openReview(id);else{window.goPage?.('production-center');setTab('queue')}}
async function openReview(id){
 state.currentJob=state.jobs.find(x=>x.id===id)||null;if(!state.currentJob)return;window.goPage?.('production-center');setTab('review');await loadAssets(id);
}
async function loadAssets(jobId){
 $('#ip20Assets').innerHTML='<div class="ip20-empty">Carregando imagens…</div>';
 const {data,error}=await db.from('production_assets').select('*').eq('studio_id',sid).eq('production_job_id',jobId).order('position');if(error){toast(error.message);return}
 state.assets=[];
 for(const a of data||[]){let url='';const r=await db.storage.from('intorna-media').createSignedUrl(a.storage_path,1800);if(!r.error)url=r.data?.signedUrl||'';state.assets.push({...a,url})}
 renderReview();
}
function renderReview(){
 const j=state.currentJob,info=$('#ip20ReviewInfo'),host=$('#ip20Assets'),pub=$('#ip20Publish');if(!j){info.textContent='Abra um job em “Revisar imagens”.';host.innerHTML='';pub.disabled=true;return}
 const approved=state.assets.filter(a=>['approved','published'].includes(a.status)).length,rejected=state.assets.filter(a=>a.status==='rejected').length;
 info.innerHTML=`<div class="ip20-row"><b>${safe(one(j.orders)?.clients?.name||'Ensaio')}</b> • ${approved} aprovada(s) • ${rejected} rejeitada(s) • ${Number(j.quantity||0)} planejada(s)<div class="ip20-prompt">${safe(j.prompt||'')}</div></div>`;
 host.innerHTML=state.assets.length?state.assets.map(a=>`<div class="ip20-asset"><img src="${safe(a.url)}" alt="Imagem ${a.position+1}"><div class="ip20-assetbody"><div class="ip20-rowtop"><b>#${a.position+1}${a.is_extra?' • EXTRA':''}</b><span class="ip20-status ${statusClass(a.status)}">${safe(statusLabel(a.status))}</span></div><div class="ip20-actions" style="margin-top:8px"><button class="ip20-btn green" data-ip20-approve="${a.id}">Aprovar</button><button class="ip20-btn danger" data-ip20-reject="${a.id}">Rejeitar</button></div></div></div>`).join(''):'<div class="ip20-empty">Nenhuma imagem gerada ainda.</div>';
 $$('[data-ip20-approve]',host).forEach(b=>b.onclick=()=>reviewAsset(b.dataset.ip20Approve,'approve',b));
 $$('[data-ip20-reject]',host).forEach(b=>b.onclick=()=>reviewAsset(b.dataset.ip20Reject,'reject',b));
 pub.disabled=approved<1||j.status==='published';
}
async function reviewAsset(id,decision,btn){btn.disabled=true;try{await invoke({action:'review_asset',assetId:id,decision});await loadAll(false);state.currentJob=state.jobs.find(x=>x.id===state.currentJob?.id)||state.currentJob;await loadAssets(state.currentJob.id);toast(decision==='approve'?'Imagem aprovada.':'Imagem rejeitada.')}catch(e){toast(e.message)}finally{btn.disabled=false}}
async function publishCurrent(){const j=state.currentJob;if(!j)return;if(!confirm('Publicar as imagens aprovadas na galeria? Fotos extras permanecerão retidas até receberem marca-d’água segura.'))return;const b=$('#ip20Publish');b.disabled=true;try{const d=await invoke({action:'publish',jobId:j.id});toast(`${d.published||0} imagem(ns) enviadas para a galeria. ${d.extras_waiting_watermark||0} extra(s) aguardando proteção.`);await loadAll(false);state.currentJob=state.jobs.find(x=>x.id===j.id)||j;await loadAssets(j.id)}catch(e){toast(e.message)}finally{b.disabled=false}}
function renderSettings(){
 const s=state.settings||{};$('#ip20Mode').value=s.generation_mode||'assisted';$('#ip20MinRefs').value=s.minimum_references||1;$('#ip20Provider').value=s.default_provider||'auto';$('#ip20Quality').value=s.default_quality||'medium';$('#ip20Size').value=s.default_size||'1024x1536';$('#ip20BatchLimit').value=s.batch_limit||3;$('#ip20ReviewRequired').value=String(s.review_required!==false);$('#ip20Watermark').value=String(s.auto_watermark_extras!==false);
}
async function saveSettings(){
 const row={studio_id:sid,generation_mode:$('#ip20Mode').value,minimum_references:Math.max(1,Math.min(8,Number($('#ip20MinRefs').value)||1)),default_provider:$('#ip20Provider').value,default_quality:$('#ip20Quality').value,default_size:$('#ip20Size').value,batch_limit:Math.max(1,Math.min(20,Number($('#ip20BatchLimit').value)||3)),review_required:$('#ip20ReviewRequired').value==='true',auto_watermark_extras:$('#ip20Watermark').value==='true',updated_by:ctx.user.id,updated_at:new Date().toISOString()};
 const b=$('#ip20SaveSettings');b.disabled=true;try{const {error}=await db.from('production_settings').upsert(row,{onConflict:'studio_id'});if(error)throw error;state.settings={...state.settings,...row};toast('Automação da produção salva.')}catch(e){toast(e.message)}finally{b.disabled=false}
}
async function runBatch(){
 if(state.loading)return;const b=$('#ip20Batch');b.disabled=true;b.textContent='Processando…';
 try{
  const lim=Math.max(1,Math.min(20,Number(state.settings.batch_limit)||3));
  const candidates=(state.orders||[]).filter(o=>!activeJobFor(o.id)&&!['published','delivered'].includes(o.production_status)).slice(0,lim);
  if(!candidates.length){toast('Não há novos pedidos para preparar.');return}
  let prepared=0;
  for(const o of candidates){const d=await invoke({action:'prepare',orderId:o.id,mode:'batch'});if(d.ready&&d.job?.id){prepared++;await generateLoop(d.job.id)}}
  toast(`${prepared} pedido(s) processado(s) no lote.`);
 }catch(e){toast(e.message||'Lote interrompido.')}finally{b.disabled=false;b.textContent='⚡ Produção em lote';await loadAll(false)}
}
async function loadRefs(){
 const {data}=await db.from('client_references').select('order_id').eq('studio_id',sid);const map={};(data||[]).forEach(x=>map[x.order_id]=(map[x.order_id]||0)+1);state.refs=map;
}
async function loadAll(show=false){
 if(state.loading)return;state.loading=true;const b=$('#ip20Refresh');if(b){b.disabled=true;b.textContent='Atualizando…'}
 try{const [d]=await Promise.all([invoke({action:'status',studioId:sid}),loadRefs()]);state.jobs=d.jobs||[];state.orders=d.orders||[];state.settings=d.settings||{};renderKpis();renderOrders();renderJobs();renderSettings();augmentOrderButtons();if(show)toast('Produção IA atualizada.')}
 catch(e){console.warn('RC20 production',e);if(show)toast(e.message||'Falha ao atualizar produção.')}
 finally{state.loading=false;if(b){b.disabled=false;b.textContent='↻ Atualizar'}}
}
function augmentOrderButtons(){
 const body=$('#pedidosBody');if(!body)return;
 $$('tr',body).forEach(tr=>{
   if($('.ip20-order-ai',tr))return;
   const adv=$('button[onclick^="advanceOrder"]',tr);if(!adv)return;const m=(adv.getAttribute('onclick')||'').match(/advanceOrder\('([^']+)'\)/);if(!m)return;
   const id=m[1],cell=tr.lastElementChild;if(!cell)return;const btn=document.createElement('button');btn.className='btn gold ip20-order-ai';btn.textContent='✨ Gerar IA';btn.onclick=()=>{window.goPage?.('production-center');setTab('queue');const j=activeJobFor(id);j?openJob(j.id):prepareOrder(id)};cell.appendChild(btn);
 });
}
function watchOrders(){const body=$('#pedidosBody');if(!body)return;observer=new MutationObserver(()=>augmentOrderButtons());observer.observe(body,{childList:true,subtree:true});augmentOrderButtons()}
function addDashboardCard(){
 const grid=$('#dashboard .grid');if(!grid||$('#ip20Dash'))return;const c=document.createElement('div');c.id='ip20Dash';c.className='card one';c.style.cssText='border:1px solid rgba(124,58,237,.25);background:linear-gradient(135deg,rgba(37,99,235,.06),rgba(124,58,237,.08))';c.innerHTML='<div class="ip20-kicker">RC20 • PRODUÇÃO IA</div><h2>✨ Gerar ensaios automaticamente</h2><p class="muted">Pedidos, referências, geração e revisão em uma única fila.</p><button class="btn primary" id="ip20DashOpen">Abrir Produção IA</button>';grid.appendChild(c);$('#ip20DashOpen').onclick=()=>window.goPage?.('production-center');
}
function installRealtime(){
 if(channel)return;channel=db.channel(`ip20:${sid}:${Date.now()}`)
  .on('postgres_changes',{event:'*',schema:'public',table:'production_jobs',filter:`studio_id=eq.${sid}`},()=>loadAll(false))
  .on('postgres_changes',{event:'*',schema:'public',table:'production_assets',filter:`studio_id=eq.${sid}`},()=>{if(state.currentJob)loadAssets(state.currentJob.id)})
  .on('postgres_changes',{event:'*',schema:'public',table:'orders',filter:`studio_id=eq.${sid}`},()=>loadAll(false))
  .subscribe(st=>{state.realtime=st;const e=$('#ip20Live');if(e){const ok=st==='SUBSCRIBED';e.className=`ip20-status ${ok?'ok':'warn'} ${ok?'ip20-live':''}`;e.innerHTML=`<span>●</span> ${ok?'Tempo real ativo':'Conectando'}`}});
}
function teardown(){if(channel)db.removeChannel(channel);clearInterval(refreshTimer);observer?.disconnect()}
function install(){
 if(window.__INTORNA_RC20__)return;if(!addPage())return;window.__INTORNA_RC20__=true;addStyles();bind();addDashboardCard();watchOrders();installRealtime();loadAll(false);refreshTimer=setInterval(()=>loadAll(false),90000);window.addEventListener('beforeunload',teardown);window.IntornaRC20={version:VERSION,refresh:()=>loadAll(true),open:()=>window.goPage?.('production-center'),state:()=>state};
}
let tries=0;const boot=setInterval(()=>{tries++;if(window.INTORNA_CTX&&window.IntornaCloud?.client&&$('.nav')&&$('.container')){install();if(window.__INTORNA_RC20__)clearInterval(boot)}if(tries>100)clearInterval(boot)},250);
})();
