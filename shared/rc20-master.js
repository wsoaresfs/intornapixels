(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let ctx=null,state={waha:null,launcher:null,busy:false};let channel=null;
function toast(m){window.toast?.(m)||alert(m)}
async function fresh(){let {data,error}=await window.IntornaCloud.client.auth.getSession();if(error)throw error;let s=data?.session;if(!s)throw new Error('Sessão expirada.');if(Number(s.expires_at||0)*1000-Date.now()<120000){const r=await window.IntornaCloud.client.auth.refreshSession();if(r.error)throw r.error;s=r.data.session}return s}
async function invoke(name,body){await fresh();let r=await window.IntornaCloud.client.functions.invoke(name,{body});if(r.error){let m=r.error.message;try{const c=r.error.context;if(c?.clone){const j=await c.clone().json();m=j?.error||m}}catch{}throw new Error(m)}if(r.data?.error)throw new Error(String(r.data.error));return r.data||{}}
const waha=(action,extra={})=>invoke('waha-connect',{action,studioId:ctx?.studioId,...extra});
const launcher=(action,extra={})=>invoke('launcher-control',{action,...extra});
function openMyStudio(){localStorage.removeItem('intorna_impersonate_studio');location.assign('/app/')}
function styles(){
 if($('#rc20MasterStyles'))return;const s=document.createElement('style');s.id='rc20MasterStyles';s.textContent=`
 .rc20-master-nav{background:linear-gradient(135deg,rgba(245,158,11,.16),rgba(124,58,237,.14))!important;border:1px solid rgba(245,158,11,.24)!important}
 .rc20-hero{background:linear-gradient(135deg,#0b132b,#312e81);color:#fff;border:0!important}.rc20-kicker{font-size:11px;font-weight:950;letter-spacing:.1em;text-transform:uppercase;color:#fbbf24}
 .rc20-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}.rc20-status{display:inline-flex;gap:6px;align-items:center;padding:7px 10px;border-radius:999px;font-size:10px;font-weight:950;background:#eef2f7;color:#475569}.rc20-status.ok{background:#dcfce7;color:#166534}.rc20-status.warn{background:#fef3c7;color:#92400e}.rc20-status.bad{background:#fee2e2;color:#991b1b}
 .rc20-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.rc20-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.rc20-kpi{border:1px solid var(--line);border-radius:12px;padding:11px}.rc20-kpi small{display:block;color:var(--muted);font-size:10px}.rc20-kpi b{display:block;font-size:17px;margin-top:4px}
 .rc20-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.rc20-note{padding:11px;border:1px solid var(--line);border-radius:11px;background:#f8fafc;font-size:11px;line-height:1.55}.rc20-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;word-break:break-all}
 .rc20-form{display:grid;gap:9px}.rc20-form input{width:100%}.rc20-log{max-height:230px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;white-space:pre-wrap;background:#0f172a;color:#e2e8f0;padding:10px;border-radius:10px}
 @media(max-width:900px){.rc20-grid{grid-template-columns:1fr}.rc20-kpis{grid-template-columns:1fr 1fr}}`;document.head.appendChild(s)
}
function addNav(){
 const nav=$('.nav');if(!nav)return;
 if(!$('#rc20MyStudio')){const b=document.createElement('button');b.type='button';b.id='rc20MyStudio';b.dataset.action='open-studio';b.className='rc20-master-nav';b.innerHTML='<span class="ico">📸</span><span class="label">Meu Estúdio</span>';b.addEventListener('click',openMyStudio);nav.querySelector('[data-page="overview"]')?.after(b)}
 if(!$('#rc20InfraNav')){const b=document.createElement('button');b.type='button';b.id='rc20InfraNav';b.dataset.page='rc20infra';b.dataset.action='open-infra';b.innerHTML='<span class="ico">🚀</span><span class="label">Infra + Launcher</span><span class="pill" style="margin-left:auto">RC22</span>';b.addEventListener('click',()=>{window.goPage?.('rc20infra');loadAll(true)});const set=nav.querySelector('[data-page="settings"]');set?nav.insertBefore(b,set):nav.appendChild(b)}
}
function addOverview(){
 const grid=$('#overview .grid');if(!grid||$('#rc20Overview'))return;const c=document.createElement('div');c.id='rc20Overview';c.className='card one';c.style.cssText='border:1px solid rgba(245,158,11,.28);background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(124,58,237,.07))';c.innerHTML='<div class="rc20-kicker">RC22 • MASTER</div><h2>📸 Seu Estúdio + Produção Automática</h2><p>Administre a plataforma e produza seus próprios ensaios com IA.</p><div class="row"><button class="btn gold" id="rc20OpenStudio">Abrir Meu Estúdio</button><button class="btn outline" id="rc20OpenInfra">Infra + Launcher</button></div>';grid.appendChild(c);$('#rc20OpenStudio').onclick=openMyStudio;$('#rc20OpenInfra').onclick=()=>{window.goPage?.('rc20infra');loadAll(true)}
}
function pageHtml(){return `
<div class="grid">
 <div class="card two rc20-hero"><div class="rc20-head"><div><div class="rc20-kicker">INTORNÁ PIXELS • RC22</div><h2>🚀 Infraestrutura + Intorná Launcher</h2><p>Depois do pareamento inicial, o botão dentro do app recupera Docker, WAHA e Quick Tunnel sem copiar comandos.</p></div><span id="rc20MainStatus" class="rc20-status warn">Verificando</span></div></div>
 <div class="card one"><h2>Servidor WAHA</h2><p class="muted">A API Key continua protegida no Vault. Para trocar apenas a URL do Quick Tunnel, deixe a chave vazia.</p><div class="rc20-form"><div><label>URL HTTPS</label><input id="rc20WahaUrl" placeholder="https://...trycloudflare.com"></div><div><label>API Key — somente primeira configuração/troca</label><input id="rc20WahaKey" type="password" autocomplete="new-password" placeholder="Deixe vazio para manter a chave"></div></div><div class="rc20-actions"><button class="btn primary" id="rc20SaveWaha">Validar e salvar</button><button class="btn ghost" id="rc20Refresh">Atualizar diagnóstico</button></div><div class="rc20-note" style="margin-top:10px"><b>Webhook:</b><div id="rc20Webhook" class="rc20-code">—</div></div></div>
 <div class="card one"><h2>Saúde do WhatsApp</h2><div class="rc20-kpis"><div class="rc20-kpi"><small>Servidor</small><b id="rc20Server">—</b></div><div class="rc20-kpi"><small>Sessões</small><b id="rc20Sessions">—</b></div><div class="rc20-kpi"><small>Conectadas</small><b id="rc20Working">—</b></div><div class="rc20-kpi"><small>Motor</small><b id="rc20Engine">—</b></div></div><div id="rc20TunnelInfo" class="rc20-note" style="margin-top:10px">Carregando…</div></div>
 <div class="card two"><div class="rc20-head"><div><h2>🖥️ Intorná Launcher</h2><p class="muted">Instalação única no notebook. Depois, as ações abaixo funcionam pelo próprio Intorná, inclusive quando você estiver no celular.</p></div><span id="rc20AgentStatus" class="rc20-status bad">Não pareado</span></div>
 <div class="rc20-grid">
  <div><h3>1. Parear notebook</h3><p class="muted">Execute <b>INSTALAR_INTORNA_LAUNCHER.cmd</b> uma vez. Ele mostrará um código de 6 dígitos.</p><label>Código exibido no notebook</label><input id="rc20PairCode" inputmode="numeric" maxlength="6" placeholder="000000"><div class="rc20-actions"><a class="btn outline" href="/launcher/IntornaLauncher-RC22.zip" download style="display:inline-block;text-decoration:none">⬇️ Baixar Launcher</a><button class="btn gold" id="rc20Pair">Parear Launcher</button></div></div>
  <div><h3>2. Controle em 1 clique</h3><div class="rc20-actions"><button class="btn primary" data-launch="start_stack">🚀 Iniciar/Recuperar tudo</button><button class="btn gold" data-launch="renew_tunnel">🌐 Renovar túnel</button><button class="btn ghost" data-launch="status">📡 Verificar status</button><button class="btn ghost" data-launch="diagnose">🩺 Diagnóstico</button><button class="btn outline" data-launch="restart_waha">🔄 Reiniciar WAHA</button></div><div id="rc20AgentInfo" class="rc20-note" style="margin-top:10px">Nenhum Launcher ativo.</div></div>
 </div>
 <h3 style="margin-top:14px">Última execução</h3><div id="rc20JobLog" class="rc20-log">Sem tarefas executadas.</div>
 </div>
 <div class="card two"><div class="rc20-head"><div><h2>🔐 Segurança RC22</h2><p class="muted">Master explícito, Launcher com segredo local, ações limitadas e trilha de auditoria.</p></div></div><div class="rc20-note">O Launcher <b>não aceita comandos livres</b>. Ele executa somente: status, iniciar pilha, renovar túnel, reiniciar WAHA e diagnóstico. O segredo do agente permanece no notebook e o backend armazena apenas o hash.</div><div class="rc20-actions"><button class="btn gold" id="rc20OpenMyStudio2">📸 Abrir Meu Estúdio</button></div></div>
</div>`}
function addPage(){const c=$('.container');if(!c||$('#rc20infra'))return;const p=document.createElement('section');p.id='rc20infra';p.className='page';p.innerHTML=pageHtml();c.appendChild(p);
 $('#rc20SaveWaha').onclick=saveWaha;$('#rc20Refresh').onclick=()=>loadAll(true);$('#rc20Pair').onclick=pairAgent;$('#rc20OpenMyStudio2').onclick=openMyStudio;$$('[data-launch]').forEach(b=>b.onclick=()=>queueTask(b.dataset.launch,b));
}
function engine(v){const s=JSON.stringify(v||{}).toUpperCase();return s.includes('GOWS')?'GOWS':s.includes('WEBJS')?'WEBJS':s?'Ativo':'—'}
async function loadWaha(){
 try{const [pf,st]=await Promise.all([waha('platform_status'),waha('status')]);state.waha={pf,st};renderWaha()}catch(e){console.warn(e);renderWaha()}
}
function renderWaha(){
 const pf=state.waha?.pf||{},st=state.waha?.st||{},c=st.connection||{},working=String(c.status||'').toUpperCase()==='WORKING',base=pf.baseUrl||st.platformBaseUrl||'';
 if($('#rc20WahaUrl')&&base)$('#rc20WahaUrl').value=base;$('#rc20Webhook').textContent=pf.webhookUrl||st.webhookUrl||'—';$('#rc20Server').textContent=pf.platformConfigured?'Online':'Pendente';$('#rc20Sessions').textContent=pf.sessions??'—';$('#rc20Working').textContent=pf.working??'—';$('#rc20Engine').textContent=working?engine(c.engine):'—';
 const m=$('#rc20MainStatus');m.className=`rc20-status ${working?'ok':pf.platformConfigured?'warn':'bad'}`;m.textContent=working?'WhatsApp operacional':pf.platformConfigured?'Servidor configurado':'Configuração pendente';
 $('#rc20TunnelInfo').innerHTML=/trycloudflare\.com/i.test(base)?'🟡 <b>Quick Tunnel:</b> modo demonstração R$0. O RC22 Launcher pode renovar a URL automaticamente.':'🟢 Endpoint HTTPS persistente/configurado.';
}
async function saveWaha(){const b=$('#rc20SaveWaha'),baseUrl=$('#rc20WahaUrl').value.trim(),apiKey=$('#rc20WahaKey').value.trim();if(!baseUrl)return toast('Informe a URL HTTPS.');b.disabled=true;try{const d=await waha('save_platform',{baseUrl,apiKey});$('#rc20WahaKey').value='';toast(d.message||'Servidor salvo.');await loadWaha()}catch(e){toast(e.message)}finally{b.disabled=false}}
async function loadLauncher(){
 try{state.launcher=await launcher('status');renderLauncher()}catch(e){console.warn(e);renderLauncher()}
}
function renderLauncher(){
 const a=(state.launcher?.agents||[]).find(x=>x.status==='active')||null,jobs=state.launcher?.jobs||[],last=jobs[0]||null,online=!!a?.online;
 const s=$('#rc20AgentStatus');s.className=`rc20-status ${online?'ok':a?'warn':'bad'}`;s.textContent=online?'Launcher online':a?'Launcher offline':'Não pareado';
 $('#rc20AgentInfo').innerHTML=a?`<b>${safe(a.label||'Intorná Launcher')}</b><br>Último sinal: ${a.last_seen_at?new Date(a.last_seen_at).toLocaleString('pt-BR'):'—'}<br>Túnel: <span class="rc20-code">${safe(a.last_tunnel_url||'—')}</span>`:'Execute o instalador no notebook e informe o código de pareamento.';
 if(last){$('#rc20JobLog').textContent=`${last.action} • ${last.status} • ${new Date(last.created_at).toLocaleString('pt-BR')}\n${last.error_message||''}\n${JSON.stringify(last.result||{},null,2)}`;}
 $$('[data-launch]').forEach(b=>b.disabled=!a);
}
function safe(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
async function pairAgent(){const code=$('#rc20PairCode').value.replace(/\D/g,'');if(code.length!==6)return toast('Digite os 6 números exibidos pelo Launcher.');const b=$('#rc20Pair');b.disabled=true;try{await launcher('approve_pair',{pairCode:code});$('#rc20PairCode').value='';toast('Notebook pareado com sucesso.');await loadLauncher()}catch(e){toast(e.message)}finally{b.disabled=false}}
async function queueTask(task,btn){btn.disabled=true;try{const d=await launcher('queue',{task});toast(d.reused?'Essa tarefa já está em andamento.':'Comando enviado ao notebook.');await new Promise(r=>setTimeout(r,2500));await Promise.all([loadLauncher(),loadWaha()])}catch(e){toast(e.message)}finally{btn.disabled=false}}
async function loadAll(show=false){if(state.busy)return;state.busy=true;try{await Promise.allSettled([loadWaha(),loadLauncher()]);if(show)toast('Diagnóstico RC22 atualizado.')}finally{state.busy=false}}
function installRealtime(){
 if(channel||!window.IntornaCloud?.client)return;channel=window.IntornaCloud.client.channel(`rc20master:${Date.now()}`)
 .on('postgres_changes',{event:'*',schema:'public',table:'launcher_agents'},()=>loadLauncher())
 .on('postgres_changes',{event:'*',schema:'public',table:'launcher_jobs'},()=>{loadLauncher();loadWaha()})
 .subscribe();
}
async function install(){
 if(window.__INTORNA_RC20_MASTER__)return true;
 if(!window.IntornaCloud?.client||!window.goPage||!$('.nav')||!$('.container'))return false;
 try{ctx=await window.IntornaCloud.requireAdmin();if(!ctx)return true}catch(e){return false}
 window.__INTORNA_RC20_MASTER__=true;styles();addNav();addOverview();addPage();installRealtime();loadAll(false);window.IntornaRC20Master={version:'22.0.2',refresh:()=>loadAll(true),openMyStudio};return true;
}
let tries=0;const boot=setInterval(async()=>{tries++;if(await install()||tries>120)clearInterval(boot)},250);
})();
