import Link from 'next/link';

interface WaiterPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WaiterPreviewModal: React.FC<WaiterPreviewModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 max-w-2xl w-full text-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-teal-600">👥 Kellner/Tisch - Vorschau</h2>
          <button
            onClick={onClose}
            className="text-3xl text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-6">
          {/* Kellner Ansicht */}
          <div className="border-2 border-teal-200 rounded-xl p-4">
            <h3 className="text-xl font-semibold text-teal-700 mb-3">👤 Kellner-Ansicht</h3>
            <p className="text-gray-600 mb-4">
              Mobile Ansicht für Kellner zur Verwaltung ihrer zugewiesenen Tische.
            </p>
            <Link
              href="/kellner"
              target="_blank"
              className="inline-block px-6 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-all"
            >
              Kellner-Ansicht öffnen
            </Link>
          </div>
          
          {/* Tisch Vorschau (Platzhalter) */}
          <div className="border-2 border-gray-200 rounded-xl p-4 opacity-60">
            <h3 className="text-xl font-semibold text-gray-700 mb-3">🪑 Tisch-Vorschau</h3>
            <p className="text-gray-600 mb-4">
              Vorschau der Gäste-Ansicht für verschiedene Tische.
            </p>
            <div className="text-sm text-gray-500">
              <p>• Tabelle mit allen 44 Tischen</p>
              <p>• QR-Code Vorschau pro Tisch</p>
              <p>• Live-Vorschau der Bestellseite</p>
              <p className="font-semibold mt-2 text-teal-600">Demnächst verfügbar...</p>
            </div>
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

export default WaiterPreviewModal;
