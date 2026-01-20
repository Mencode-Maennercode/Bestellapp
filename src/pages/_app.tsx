import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Footer from '@/components/Footer';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isTischApp = router.pathname.startsWith('/tisch');
  
  useEffect(() => {
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        console.log('Service Worker registered:', registration.scope);
      }).catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
    }
  }, []);

  // Determine manifest and theme based on route
  const manifestPath = isTischApp ? '/manifest-tisch.json' : '/manifest.json';
  const themeColor = isTischApp ? '#FFA500' : '#009640';
  const appTitle = isTischApp ? 'Tisch' : 'Kellner';
  const appIcon = isTischApp ? '/icons/beer.png' : '/icons/waiters.png';

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content={themeColor} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={appTitle} />
        <link rel="manifest" href={manifestPath} />
        <link rel="apple-touch-icon" href={appIcon} />
        <link rel="icon" href={appIcon} />
        <title>Karneval Bestellsystem</title>
      </Head>
      <Component {...pageProps} />
      <Footer />
    </>
  );
}
