(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
function styles(){
 if($('#rc20StudioStyles'))return;
 const s=document.createElement('style');s.id='rc20StudioStyles';s.textContent=`
 .rc20-master-banner{border:1px solid rgba(245,158,11,.28);background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(124,58,237,.07));border-radius:16px;padding:14px;margin-bottom:16px}
 .rc20-master-pill{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:950}
 `;document.head.appendChild(s);
}
function goPlatform(){location.href='/admin/'}
function install(){
 if(window.__INTORNA_RC20_STUDIO__)return true;
 const ctx=window.INTORNA_CTX,top=$('.top-actions'),dash=$('#dashboard');
 if(!ctx||!top||!dash)return false;
 window.__INTORNA_RC20_STUDIO__=true;styles();
 if(ctx.isAdmin){
   if(![...top.querySelectorAll('button')].some(b=>/plataforma/i.test(b.textContent||''))){
     const b=document.createElement('button');b.className='btn outline';b.textContent='🏢 Plataforma';b.onclick=goPlatform;top.appendChild(b);
   }
   if(!ctx.impersonating&&!$('#rc20MasterBanner')){
     const b=document.createElement('div');b.id='rc20MasterBanner';b.className='rc20-master-banner';
     b.innerHTML='<div class="row"><div><span class="rc20-master-pill">👑 MASTER • MEU ESTÚDIO • RC20</span></div></div>';
     dash.prepend(b);
   }
 }
 return true;
}
let tries=0;const boot=setInterval(()=>{tries++;if(install()||tries>120)clearInterval(boot)},250);
})();