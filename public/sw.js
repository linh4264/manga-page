/**
 * DriveManga Service Worker (PWA & Offline Support)
 * Manages App Shell caching, offline navigation fallback, and offline chapter image delivery.
 */

const STATIC_CACHE = 'drivemanga-shell-v1';
const OFFLINE_CHAPTERS_CACHE = 'drivemanga-offline-chapters-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.webmanifest',
  '/Credit.webp'
];

// Install: Pre-cache static App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pre-caching some assets failed:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== OFFLINE_CHAPTERS_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy dispatcher
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests and Firebase Realtime WebSocket / REST POST
  if (request.method !== 'GET') return;

  // 1. Check if requested image is in Offline Chapters Cache
  if (
    url.hostname.includes('googleusercontent.com') ||
    url.hostname.includes('drive.google.com') ||
    url.hostname.includes('wsrv.nl') ||
    url.pathname.includes('/api/image-proxy') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.avif')
  ) {
    event.respondWith(
      caches.open(OFFLINE_CHAPTERS_CACHE).then(async (chapterCache) => {
        const cachedResponse = await chapterCache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Check if query parameter has Google Drive file ID to match across proxy/CDN formats
        let fileId = url.searchParams.get('id');
        if (!fileId && url.searchParams.has('url')) {
          try {
            const innerUrl = new URL(url.searchParams.get('url'));
            fileId = innerUrl.searchParams.get('id');
          } catch (e) {}
        }
        if (fileId) {
          const matchedFallback = await chapterCache.match(`https://lh3.googleusercontent.com/d/${fileId}=w1600`);
          if (matchedFallback) {
            return matchedFallback;
          }
        }

        // Try network, but don't fail hard if offline
        try {
          return await fetch(request);
        } catch {
          // If offline and image not downloaded, return 503 response
          return new Response('Offline - Image not cached', { status: 503, statusText: 'Offline' });
        }
      })
    );
    return;
  }

  // 2. Navigation Request (SPA HTML Shell fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/index.html').then((res) => res || caches.match('/'));
      })
    );
    return;
  }

  // 3. Static Assets (CSS, JS, Fonts) - Stale While Revalidate
  if (
    url.origin === self.location.origin ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then((networkRes) => {
          if (networkRes.ok) {
            cache.put(request, networkRes.clone());
          }
          return networkRes;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
