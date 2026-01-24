import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, push, onValue, remove, set, get } from 'firebase/database';
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const database = getDatabase(app);

// Firebase Cloud Messaging for push notifications
let messaging: Messaging | null = null;

// Initialize messaging only on client side and if supported
async function initializeMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  
  try {
    const supported = await isSupported();
    if (!supported) {
      console.log('FCM not supported in this browser');
      return null;
    }
    
    if (!messaging) {
      messaging = getMessaging(app);
    }
    return messaging;
  } catch (error) {
    console.error('Error initializing FCM:', error);
    return null;
  }
}

// Get FCM token for push notifications
export async function getFCMToken(): Promise<string | null> {
  try {
    const msg = await initializeMessaging();
    if (!msg) return null;
    
    // Register service worker first
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    
    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }
    
    // Get FCM token
    const token = await getToken(msg, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration
    });
    
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

// Listen for foreground messages
export function onForegroundMessage(callback: (payload: any) => void): () => void {
  let unsubscribe = () => {};
  
  initializeMessaging().then(msg => {
    if (msg) {
      unsubscribe = onMessage(msg, (payload) => {
        console.log('Foreground message received:', payload);
        callback(payload);
      });
    }
  });
  
  return () => unsubscribe();
}

// Save FCM token for a waiter to Firebase
export async function saveWaiterFCMToken(waiterName: string, token: string): Promise<void> {
  try {
    const tokenRef = ref(database, `fcmTokens/${waiterName}`);
    await set(tokenRef, {
      token,
      updatedAt: Date.now(),
      platform: navigator.userAgent.includes('Android') ? 'android' : 
                navigator.userAgent.includes('iPhone') ? 'ios' : 'web'
    });
    console.log('FCM token saved for waiter:', waiterName);
  } catch (error) {
    console.error('Error saving FCM token:', error);
  }
}

// Remove FCM token when waiter logs out
export async function removeWaiterFCMToken(waiterName: string): Promise<void> {
  try {
    const tokenRef = ref(database, `fcmTokens/${waiterName}`);
    await remove(tokenRef);
  } catch (error) {
    console.error('Error removing FCM token:', error);
  }
}

export { database, ref, push, onValue, remove, set, get, firebaseConfig };
