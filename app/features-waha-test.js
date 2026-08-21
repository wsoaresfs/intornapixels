/*
 * Compatibilidade RC19.
 * O antigo módulo experimental WAHA foi desativado.
 * Mantemos este arquivo apenas para impedir 404 em instalações antigas
 * que ainda tentem carregá-lo pelo bootstrap legado.
 */
(()=>{
  'use strict';
  window.IntornaWahaLegacyTest = Object.freeze({
    disabled: true,
    replacedBy: 'RC19 Realtime Hardened'
  });
})();
