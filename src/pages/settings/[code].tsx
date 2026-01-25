import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const ADMIN_CODE = process.env.NEXT_PUBLIC_ADMIN_CODE || 'V26K';

const SettingsPageContent = dynamic(() => import('../../components/SettingsPageContent'), { ssr: false });

export default function ProtectedSettingsPage() {
  const router = useRouter();
  const { code } = router.query;
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!code) return;
    
    if (code === ADMIN_CODE) {
      setAuthorized(true);
    }
    setChecking(false);
  }, [code]);

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Laden...</div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-white text-2xl font-bold mb-2">Zugang verweigert</h1>
          <p className="text-gray-400">Ungültiger Zugangslink.</p>
        </div>
      </div>
    );
  }

  return <SettingsPageContent />;
}
