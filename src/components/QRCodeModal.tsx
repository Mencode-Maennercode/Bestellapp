import Link from 'next/link';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const ADMIN_CODE = process.env.NEXT_PUBLIC_ADMIN_CODE || 'V26K';

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 max-w-2xl w-full text-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-evm-yellow">📱 QR-Codes generieren</h2>
          <button
            onClick={onClose}
            className="text-3xl text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-6">
          <div className="border-2 border-evm-yellow rounded-xl p-4">
            <h3 className="text-xl font-semibold text-evm-yellow mb-3">QR-Code Generator</h3>
            <p className="text-gray-600 mb-4">
              Generiere QR-Codes für alle 44 Tische deiner Karnevalsveranstaltung.
            </p>
            <Link
              href={`/qrcodes/${ADMIN_CODE}`}
              target="_blank"
              className="inline-block px-6 py-3 bg-evm-yellow text-black rounded-xl font-bold hover:bg-yellow-600 transition-all"
            >
              QR-Code Generator öffnen
            </Link>
          </div>
          
          <div className="bg-gray-100 rounded-xl p-4">
            <h4 className="font-semibold text-gray-700 mb-2">📋 Funktionen:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 44 individuelle QR-Codes für alle Tische</li>
              <li>• Verschlüsselte Tisch-Codes zur Missbrauchsverhinderung</li>
              <li>• Druckoptimierte Ausgabe</li>
              <li>• Vorschau der QR-Codes vor dem Druck</li>
            </ul>
          </div>
        </div>
        
        <button
          onClick={onClose}
          className="w-full mt-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold text-xl"
        >
          Schließen
        </button>
      </div>
    </div>
  );
};

export default QRCodeModal;
