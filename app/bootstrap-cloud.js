(async function(){
  'use strict';
  const loading=document.createElement('div');
  loading.id='cloudLoading';
  loading.style.cssText='position:fixed;inset:0;z-index:9999;background:#0B132B;color:white;display:grid;place-items:center;font-family:Inter,system-ui;text-align:center;padding:30px';
  loading.innerHTML='<div><div style="font-size:42px">☁️</div><h2>Conectando ao Intorná Pixels…</h2><p style="opacity:.75">Carregando seu estúdio e sincronizando os dados.</p></div>';
  document.body.appendChild(loading);
  try{
    const ctx=await IntornaCloud.requireStudio();if(!ctx)return;
    const workspace=await IntornaCloud.hydrateWorkspace(ctx);
    localStorage.setItem(IntornaCloud.KEY,JSON.stringify(workspace));
    IntornaCloud.installWorkspaceSync(ctx);
    const script=document.createElement('script');script.src='app.js';
    script.onload=async()=>{
      window.INTORNA_CTX=ctx;
      const v6=document.createElement('script');v6.src='features-v6.js';v6.async=false;v6.onload=()=>{const v7=document.createElement('script');v7.src='features-v7.js';v7.async=false;v7.onload=()=>{const v8=document.createElement('script');v8.src='features-v8.js';v8.async=false;v8.onload=()=>{const v9=document.createElement('script');v9.src='features-v9.js';v9.async=false;v9.onload=()=>{const v10=document.createElement('script');v10.src='features-v10.js';v10.async=false;v10.onload=()=>{const v11=document.createElement('script');v11.src='features-v11.js';v11.async=false;document.body.appendChild(v11)};document.body.appendChild(v10)};document.body.appendChild(v9)};document.body.appendChild(v8)};document.body.appendChild(v7)};document.body.appendChild(v6);
      loading.remove();
      const top=document.querySelector('.top-actions');
      if(top){
        const badge=document.createElement('div');badge.className='tenant-user';badge.innerHTML=`<small>${escapeHtml(ctx.user.user_metadata?.full_name||ctx.user.email||'Usuário')}</small><b>${escapeHtml(ctx.studio.name)} • ${escapeHtml(ctx.studio.plan_id||'free')}</b>`;top.prepend(badge);
        if(ctx.impersonating){const back=document.createElement('button');back.className='btn outline';back.textContent='Voltar ao Admin';back.onclick=()=>{localStorage.removeItem('intorna_impersonate_studio');location.href='/admin/'};top.appendChild(back)}
        const btn=document.createElement('button');btn.className='btn danger';btn.textContent='Sair';btn.onclick=()=>IntornaCloud.signOut();top.appendChild(btn);
      }
      try{const ns=await IntornaCloud.notices(ctx);const dash=document.getElementById('dashboard');if(dash&&ns.length){const wrap=document.createElement('div');wrap.className='notice-stack';wrap.innerHTML=ns.map(n=>`<div class="tenant-notice"><b>${escapeHtml(n.title)}</b><span>${escapeHtml(n.body)}</span></div>`).join('');dash.prepend(wrap)}}catch(e){console.warn(e)}
      const form=document.getElementById('supportForm');if(form){form.onsubmit=async e=>{e.preventDefault();try{await IntornaCloud.sendTicket(ctx,{subject:document.getElementById('supSubject').value.trim(),message:document.getElementById('supMessage').value.trim(),priority:document.getElementById('supPriority').value});form.reset();window.toast?.('Chamado enviado.');await renderTickets()}catch(ex){window.toast?.(ex.message||'Falha ao enviar chamado.')}}}
      async function renderTickets(){const box=document.getElementById('myTickets');if(!box)return;try{const items=await IntornaCloud.listTickets(ctx);box.innerHTML=items.length?items.map(t=>`<div class="library-item"><div class="row" style="justify-content:space-between"><b>${escapeHtml(t.subject)}</b><span class="pill ${t.status==='closed'?'ok':t.status==='in_progress'?'warn':''}">${t.status==='closed'?'Resolvido':t.status==='in_progress'?'Em atendimento':'Aberto'}</span></div><p>${escapeHtml(t.message)}</p>${t.admin_response?`<p><b>Resposta:</b> ${escapeHtml(t.admin_response)}</p>`:''}<small class="muted">${new Date(t.created_at).toLocaleString('pt-BR')}</small></div>`).join(''):'<div class="empty">Nenhum chamado enviado.</div>'}catch(e){box.innerHTML='<div class="empty">Não foi possível carregar os chamados.</div>'}}
      async function installBilling(){
        const checkoutBox=document.getElementById('billingCheckout');
        const method=document.getElementById('billingMethod');
        if(!checkoutBox||!method)return;
        async function refreshBilling(){
          try{
            const [subs,pays]=await Promise.all([IntornaCloud.listSubscriptions(ctx),IntornaCloud.listBillingPayments(ctx)]);
            const current=subs.find(s=>['active','ACTIVE','pending'].includes(String(s.status)))||subs[0];
            if(current){
              const last=pays.find(p=>p.subscription_id===current.id)||pays[0];
              checkoutBox.style.display='block';
              checkoutBox.innerHTML=`<div class="row" style="justify-content:space-between;align-items:flex-start"><div><h2>Assinatura</h2><p><b>Plano:</b> ${escapeHtml(current.plan_id)} &nbsp; <b>Status:</b> ${escapeHtml(current.status)}</p>${last?`<p class="muted">Última cobrança: ${Number(last.amount||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} • ${escapeHtml(last.status||'')}</p>`:''}</div>${['active','ACTIVE','pending'].includes(String(current.status))?`<button id="cancelBillingBtn" class="btn danger">Cancelar assinatura</button>`:''}</div>${last?.invoice_url?`<a class="btn gold" style="display:inline-block;text-decoration:none;margin-top:10px" href="${escapeHtml(last.invoice_url)}" target="_blank" rel="noopener">Abrir cobrança</a>`:''}`;
              const cancel=document.getElementById('cancelBillingBtn');if(cancel)cancel.onclick=async()=>{if(!confirm('Cancelar esta assinatura e retornar ao plano gratuito?'))return;try{await IntornaCloud.cancelSubscription(current.id);window.toast?.('Assinatura cancelada.');location.reload()}catch(e){window.toast?.(e.message||'Falha ao cancelar.')}};
            }
          }catch(e){console.warn('billing status',e)}
        }
        window.selectPlan=async id=>{
          const labels={start:'Start',pro:'Pro',studio:'Studio',free:'Gratuito'};
          if(id==='free'){window.toast?.('O plano Gratuito não gera cobrança. Cancele uma assinatura ativa para retornar a ele.');return}
          if(!confirm(`Contratar o plano ${labels[id]||id} com pagamento via ${method.options[method.selectedIndex].text}?`))return;
          checkoutBox.style.display='block';checkoutBox.innerHTML='<h2>Gerando cobrança…</h2><p class="muted">Aguarde a confirmação do Asaas.</p>';
          try{
            const result=await IntornaCloud.createSubscription(ctx,id,method.value);const c=result.checkout||{};
            let extra='';
            if(c.pixEncodedImage)extra+=`<img alt="QR Code Pix" style="width:min(260px,100%);display:block;margin:16px auto;border-radius:12px" src="data:image/png;base64,${c.pixEncodedImage}">`;
            if(c.pixPayload)extra+=`<label>Pix Copia e Cola</label><textarea id="pixPayloadBox" readonly>${escapeHtml(c.pixPayload)}</textarea><button class="btn ghost" id="copyPixBtn">Copiar Pix</button>`;
            if(c.invoiceUrl)extra+=`<a class="btn gold" style="display:inline-block;text-decoration:none;margin-top:12px" href="${escapeHtml(c.invoiceUrl)}" target="_blank" rel="noopener">Abrir página de pagamento</a>`;
            checkoutBox.innerHTML=`<h2>Cobrança criada</h2><p>Plano <b>${escapeHtml(labels[id]||id)}</b>. O plano será liberado automaticamente após a confirmação do pagamento.</p>${c.dueDate?`<p class="muted">Vencimento: ${new Date(c.dueDate+'T12:00:00').toLocaleDateString('pt-BR')}</p>`:''}${extra||'<p class="muted">A cobrança foi criada. O link ficará disponível assim que o Asaas gerar a primeira mensalidade.</p>'}`;
            const cp=document.getElementById('copyPixBtn');if(cp)cp.onclick=async()=>{await navigator.clipboard.writeText(c.pixPayload);window.toast?.('Pix copiado.')};
          }catch(e){checkoutBox.innerHTML=`<h2>Não foi possível gerar a cobrança</h2><p>${escapeHtml(e.message||'Erro no pagamento.')}</p>`}
        };
        await refreshBilling();
      }
      await renderTickets();
      await installBilling();
    };
    script.onerror=()=>{loading.innerHTML='<div><h2>Falha ao abrir a área operacional.</h2><p>Atualize a página.</p></div>'};
    document.body.appendChild(script);
  }catch(e){console.error(e);loading.innerHTML=`<div><h2>Não foi possível carregar o estúdio.</h2><p>${escapeHtml(e.message||'Erro de conexão.')}</p><button onclick="location.href='/portal/'" style="padding:12px 20px;border:0;border-radius:10px;font-weight:800">Voltar ao login</button></div>`}
  function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
})();
