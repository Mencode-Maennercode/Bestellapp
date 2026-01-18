import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const ADMIN_CODE = 'A267';

const BarPageContent = dynamic(() => import('../bar'), { ssr: false });

export default function ProtectedBarPage() {
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f1419 0%, #1a1f26 100%)' }}>
        <div className="text-white text-xl">Laden...</div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f1419 0%, #1a1f26 100%)' }}>
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-white text-2xl font-bold mb-2">Zugang verweigert</h1>
          <p className="text-gray-400">Ungültiger Zugangslink.</p>
        </div>
      </div>
    );
  }

  // /bar/A267 = Haupttheke (index 0)
  return <BarPageContent thekeIndex={0} />;
}
