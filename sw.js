// Life Assistant v2.0 - Couples Edition Service Worker
const CACHE_NAME = 'life-assistant-v2';
const ASSETS = [
  '/',
  '/index.html',
  'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Sora:wght@300;400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js'
];

// Install
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  
  // Network-first for API calls
  if (e.request.url.includes('supabase.co') || e.request.url.includes('aladhan.com')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  
  // Cache-first for assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

// Push notifications
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'Life Assistant', body: 'Time to check in!' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'reminder',
      data: data
    })
  );
});

// Notification click
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('life-assistant') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', e => {
  if (e.tag === 'sync-checkins') {
    e.waitUntil(syncPendingCheckins());
  }
});

async function syncPendingCheckins() {
  // Sync any pending offline changes when back online
  const pending = await getPendingChanges();
  for (const change of pending) {
    try {
      await fetch(change.url, {
        method: change.method,
        headers: change.headers,
        body: JSON.stringify(change.body)
      });
      await removePendingChange(change.id);
    } catch (e) {
      console.error('Sync failed:', e);
    }
  }
}

function getPendingChanges() {
  return new Promise(resolve => {
    // In a real implementation, this would read from IndexedDB
    resolve([]);
  });
}

function removePendingChange(id) {
  return Promise.resolve();
}
