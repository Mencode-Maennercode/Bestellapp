import React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import TablePreviewModal from './TablePreviewModal';
import DynamicTableModal from './DynamicTableModal';

interface SystemPrepModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SystemPrepModal: React.FC<SystemPrepModalProps> = ({ isOpen, onClose }) => {
  const [showTablePreview, setShowTablePreview] = useState(false);
  const [showDynamicTables, setShowDynamicTables] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto text-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-600">⚙️ Systemvorbereitung</h2>
          <button
            onClick={onClose}
            className="text-3xl text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-6">
          {/* QR-Codes */}
          <div className="border-2 border-evm-yellow rounded-xl p-4">
            <h3 className="text-xl font-semibold text-evm-yellow mb-3">📱 Tische & QR-Codes verwalten</h3>
            <p className="text-gray-600 mb-4">
              Generiere dynamische Tische mit individuellen QR-Codes. Lege die Anzahl fest und erstelle neue Tische.
            </p>
            <button
              onClick={() => setShowDynamicTables(true)}
              className="inline-block px-6 py-3 bg-evm-yellow text-black rounded-xl font-bold hover:bg-yellow-600 transition-all"
            >
              🪑 Tische verwalten
            </button>
          </div>
          
          {/* Kellner/Tisch Vorschau */}
          <div className="border-2 border-teal-200 rounded-xl p-4">
            <h3 className="text-xl font-semibold text-teal-700 mb-3">👥 Kellner/Tisch - Vorschau</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-teal-600 mb-2">👤 Kellner-Ansicht</h4>
                <p className="text-gray-600 mb-3">
                  Mobile Ansicht für Kellner zur Verwaltung ihrer zugewiesenen Tische.
                </p>
                <Link
                  href="/kellner"
                  target="_blank"
                  className="inline-block px-6 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-all mr-3"
                >
                  Kellner-Ansicht öffnen
                </Link>
              </div>
              
              <div className="border-2 border-teal-200 rounded-xl p-4">
                <h4 className="font-semibold text-teal-600 mb-2">🪑 Tisch-Demo</h4>
                <p className="text-gray-600 mb-3">
                  Beispiel-Tisch mit QR-Code zum Testen der Bestellfunktion.
                </p>
                <button
                  onClick={() => setShowTablePreview(true)}
                  className="inline-block px-6 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-all"
                >
                  🪑 Demo-Tisch öffnen
                </button>
              </div>
            </div>
          </div>
          
          {/* System-Checkliste */}
          <div className="bg-gray-100 rounded-xl p-4">
            <h4 className="font-semibold text-gray-700 mb-3">✅ System-Checkliste:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>QR-Codes gedruckt und platziert</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Kellner über System informiert</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Preise und Produkte konfiguriert</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Test-Bestellungen durchgeführt</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Notfall-Stopp getestet</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Bar-Ansicht funktioniert</span>
                </div>
              </div>
            </div>
          </div>

          {/* Zukünftige Funktionen */}
          <div className="border-2 border-gray-200 rounded-xl p-4 opacity-60">
            <h3 className="text-xl font-semibold text-gray-700 mb-3">🎨 Sprache / Farbe / Logo</h3>
            <p className="text-gray-600 mb-4">
              Anpassung des Erscheinungsbildes und der Sprache für deine Veranstaltung.
            </p>
            <div className="text-sm text-gray-500">
              <p>• Spracheinstellungen (Deutsch / Kölsch)</p>
              <p>• Farbschema und Theme-Anpassung</p>
              <p>• Logo und Branding hochladen</p>
              <p>• Schriftarten und Layout-Optionen</p>
              <p className="font-semibold mt-2 text-purple-600">Demnächst verfügbar...</p>
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
      
      {/* Table Preview Modal */}
      <TablePreviewModal 
        isOpen={showTablePreview} 
        onClose={() => setShowTablePreview(false)} 
      />
      
      {/* Dynamic Table Modal */}
      <DynamicTableModal 
        isOpen={showDynamicTables} 
        onClose={() => setShowDynamicTables(false)} 
      />
    </div>
  );
};

export default SystemPrepModal;
