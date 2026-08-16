(function(){
  'use strict';
  const P=window.IntornaPlatform,data=P.ensure(),session=P.session();
  if(!session){location.replace('/portal/');return}
  if(session.role==='admin'){location.replace('/admin/');return}
  const studio=P.studio(data,session.studioId||P.activeStudioId());
  if(!studio){P.logout();location.replace('/portal/');return}
  if(['blocked','cancelled'].includes(studio.status)){P.logout();alert('Esta conta não está liberada. Entre em contato com o suporte.');location.replace('/portal/');return}
  P.setActiveStudio(studio.id);
  studio.workspace=studio.workspace||P.blankWorkspace(studio.name,studio.plan);
  studio.workspace.config={...P.blankWorkspace().config,...(studio.workspace.config||{}),brand:studio.name,plan:studio.plan};
  localStorage.setItem(P.LEGACY_KEY,JSON.stringify(studio.workspace));
  const nativeSet=localStorage.setItem.bind(localStorage);
  localStorage.setItem=function(key,value){nativeSet(key,value);if(key===P.LEGACY_KEY){try{const current=P.ensure(),s=P.studio(current,studio.id);if(s){s.workspace=JSON.parse(value);s.workspace.config={...s.workspace.config,brand:s.name,plan:s.plan};s.lastActiveAt=P.now();P.save(current)}}catch(e){console.warn('Falha ao sincronizar estúdio',e)}}};
  function plan(){const current=P.ensure(),s=P.studio(current,studio.id);return P.plan(current,s?.plan||'free')}
  function usage(){try{const w=JSON.parse(localStorage.getItem(P.LEGACY_KEY)||'{}');return {orders:P.monthlyOrders(w),clients:(w.clients||[]).length}}catch{return {orders:0,clients:0}}}
  function noticeHtml(){const current=P.ensure(),s=P.studio(current,studio.id);const notices=current.notices.filter(n=>n.active&&(n.audience==='all'||n.audience===s.plan));return notices.map(n=>`<div class="tenant-notice"><b>${escapeHtml(n.title)}</b><span>${escapeHtml(n.body)}</span></div>`).join('')}
  function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function enhance(){
    const top=document.querySelector('.top-actions');if(top){const currentPlan=plan(),u=usage();top.insertAdjacentHTML('afterbegin',`<div class="tenant-user"><small>${escapeHtml(studio.ownerName||studio.name)}</small><b>${escapeHtml(currentPlan.name)} • ${u.orders}/${currentPlan.orderLimit>=9999?'∞':currentPlan.orderLimit}</b></div>${session.impersonatedBy?'<button class="btn outline" id="backAdmin">Voltar ao Admin</button>':''}<button class="btn danger" id="logoutStudio">Sair</button>`);document.getElementById('logoutStudio').onclick=()=>{P.logout();location.href='/portal/'};if(document.getElementById('backAdmin'))document.getElementById('backAdmin').onclick=()=>{const current=P.ensure(),a=current.admins.find(x=>x.id===session.impersonatedBy)||current.admins[0];P.setSession({role:'admin',userId:a.id,name:a.name,at:P.now()});location.href='/admin/'}}
    const dashboard=document.getElementById('dashboard');const nh=noticeHtml();if(dashboard&&nh)dashboard.insertAdjacentHTML('afterbegin',`<div class="notice-stack">${nh}</div>`);
    const formOrder=document.getElementById('pedidoForm');if(formOrder)formOrder.addEventListener('submit',e=>{const p=plan(),u=usage();if(u.orders>=p.orderLimit){e.preventDefault();e.stopImmediatePropagation();window.toast?.(`Limite mensal do plano ${p.name} atingido.`)}},true);
    const formClient=document.getElementById('clienteForm');if(formClient)formClient.addEventListener('submit',e=>{const p=plan(),u=usage();if(u.clients>=p.clientLimit){e.preventDefault();e.stopImmediatePropagation();window.toast?.(`Limite de clientes do plano ${p.name} atingido.`)}},true);
    window.selectPlan=function(){window.toast?.('A alteração de plano é feita pela administração da Intorná Pixels.');};const supportForm=document.getElementById('supportForm');if(supportForm)supportForm.addEventListener('submit',e=>{e.preventDefault();const current=P.ensure();current.tickets.unshift({id:P.uid('ticket'),studioId:studio.id,subject:document.getElementById('supSubject').value.trim(),message:document.getElementById('supMessage').value.trim(),priority:document.getElementById('supPriority').value,status:'open',createdAt:P.now()});P.log(current,'support',`Novo chamado: ${document.getElementById('supSubject').value.trim()}`,studio.id);P.save(current);supportForm.reset();renderMyTickets();window.toast?.('Chamado enviado para a administração.')});renderMyTickets();
  }
  function renderMyTickets(){const box=document.getElementById('myTickets');if(!box)return;const current=P.ensure(),items=current.tickets.filter(t=>t.studioId===studio.id);box.innerHTML=items.length?items.map(t=>`<div class="library-item"><div class="row" style="justify-content:space-between"><b>${escapeHtml(t.subject)}</b><span class="pill ${t.status==='closed'?'ok':t.status==='in_progress'?'warn':''}">${t.status==='closed'?'Resolvido':t.status==='in_progress'?'Em atendimento':'Aberto'}</span></div><p>${escapeHtml(t.message)}</p><small class="muted">${new Date(t.createdAt).toLocaleString('pt-BR')}</small></div>`).join(''):'<div class="empty">Nenhum chamado enviado.</div>'}
  let lastWorkspace=localStorage.getItem(P.LEGACY_KEY)||'';setInterval(()=>{const raw=localStorage.getItem(P.LEGACY_KEY)||'';if(raw&&raw!==lastWorkspace){lastWorkspace=raw;try{const current=P.ensure(),s=P.studio(current,studio.id);if(s){s.workspace=JSON.parse(raw);s.workspace.config={...s.workspace.config,brand:s.name,plan:s.plan};s.lastActiveAt=P.now();P.save(current)}}catch(e){console.warn('Falha ao sincronizar dados operacionais',e)}}},800);document.addEventListener('DOMContentLoaded',enhance);
})();
