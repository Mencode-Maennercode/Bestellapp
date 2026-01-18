import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { AppSettings, defaultSettings, getSettings } from '@/lib/settings';

interface QRCodesPrintPanelProps {
  baseUrl?: string;
}

interface TableQR {
  tableNumber: number;
  code: string;
  qrDataUrl: string;
}

export default function QRCodesPrintPanel({ baseUrl = '' }: QRCodesPrintPanelProps) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [tables, setTables] = useState<TableQR[]>([]);
  const [loading, setLoading] = useState(true);
  const [startTable, setStartTable] = useState(1);
  const [endTable, setEndTable] = useState(44);
  const [generating, setGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await getSettings();
      setSettings(s);
    } catch (err) {
      console.error('Error loading settings:', err);
    }
    setLoading(false);
  };

  const generateQRCodes = async () => {
    setGenerating(true);
    const newTables: TableQR[] = [];
    
    for (let i = startTable; i <= endTable; i++) {
      const code = `T${i.toString().padStart(3, '0')}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      const url = `${baseUrl || window.location.origin}/tisch/${code}`;
      
      try {
        const qrDataUrl = await QRCode.toDataURL(url, {
          width: 200,
          margin: 1,
          color: {
            dark: settings.colors?.primaryTisch || '#009640',
            light: '#FFFFFF',
          },
        });
        
        newTables.push({
          tableNumber: i,
          code,
          qrDataUrl,
        });
      } catch (err) {
        console.error(`Error generating QR for table ${i}:`, err);
      }
    }
    
    setTables(newTables);
    setGenerating(false);
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup-Blocker verhindert das Öffnen. Bitte erlauben Sie Popups für diese Seite.');
      return;
    }

    const primaryColor = settings.colors?.primaryTisch || '#009640';
    const secondaryColor = settings.colors?.secondaryTisch || '#FFCC00';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR-Codes Tische ${startTable}-${endTable}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 10mm; }
          body { font-family: 'Inter', system-ui, sans-serif; }
          .page { 
            display: grid; 
            grid-template-columns: repeat(2, 1fr); 
            grid-template-rows: repeat(2, 1fr);
            gap: 10mm;
            height: 277mm;
            page-break-after: always;
          }
          .page:last-child { page-break-after: auto; }
          .qr-card {
            border: 3px solid ${primaryColor};
            border-radius: 12px;
            padding: 15px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
          }
          .table-number {
            font-size: 48px;
            font-weight: 800;
            color: ${primaryColor};
            margin-bottom: 10px;
          }
          .qr-image {
            width: 150px;
            height: 150px;
            margin: 10px 0;
          }
          .scan-text {
            font-size: 14px;
            color: #666;
            text-align: center;
            margin-top: 10px;
          }
          .code-text {
            font-family: monospace;
            font-size: 12px;
            color: #999;
            margin-top: 5px;
          }
          .header-bar {
            background: ${primaryColor};
            color: white;
            padding: 8px 15px;
            border-radius: 8px;
            font-weight: 600;
            margin-bottom: 10px;
          }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${Array.from({ length: Math.ceil(tables.length / 4) }, (_, pageIndex) => `
          <div class="page">
            ${tables.slice(pageIndex * 4, (pageIndex + 1) * 4).map(table => `
              <div class="qr-card">
                <div class="header-bar">Karneval Bestellsystem</div>
                <div class="table-number">Tisch ${table.tableNumber}</div>
                <img class="qr-image" src="${table.qrDataUrl}" alt="QR Code" />
                <div class="scan-text">Scannen zum Bestellen</div>
                <div class="code-text">${table.code}</div>
              </div>
            `).join('')}
          </div>
        `).join('')}
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white text-xl">Laden...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Range Selection */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <h3 className="text-lg font-semibold mb-3">📱 Tischbereich wählen</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Von Tisch</label>
            <input
              type="number"
              min="1"
              max="100"
              value={startTable}
              onChange={(e) => setStartTable(parseInt(e.target.value) || 1)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Bis Tisch</label>
            <input
              type="number"
              min="1"
              max="100"
              value={endTable}
              onChange={(e) => setEndTable(parseInt(e.target.value) || 44)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
            />
          </div>
        </div>
        <button
          onClick={generateQRCodes}
          disabled={generating}
          className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors"
        >
          {generating ? 'Generiere...' : '🔄 QR-Codes generieren'}
        </button>
      </div>

      {/* Preview */}
      {tables.length > 0 && (
        <>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">👁️ Vorschau</h3>
              <span className="text-sm text-slate-400">{tables.length} Tische • {Math.ceil(tables.length / 4)} Seiten</span>
            </div>
            <div ref={printRef} className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
              {tables.slice(0, 8).map(table => (
                <div 
                  key={table.tableNumber} 
                  className="bg-white rounded-lg p-3 flex flex-col items-center"
                  style={{ borderColor: settings.colors?.primaryTisch, borderWidth: 2 }}
                >
                  <div 
                    className="text-2xl font-bold"
                    style={{ color: settings.colors?.primaryTisch }}
                  >
                    Tisch {table.tableNumber}
                  </div>
                  <img src={table.qrDataUrl} alt={`QR ${table.tableNumber}`} className="w-20 h-20" />
                  <div className="text-xs text-gray-500 font-mono">{table.code}</div>
                </div>
              ))}
            </div>
            {tables.length > 8 && (
              <p className="text-sm text-slate-400 text-center mt-2">
                + {tables.length - 8} weitere Tische
              </p>
            )}
          </div>

          <button
            onClick={handlePrint}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold text-lg transition-colors"
          >
            🖨️ QR-Codes drucken (4 pro Seite)
          </button>
        </>
      )}

      {/* Info */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <h4 className="font-semibold mb-2">ℹ️ Hinweise</h4>
        <ul className="text-sm text-slate-400 space-y-1">
          <li>• 4 QR-Codes pro A4-Seite</li>
          <li>• Farben basieren auf den Einstellungen</li>
          <li>• Jeder Code ist einzigartig pro Generierung</li>
          <li>• Druckqualität: Am besten auf dickerem Papier</li>
        </ul>
      </div>
    </div>
  );
}
