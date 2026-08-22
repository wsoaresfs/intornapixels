(()=>{
'use strict';
if(window.__INTORNA_RC20_LOADER__)return;
window.__INTORNA_RC20_LOADER__=true;
function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=reject;document.body.appendChild(s)})}
(async()=>{
  try{
    if(!window.__INTORNA_RC19__)await load('/app/features-v19.js?v=20.0.0-base');
    await load('/app/features-v20.js?v=20.0.0');
    window.toast?.('RC20 • Motor Automático de Ensaios pronto.');
  }catch(e){
    console.error('RC20 loader',e);
    window.toast?.('Não foi possível carregar a RC20. Atualize a página.');
  }
})();
})();