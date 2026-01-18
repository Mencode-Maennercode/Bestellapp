import React, { useState } from 'react';
import QRCode from 'qrcode';
import { 
  createTables, 
  deleteAllTables, 
  getAllTables, 
  getAllTableCodes,
  type Table 
} from '@/lib/dynamicTables';

interface DynamicTableModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DynamicTableModal: React.FC<DynamicTableModalProps> = ({ isOpen, onClose }) => {
  const [tableCount, setTableCount] = useState<string>('44');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTables, setCurrentTables] = useState<Table[]>([]);
  const [qrCodes, setQrCodes] = useState<{ tableNumber: number; code: string; qrDataUrl: string }[]>([]);
  const [showQRs, setShowQRs] = useState(false);

  // Load current tables when modal opens
  React.useEffect(() => {
    if (isOpen) {
      loadCurrentTables();
    }
  }, [isOpen]);

  const loadCurrentTables = async () => {
    try {
      const tables = await getAllTables();
      setCurrentTables(tables);
    } catch (error) {
      console.error('Failed to load tables:', error);
    }
  };

  const generateNewTables = async () => {
    const count = parseInt(tableCount);
    if (isNaN(count) || count < 1 || count > 100) {
      alert('Bitte gib eine gültige Zahl zwischen 1 und 100 ein');
      return;
    }

    setIsGenerating(true);
    try {
      // Delete old tables and create new ones
      const newTables = await createTables(count);
      setCurrentTables(newTables);
      
      // Generate QR codes for all new tables
      const baseUrl = window.location.origin;
      const qrData = await Promise.all(
        newTables.map(async (table) => {
          const tableUrl = `${baseUrl}/tisch/${table.code}`;
          const qrDataUrl = await QRCode.toDataURL(tableUrl, {
            width: 150,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          return {
            tableNumber: table.number,
            code: table.code,
            qrDataUrl
          };
        })
      );
      
      setQrCodes(qrData);
      setShowQRs(true);
      
      alert(`✅ Erfolgreich ${count} neue Tische generiert!`);
    } catch (error) {
      console.error('Failed to generate tables:', error);
      alert('❌ Fehler beim Generieren der Tische');
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteAllTablesAndReset = async () => {
    if (!confirm('Bist du sicher? Alle Tische werden gelöscht und QR-Codes ungültig!')) {
      return;
    }

    setIsGenerating(true);
    try {
      await deleteAllTables();
      setCurrentTables([]);
      setQrCodes([]);
      setShowQRs(false);
      alert('✅ Alle Tische wurden gelöscht');
    } catch (error) {
      console.error('Failed to delete tables:', error);
      alert('❌ Fehler beim Löschen der Tische');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAllQRCodes = () => {
    // Create a temporary link to download all QR codes as a zip-like HTML page
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR-Codes für Tische</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .qr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
          .qr-item { text-align: center; border: 1px solid #ddd; padding: 10px; border-radius: 8px; }
          .qr-item img { max-width: 150px; }
          .table-number { font-weight: bold; font-size: 18px; margin: 10px 0; }
          .table-code { color: #666; font-family: monospace; }
        </style>
      </head>
      <body>
        <h1>QR-Codes für Tische (${new Date().toLocaleDateString('de-DE')})</h1>
        <div class="qr-grid">
          ${qrCodes.map(qr => `
            <div class="qr-item">
              <div class="table-number">Tisch ${qr.tableNumber}</div>
              <img src="${qr.qrDataUrl}" alt="QR Code for Table ${qr.tableNumber}" />
              <div class="table-code">${qr.code}</div>
            </div>
          `).join('')}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qr-codes-tische-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-600">🪑 Dynamische Tische Verwaltung</h2>
          <button
            onClick={onClose}
            className="text-3xl text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {!showQRs ? (
          <div className="space-y-6">
            {/* Current Status */}
            <div className="border-2 border-blue-200 rounded-xl p-4">
              <h3 className="text-xl font-semibold text-blue-700 mb-3">📊 Aktueller Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{currentTables.length}</div>
                  <div className="text-sm text-gray-600">Aktive Tische</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {currentTables.filter(t => t.isActive).length}
                  </div>
                  <div className="text-sm text-gray-600">Aktive Tische</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {currentTables.length > 0 ? Math.min(...currentTables.map(t => t.number)) : 0} - {currentTables.length > 0 ? Math.max(...currentTables.map(t => t.number)) : 0}
                  </div>
                  <div className="text-sm text-gray-600">Tisch-Nummern</div>
                </div>
              </div>
            </div>

            {/* Generate New Tables */}
            <div className="border-2 border-green-200 rounded-xl p-4">
              <h3 className="text-xl font-semibold text-green-700 mb-3">🆕 Neue Tische generieren</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Anzahl der Tische (1-100):
                  </label>
                  <input
                    type="number"
                    value={tableCount}
                    onChange={(e) => setTableCount(e.target.value)}
                    min="1"
                    max="100"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-white"
                    placeholder="z.B. 44"
                  />
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    <span className="font-semibold">⚠️ Achtung:</span> Beim Generieren neuer Tische werden alle alten Tische und deren QR-Codes ungültig!
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={generateNewTables}
                    disabled={isGenerating}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                  >
                    {isGenerating ? '🔄 Generiere...' : '🆕 Neue Tische generieren'}
                  </button>
                </div>
              </div>
            </div>

            {/* Delete All Tables */}
            <div className="border-2 border-red-200 rounded-xl p-4">
              <h3 className="text-xl font-semibold text-red-700 mb-3">🗑️ Alle Tische löschen</h3>
              <p className="text-gray-600 mb-4">
                Löscht alle aktuellen Tische und ihre QR-Codes. Diese Aktion kann nicht rückgängig gemacht werden!
              </p>
              <button
                onClick={deleteAllTablesAndReset}
                disabled={isGenerating || currentTables.length === 0}
                className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:bg-gray-400 transition-colors"
              >
                🗑️ Alle Tische löschen
              </button>
            </div>
          </div>
        ) : (
          /* QR Codes Display */
          <div className="space-y-6">
            <div className="border-2 border-purple-200 rounded-xl p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-purple-700">📱 Generierte QR-Codes</h3>
                <button
                  onClick={downloadAllQRCodes}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-colors"
                >
                  📥 Alle herunterladen
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-96 overflow-y-auto">
                {qrCodes.map((qr) => (
                  <div key={qr.tableNumber} className="text-center border border-gray-200 rounded-lg p-3">
                    <div className="font-bold text-gray-700 mb-2">Tisch {qr.tableNumber}</div>
                    <img src={qr.qrDataUrl} alt={`QR Code for Table ${qr.tableNumber}`} className="mx-auto mb-2" />
                    <div className="text-xs text-gray-500 font-mono">{qr.code}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowQRs(false)}
                className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 transition-colors"
              >
                🔧 Zurück zur Konfiguration
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
              >
                ✅ Fertig
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DynamicTableModal;
