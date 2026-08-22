(()=>{
'use strict';
if(window.__INTORNA_RC21_LOADER__)return;
window.__INTORNA_RC21_LOADER__=true;
function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=reject;document.body.appendChild(s)})}
(async()=>{
  try{
    if(!window.__INTORNA_RC19__)await load('/app/features-v19.js?v=21.0.0-base');
    if(!window.__INTORNA_RC20__)await load('/app/features-v20.js?v=21.0.0-base');
    await load('/app/features-v21.js?v=21.0.0');
    window.toast?.('RC21 • Identity First + Flow Bridge pronto.');
  }catch(e){
    console.error('RC21 loader',e);
    window.toast?.('Não foi possível carregar a RC21. Atualize a página.');
  }
})();
})();
