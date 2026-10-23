import React, { useState } from 'react';
import QRCode from 'qrcode';

interface TablePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TablePreviewModal: React.FC<TablePreviewModalProps> = ({ isOpen, onClose }) => {
  const [qrCode, setQrCode] = useState<string>('');

  // Demo table data
  const demoTable = {
    number: 'DEMO',
    code: 'DEMO123',
    name: 'Beispiel-Tisch'
  };

  const generateDemoQRCode = async () => {
    try {
      const baseUrl = window.location.origin;
      const tableUrl = `${baseUrl}/tisch/${demoTable.code}`;
      const qrDataUrl = await QRCode.toDataURL(tableUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCode(qrDataUrl);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }
  };

  const openLivePreview = () => {
    const baseUrl = window.location.origin;
    const tableUrl = `${baseUrl}/tisch/${demoTable.code}`;
    window.open(tableUrl, '_blank');
  };

  // Generate QR code when modal opens
  React.useEffect(() => {
    if (isOpen) {
      generateDemoQRCode();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-600">🪑 Tisch-Vorschau</h2>
          <button
            onClick={onClose}
            className="text-3xl text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-700 mb-6">🪑 Beispiel-Tisch Demo</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Demo Table Info */}
            <div className="border-2 border-blue-200 rounded-xl p-6">
              <h4 className="text-lg font-semibold text-blue-700 mb-4">📋 Tisch-Informationen</h4>
              <div className="space-y-3 text-left">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-600">Tisch-Nummer:</span>
                  <span className="font-bold text-blue-600">{demoTable.number}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-600">Tisch-Code:</span>
                  <span className="font-bold text-green-600">{demoTable.code}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-600">Typ:</span>
                  <span className="font-bold text-purple-600">{demoTable.name}</span>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <span className="font-semibold">💡 Hinweis:</span> Dies ist ein Demo-Tisch zum Testen der Bestellfunktion.
                </p>
              </div>
            </div>

            {/* QR Code and Preview */}
            <div className="border-2 border-green-200 rounded-xl p-6">
              <h4 className="text-lg font-semibold text-green-700 mb-4">📱 QR-Code & Vorschau</h4>
              {qrCode ? (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <img src={qrCode} alt="Demo QR Code" className="border-2 border-gray-300 rounded-lg" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-3">
                      Scanne den Code oder teste direkt:
                    </p>
                    <button
                      onClick={openLivePreview}
                      className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <span>🔗</span>
                      <span>Live-Demo öffnen</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">⏳</div>
                  <p className="text-gray-500">QR-Code wird generiert...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 rounded-xl p-4">
          <h4 className="font-semibold text-blue-800 mb-2">📖 Demo-Anleitung:</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-700">
            <div>
              <p className="font-semibold mb-1">1. Demo-Tisch:</p>
              <p>Verwende den Beispiel-Tisch "DEMO123"</p>
            </div>
            <div>
              <p className="font-semibold mb-1">2. QR-Code testen:</p>
              <p>Scanne den Code oder öffne direkt</p>
            </div>
            <div>
              <p className="font-semibold mb-1">3. Bestellen:</p>
              <p>Teste die komplette Bestellfunktion</p>
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

export default TablePreviewModal;
