(()=>{
'use strict';
if(window.__INTORNA_RC19_LOADER__)return;
window.__INTORNA_RC19_LOADER__=true;
const s=document.createElement('script');
s.src='/app/features-v19.js?v=19.0.0';
s.async=false;
s.onload=()=>{window.toast?.('Central de Vendas RC19 pronta.');};
s.onerror=()=>{console.error('RC19: falha ao carregar features-v19.js');window.toast?.('Não foi possível carregar a Central de Vendas. Atualize a página.');};
document.body.appendChild(s);
})();
