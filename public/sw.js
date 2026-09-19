/**
 * Service Worker Oficial do Quinzena App (CARD-075)
 * Suporte a PWA, Instalação Nativa, Cache do App Shell Offline e Blindagem Rigorosa de CSP.
 */

const isLocalhost = Boolean(
  self.location.hostname === 'localhost' ||
  self.location.hostname === '[::1]' ||
  self.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

if (isLocalhost) {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.claim())
    );
  });
  self.addEventListener('fetch', () => {});
} else {
const CACHE_VERSION = 'quinzena-v2.1.0';
const APP_SHELL_CACHE = `quinzena-shell-${CACHE_VERSION}`;

// Recursos essenciais do App Shell cacheados no install para disponibilidade offline
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/icon.svg'
];

// Instalação: Pré-cache resiliente dos arquivos essenciais do App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then(async (cache) => {
        await Promise.allSettled(
          PRECACHE_ASSETS.map((asset) =>
            cache.add(asset).catch((err) =>
              console.warn(`[SW] Aviso ao pré-cachear ${asset}:`, err)
            )
          )
        );
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Pré-cache parcial do App Shell:', err);
        return self.skipWaiting();
      })
  );
});

// Ativação: Limpeza atômica de versões antigas e reivindicação imediata dos clientes
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('quinzena-') && name !== APP_SHELL_CACHE)
          .map((name) => {
            console.info('[SW] Purgando cache legado:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições com Blindagem de CSP e Isolamento Estrito de Origem
self.addEventListener('fetch', (event) => {
  // 1. Apenas requisições GET
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // 2. ISOLAMENTO RESTRITO: Nunca interceptar chamadas externas de terceiros!
  // Google Auth, AdSense, GTM, Analytics, APIs externas e avatares (lh3.googleusercontent.com)
  // seguem direto pela rede sem virar fetch() no SW, evitando violações de CSP connect-src.
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. Ignora rotas de proxy ou API
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 4. Navegações de página (SPA Navigation): Network First com Fallback garantido para /index.html em cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Tenta a rede primeiro (Network First) para obter a versão mais recente da aplicação
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.ok) {
            try {
              const cache = await caches.open(APP_SHELL_CACHE);
              await cache.put('/index.html', networkResponse.clone());
            } catch (cacheErr) {
              console.warn('[SW] Aviso ao atualizar /index.html no cache:', cacheErr);
            }
            return networkResponse;
          }

          // Se a rede respondeu com status não-ok (ex: 404/500), tenta o index.html em cache
          const cache = await caches.open(APP_SHELL_CACHE);
          const cachedIndex = (await cache.match('/index.html')) || (await cache.match('/'));
          if (cachedIndex) {
            return cachedIndex;
          }
          return networkResponse;
        } catch (fetchErr) {
          // Falha de rede (offline, abort, conexão instável): recupera App Shell do cache
          try {
            const cache = await caches.open(APP_SHELL_CACHE);
            const cachedIndex = (await cache.match('/index.html')) || (await cache.match('/'));
            if (cachedIndex) {
              return cachedIndex;
            }

            // Se não estiver em cache, tenta buscar diretamente /index.html da rede
            const directIndex = await fetch('/index.html');
            if (directIndex && directIndex.ok) {
              return directIndex;
            }
          } catch (fallbackErr) {
            console.warn('[SW] Fallback de navegação offline esgotado:', fallbackErr);
          }

          // Resposta offline garantida: NUNCA resolve com undefined para evitar TypeError
          return new Response(
            '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Quinzena — Offline</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;padding:40px 20px;font-family:system-ui,-apple-system,sans-serif;background:#0e1512;color:#f5f2e9;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;}h1{font-size:1.5rem;margin-bottom:12px;color:#34d399;}p{color:#a0b0a8;margin-bottom:24px;max-width:400px;line-height:1.5;}button{padding:12px 24px;background:#173F35;border:1px solid #34d399;border-radius:8px;color:#f5f2e9;font-weight:600;font-size:1rem;cursor:pointer;}</style></head><body><h1>Quinzena Offline</h1><p>Não foi possível carregar a página no momento. Verifique sua conexão com a internet.</p><button onclick="window.location.reload()">Tentar novamente</button></body></html>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
          );
        }
      })()
    );
    return;
  }

  // 5. Assets estáticos do App Shell (JS, CSS, Imagens locais, SVGs): Stale-While-Revalidate com Fallback Seguro
  event.respondWith(
    (async () => {
      try {
        const cachedResponse = await caches.match(event.request);

        const fetchPromise = fetch(event.request)
          .then(async (networkResponse) => {
            if (
              networkResponse &&
              networkResponse.ok &&
              (networkResponse.type === 'basic' || networkResponse.type === 'default')
            ) {
              try {
                const cache = await caches.open(APP_SHELL_CACHE);
                await cache.put(event.request, networkResponse.clone());
              } catch (e) {
                // Silenciosamente ignora erros de quota de cache
              }
            }
            return networkResponse;
          })
          .catch((networkErr) => {
            console.warn('[SW] Falha de rede para asset:', event.request.url, networkErr);
            return null;
          });

        if (cachedResponse) {
          // Se já está no cache, entrega imediatamente e revalida em background
          event.waitUntil(fetchPromise);
          return cachedResponse;
        }

        // Não estava no cache: aguarda a busca na rede
        const networkResponse = await fetchPromise;
        if (networkResponse) {
          return networkResponse;
        }

        // Se nem o cache nem a rede retornaram resposta, retorna erro HTTP válido
        // NUNCA retorna undefined para não violar o contrato de event.respondWith
        return new Response('Asset indisponível offline', {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      } catch (fatalError) {
        console.error('[SW] Erro crítico ao processar asset:', fatalError);
        return new Response('Erro interno do Service Worker', {
          status: 500,
          statusText: 'Internal Error',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })()
  );
});

// Listener de mensagens para ativação sob demanda
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
}

