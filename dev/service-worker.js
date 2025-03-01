try {
  importScripts('./log-utils.js');
} catch (e) {
  console.error('Failed to import log-utils.js:', e);
}

const SW_VERSION = '1.0.51';

// Cache names with proper versioning
const CACHE_VERSION = '1.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;

// Resources to precache
const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './offline.html',
  './images/logo.png',
  './images/lib.png',
  './lib.js',
  './network.js',
  './log-utils.js',
  './noble-post-quantum.js',
  './noble-secp256k1.js',
  './noble-ciphers.js',
  './blake2b.js',
  './keccak256.js',
  './stringify-shardus.js',
  './qrcode.js',
  './liberdus_logo_50.png',
  './liberdus_logo_250.png'
];

// Simplified state management
const state = {
    pollInterval: null,
    timestamp: null,
    account: null,
    lastPollTime: 0,
    notifiedChats: new Set()
};

// Install event - set up caching
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing, version:', CACHE_VERSION);
  
  event.waitUntil(
    (async () => {
      try {
        // Open cache
        const cache = await caches.open(STATIC_CACHE);
        console.log('[Service Worker] Cache opened');

        // Try to precache resources
        try {
          await cache.addAll(PRECACHE_URLS);
          console.log('[Service Worker] Precaching complete');
        } catch (precacheError) {
          console.warn('[Service Worker] Precaching failed, will try individual resources:', precacheError);
          
          // If bulk precaching fails, try individual resources
          const precachePromises = PRECACHE_URLS.map(async (url) => {
            try {
              const response = await fetch(url);
              await cache.put(url, response);
              console.log(`[Service Worker] Cached: ${url}`);
            } catch (err) {
              console.warn(`[Service Worker] Failed to cache: ${url}`, err);
              // Don't throw - continue with other resources
            }
          });

          await Promise.allSettled(precachePromises);
        }

        // Check what we managed to cache
        const cachedKeys = await cache.keys();
        console.log('[Service Worker] Cached resources:', cachedKeys.map(req => req.url));

      } catch (error) {
        console.error('[Service Worker] Cache initialization failed:', error);
        // Don't throw - allow installation even if caching fails
      }
    })()
  );

  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating new service worker');

  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter(cacheName => {
              return cacheName.startsWith('static-') && cacheName !== STATIC_CACHE ||
                     cacheName.startsWith('dynamic-') && cacheName !== DYNAMIC_CACHE ||
                     cacheName.startsWith('data-') && cacheName !== DATA_CACHE;
            })
            .map(cacheName => {
              console.log('[Service Worker] Removing old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );

        // Take control of all clients immediately
        await self.clients.claim();
        
        // Verify cache contents after activation
        const cache = await caches.open(STATIC_CACHE);
        const cachedKeys = await cache.keys();
        console.log('[Service Worker] Available cached resources:', 
          cachedKeys.map(req => req.url));

      } catch (error) {
        console.error('[Service Worker] Activation tasks failed:', error);
        // Don't throw - allow activation even if cleanup fails
      }
    })()
  );
});

// Helper function to determine caching strategy based on request
function getCacheStrategy(request) {
  const url = new URL(request.url);
  
  // Static assets - Cache First
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    PRECACHE_URLS.includes(url.pathname)
  ) {
    return 'cache-first';
  }
  
  // API endpoints - Network First
  if (url.pathname.startsWith('/api/')) {
    return 'network-first';
  }
  
  // HTML navigation - Cache First for offline support
  if (request.mode === 'navigate') {
    return 'cache-first';
  }
  
  // Default to network first
  return 'network-first';
}

// Fetch event - handle caching strategies
self.addEventListener('fetch', (event) => {
  const strategy = getCacheStrategy(event.request);
  
  switch (strategy) {
    case 'cache-first':
      event.respondWith(cacheFirst(event.request));
      break;
    case 'network-first':
      event.respondWith(networkFirst(event.request));
      break;
    default:
      event.respondWith(networkFirst(event.request));
  }
});

