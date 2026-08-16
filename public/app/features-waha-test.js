(function(){
  'use strict';
  const ctx=window.INTORNA_CTX;
  const db=window.IntornaCloud?.client;
  if(!ctx||!db||!ctx.isAdmin)return;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  let currentChat=null, chats=[], messages=[];

  function inject(){
    const page=$('whatsapp');
    if(!page||$('wahaTestRoot'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='styles-waha-test.css';
    document.head.appendChild(link);
    const wrap=document.createElement('div');
    wrap.id='wahaTestRoot';
    wrap.className='card waha-test-root';
    wrap.innerHTML=`
      <div class="waha-topbar">
        <div>
          <h2 style="margin:0">WAHA Teste Experimental</h2>
          <p class="muted" style="margin:6px 0 0">Modo pessoal de teste para o administrador. Usa uma instância WAHA separada e não fica habilitado para os assinantes.</p>
        </div>
        <span id="wahaStatusPill" class="waha-pill idle">Não conectado</span>
      </div>
      <details open class="waha-config-box">
        <summary>⚙️ Configuração do WAHA</summary>
        <div class="waha-config-grid">
          <div><label>URL do WAHA</label><input id="wahaBaseUrl" placeholder="https://seu-waha.exemplo.com"></div>
          <div><label>Sessão</label><input id="wahaSession" placeholder="default"></div>
          <div class="full"><label>API Key</label><input id="wahaApiKey" type="password" placeholder="Cole uma nova X-Api-Key ou deixe vazio para manter"></div>
          <div class="row full">
            <button class="btn primary" id="wahaSaveCfg">Salvar no Vault</button>
            <button class="btn ghost" id="wahaCheck">Ver status</button>
            <button class="btn ghost" id="wahaStart">Iniciar sessão</button>
            <button class="btn ghost" id="wahaRestart">Reiniciar</button>
            <button class="btn danger" id="wahaLogout">Logout</button>
          </div>
          <div class="full"><small class="photo-note">As credenciais ficam protegidas no Supabase Vault e somente o administrador Master pode alterá-las. A chave nunca é exibida novamente no navegador.</small></div>
        </div>
      </details>
      <div class="waha-qr-shell">
        <div class="waha-qr-card">
          <div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">QR Code</h3><button class="btn ghost" id="wahaLoadQr">Atualizar QR</button></div>
          <div id="wahaQrBox" class="waha-qr-box">Carregue o QR para conectar o WhatsApp.</div>
        </div>
        <div class="waha-help-card">
          <h3 style="margin-top:0">Como testar</h3>
          <ol>
            <li>Suba uma instância WAHA em um servidor seu.</li>
            <li>Preencha URL, API Key e sessão.</li>
            <li>Clique em <b>Iniciar sessão</b> e depois <b>Atualizar QR</b>.</li>
            <li>Escaneie o QR no WhatsApp.</li>
            <li>Quando o status estiver conectado, carregue as conversas e envie mensagens.</li>
          </ol>
        </div>
      </div>
      <div class="waha-shell">
        <div class="waha-list-panel">
          <div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">Conversas</h3><button class="btn ghost" id="wahaLoadChats">Atualizar</button></div>
          <input id="wahaSearch" placeholder="Buscar conversa" style="margin:10px 0">
          <div id="wahaChats" class="waha-list"><div class="empty">Nenhuma conversa carregada.</div></div>
        </div>
        <div class="waha-chat-panel">
          <div class="waha-chat-head">
            <div><b id="wahaChatTitle">Selecione uma conversa</b><div id="wahaChatSub" class="muted"></div></div>
            <button class="btn ghost" id="wahaRefreshMessages">Atualizar mensagens</button>
          </div>
          <div id="wahaMessages" class="waha-messages"><div class="empty">Selecione uma conversa para abrir o histórico.</div></div>
          <div class="waha-compose-box">
            <label>Número manual (opcional)</label>
            <input id="wahaManualTarget" placeholder="5531999999999 ou 5531999999999@c.us">
            <label>Mensagem</label>
            <textarea id="wahaComposer" placeholder="Digite a mensagem..."></textarea>
            <div class="row" style="justify-content:space-between;align-items:center"><small class="muted">Se nenhuma conversa estiver selecionada, o envio usa o número manual.</small><button class="btn primary" id="wahaSend">Enviar</button></div>
          </div>
        </div>
      </div>`;
    page.appendChild(wrap);
    bind();
    loadCfg();
  }

  function bind(){
    $('wahaSaveCfg').onclick=saveCfg;
    $('wahaCheck').onclick=()=>status(true);
    $('wahaStart').onclick=()=>runAction('start');
    $('wahaRestart').onclick=()=>runAction('restart');
    $('wahaLogout').onclick=()=>runAction('logout');
    $('wahaLoadQr').onclick=loadQr;
    $('wahaLoadChats').onclick=loadChats;
    $('wahaRefreshMessages').onclick=()=>currentChat&&loadMessages(currentChat.id,currentChat.name||currentChat.id);
    $('wahaSend').onclick=sendMessage;
    $('wahaSearch').oninput=renderChats;
  }

  function cfg(){
    return {
      baseUrl: $('wahaBaseUrl').value.trim(),
      apiKey: $('wahaApiKey').value.trim(),
      session: ($('wahaSession').value.trim()||'default')
    };
  }

  async function loadCfg(){
    try{
      const {data,error}=await db.functions.invoke('integration-admin',{body:{action:'status'}});
      if(error)throw error;if(data?.error)throw new Error(data.error);
      const c=data?.config||{};
      $('wahaBaseUrl').value=c.wahaBaseUrl||'';
      $('wahaApiKey').value='';
      $('wahaSession').value=c.wahaSession||'default';
      if(c.connected?.waha)status(false);
    }catch(_){ }
  }

  async function saveCfg(){
    try{
      const c=cfg(),secrets={};if(c.apiKey)secrets.waha=c.apiKey;
      const {data,error}=await db.functions.invoke('integration-admin',{body:{action:'save',wahaBaseUrl:c.baseUrl,wahaSession:c.session,secrets}});
      if(error)throw error;if(data?.error)throw new Error(data.error);
      $('wahaApiKey').value='';toast('Configuração WAHA salva com segurança.');await status(false);
    }catch(e){toast(e.message||'Falha ao salvar configuração WAHA.')}
  }

  async function invoke(action,payload={}){
    const body={action,...payload};
    const {data,error}=await db.functions.invoke('waha-test',{body});
    if(error)throw error;
    if(data?.error)throw new Error(data.error);
    return data;
  }

  function setStatus(label,kind='idle'){
    const pill=$('wahaStatusPill');
    pill.className=`waha-pill ${kind}`;
    pill.textContent=label;
  }

  async function status(showToast){
    try{
      const data=await invoke('status');
      const s=(data.session?.status||'unknown').toLowerCase();
      const map={working:'connected',connected:'connected',scan_qr:'warning',scan_qr_code:'warning',starting:'warning',failed:'danger',stopped:'idle',unknown:'idle'};
      setStatus(data.session?.status||'Sem status',map[s]||'idle');
      if(showToast)toast('Status atualizado.');
      return data;
    }catch(e){
      setStatus('Erro de conexão','danger');
      if(showToast!==false)toast(e.message||'Falha ao consultar WAHA.');
      throw e;
    }
  }

  async function runAction(action){
    try{
      if(action==='logout'&&!confirm('Deseja desconectar a sessão WAHA?'))return;
      const data=await invoke(action);
      await status(false);
      if(action!=='logout')toast('Ação executada.');
      if(action==='logout'){$('wahaQrBox').innerHTML='Sessão desconectada.';chats=[];messages=[];renderChats();$('wahaMessages').innerHTML='<div class="empty">Sessão desconectada.</div>'}
      return data;
    }catch(e){toast(e.message||'Falha ao executar ação.')}}

  async function loadQr(){
    try{
      $('wahaQrBox').innerHTML='Carregando QR...';
      const data=await invoke('qr');
      const img=data.base64||data.qr||data.dataUrl||'';
      if(!img){$('wahaQrBox').innerHTML='QR indisponível no momento. Tente reiniciar a sessão.';return}
      const src=img.startsWith('data:')?img:`data:image/png;base64,${img}`;
      $('wahaQrBox').innerHTML=`<img src="${src}" alt="QR WAHA"><small class="muted">Escaneie com o WhatsApp em Aparelhos conectados.</small>`;
      await status(false);
    }catch(e){$('wahaQrBox').innerHTML=`<div class="empty">${esc(e.message||'Falha ao carregar QR.')}</div>`;toast(e.message||'Falha ao carregar QR.')}}

  async function loadChats(){
    try{
      const data=await invoke('chats');
      chats=Array.isArray(data.chats)?data.chats:[];
      renderChats();
      toast('Conversas atualizadas.');
    }catch(e){toast(e.message||'Falha ao carregar conversas.')}}

  function renderChats(){
    const q=($('wahaSearch').value||'').trim().toLowerCase();
    const list=q?chats.filter(c=>`${c.name||''} ${c.id||''} ${(c.lastMessage?.body||'')}`.toLowerCase().includes(q)):chats;
    $('wahaChats').innerHTML=list.length?list.map(c=>`
      <button class="waha-chat-item ${currentChat?.id===c.id?'active':''}" data-id="${esc(c.id)}">
        <b>${esc(c.name||c.id)}</b>
        <small>${esc(c.id||'')}</small>
        <span>${esc(c.lastMessage?.body||'Sem mensagem')}</span>
      </button>`).join(''):'<div class="empty">Nenhuma conversa encontrada.</div>';
    document.querySelectorAll('.waha-chat-item').forEach(btn=>btn.onclick=()=>loadMessages(btn.dataset.id,btn.querySelector('b')?.textContent||btn.dataset.id));
  }

  async function loadMessages(chatId, title){
    try{
      currentChat={id:chatId,name:title};
      $('wahaChatTitle').textContent=title||chatId;
      $('wahaChatSub').textContent=chatId;
      $('wahaMessages').innerHTML='Carregando mensagens...';
      const data=await invoke('messages',{chatId});
      messages=Array.isArray(data.messages)?data.messages:[];
      renderMessages();
      renderChats();
    }catch(e){$('wahaMessages').innerHTML=`<div class="empty">${esc(e.message||'Falha ao carregar mensagens.')}</div>`;toast(e.message||'Falha ao carregar mensagens.')}}

  function renderMessages(){
    $('wahaMessages').innerHTML=messages.length?messages.map(m=>{
      const fromMe=!!m.fromMe;
      const text=m.body||`[${m.type||'mensagem'}]`;
      const time=m.timestamp?new Date(Number(m.timestamp)*1000).toLocaleString('pt-BR'):'—';
      return `<div class="waha-bubble ${fromMe?'out':'in'}"><div>${esc(text)}</div><small>${time}${fromMe?` • ${esc(m.ackName||'')}`:''}</small></div>`
    }).join(''):'<div class="empty">Nenhuma mensagem nesta conversa.</div>';
    $('wahaMessages').scrollTop=$('wahaMessages').scrollHeight;
  }

  function normalizeTarget(v){
    const raw=String(v||'').trim();
    if(!raw)return '';
    if(raw.includes('@'))return raw;
    const digits=raw.replace(/\D/g,'');
    return digits?`${digits}@c.us`:'';
  }

  async function sendMessage(){
    try{
      const text=$('wahaComposer').value.trim();
      if(!text)return toast('Digite a mensagem.');
      const chatId=currentChat?.id||normalizeTarget($('wahaManualTarget').value);
      if(!chatId)return toast('Selecione uma conversa ou informe um número manual.');
      await invoke('send_text',{chatId,text});
      $('wahaComposer').value='';
      toast('Mensagem enviada.');
      await loadMessages(chatId,currentChat?.name||chatId);
      await loadChats();
    }catch(e){toast(e.message||'Falha ao enviar mensagem.')}}

  function toast(msg){window.toast?window.toast(msg):alert(msg)}
  inject();
})();
