(()=>{
'use strict';

const VERSION='RC18';
const $=(s,r=document)=>r.querySelector(s);

function addStyles(){
  if($('#rc18StudioStyles')) return;
  const s=document.createElement('style');
  s.id='rc18StudioStyles';
  s.textContent=`
    .rc18-master-pill{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:900}
    .rc18-master-banner{border:1px solid rgba(245,158,11,.28);background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(124,58,237,.07));border-radius:16px;padding:14px;margin-bottom:16px}
    .rc18-master-banner .row{justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
  `;
  document.head.appendChild(s);
}

function goPlatform(){
  location.href='/admin/';
}
window.rc18GoPlatform=goPlatform;

function install(){
  if(window.__INTORNA_RC18_STUDIO__) return true;
  const ctx=window.INTORNA_CTX;
  const top=$('.top-actions');
  const dash=$('#dashboard');
  if(!ctx || !top || !dash) return false;

  window.__INTORNA_RC18_STUDIO__=true;
  addStyles();

  if(!ctx.isAdmin) return true;

  const existing=[...top.querySelectorAll('button')].some(b=>/admin|plataforma/i.test(b.textContent||''));
  if(!existing){
    const btn=document.createElement('button');
    btn.className='btn outline';
    btn.textContent='🏢 Plataforma';
    btn.onclick=goPlatform;
    top.appendChild(btn);
  }

  if(!ctx.impersonating && !$('#rc18MasterBanner')){
    const banner=document.createElement('div');
    banner.id='rc18MasterBanner';
    banner.className='rc18-master-banner';
    banner.innerHTML=`
      <div class="row">
        <div>
          <span class="rc18-master-pill">👑 MASTER • MEU ESTÚDIO</span>
          <h2 style="margin:8px 0 4px">Seu ambiente de vendas de fotos</h2>
          <p class="muted" style="margin:0">Clientes, pedidos, ensaios, vendas extras, financeiro, Central de Vendas e WhatsApp ficam separados dos estúdios clientes da plataforma.</p>
        </div>
        <button class="btn outline" id="rc18BackPlatform">🏢 Voltar à Plataforma</button>
      </div>
    `;
    dash.prepend(banner);
    $('#rc18BackPlatform').onclick=goPlatform;
  }

  const sidePlan=$('#sidePlan');
  if(sidePlan && !ctx.impersonating){
    const original=sidePlan.textContent;
    if(!/Master/i.test(original)) sidePlan.textContent=`${original} • Master`;
  }

  window.IntornaRC18Studio={
    version:VERSION,
    isMaster:true,
    studioId:ctx.studioId,
    impersonating:!!ctx.impersonating,
    goPlatform
  };

  return true;
}

let tries=0;
const boot=setInterval(()=>{
  tries++;
  const ok=install();
  if(ok || tries>100) clearInterval(boot);
},250);

})();
