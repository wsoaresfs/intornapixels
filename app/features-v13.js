(()=>{
'use strict';
if(window.__INTORNA_RC22_VALIDATION_LOADER__)return;
window.__INTORNA_RC22_VALIDATION_LOADER__=true;
function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=reject;document.body.appendChild(s)})}
(async()=>{try{
 if(!window.__INTORNA_RC19__)await load('/app/features-v19.js?v=22v-base');
 if(!window.__INTORNA_RC20__)await load('/app/features-v20.js?v=22v-base');
 await load('/app/features-v21-validation.js?v=22v-identity');
 await load('/app/features-v22-validation.js?v=22v1');
}catch(e){console.error('RC22 validation loader',e);window.toast?.('Falha ao carregar RC22 de validação.')}})();
})();
