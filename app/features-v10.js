(function(){
  'use strict';
  const STAGES=[
    {id:'novo',label:'Novo lead',icon:'●',tone:'blue'},
    {id:'contato',label:'Em contato',icon:'💬',tone:'cyan'},
    {id:'orcamento',label:'Orçamento',icon:'▤',tone:'amber'},
    {id:'negociacao',label:'Negociação',icon:'↔',tone:'purple'},
    {id:'fechado',label:'Cliente fechado',icon:'✓',tone:'green'},
    {id:'perdido',label:'Não convertido',icon:'×',tone:'slate'}
  ];
  const SOURCES=['Orgânico','WhatsApp','Indicação','Meta Ads','Google Ads','TikTok Ads','Outro'];
  const $=id=>document.getElementById(id);
  const h=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  let search='',source='all',dragId='',pendingClient=null,pendingOrderPaid=false,editing='';

  function getMeta(id){
    state.config.crm=state.config.crm&&typeof state.config.crm==='object'?state.config.crm:{};
    return state.config.crm[id]||{stage:'novo',source:'Orgânico',campaign:'',expectedValue:0,notes:'',convertedAt:null,updatedAt:null};
  }
  function setMeta(id,updates){
    const old=getMeta(id),next={...old,...updates,updatedAt:new Date().toISOString()};
    if(next.stage==='fechado'&&!next.convertedAt)next.convertedAt=new Date().toISOString();
    state.config.crm[id]=next;
  }
  function inject(){
    if($('comercial'))return;
    state.config.crm=state.config.crm&&typeof state.config.crm==='object'?state.config.crm:{};
    state.config.orderPaymentDates=state.config.orderPaymentDates&&typeof state.config.orderPaymentDates==='object'?state.config.orderPaymentDates:{};
    injectClientFields();
    const nav=document.querySelector('.nav'),before=nav?.querySelector('[data-page="pedidos"]');
    if(nav){const b=document.createElement('button');b.dataset.page='comercial';b.innerHTML='<span class="ico">◉</span><span class="label">Comercial</span><span class="v10-nav-count" id="v10NavCount">0</span>';b.onclick=()=>{render();goPage('comercial')};nav.insertBefore(b,before)}
    document.querySelector('.container')?.insertAdjacentHTML('beforeend',page());
    const link=document.createElement('link');link.rel='stylesheet';link.href='styles-v10.css';document.head.appendChild(link);
    bind();patchPayments();
    const previousSave=save;save=function(){previousSave();render()};
    render();window.IntornaV9?.render?.();
  }
  function injectClientFields(){
    const form=$('clienteForm'),dateInput=$('cData');if(!form||!dateInput||$('cLeadSource'))return;
    (dateInput.previousElementSibling||dateInput).insertAdjacentHTML('beforebegin',`<div class="v10-client-fields"><label>Origem do lead</label><select id="cLeadSource">${SOURCES.map(x=>`<option>${x}</option>`).join('')}</select><label>Campanha</label><input id="cCampaign" placeholder="Ex.: Aniversário Agosto"><label>Etapa comercial</label><select id="cLeadStage">${STAGES.map(x=>`<option value="${x.id}">${x.label}</option>`).join('')}</select><label>Valor provável</label><input id="cExpectedValue" type="number" min="0" step="0.01" value="35.00"></div>`);
    form.addEventListener('submit',()=>{pendingClient={before:new Set(state.clients.map(c=>c.id)),source:$('cLeadSource').value,campaign:$('cCampaign').value.trim(),stage:$('cLeadStage').value,expectedValue:Number($('cExpectedValue').value||0)};setTimeout(captureNewClient,0)},true);
  }
  function captureNewClient(){if(!pendingClient)return;const client=state.clients.find(c=>!pendingClient.before.has(c.id));if(client){setMeta(client.id,pendingClient);save()}pendingClient=null}
  function patchPayments(){
    const oldToggle=window.togglePayment;
    window.togglePayment=id=>{oldToggle(id);const o=getOrder(id);if(!o)return;if(o.payment==='Pago')state.config.orderPaymentDates[id]=state.config.orderPaymentDates[id]||new Date().toISOString();else delete state.config.orderPaymentDates[id];save()};
    $('pedidoForm')?.addEventListener('submit',()=>{pendingOrderPaid=$('pPagamento').value==='Pago';const before=new Set(state.orders.map(o=>o.id));setTimeout(()=>{if(!pendingOrderPaid)return;const o=state.orders.find(x=>!before.has(x.id));if(o){state.config.orderPaymentDates[o.id]=new Date().toISOString();save()}pendingOrderPaid=false},0)},true);
  }
  function page(){return `<section class="page" id="comercial">
    <div class="v10-head"><div><span>CRM COMERCIAL</span><h2>Transforme contatos em clientes.</h2><p>Organize cada oportunidade desde a primeira conversa até o fechamento.</p></div><button class="btn gold" id="v10NewLead">+ Cadastrar lead</button></div>
    <div class="v10-kpis"><div><small>Leads ativos</small><b id="v10Active">0</b></div><div><small>Precisam de contato</small><b id="v10Contact">0</b></div><div><small>Em negociação</small><b id="v10Negotiation">0</b></div><div><small>Potencial comercial</small><b id="v10Potential">R$ 0</b></div></div>
    <div class="v10-toolbar"><label><span>⌕</span><input id="v10Search" placeholder="Buscar cliente ou campanha"></label><select id="v10Source"><option value="all">Todas as origens</option>${SOURCES.map(x=>`<option>${x}</option>`).join('')}</select><button class="btn ghost" id="v10Clear">Limpar</button></div>
    <div class="v10-board" id="v10Board"></div><p class="v10-help">Arraste os cartões no computador ou use as setas no celular.</p>
    <dialog id="v10Dialog" class="v10-dialog"><form method="dialog" class="v10-dialog-card"><div class="v10-dialog-head"><div><span>OPORTUNIDADE</span><h2 id="v10DialogName">Cliente</h2></div><button value="cancel" aria-label="Fechar">×</button></div><div class="v10-form"><div><label>Etapa</label><select id="v10EditStage">${STAGES.map(x=>`<option value="${x.id}">${x.label}</option>`).join('')}</select></div><div><label>Origem</label><select id="v10EditSource">${SOURCES.map(x=>`<option>${x}</option>`).join('')}</select></div><div><label>Campanha</label><input id="v10EditCampaign"></div><div><label>Valor provável</label><input id="v10EditValue" type="number" min="0" step="0.01"></div><div class="full"><label>Anotações comerciais</label><textarea id="v10EditNotes" rows="4"></textarea></div></div><div class="v10-dialog-actions"><button value="cancel" class="btn ghost">Cancelar</button><button type="button" class="btn primary" id="v10Save">Salvar oportunidade</button></div></form></dialog>
  </section>`}
  function bind(){$('v10NewLead').onclick=()=>goPage('clientes');$('v10Search').oninput=e=>{search=e.target.value.toLowerCase().trim();renderBoard()};$('v10Source').onchange=e=>{source=e.target.value;renderBoard()};$('v10Clear').onclick=()=>{search='';source='all';$('v10Search').value='';$('v10Source').value='all';renderBoard()};$('v10Save').onclick=saveEdit}
  function filtered(){return state.clients.filter(c=>{const m=getMeta(c.id),txt=`${c.name} ${c.whatsapp||''} ${m.campaign||''} ${m.source||''}`.toLowerCase();return(!search||txt.includes(search))&&(source==='all'||m.source===source)})}
  function render(){if(!$('comercial'))return;const metas=state.clients.map(c=>getMeta(c.id)),active=metas.filter(m=>!['fechado','perdido'].includes(m.stage));$('v10Active').textContent=active.length;$('v10Contact').textContent=metas.filter(m=>['novo','contato'].includes(m.stage)).length;$('v10Negotiation').textContent=metas.filter(m=>['orcamento','negociacao'].includes(m.stage)).length;$('v10Potential').textContent=money(active.reduce((n,m)=>n+Number(m.expectedValue||0),0));$('v10NavCount').textContent=active.length;$('v10NavCount').style.display=active.length?'inline-grid':'none';renderBoard()}
  function renderBoard(){const rows=filtered();$('v10Board').innerHTML=STAGES.map(s=>{const clients=rows.filter(c=>getMeta(c.id).stage===s.id);return `<section class="v10-column ${s.tone}" data-stage="${s.id}"><header><span>${s.icon}</span><div><b>${s.label}</b><small>${clients.length} oportunidade(s)</small></div></header><div class="v10-drop">${clients.length?clients.map(card).join(''):'<div class="v10-empty">Nenhum lead</div>'}</div></section>`}).join('');const board=$('v10Board');board.querySelectorAll('.v10-card').forEach(el=>{el.ondragstart=()=>{dragId=el.dataset.id;el.classList.add('dragging')};el.ondragend=()=>{dragId='';el.classList.remove('dragging')}});board.querySelectorAll('.v10-column').forEach(col=>{col.ondragover=e=>{e.preventDefault();col.classList.add('over')};col.ondragleave=()=>col.classList.remove('over');col.ondrop=e=>{e.preventDefault();col.classList.remove('over');if(dragId)move(dragId,col.dataset.stage)}})}
  function card(c){const m=getMeta(c.id),idx=STAGES.findIndex(x=>x.id===m.stage),orders=state.orders.filter(o=>o.clientId===c.id).length;return `<article class="v10-card" draggable="true" data-id="${c.id}"><div class="v10-card-top"><span>${h((c.name||'?')[0].toUpperCase())}</span><div><b>${h(c.name)}</b><small>${h(c.whatsapp||'Sem WhatsApp')}</small></div><button onclick="IntornaCRM.edit('${c.id}')">•••</button></div><div class="v10-tags"><em>${h(m.source||'Orgânico')}</em>${m.campaign?`<em>${h(m.campaign)}</em>`:''}</div><div class="v10-value"><span>${orders} pedido(s)</span><b>${money(m.expectedValue)}</b></div><div class="v10-actions"><button ${idx<=0?'disabled':''} onclick="IntornaCRM.step('${c.id}',-1)">←</button><button onclick="IntornaCRM.whats('${c.id}')">💬</button><button onclick="IntornaCRM.quote('${c.id}')">Orçamento</button><button ${idx>=STAGES.length-1?'disabled':''} onclick="IntornaCRM.step('${c.id}',1)">→</button></div></article>`}
  function move(id,stage){if(!STAGES.some(x=>x.id===stage))return;setMeta(id,{stage});save();toast(`Etapa atualizada: ${STAGES.find(x=>x.id===stage).label}.`)}
  function step(id,d){const m=getMeta(id),idx=STAGES.findIndex(x=>x.id===m.stage),next=Math.max(0,Math.min(STAGES.length-1,idx+d));move(id,STAGES[next].id)}
  function edit(id){const c=getClient(id);if(!c)return;editing=id;const m=getMeta(id);$('v10DialogName').textContent=c.name;$('v10EditStage').value=m.stage;$('v10EditSource').value=m.source||'Orgânico';$('v10EditCampaign').value=m.campaign||'';$('v10EditValue').value=Number(m.expectedValue||0).toFixed(2);$('v10EditNotes').value=m.notes||'';$('v10Dialog').showModal()}
  function saveEdit(){if(!editing)return;setMeta(editing,{stage:$('v10EditStage').value,source:$('v10EditSource').value,campaign:$('v10EditCampaign').value.trim(),expectedValue:Number($('v10EditValue').value||0),notes:$('v10EditNotes').value.trim()});save();$('v10Dialog').close();toast('Oportunidade atualizada.')}
  function whats(id){const c=getClient(id);if(!c?.whatsapp)return toast('Cliente sem WhatsApp cadastrado.');window.open(`https://wa.me/55${String(c.whatsapp).replace(/\D/g,'')}`,'_blank','noopener')}
  function quote(id){if(!window.IntornaQuotes)return toast('Módulo de orçamentos ainda está carregando.');window.IntornaQuotes.newFor(id)}
  window.IntornaCRM={getMeta,setMeta,move,step,edit,whats,quote,render,SOURCES,STAGES};inject();
})();
