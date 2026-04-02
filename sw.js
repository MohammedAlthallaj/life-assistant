// ═══════════════════════════════════════════════════════════════════════════
// LIFE ASSISTANT - SERVICE WORKER
// ═══════════════════════════════════════════════════════════════════════════
// Issue #7 Fix: Creates missing service worker to prevent console errors
// and enable offline functionality + background notifications

const CACHE_NAME = 'life-assistant-v1.1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Store Supabase credentials received from main thread
let sbCredentials = null;

// ─── INSTALL ─────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS).catch(err => {
          // Don't fail install if some assets aren't available
          console.warn('[SW] Some assets failed to cache:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ─── FETCH (Network-first with cache fallback) ───────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip cross-origin requests (Supabase API, fonts, CDN)
  if (url.origin !== location.origin) return;
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone and cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// ─── MESSAGE HANDLER (Receive credentials from main app) ─────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SB_CREDS') {
    sbCredentials = {
      url: event.data.url,
      key: event.data.key
    };
    console.log('[SW] Received Supabase credentials');
  }
});

// ─── PERIODIC SYNC (Check reminders in background) ───────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkReminders());
  }
});

async function checkReminders() {
  if (!sbCredentials) {
    console.log('[SW] No Supabase credentials, skipping reminder check');
    return;
  }
  
  try {
    const now = new Date().toISOString();
    const response = await fetch(
      `${sbCredentials.url}/rest/v1/notes?is_reminder=eq.true&completed=eq.false&reminder_date=lte.${now}&select=id,content,reminder_date`,
      {
        headers: {
          'apikey': sbCredentials.key,
          'Authorization': `Bearer ${sbCredentials.key}`
        }
      }
    );
    
    if (!response.ok) return;
    
    const notes = await response.json();
    
    for (const note of notes) {
      await self.registration.showNotification('📋 Reminder', {
        body: note.content,
        icon: '/icon.svg',
        tag: `reminder-${note.id}`,
        requireInteraction: true,
        data: { noteId: note.id }
      });
    }
  } catch (err) {
    console.error('[SW] Reminder check failed:', err);
  }
}

// ─── NOTIFICATION CLICK ──────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Focus existing window or open new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Try to focus existing window
        for (const client of windowClients) {
          if (client.url.includes(location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// ─── PUSH NOTIFICATIONS (Future-ready) ───────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'You have a notification',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.tag || 'default',
      data: data.data || {}
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Life Assistant', options)
    );
  } catch (err) {
    console.error('[SW] Push handling failed:', err);
  }
});

console.log('[SW] Service Worker loaded - Life Assistant v1.1');
