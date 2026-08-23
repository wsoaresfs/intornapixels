(()=>{
'use strict';
if(window.__INTORNA_RC22_LOADER__)return;
window.__INTORNA_RC22_LOADER__=true;
function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=reject;document.body.appendChild(s)})}
(async()=>{
  try{
    if(!window.__INTORNA_RC19__)await load('/app/features-v19.js?v=22.0.0-base');
    if(!window.__INTORNA_RC20__)await load('/app/features-v20.js?v=22.0.0-base');
    await load('/app/features-v22.js?v=22.0.1');
    await load('/app/features-v22-creative.js?v=22.3.1');
    await load('/app/features-v24-beta.js?v=22.4.0');
    await load('/app/features-v25-catalogs.js?v=22.5.0');
    window.toast?.('RC22.5 Beta • Catálogos de amostra prontos para compartilhar.');
  }catch(e){
    console.error('RC22 loader',e);
    window.toast?.('Não foi possível carregar a RC22. Atualize a página.');
  }
})();
})();
