// Configuração pública do Supabase. Esta chave é publicável e protegida por RLS.
window.INTORNA_BACKEND = {
  supabaseUrl: 'https://sqeqehohwrfqtbdxcnfs.supabase.co',
  supabasePublishableKey: 'sb_publishable_uN4524408hXErU-OgTA9hA_XDQiPyvS'
};

(function(){
  'use strict';
  if(window.__INTORNA_RC22_SHARED_LOADER__) return;
  window.__INTORNA_RC22_SHARED_LOADER__ = true;
  const path=String(location.pathname||'/');
  let src='';
  if(path.startsWith('/admin')) src='/shared/rc20-master.js?v=22.0.2';
  else if(path.startsWith('/app')) src='/shared/rc20-studio.js?v=22.0.2';
  if(!src) return;
  const s=document.createElement('script');
  s.src=src;s.async=true;s.dataset.intornaRc22='true';
  s.onerror=()=>console.warn('Intorná RC22: módulo complementar não carregado:',src);
  (document.head||document.documentElement).appendChild(s);
})();
