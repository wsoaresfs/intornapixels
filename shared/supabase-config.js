// Configuração pública do Supabase. Esta chave é publicável e protegida por RLS.
window.INTORNA_BACKEND = {
  supabaseUrl: 'https://sqeqehohwrfqtbdxcnfs.supabase.co',
  supabasePublishableKey: 'sb_publishable_uN4524408hXErU-OgTA9hA_XDQiPyvS'
};

/* =========================================================
   RC18 — MASTER DUAL
   Carrega os módulos extras sem alterar a estrutura antiga.
   ========================================================= */
(function(){
  'use strict';
  if(window.__INTORNA_RC18_LOADER__) return;
  window.__INTORNA_RC18_LOADER__ = true;

  const path = String(location.pathname || '/');
  let src = '';

  if(path.startsWith('/admin')){
    src = '/shared/rc18-master.js?v=18.0.0';
  }else if(path.startsWith('/app')){
    src = '/shared/rc18-studio.js?v=18.0.0';
  }

  if(!src) return;

  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.dataset.intornaRc18 = 'true';
  (document.head || document.documentElement).appendChild(s);
})();
