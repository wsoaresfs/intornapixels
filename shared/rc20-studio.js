(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
function styles(){
 if($('#rc20StudioStyles'))return;
 const s=document.createElement('style');s.id='rc20StudioStyles';s.textContent=`
 .rc20-master-banner{border:1px solid rgba(245,158,11,.28);background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(124,58,237,.07));border-radius:16px;padding:14px;margin-bottom:16px}
 .rc20-master-pill{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:950}
 #sales-radar .ip19-wrap{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:14px!important;width:100%!important;min-width:0!important}
 #sales-radar .ip19-wrap>*{width:100%!important;min-width:0!important;max-width:none!important;grid-column:1/-1!important}
 #sales-radar .ip19-kpis{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:10px!important;width:100%!important}
 #sales-radar .ip19-tabs{display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:flex-start!important;flex-wrap:wrap!important;width:100%!important}
 #sales-radar .ip19-panel{width:100%!important;min-width:0!important}
 @media(max-width:1100px){#sales-radar .ip19-kpis{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
 @media(max-width:700px){#sales-radar .ip19-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}#sales-radar .ip19-tab{flex:1 1 calc(50% - 7px)!important;text-align:center!important}}
 @media(max-width:430px){#sales-radar .ip19-kpis{grid-template-columns:1fr!important}#sales-radar .ip19-tab{flex:1 1 100%!important}}
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
     b.innerHTML=`<div class="row" style="justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><span class="rc20-master-pill">👑 MASTER • MEU ESTÚDIO • RC21</span><h2 style="margin:8px 0 4px">Produção + vendas + entrega</h2><p class="muted" style="margin:0">Seu estúdio agora inclui o Motor Automático de Ensaios IA.</p></div><button class="btn outline" id="rc20BackPlatform">🏢 Plataforma</button></div>`;
     dash.prepend(b);$('#rc20BackPlatform').onclick=goPlatform;
   }
   const side=$('#sidePlan');if(side&&!ctx.impersonating&&!/Master/i.test(side.textContent))side.textContent=`${side.textContent} • Master`;
 }
 window.IntornaRC20Studio={version:'21.0.0',goPlatform};
 return true;
}
let tries=0;const boot=setInterval(()=>{tries++;if(install()||tries>120)clearInterval(boot)},250);
})();
