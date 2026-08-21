(()=>{
'use strict';
/* RC19: ponte localStorage legada desativada. O multiestúdio oficial usa IntornaCloud/Supabase + RLS. */
window.IntornaTenantBridge={
  version:'RC19',
  legacyDisabled:true,
  async route(){return window.IntornaCloud?.route?.()}
};
})();