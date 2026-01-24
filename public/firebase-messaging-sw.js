// Firebase Messaging Service Worker for Push Notifications
// Using Firebase v10 compat for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Firebase configuration - hardcoded for service worker (env vars not available)
// These will be replaced at build time or you can hardcode them
const firebaseConfig = {
  apiKey: "AIzaSyBXkAeLoFdv_kDV5N1sYIqF6rKLuOWCL3Y",
  authDomain: "karneval-bestellsystem.firebaseapp.com",
  databaseURL: "https://karneval-bestellsystem-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "karneval-bestellsystem",
  storageBucket: "karneval-bestellsystem.appspot.com",
  messagingSenderId: "485865467408",
  appId: "1:485865467408:web:8c8f0e6e0e6e0e6e0e6e0e"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || '🍺 Neue Bestellung!';
  const notificationOptions = {
    body: payload.notification?.body || 'Eine neue Bestellung ist eingegangen.',
    icon: '/icons/waiters.png',
    badge: '/icons/waiters.png',
    // IMPORTANT: Long vibration pattern for background notifications
    vibrate: [500, 200, 500, 200, 500, 200, 500, 200, 500],
    tag: 'order-notification-' + Date.now(),
    requireInteraction: true, // Keep notification until user interacts
    renotify: true, // Vibrate again even if same tag
    silent: false, // Ensure sound plays
    data: payload.data,
    actions: [
      { action: 'open', title: '📱 Öffnen' },
      { action: 'dismiss', title: '❌ Später' }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event.action);
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // Open or focus the kellner page
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to find and focus existing kellner window
      for (const client of clientList) {
        if (client.url.includes('/kellner') && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        // Try to get the admin code from the notification data
        const adminCode = event.notification.data?.adminCode || 'V26K';
        return clients.openWindow('/kellner/' + adminCode);
      }
    })
  );
});

// Handle service worker installation
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker installed');
  self.skipWaiting();
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker activated');
  event.waitUntil(clients.claim());
});
