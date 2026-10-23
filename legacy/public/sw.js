const CACHE_NAME = 'karneval-kellner-v1';
const urlsToCache = [
  '/kellner',
  '/manifest.json',
];

// Install service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Handle push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Neue Bestellung eingegangen!',
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    vibrate: [500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500],
    tag: 'new-order',
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Öffnen' },
      { action: 'dismiss', title: 'Schließen' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('🍺 Neue Bestellung!', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('/kellner') && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/kellner');
        }
      })
    );
  }
});

// Listen for messages from the app to trigger notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NEW_ORDER') {
    const { tableNumber, orderType, total } = event.data;
    
    const title = orderType === 'waiter_call' 
      ? `🙋 Tisch ${tableNumber} ruft!`
      : `🍺 Neue Bestellung Tisch ${tableNumber}`;
    
    const body = orderType === 'waiter_call'
      ? 'Kellner wird gerufen - Tippe zum Öffnen'
      : `${total} € - Tippe zum Öffnen`;
    
    const options = {
      body,
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      vibrate: [500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500],
      tag: 'order-' + Date.now(),
      requireInteraction: true,
      silent: false,
      actions: [
        { action: 'open', title: 'Öffnen' },
        { action: 'dismiss', title: 'Später' }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

// Background sync for when online again
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});

async function syncOrders() {
  // Re-fetch orders when back online
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_ORDERS' });
  });
}
