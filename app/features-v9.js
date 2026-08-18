(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const h=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  let period='30',channel='all',campaign='all';

  function inject(){
    if($('performance'))return;
    state.config.marketingEntries=Array.isArray(state.config.marketingEntries)?state.config.marketingEntries:[];
    const nav=document.querySelector('.nav'),before=nav?.querySelector('[data-page="financeiro"]');
    if(nav){
      const button=document.createElement('button');button.dataset.page='performance';
      button.innerHTML='<span class="ico">↗</span><span class="label">Performance</span>';
      button.onclick=()=>{render();goPage('performance')};nav.insertBefore(button,before);
    }
    document.querySelector('.container')?.insertAdjacentHTML('beforeend',page());
    const link=document.createElement('link');link.rel='stylesheet';link.href='styles-v9.css';document.head.appendChild(link);
    bind();
    const previousSave=save;save=function(){previousSave();render()};
    render();
  }

  function page(){return `
  <section class="page" id="performance">
    <div class="v9-shell">
      <div class="v9-top">
        <div><span class="v9-live"><i></i> DADOS DO ESTÚDIO</span><h2>Performance de vendas</h2><p>Entenda se seus anúncios estão trazendo clientes e lucro.</p></div>
        <div class="v9-top-actions"><select id="v9Period" aria-label="Período"><option value="today">Hoje</option><option value="7">Últimos 7 dias</option><option value="30" selected>Últimos 30 dias</option><option value="month">Este mês</option><option value="all">Todo o período</option></select><select id="v9Channel" aria-label="Origem"><option value="all">Todas as origens</option></select><select id="v9Campaign" aria-label="Campanha"><option value="all">Todas as campanhas</option></select><button class="v9-cost-btn" id="v9Costs">⚙ Central de custos</button></div>
      </div>
      <div class="v9-main-grid">
        <article class="v9-panel v9-revenue">
          <div class="v9-metric-label"><span class="v9-metric-icon red">$</span><div><small>Faturamento</small><em id="v9RevenueCaption">vendas pagas no período</em></div></div>
          <strong id="v9Revenue">R$ 0,00</strong>
          <div class="v9-chart" id="v9Chart"></div>
        </article>
        <article class="v9-panel v9-conversion">
          <div><small>Taxa de conversão</small><div class="v9-gauge" id="v9Gauge"><div><strong id="v9Conversion">0%</strong><span>CONVERSÃO</span></div></div><p id="v9ConversionText">Cadastre leads e vendas para acompanhar.</p></div>
        </article>
        <div class="v9-side-stack">
          <article class="v9-panel v9-side"><span class="v9-metric-icon red">♙</span><div><small>Leads novos</small><strong id="v9Leads">0</strong><em>clientes cadastrados</em></div></article>
          <article class="v9-panel v9-side"><span class="v9-metric-icon red">▣</span><div><small>Vendas</small><strong id="v9Sales">0</strong><em>pedidos pagos</em></div></article>
        </div>
      </div>
      <div class="v9-result-title">RESULTADO DO TRÁFEGO</div>
      <div class="v9-results">
        <article class="v9-panel v9-result"><span>〽</span><small>Gasto em anúncios</small><strong id="v9Spend">R$ 0,00</strong><em>custos registrados</em></article>
        <article class="v9-panel v9-result"><span>♙</span><small>CPL</small><strong id="v9Cpl">R$ 0,00</strong><em>custo por lead</em></article>
        <article class="v9-panel v9-result"><span>▤</span><small>CPA</small><strong id="v9Cpa">R$ 0,00</strong><em>custo por venda</em></article>
        <article class="v9-panel v9-result"><span>▣</span><small>Ticket médio</small><strong id="v9Ticket">R$ 0,00</strong><em>por venda</em></article>
        <article class="v9-panel v9-result positive"><span>↗</span><small>Resultado após anúncios</small><strong id="v9Profit">R$ 0,00</strong><em>faturamento menos mídia</em></article>
        <article class="v9-panel v9-result positive"><span>◎</span><small>ROAS</small><strong id="v9Roas">0,00×</strong><em>retorno sobre anúncios</em></article>
      </div>
      <p class="v9-footnote">Os indicadores usam clientes, pedidos pagos e custos de anúncios cadastrados no Intorná Pixels. Assim, o painel melhora automaticamente conforme o estúdio registra a operação.</p>
    </div>
    <dialog class="v9-dialog" id="v9CostDialog">
      <form method="dialog" class="v9-dialog-card" id="v9CostForm">
        <div class="v9-dialog-head"><div><span class="v9-eyebrow">MARKETING</span><h2>Central de custos</h2><p>Registre cada recarga ou gasto com anúncios.</p></div><button value="cancel" class="v9-close" aria-label="Fechar">×</button></div>
        <div class="v9-form-grid"><div><label>Data</label><input id="v9CostDate" type="date" required></div><div><label>Canal</label><select id="v9CostChannel"><option>Meta Ads</option><option>Google Ads</option><option>TikTok Ads</option><option>Outro</option></select></div><div><label>Valor investido</label><input id="v9CostValue" type="number" min="0.01" step="0.01" placeholder="0,00" required></div><div><label>Campanha ou observação</label><input id="v9CostNote" placeholder="Ex.: Ensaio de aniversário"></div></div>
        <div class="v9-dialog-actions"><button value="cancel" class="btn ghost">Cancelar</button><button value="default" class="btn primary" id="v9SaveCost">Registrar custo</button></div>
        <div class="v9-cost-history"><h3>Últimos lançamentos</h3><div id="v9CostList"></div></div>
      </form>
    </dialog>
  </section>`}

  function bind(){
    $('v9Period').onchange=e=>{period=e.target.value;render()};
    $('v9Channel').onchange=e=>{channel=e.target.value;campaign='all';render()};
    $('v9Campaign').onchange=e=>{campaign=e.target.value;render()};
    $('v9Costs').onclick=()=>{renderCosts();$('v9CostDialog').showModal()};
    $('v9SaveCost').onclick=e=>{e.preventDefault();addCost()};
    $('v9CostDate').value=new Date().toISOString().slice(0,10);
  }
  function startDate(){
    const now=new Date();
    if(period==='all')return null;
    if(period==='today')return new Date(now.getFullYear(),now.getMonth(),now.getDate());
    if(period==='month')return new Date(now.getFullYear(),now.getMonth(),1);
    const d=new Date(now);d.setDate(d.getDate()-(Number(period)-1));d.setHours(0,0,0,0);return d;
  }
  function inside(value){if(!value)return false;const d=new Date(value);if(Number.isNaN(d.getTime()))return false;const start=startDate();return !start||d>=start}
  function metrics(){
    const crm=state.config.crm||{},meta=id=>crm[id]||{source:'Orgânico',campaign:''},matches=c=>(channel==='all'||meta(c.id).source===channel)&&(campaign==='all'||meta(c.id).campaign===campaign);
    const clients=state.clients.filter(c=>inside(c.createdAt)&&matches(c));
    const selectedClients=new Set(state.clients.filter(matches).map(c=>c.id)),paymentDates=state.config.orderPaymentDates||{};
    const sales=state.orders.filter(o=>o.payment==='Pago'&&inside(paymentDates[o.id]||o.createdAt)&&(channel==='all'&&campaign==='all'||selectedClients.has(o.clientId)));
    const revenue=sales.reduce((n,o)=>n+Number(o.total||0),0);
    const costs=state.config.marketingEntries.filter(x=>inside(`${x.date}T12:00:00`)&&(channel==='all'||x.channel===channel)&&(campaign==='all'||String(x.note||'').toLocaleLowerCase().includes(campaign.toLocaleLowerCase())));
    const spend=costs.reduce((n,x)=>n+Number(x.value||0),0),leads=clients.length,count=sales.length;
    return {clients,sales,revenue,costs,spend,leads,count,conversion:leads?Math.min(100,count/leads*100):0,cpl:leads?spend/leads:0,cpa:count?spend/count:0,ticket:count?revenue/count:0,profit:revenue-spend,roas:spend?revenue/spend:0};
  }
  function render(){
    if(!$('performance'))return;renderFilters();const m=metrics();
    $('v9Revenue').textContent=money(m.revenue);$('v9Leads').textContent=m.leads;$('v9Sales').textContent=m.count;
    $('v9Conversion').textContent=`${m.conversion.toFixed(m.conversion<10?1:0).replace('.',',')}%`;
    $('v9ConversionText').textContent=m.leads?`${m.count} de ${m.leads} leads compraram`:'Cadastre leads e vendas para acompanhar.';
    $('v9Gauge').style.setProperty('--gauge',`${m.conversion*3.6}deg`);
    $('v9Spend').textContent=money(m.spend);$('v9Cpl').textContent=money(m.cpl);$('v9Cpa').textContent=money(m.cpa);$('v9Ticket').textContent=money(m.ticket);$('v9Profit').textContent=money(m.profit);$('v9Profit').closest('.v9-result').classList.toggle('negative',m.profit<0);$('v9Roas').textContent=`${m.roas.toFixed(2).replace('.',',')}×`;
    drawChart(m.sales);renderCosts();
  }
  function renderFilters(){
    const crm=state.config.crm||{},sourceOf=c=>crm[c.id]?.source||'Orgânico',sources=[...new Set(state.clients.map(sourceOf))].sort(),campaigns=[...new Set(state.clients.filter(c=>channel==='all'||sourceOf(c)===channel).map(c=>crm[c.id]?.campaign).filter(Boolean))].sort();
    $('v9Channel').innerHTML='<option value="all">Todas as origens</option>'+sources.map(x=>`<option value="${h(x)}">${h(x)}</option>`).join('');
    if(!sources.includes(channel))channel='all';$('v9Channel').value=channel;
    $('v9Campaign').innerHTML='<option value="all">Todas as campanhas</option>'+campaigns.map(x=>`<option value="${h(x)}">${h(x)}</option>`).join('');
    if(!campaigns.includes(campaign))campaign='all';$('v9Campaign').value=campaign;
  }
  function drawChart(sales){
    const days=period==='today'?1:period==='7'?7:period==='30'?14:period==='month'?Math.min(14,new Date().getDate()):14,now=new Date(),points=[],paymentDates=state.config.orderPaymentDates||{};
    for(let i=days-1;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i),key=d.toISOString().slice(0,10),value=sales.filter(o=>String(paymentDates[o.id]||o.createdAt).slice(0,10)===key).reduce((n,o)=>n+Number(o.total||0),0);points.push({d,value})}
    const max=Math.max(1,...points.map(x=>x.value)),coords=points.map((x,i)=>`${points.length===1?300:i/(points.length-1)*580+10},${160-(x.value/max)*135}`),line=coords.join(' '),area=`10,170 ${line} 590,170`;
    $('v9Chart').innerHTML=`<svg viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-label="Evolução do faturamento"><defs><linearGradient id="v9Area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fb3154" stop-opacity=".38"/><stop offset="1" stop-color="#fb3154" stop-opacity="0"/></linearGradient></defs><line x1="0" x2="600" y1="170" y2="170" stroke="#45202a"/><polygon points="${area}" fill="url(#v9Area)"/><polyline points="${line}" fill="none" stroke="#ff3154" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>${coords.map((p,i)=>points[i].value?`<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="4" fill="#ff3154"/>`:'').join('')}</svg>`;
  }
  function addCost(){
    const date=$('v9CostDate').value,value=Number($('v9CostValue').value||0);if(!date||value<=0)return toast('Informe a data e o valor do investimento.');
    state.config.marketingEntries.unshift({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),date,channel:$('v9CostChannel').value,value,note:$('v9CostNote').value.trim(),createdAt:new Date().toISOString()});
    $('v9CostValue').value='';$('v9CostNote').value='';save();renderCosts();toast('Custo de anúncio registrado.');
  }
  function removeCost(id){state.config.marketingEntries=state.config.marketingEntries.filter(x=>x.id!==id);save();renderCosts();toast('Lançamento removido.')}
  function renderCosts(){
    if(!$('v9CostList'))return;const rows=state.config.marketingEntries;
    $('v9CostList').innerHTML=rows.length?rows.slice(0,20).map(x=>`<div class="v9-cost-row"><div><b>${h(x.channel)}</b><small>${new Date(`${x.date}T12:00:00`).toLocaleDateString('pt-BR')}${x.note?` • ${h(x.note)}`:''}</small></div><strong>${money(x.value)}</strong><button type="button" onclick="IntornaV9.removeCost('${x.id}')" aria-label="Excluir">×</button></div>`).join(''):'<div class="v9-empty">Nenhum investimento em anúncios registrado.</div>';
  }
  window.IntornaV9={removeCost,render};inject();
})();
