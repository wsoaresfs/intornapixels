(()=>{
'use strict';

const VERSION='RC12';
const $=(s,r=document)=>r.querySelector(s);
const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let installed=false;

function toast(msg){
  if(window.toast){window.toast(msg);return}
  let el=$('#ip12Toast');
  if(!el){el=document.createElement('div');el.id='ip12Toast';el.className='ip12-toast';document.body.appendChild(el)}
  el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2800);
}

function client(){return window.IntornaCloud?.client||window.INTORNA_SUPABASE||window.supabaseClient||window.sb||null}
function studioId(){return window.INTORNA_CTX?.studioId||null}

async function invokeConnect(action,extra={}){
  const db=client(),sid=studioId();
  if(!db||!sid)throw new Error('Sessão do estúdio não encontrada.');
  const {data,error}=await db.functions.invoke('marketing-connect',{body:{action,studioId:sid,...extra}});
  if(error)throw error;if(data?.error)throw new Error(data.error);return data;
}

async function invokeSync(action='sync_all'){
  const db=client(),sid=studioId();
  if(!db||!sid)throw new Error('Sessão do estúdio não encontrada.');
  const {data,error}=await db.functions.invoke('marketing-sync',{body:{action,studioId:sid,days:Number(window.IntornaRC11?.state?.()?.period||30)}});
  if(error)throw error;if(data?.error)throw new Error(data.error);return data;
}

function styles(){
  if($('#ip12Styles'))return;
  const s=document.createElement('style');s.id='ip12Styles';s.textContent=`
  .ip12-real{grid-column:1/-1}.ip12-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}.ip12-head h3{margin:0 0 4px}.ip12-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}.ip12-provider{border:1px solid var(--ip10-line,#dbe1ea);border-radius:16px;padding:15px;background:rgba(255,255,255,.03)}.ip12-provider-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.ip12-provider-title{display:flex;align-items:center;gap:10px}.ip12-logo{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-weight:900;background:#171d32;color:white}.ip12-status{font-size:11px;font-weight:900;padding:6px 9px;border-radius:999px;background:#fff3cd;color:#7c5700}.ip12-status.ok{background:#dcfce7;color:#166534}.ip12-status.err{background:#fee2e2;color:#991b1b}.ip12-meta{font-size:12px;opacity:.75;margin:8px 0 12px;min-height:34px}.ip12-actions{display:flex;gap:8px;flex-wrap:wrap}.ip12-btn{border:0;border-radius:11px;padding:10px 13px;font-weight:900;cursor:pointer}.ip12-btn.primary{background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff}.ip12-btn.ghost{background:#eef2f7;color:#27364c}.ip12-btn.danger{background:#fee2e2;color:#991b1b}.ip12-btn:disabled{opacity:.55;cursor:not-allowed}.ip12-overlay{position:fixed;inset:0;background:rgba(5,8,20,.76);display:none;align-items:center;justify-content:center;padding:18px;z-index:10000}.ip12-overlay.show{display:flex}.ip12-modal{width:min(720px,100%);max-height:92vh;overflow:auto;background:#fff;color:#111827;border-radius:20px;padding:20px;box-shadow:0 25px 80px rgba(0,0,0,.35)}.ip12-modal h2{margin:0 0 6px}.ip12-modal p{color:#667085;line-height:1.45}.ip12-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ip12-form .full{grid-column:1/-1}.ip12-form label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:800}.ip12-form input{width:100%;padding:11px 12px;border:1px solid #cbd5e1;border-radius:10px}.ip12-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;flex-wrap:wrap}.ip12-note{font-size:11px;background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:10px;color:#475569}.ip12-toast{position:fixed;right:18px;bottom:18px;background:#111827;color:#fff;padding:12px 16px;border-radius:12px;z-index:11000;display:none}.ip12-toast.show{display:block}@media(max-width:720px){.ip12-grid,.ip12-form{grid-template-columns:1fr}.ip12-form .full{grid-column:auto}}
  `;document.head.appendChild(s);
}

function modal(){
  if($('#ip12Overlay'))return;
  const o=document.createElement('div');o.id='ip12Overlay';o.className='ip12-overlay';o.innerHTML=`<div class="ip12-modal" id="ip12Modal"></div>`;document.body.appendChild(o);
  o.addEventListener('click',e=>{if(e.target===o)closeModal()});
}
function closeModal(){$('#ip12Overlay')?.classList.remove('show');$('#ip12Modal').innerHTML=''}
function openModal(html){$('#ip12Modal').innerHTML=html;$('#ip12Overlay').classList.add('show')}

function metaForm(){
  openModal(`<h2>Conectar Meta Ads</h2><p>Conecte uma conta real do Facebook/Instagram Ads. A credencial é enviada direto ao backend e armazenada criptografada.</p><form id="ip12MetaForm" class="ip12-form"><label class="full">ID da conta de anúncios<input name="accountId" placeholder="Ex.: 123456789012345 ou act_123456789012345" required></label><label class="full">Access Token da Meta<input name="accessToken" type="password" autocomplete="off" placeholder="Token com permissão ads_read" required></label><div class="full ip12-note">O Intorná Pixels valida a conta na API da Meta v25.0 antes de salvar. O token não fica no navegador.</div></form><div class="ip12-modal-actions"><button class="ip12-btn ghost" id="ip12Cancel">Cancelar</button><button class="ip12-btn primary" id="ip12MetaSave">Validar e conectar</button></div>`);
  $('#ip12Cancel').onclick=closeModal;$('#ip12MetaSave').onclick=connectMeta;
}

async function connectMeta(){
  const form=$('#ip12MetaForm'),btn=$('#ip12MetaSave');if(!form.reportValidity())return;
  const fd=new FormData(form);btn.disabled=true;btn.textContent='Validando na Meta…';
  try{const d=await invokeConnect('connect_meta',{accountId:fd.get('accountId'),accessToken:fd.get('accessToken')});toast(`Meta Ads conectada: ${d.result?.account?.name||'conta validada'}`);closeModal();await refresh();await window.IntornaRC11?.reload?.()}catch(e){toast(e.message||'Não foi possível conectar a Meta.')}finally{btn.disabled=false;btn.textContent='Validar e conectar'}
}

function googleForm(){
  openModal(`<h2>Conectar Google Ads</h2><p>Use as credenciais OAuth da conta real do Google Ads. O acesso é validado na Google Ads API v25 antes de ser salvo.</p><form id="ip12GoogleForm" class="ip12-form"><label>Customer ID<input name="customerId" placeholder="123-456-7890" required></label><label>Login Customer ID (opcional)<input name="loginCustomerId" placeholder="Conta administradora/MCC"></label><label class="full">OAuth Client ID<input name="clientId" autocomplete="off" required></label><label class="full">OAuth Client Secret<input name="clientSecret" type="password" autocomplete="off" required></label><label class="full">Refresh Token OAuth<input name="refreshToken" type="password" autocomplete="off" required></label><label class="full">Developer Token Google Ads<input name="developerToken" type="password" autocomplete="off" required></label><div class="full ip12-note">O Google Ads exige OAuth 2.0 e Developer Token. Todos os dados sensíveis ficam criptografados no Vault.</div></form><div class="ip12-modal-actions"><button class="ip12-btn ghost" id="ip12Cancel">Cancelar</button><button class="ip12-btn primary" id="ip12GoogleSave">Validar e conectar</button></div>`);
  $('#ip12Cancel').onclick=closeModal;$('#ip12GoogleSave').onclick=connectGoogle;
}

async function connectGoogle(){
  const form=$('#ip12GoogleForm'),btn=$('#ip12GoogleSave');if(!form.reportValidity())return;
  const fd=new FormData(form);btn.disabled=true;btn.textContent='Validando no Google…';
  try{const d=await invokeConnect('connect_google',{customerId:fd.get('customerId'),loginCustomerId:fd.get('loginCustomerId'),clientId:fd.get('clientId'),clientSecret:fd.get('clientSecret'),refreshToken:fd.get('refreshToken'),developerToken:fd.get('developerToken')});toast(`Google Ads conectado: ${d.result?.account?.name||'conta validada'}`);closeModal();await refresh();await window.IntornaRC11?.reload?.()}catch(e){toast(e.message||'Não foi possível conectar o Google Ads.')}finally{btn.disabled=false;btn.textContent='Validar e conectar'}
}

async function disconnect(provider){
  if(!confirm(`Desconectar ${provider==='meta'?'Meta Ads':'Google Ads'} deste estúdio?`))return;
  try{await invokeConnect('disconnect',{provider});toast('Conta desconectada.');await refresh();await window.IntornaRC11?.reload?.()}catch(e){toast(e.message||'Falha ao desconectar.')}
}

async function syncAll(){
  const btn=$('#ip10Sync');if(btn){btn.disabled=true;btn.textContent='↻ Sincronizando…'}
  try{const d=await invokeSync('sync_all');const errs=d.result?.errors||[];await window.IntornaRC11?.reload?.();await refresh();toast(errs.length?`Sincronização parcial: ${errs.map(x=>x.provider).join(', ')}`:'Contas sincronizadas com sucesso.')}catch(e){toast(e.message||'Falha ao sincronizar anúncios.')}finally{if(btn){btn.disabled=false;btn.textContent='↻ Sincronizar anúncios'}}
}

function installSyncOverride(){
  const old=$('#ip10Sync');if(!old||old.dataset.ip12==='1')return;
  const btn=old.cloneNode(true);btn.dataset.ip12='1';old.replaceWith(btn);btn.addEventListener('click',syncAll);
}

function providerHtml(provider,row){
  const meta=provider==='meta',name=meta?'Meta Ads':'Google Ads',logo=meta?'M':'G';
  const ready=row?.status==='ready',err=row?.status==='error';
  const cls=ready?'ok':err?'err':'';
  const status=ready?'Conectado':err?'Erro':'Não conectado';
  const detail=ready?`${safe(row.account_label||name)}${row.account_external_id?` • ${safe(row.account_external_id)}`:''}${row.last_sync_at?`<br>Última sincronização: ${safe(new Date(row.last_sync_at).toLocaleString('pt-BR'))}`:''}`:err?safe(row.last_error||'Verifique a conexão.'):'Conecte uma conta real para importar investimento, cliques, leads e vendas.';
  return `<div class="ip12-provider"><div class="ip12-provider-head"><div class="ip12-provider-title"><div class="ip12-logo">${logo}</div><div><b>${name}</b><div style="font-size:11px;opacity:.65">Conta real</div></div></div><span class="ip12-status ${cls}">${status}</span></div><div class="ip12-meta">${detail}</div><div class="ip12-actions">${ready?`<button class="ip12-btn primary" data-sync="${provider}">Sincronizar agora</button><button class="ip12-btn danger" data-disconnect="${provider}">Desconectar</button>`:`<button class="ip12-btn primary" data-connect="${provider}">Conectar ${name}</button>`}</div></div>`;
}

async function refresh(){
  const host=$('#ip12Providers');if(!host)return;
  host.innerHTML='<div class="ip12-note" style="grid-column:1/-1">Verificando conexões…</div>';
  try{const d=await invokeConnect('status');const map=Object.fromEntries((d.connections||[]).map(x=>[x.provider,x]));host.innerHTML=providerHtml('meta',map.meta)+providerHtml('google',map.google);bindProviderActions()}catch(e){host.innerHTML=`<div class="ip12-note" style="grid-column:1/-1">${safe(e.message||'Não foi possível verificar as conexões.')}</div>`}
}

function bindProviderActions(){
  document.querySelectorAll('[data-connect="meta"]').forEach(b=>b.onclick=metaForm);
  document.querySelectorAll('[data-connect="google"]').forEach(b=>b.onclick=googleForm);
  document.querySelectorAll('[data-disconnect]').forEach(b=>b.onclick=()=>disconnect(b.dataset.disconnect));
  document.querySelectorAll('[data-sync]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await invokeSync(b.dataset.sync==='meta'?'sync_meta':'sync_google');await window.IntornaRC11?.reload?.();await refresh();toast('Conta sincronizada.')}catch(e){toast(e.message||'Falha ao sincronizar.')}finally{b.disabled=false}});
}

function install(){
  if(installed)return;
  const section=$('#ip10Marketing'),grid=section?.querySelector('.ip10-grid');if(!section||!grid)return;
  installed=true;styles();modal();
  const card=document.createElement('div');card.id='ip12RealAccounts';card.className='ip10-card ip12-real';card.innerHTML=`<div class="ip12-head"><div><div class="ip10-kicker">INTORNÁ PIXELS • ${VERSION}</div><h3>Contas reais de tráfego pago</h3><div class="ip10-small">Conecte as contas do estúdio com credenciais protegidas no backend.</div></div><button class="ip12-btn ghost" id="ip12Refresh">Atualizar conexões</button></div><div class="ip12-grid" id="ip12Providers"></div>`;
  const history=grid.querySelector('.ip10-span12');if(history)grid.insertBefore(card,history);else grid.appendChild(card);
  $('#ip12Refresh').onclick=refresh;installSyncOverride();refresh();
  window.IntornaMarketingAccounts={refresh,openMeta:metaForm,openGoogle:googleForm};
}

const timer=setInterval(()=>{install();if(installed)clearInterval(timer)},300);
setTimeout(()=>clearInterval(timer),15000);
})();


/* =========================================================
   RC13 — MOTOR DE VENDAS
   Carregamento incremental sem alterar o bootstrap.
   ========================================================= */
(()=>{
  if(document.querySelector('script[data-intorna-v13]')) return;
  const s=document.createElement('script');
  s.src='features-v13.js?v=22.1.0';
  s.async=false;
  s.dataset.intornaV13='1';
  document.body.appendChild(s);
})();