// Cache-First Strategy
async function cacheFirst(request) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    
    if (cached) {
      console.log('[Service Worker] Serving from cache:', request.url);
      return cached;
    }
    
    // If not in cache, try network
    try {
      const response = await fetch(request);
      // Cache the new response
      cache.put(request, response.clone());
      return response;
    } catch (error) {
      console.warn('[Service Worker] Network fetch failed:', error);
      // If offline and resource not in cache, return offline fallback
      if (request.mode === 'navigate') {
        const offlinePage = await cache.match('./offline.html');
        if (offlinePage) {
          return offlinePage;
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('[Service Worker] Cache-first strategy failed:', error);
    throw error;
  }
}

// Network-First Strategy
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    // Only cache GET requests
    if (request.method === 'GET') {
      try {
        const cache = await caches.open(DYNAMIC_CACHE);
        await cache.put(request, response.clone());
      } catch (cacheError) {
        console.warn('[Service Worker] Failed to cache response:', cacheError);
        // Continue even if caching fails
      }
    }
    
    return response;
  } catch (error) {
    console.warn('[Service Worker] Network request failed:', error);
    
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // If offline and no cache, return offline fallback for navigation
    if (request.mode === 'navigate') {
      const offlineFallback = await caches.match('./offline.html');
      if (offlineFallback) {
        return offlineFallback;
      }
    }
    
    throw error;
  }
}

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  } else if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }
});

// Handle messages from the client
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Error handling and logging
self.addEventListener('error', (event) => {
  console.error('[Service Worker] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[Service Worker] Unhandled rejection:', event.reason);
});

function startPolling() {
    if (state.pollInterval) return;
    
    console.log('Starting message polling');
    Logger.log('Starting message polling');
    state.pollInterval = setInterval(checkForNewMessages, 60000);
    checkForNewMessages();
}

function stopPolling() {
    if (state.pollInterval) {
        clearInterval(state.pollInterval);
        Object.assign(state, {
            pollInterval: null,
            timestamp: null,
            account: null,
            lastPollTime: 0,
            notifiedChats: new Set()
        });
        console.log('[Service Worker] Stopped message polling');
        Logger.log('[Service Worker] Stopped message polling');
    }
}

// Utility function to ensure address is 64 characters
function longAddress(addr) {
    return addr.padEnd(64, '0');
}

async function checkForNewMessages() {
    try {
        if (!state.timestamp || !state.account) {
            console.log('❌ No poll timestamp or account data');
            Logger.warn('Message polling failed: No timestamp or account data');
            return;
        }

        const { address, network } = state.account;
        if (!address || !network?.gateways?.length) {
            console.log('❌ Invalid account configuration');
            return;
        }

        // Get random gateway
        const gateway = network.gateways[Math.floor(Math.random() * network.gateways.length)];
        const paddedAddress = address.padEnd(64, '0');
        
        // Query for new messages
        const url = `${gateway.protocol}://${gateway.host}:${gateway.port}/account/${paddedAddress}/chats/${state.lastPollTime || state.timestamp}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Network response failed: ${response.status}`);

        const { chats } = await response.json();
        if (!chats) return;

        // Track new chats
        const newChats = new Set(
            Object.values(chats).filter(chatId => !state.notifiedChats.has(chatId))
        );

        if (newChats.size > 0) {
            await showNotification(newChats.size);
            Logger.log('New messages received:', { count: newChats.size });
            newChats.forEach(chatId => state.notifiedChats.add(chatId));
            state.lastPollTime = parseInt(state.timestamp);
        }

    } catch (error) {
        console.error('❌ Error checking messages:', error);
        Logger.error('Message polling error:', error.message);
    }
}

async function showNotification(chatCount) {
    if (self.Notification?.permission !== 'granted') {
        Logger.warn('Notification permission not granted');
        return;
    }

    try {
        const notificationText = chatCount === 1 
            ? 'You have new messages in a conversation'
            : `You have new messages in ${chatCount} conversations`;

        await self.registration.showNotification('New Messages', {
            body: notificationText,
            icon: './liberdus_logo_250.png',
            badge: './liberdus_logo_250.png',
            tag: 'new-messages',
            renotify: true
        });
        console.log('✅ Notification sent successfully');
        Logger.log('Notification sent:', { chatCount });
    } catch (error) {
        console.error('❌ Error showing notification:', error);
        Logger.error('Notification error:', error.message);
    }
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    // Focus existing window or open new one
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            for (const client of clientList) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

self.addEventListener('terminate', event => {
  event.waitUntil(Logger.forceSave());
});
