const CACHE_NAME = 'rift-v77';

// Seiten und Assets die gecacht werden sollen
const PRECACHE_URLS = [
  './',
  './index.html',
  './charakterbogen.html',
  './wuerfel.html',
  './chat.html',
  './karte.html',
  './notizen.html',
  './whiteboard.html',
  './login.html',
  './gm-options.html',
  './404.html',
  './manifest.json',
  './assets/css/design-tokens.css',
  './assets/css/global.css',
  './assets/js/lang.js',
  './assets/js/i18n.js',
  './assets/js/nav.js',
  './assets/js/firebase-sync.js',
  './assets/js/auth.js',
  './assets/icons/icon_favicon.png',
  './assets/icons/icon_character.png',
  './assets/icons/icon_dice.png',
  './assets/icons/icon_chat.png',
  './assets/icons/icon_map.png',
  './assets/icons/icon_notes.png',
  './assets/icons/icon_whiteboard.png',
  './assets/icons/icon_home.png'
];

// Install - Cache alle wichtigen Dateien
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate - Alte Caches löschen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - Cache-First für Assets, Network-First für API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip Firebase und externe Requests
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis') ||
      !url.hostname.includes(self.location.hostname)) {
    return;
  }
  
  // Cache-First Strategie
  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) {
          // Im Hintergrund aktualisieren
          fetch(event.request).then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response);
              });
            }
          }).catch(() => {});
          return cached;
        }
        
        // Nicht im Cache - Netzwerk
        return fetch(event.request).then((response) => {
          if (response.ok && event.request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
  );
});
