// Life Assistant — Service Worker v2.0
// Handles: caching, push notifications, periodic background sync

const CACHE = 'life-v2';
const PRECACHE = [
  '/',
  '/index.html',
  'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Sora:wght@300;400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js'
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH ─────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.url.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => new Response('offline', { status: 503 })));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// ── CREDENTIALS STORE (sent from app via postMessage) ─────────
let SB_URL = '';
let SB_KEY = '';

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SB_CREDS') {
    SB_URL = e.data.url;
    SB_KEY = e.data.key;
  }
});

// ── SUPABASE HELPER (minimal fetch-based, no SDK needed) ──────
async function sbQuery(table, filters = '') {
  if (!SB_URL || !SB_KEY) return [];
  const url = `${SB_URL}/rest/v1/${table}?${filters}`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

async function sbPatch(table, id, body) {
  if (!SB_URL || !SB_KEY) return;
  await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(body)
  }).catch(() => {});
}

// ── CHECK & FIRE DUE REMINDERS ─────────────────────────────────
async function checkReminders() {
  const now = new Date().toISOString();
  // Get all unread, uncompleted reminders whose time has passed
  const due = await sbQuery(
    'notes',
    `is_reminder=eq.true&completed=eq.false&reminder_date=lte.${encodeURIComponent(now)}&select=id,content,reminder_date`
  );
  for (const note of due) {
    await self.registration.showNotification('⏰ Reminder', {
      body: note.content,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `reminder-${note.id}`,     // prevents duplicates
      renotify: false,
      data: { noteId: note.id, url: '/' },
      actions: [
        { action: 'done', title: '✅ Mark Done' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    });
  }
  return due.length;
}

// ── PERIODIC BACKGROUND SYNC (Android Chrome) ─────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-reminders') {
    e.waitUntil(checkReminders());
  }
});

// ── PUSH (future server-sent push) ────────────────────────────
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'Life Assistant', body: 'You have a reminder.' };
  e.waitUntil(
    self.registration.showNotification(data.title || '⏰ Reminder', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'push-' + Date.now(),
      data: { url: data.url || '/' }
    })
  );
});

// ── NOTIFICATION CLICK ─────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();

  if (e.action === 'done' && e.notification.data?.noteId) {
    // Mark completed in Supabase
    e.waitUntil(sbPatch('notes', e.notification.data.noteId, { completed: true }));
  }

  // Open / focus the app
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow(e.notification.data?.url || '/');
    })
  );
});
