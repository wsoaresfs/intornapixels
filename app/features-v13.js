(()=>{
'use strict';
if(window.__INTORNA_RC21_VALIDATION_LOADER__)return;
window.__INTORNA_RC21_VALIDATION_LOADER__=true;
function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=reject;document.body.appendChild(s)})}
(async()=>{try{
 if(!window.__INTORNA_RC19__)await load('/app/features-v19.js?v=21v-base');
 if(!window.__INTORNA_RC20__)await load('/app/features-v20.js?v=21v-base');
 await load('/app/features-v21-validation.js?v=21v1');
}catch(e){console.error('RC21 validation loader',e);window.toast?.('Falha ao carregar RC21 de validação.')}})();
})();
