import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useRef, useEffect } from 'react';

const Footer = () => {
  const router = useRouter();
  const isBarPage = router.pathname.startsWith('/bar');
  const impressumLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showDeveloperPinModal, setShowDeveloperPinModal] = useState(false);
  const [developerPin, setDeveloperPin] = useState('');
  const [developerPinError, setDeveloperPinError] = useState(false);

  // Handler for impressum long press (only on bar pages)
  const handleImpressumLongPressStart = () => {
    if (!isBarPage) return;
    
    impressumLongPressTimerRef.current = setTimeout(() => {
      setShowDeveloperPinModal(true);
      setDeveloperPin('');
      setDeveloperPinError(false);
    }, 800); // 800ms long press
  };

  const handleImpressumLongPressEnd = () => {
    if (impressumLongPressTimerRef.current) {
      clearTimeout(impressumLongPressTimerRef.current);
      impressumLongPressTimerRef.current = null;
    }
  };

  // Handler for developer PIN confirmation
  const handleDeveloperPinConfirm = () => {
    if (developerPin === '1265') {
      setDeveloperPinError(false);
      setShowDeveloperPinModal(false);
      setDeveloperPin('');
      // Open developer statistics in new window
      const ADMIN_CODE = process.env.NEXT_PUBLIC_ADMIN_CODE || 'V26K';
      const developerStatsUrl = `${window.location.origin}/developer-statistics/${ADMIN_CODE}`;
      window.open(developerStatsUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
    } else {
      setDeveloperPinError(true);
      setTimeout(() => setDeveloperPinError(false), 2000);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (impressumLongPressTimerRef.current) {
        clearTimeout(impressumLongPressTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <footer className="bg-gray-800 text-white py-4 px-4 mt-8 pb-safe">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center text-sm">
          <div className="mb-2 sm:mb-0">
            © 2026 Karneval Bestellsystem
          </div>
          <div className="flex space-x-4">
            {isBarPage ? (
              <span 
                className="hover:text-gray-300 transition-colors cursor-pointer select-none"
                onMouseDown={handleImpressumLongPressStart}
                onMouseUp={handleImpressumLongPressEnd}
                onMouseLeave={handleImpressumLongPressEnd}
                onTouchStart={handleImpressumLongPressStart}
                onTouchEnd={handleImpressumLongPressEnd}
              >
                Impressum
              </span>
            ) : (
              <Link href="/impressum" className="hover:text-gray-300 transition-colors">
                Impressum
              </Link>
            )}
            <Link href="/datenschutz" className="hover:text-gray-300 transition-colors">
              Datenschutz
            </Link>
          </div>
        </div>
      </footer>

      {/* Developer PIN Modal */}
      {showDeveloperPinModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-gray-900 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-3xl mx-auto mb-4">
                🔧
              </div>
              <h2 className="text-2xl font-bold mb-2">Entwickler-Zugang</h2>
              <p className="text-gray-600 text-sm">
                Gib den Entwickler-PIN ein, um die Statistik-Seite zu öffnen.
              </p>
            </div>
            
            <div className="mb-6">
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={developerPin}
                  onChange={(e) => {
                    setDeveloperPin(e.target.value);
                    setDeveloperPinError(false);
                  }}
                  placeholder="••••"
                  className={`w-full p-4 text-3xl text-center border-2 rounded-xl font-mono transition-all ${
                    developerPinError 
                      ? 'border-red-500 bg-red-50 text-red-600' 
                      : 'border-gray-300 bg-gray-50 focus:border-purple-500 focus:bg-white'
                  }`}
                  maxLength={4}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleDeveloperPinConfirm()}
                />
                {developerPinError && (
                  <div className="absolute -top-6 left-0 right-0 text-center">
                    <span className="text-red-500 text-sm font-medium">❌ Falscher PIN!</span>
                  </div>
                )}
              </div>
              
              {/* PIN Indicators */}
              <div className="flex justify-center gap-2 mt-4">
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className={`w-3 h-3 rounded-full transition-all ${
                      developerPin.length > index 
                        ? (developerPinError ? 'bg-red-500' : 'bg-purple-500') 
                        : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeveloperPinModal(false);
                  setDeveloperPin('');
                  setDeveloperPinError(false);
                }}
                className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDeveloperPinConfirm}
                disabled={developerPin.length !== 4}
                className={`flex-1 px-6 py-4 text-white rounded-xl font-bold transition-all ${
                  developerPin.length !== 4 
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                🔧 Öffnen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Footer;
