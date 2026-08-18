(function(){
  'use strict';
  const FLOW=['Aguardando fotos','Pagamento pendente','Em produção','Em revisão','Pronto para entrega','Entregue'];
  const META={
    'Aguardando fotos':{icon:'📥',tone:'blue',hint:'Receber referências'},
    'Pagamento pendente':{icon:'💳',tone:'amber',hint:'Confirmar pagamento'},
    'Em produção':{icon:'✨',tone:'purple',hint:'Criar o ensaio'},
    'Em revisão':{icon:'🔎',tone:'cyan',hint:'Revisar qualidade'},
    'Pronto para entrega':{icon:'🎁',tone:'green',hint:'Liberar galeria'},
    'Entregue':{icon:'✓',tone:'slate',hint:'Pós-venda'}
  };
  const $=id=>document.getElementById(id);
  const h=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  let query='',payment='all',deadline='all',draggingId='';

  function inject(){
    if($('producao'))return;
    const nav=document.querySelector('.nav');
    const before=nav?.querySelector('[data-page="director"]');
    if(nav){
      const button=document.createElement('button');
      button.dataset.page='producao';
      button.innerHTML='<span class="ico">▦</span><span class="label">Produção</span><span class="v8-nav-count" id="v8NavCount">0</span>';
      button.onclick=()=>{render();goPage('producao')};
      nav.insertBefore(button,before);
    }
    const container=document.querySelector('.container');
    if(!container)return;
    container.insertAdjacentHTML('beforeend',page());
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='styles-v8.css';
    document.head.appendChild(link);
    bind();
    const previousSave=save;
    save=function(){previousSave();render()};
    render();
  }

  function page(){return `
    <section class="page" id="producao">
      <div class="v8-production-head">
        <div>
          <span class="v8-eyebrow">CENTRAL DE PRODUÇÃO</span>
          <h2>Todos os ensaios, do pedido à entrega.</h2>
          <p>Acompanhe prazos, pagamentos e o próximo passo de cada cliente em uma única tela.</p>
        </div>
        <button class="btn gold" id="v8NewOrder">+ Novo pedido</button>
      </div>

      <div class="v8-kpis">
        <div class="v8-kpi"><span class="v8-kpi-icon urgent">!</span><div><small>Atrasados</small><b id="v8Late">0</b></div></div>
        <div class="v8-kpi"><span class="v8-kpi-icon today">◷</span><div><small>Vencem hoje</small><b id="v8Today">0</b></div></div>
        <div class="v8-kpi"><span class="v8-kpi-icon working">✨</span><div><small>Em produção</small><b id="v8Working">0</b></div></div>
        <div class="v8-kpi"><span class="v8-kpi-icon money">R$</span><div><small>A receber</small><b id="v8OpenValue">R$ 0</b></div></div>
      </div>

      <div class="v8-toolbar">
        <label class="v8-search"><span>⌕</span><input id="v8Search" placeholder="Buscar cliente, ensaio ou pacote"></label>
        <select id="v8Payment" aria-label="Filtrar por pagamento">
          <option value="all">Todos os pagamentos</option><option value="Pendente">Pendente</option><option value="Parcial">Parcial</option><option value="Pago">Pago</option>
        </select>
        <select id="v8Deadline" aria-label="Filtrar por prazo">
          <option value="all">Todos os prazos</option><option value="late">Atrasados</option><option value="today">Vencem hoje</option><option value="week">Próximos 7 dias</option><option value="none">Sem prazo</option>
        </select>
        <button class="btn ghost" id="v8Clear">Limpar filtros</button>
      </div>

      <div class="v8-board" id="v8Board"></div>
      <div class="v8-mobile-help">No celular, use as setas de cada cartão para avançar ou voltar a etapa.</div>
    </section>`}

  function bind(){
    $('v8NewOrder').onclick=()=>goPage('pedidos');
    $('v8Search').oninput=e=>{query=e.target.value.toLowerCase().trim();renderBoard()};
    $('v8Payment').onchange=e=>{payment=e.target.value;renderBoard()};
    $('v8Deadline').onchange=e=>{deadline=e.target.value;renderBoard()};
    $('v8Clear').onclick=()=>{query='';payment='all';deadline='all';$('v8Search').value='';$('v8Payment').value='all';$('v8Deadline').value='all';renderBoard()};
  }

  function dateOnly(date){return new Date(date.getFullYear(),date.getMonth(),date.getDate())}
  function deadlineState(order){
    if(!order.deadline)return 'none';
    const d=new Date(order.deadline);if(Number.isNaN(d.getTime()))return 'none';
    const now=dateOnly(new Date()),target=dateOnly(d),days=Math.round((target-now)/86400000);
    if(order.status!=='Entregue'&&days<0)return 'late';
    if(days===0)return 'today';
    if(days>0&&days<=7)return 'week';
    return 'future';
  }
  function deadlineLabel(order){
    const state=deadlineState(order);
    if(state==='none')return {text:'Sem prazo',cls:'none'};
    if(state==='late'){const days=Math.max(1,Math.ceil((dateOnly(new Date())-dateOnly(new Date(order.deadline)))/86400000));return {text:`${days}d atrasado`,cls:'late'}}
    if(state==='today')return {text:'Vence hoje',cls:'today'};
    return {text:new Date(order.deadline).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.',''),cls:'normal'};
  }
  function filtered(){return state.orders.filter(o=>{
    const c=getClient(o.clientId),p=getPackage(o.packageId),hay=`${c?.name||''} ${o.type||''} ${p.name||''}`.toLowerCase();
    return (!query||hay.includes(query))&&(payment==='all'||o.payment===payment)&&(deadline==='all'||deadlineState(o)===deadline);
  })}
  function render(){
    if(!$('producao'))return;
    const open=state.orders.filter(o=>o.status!=='Entregue');
    $('v8NavCount').textContent=open.length;
    $('v8NavCount').style.display=open.length?'inline-grid':'none';
    $('v8Late').textContent=open.filter(o=>deadlineState(o)==='late').length;
    $('v8Today').textContent=open.filter(o=>deadlineState(o)==='today').length;
    $('v8Working').textContent=open.filter(o=>['Em produção','Em revisão'].includes(o.status)).length;
    $('v8OpenValue').textContent=money(state.orders.filter(o=>o.payment!=='Pago').reduce((n,o)=>n+Number(o.total||0),0));
    renderBoard();
  }
  function renderBoard(){
    const board=$('v8Board');if(!board)return;
    const rows=filtered();
    board.innerHTML=FLOW.map(status=>{
      const items=rows.filter(o=>o.status===status).sort((a,b)=>{
        const ad=a.deadline?new Date(a.deadline).getTime():Infinity,bd=b.deadline?new Date(b.deadline).getTime():Infinity;return ad-bd;
      });
      const meta=META[status];
      return `<div class="v8-column tone-${meta.tone}" data-status="${h(status)}">
        <div class="v8-column-head"><span class="v8-stage-icon">${meta.icon}</span><div><b>${h(status)}</b><small>${meta.hint}</small></div><span class="v8-count">${items.length}</span></div>
        <div class="v8-dropzone">${items.length?items.map(card).join(''):`<div class="v8-empty-stage">Nenhum pedido nesta etapa</div>`}</div>
      </div>`
    }).join('');
    board.querySelectorAll('.v8-order-card').forEach(el=>{
      el.addEventListener('dragstart',()=>{draggingId=el.dataset.id;el.classList.add('dragging')});
      el.addEventListener('dragend',()=>{draggingId='';el.classList.remove('dragging');board.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'))});
    });
    board.querySelectorAll('.v8-column').forEach(col=>{
      col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drag-over')});
      col.addEventListener('dragleave',()=>col.classList.remove('drag-over'));
      col.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('drag-over');if(draggingId)move(draggingId,col.dataset.status)});
    });
  }
  function card(o){
    const c=getClient(o.clientId),p=getPackage(o.packageId),d=deadlineLabel(o),idx=FLOW.indexOf(o.status),paid=o.payment==='Pago';
    return `<article class="v8-order-card" draggable="true" data-id="${o.id}">
      <div class="v8-card-top"><span class="v8-avatar">${h((c?.name||'?').trim()[0]?.toUpperCase()||'?')}</span><div class="v8-card-person"><b>${h(c?.name||'Cliente removido')}</b><small>${h(o.type||'Ensaio')} • ${h(p.name)}</small></div><button class="v8-more" aria-label="Abrir pedido" onclick="IntornaV8.open('${o.id}','orders')">•••</button></div>
      <div class="v8-card-tags"><span class="v8-deadline ${d.cls}">◷ ${d.text}</span><span class="v8-payment ${paid?'paid':o.payment==='Parcial'?'partial':'pending'}">${paid?'✓ ':''}${h(o.payment)}</span></div>
      <div class="v8-card-value"><span>${p.photos} fotos • ${h(o.format||'4:5')}</span><b>${money(o.total)}</b></div>
      <div class="v8-card-actions">
        <button title="Voltar etapa" ${idx<=0?'disabled':''} onclick="IntornaV8.step('${o.id}',-1)">←</button>
        <button title="WhatsApp" onclick="IntornaV8.open('${o.id}','whatsapp')">💬</button>
        <button title="Abrir ferramenta da etapa" onclick="IntornaV8.smart('${o.id}')">Abrir</button>
        <button title="Avançar etapa" ${idx>=FLOW.length-1?'disabled':''} onclick="IntornaV8.step('${o.id}',1)">→</button>
      </div>
    </article>`
  }
  function move(id,status){const o=getOrder(id);if(!o||!FLOW.includes(status)||o.status===status)return;o.status=status;save();toast(`Pedido movido para ${status}.`)}
  function step(id,direction){const o=getOrder(id);if(!o)return;const next=Math.max(0,Math.min(FLOW.length-1,FLOW.indexOf(o.status)+direction));move(id,FLOW[next])}
  function open(id,where){
    const o=getOrder(id);if(!o)return;
    if(where==='orders'){goPage('pedidos');setTimeout(()=>document.querySelector(`#pedidos tr button[onclick*="${id}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),80);return}
    if(where==='whatsapp'){
      const c=getClient(o.clientId);if(!c?.whatsapp)return toast('Este cliente ainda não tem WhatsApp cadastrado.');
      const first=(c.name||'cliente').split(' ')[0],msg=`Olá, ${first}! Passando para atualizar seu ensaio: ele está na etapa “${o.status}”. Qualquer dúvida, estou à disposição.`;
      window.open(`https://wa.me/55${String(c.whatsapp).replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`,'_blank','noopener');
    }
  }
  function smart(id){
    const o=getOrder(id);if(!o)return;
    if(o.status==='Aguardando fotos'){open(id,'whatsapp');return}
    if(o.status==='Pagamento pendente'){open(id,'whatsapp');return}
    if(o.status==='Em produção'){$('gPedido').value=id;$('gPedido').dispatchEvent(new Event('change'));goPage('director');return}
    if(o.status==='Em revisão'){$('qPedido').value=id;$('qPedido').dispatchEvent(new Event('change'));goPage('qualidade');return}
    if(o.status==='Pronto para entrega'&&$('galOrder')){$('galOrder').value=id;$('galOrder').dispatchEvent(new Event('change'));goPage('galeria');return}
    if(o.status==='Entregue'){open(id,'whatsapp');return}
    goPage('pedidos');
  }
  window.IntornaV8={move,step,open,smart,render};
  inject();
})();
