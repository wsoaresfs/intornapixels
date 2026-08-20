const CACHE = 'intorna-pixels-rc12-trafego-real';

const CORE = [
  '/',
  '/index.html',

  '/portal/',
  '/portal/index.html',

  '/admin/',
  '/admin/index.html',
  '/admin/admin.js',
  '/admin/styles.css',

  '/app/',
  '/app/index.html',
  '/app/app.js',
  '/app/bootstrap-cloud.js',

  '/app/features-v6.js',
  '/app/features-v7.js',
  '/app/features-v11.js',
  '/app/features-v12.js',

  '/app/features-waha-test.js',

  '/app/styles.css',
  '/app/styles-v6.css',
  '/app/styles-v7.css',
  '/app/features-v11.css',
  '/app/styles-waha-test.css',

  '/cliente/',
  '/cliente/index.html',
  '/cliente/portal.js',
  '/cliente/styles.css',

  '/shared/supabase-config.js',
  '/shared/cloud.js',
  '/shared/platform.js',
  '/shared/tenant-bridge.js',

  '/assets/logo.svg',
  '/assets/icon.svg',
  '/assets/logo-horizontal.png',

  '/manifest.webmanifest'
];


/* =========================================================
   INSTALAÇÃO
   ========================================================= */

self.addEventListener('install', event => {

  self.skipWaiting();

  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(CORE))
      .catch(error => {
        console.error(
          'Falha ao preparar cache RC12:',
          error
        );
      })
  );
});


/* =========================================================
   ATIVAÇÃO
   Remove caches antigos automaticamente
   ========================================================= */

self.addEventListener('activate', event => {

  event.waitUntil(

    Promise.all([

      self.clients.claim(),

      caches.keys().then(keys =>

        Promise.all(

          keys

            .filter(
              key => key !== CACHE
            )

            .map(
              key => caches.delete(key)
            )
        )
      )
    ])
  );
});


/* =========================================================
   NETWORK FIRST
   HTML / JS / CSS
   Evita RC antiga presa no navegador
   ========================================================= */

async function networkFirst(request) {

  try {

    const response =
      await fetch(
        request,
        {
          cache:'no-store'
        }
      );

    if(response && response.ok){

      const copy =
        response.clone();

      caches
        .open(CACHE)
        .then(
          cache =>
            cache.put(
              request,
              copy
            )
        )
        .catch(()=>{});
    }

    return response;

  } catch(error) {

    const cached =
      await caches.match(
        request
      );

    if(cached){
      return cached;
    }

    throw error;
  }
}


/* =========================================================
   CACHE FIRST
   Imagens e arquivos estáticos
   ========================================================= */

async function cacheFirst(request) {

  const cached =
    await caches.match(
      request
    );

  if(cached){
    return cached;
  }

  try {

    const response =
      await fetch(request);

    if(response && response.ok){

      const copy =
        response.clone();

      caches
        .open(CACHE)
        .then(
          cache =>
            cache.put(
              request,
              copy
            )
        )
        .catch(()=>{});
    }

    return response;

  } catch(error) {

    throw error;
  }
}


/* =========================================================
   FETCH
   ========================================================= */

self.addEventListener('fetch', event => {

  if(
    event.request.method !== 'GET'
  ){
    return;
  }

  const url =
    new URL(
      event.request.url
    );

  if(
    url.origin !==
    self.location.origin
  ){
    return;
  }


  /*
   * Navegação sempre tenta internet primeiro.
   */
  if(
    event.request.mode === 'navigate'
  ){

    event.respondWith(

      networkFirst(
        event.request
      ).catch(
        async()=>{

          return (
            await caches.match(
              event.request
            )
          )
          ||
          (
            await caches.match(
              '/portal/'
            )
          );
        }
      )
    );

    return;
  }


  /*
   * JS e CSS sempre tentam pegar a versão nova.
   */
  if(
    url.pathname.endsWith('.js')
    ||
    url.pathname.endsWith('.css')
    ||
    url.pathname.endsWith('.html')
    ||
    url.pathname.endsWith('.json')
    ||
    url.pathname.endsWith('.webmanifest')
  ){

    event.respondWith(
      networkFirst(
        event.request
      )
    );

    return;
  }


  /*
   * Imagens, SVG e demais arquivos estáticos
   * podem usar cache primeiro.
   */
  event.respondWith(
    cacheFirst(
      event.request
    )
  );
});
