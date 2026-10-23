// Push for waiters (FCM web push). Deliberately tiny and without the Firebase SDK:
// it only shows the notification and opens the waiter view on tap.
// While the waiter view is visible, the page rings its own full-screen alarm instead.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

const waiterUrl = () => new URL('kellner/', self.registration.scope).href;

self.addEventListener('push', event => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch {
    /* not JSON */
  }
  const n = msg.notification || {};
  const data = msg.data || {};

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windows.some(w => w.visibilityState === 'visible' && w.url.startsWith(waiterUrl()))) return;
      await self.registration.showNotification(n.title || 'Neue Bestellung', {
        body: n.body || '',
        tag: data.orderId ? `order-${data.orderId}` : 'order',
        renotify: true,
        requireInteraction: true,
        icon: new URL('icon-192.png', self.registration.scope).href,
        vibrate: [300, 100, 300, 100, 300],
        data: { url: waiterUrl() },
      });
    })(),
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || waiterUrl();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find(w => w.url.startsWith(url));
      if (open) return open.focus();
      return self.clients.openWindow(url);
    })(),
  );
});
