// Configuração pública do Supabase. Esta chave é publicável e protegida por RLS.
window.INTORNA_BACKEND = {
  supabaseUrl: 'https://sqeqehohwrfqtbdxcnfs.supabase.co',
  supabasePublishableKey: 'sb_publishable_uN4524408hXErU-OgTA9hA_XDQiPyvS'
};

/* =========================================================
   RC19 — REALTIME HARDENED / MASTER DUAL
   Loader separado do loader operacional da Central RC19.
   ========================================================= */
(function(){
  'use strict';
  if(window.__INTORNA_RC19_SHARED_LOADER__) return;
  window.__INTORNA_RC19_SHARED_LOADER__ = true;

  const path = String(location.pathname || '/');
  let src = '';

  if(path.startsWith('/admin')){
    src = '/shared/rc19-master.js?v=19.0.0';
  }else if(path.startsWith('/app')){
    src = '/shared/rc19-studio.js?v=19.0.0';
  }

  if(!src) return;
  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.dataset.intornaRc19Shared = 'true';
  s.onerror = () => console.warn('Intorná RC19: módulo complementar não carregado:', src);
  (document.head || document.documentElement).appendChild(s);
})();
