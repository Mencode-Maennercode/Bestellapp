import { useState, useEffect, useRef } from 'react';
import { getAllTableCodes } from '@/lib/tables';
import QRCode from 'qrcode';

interface TableQR {
  tableNumber: number;
  code: string;
  dataUrl: string;
}

export default function QRCodesPage() {
  const [tableQRs, setTableQRs] = useState<TableQR[]>([]);
  const [baseUrl, setBaseUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Set default base URL from current location
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const generateQRCodes = async () => {
    if (!baseUrl) return;
    
    setIsGenerating(true);
    const tables = getAllTableCodes();
    const qrs: TableQR[] = [];

    for (const table of tables) {
      const url = `${baseUrl}/tisch/${table.code}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#009640',
          light: '#FFFFFF',
        },
      });
      qrs.push({
        tableNumber: table.tableNumber,
        code: table.code,
        dataUrl,
      });
    }

    setTableQRs(qrs);
    setIsGenerating(false);
  };

  const printAll = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header - hidden in print */}
      <div className="bg-evm-green text-white p-6 print:hidden">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">📱 QR-Codes generieren</h1>
          
          <div className="bg-white/10 rounded-xl p-4 mb-4">
            <label className="block text-sm mb-2">Basis-URL (deine Vercel-Domain)</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://deine-app.vercel.app"
              className="w-full p-3 rounded-lg text-black text-lg"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={generateQRCodes}
              disabled={isGenerating || !baseUrl}
              className="px-6 py-3 bg-evm-yellow text-black rounded-xl font-bold disabled:opacity-50"
            >
              {isGenerating ? 'Generiere...' : '🔄 QR-Codes generieren'}
            </button>
            
            {tableQRs.length > 0 && (
              <button
                onClick={printAll}
                className="px-6 py-3 bg-white text-evm-green rounded-xl font-bold"
              >
                🖨️ Alle drucken
              </button>
            )}
          </div>
        </div>
      </div>

      {/* QR Codes Grid */}
      <div className="max-w-6xl mx-auto p-6">
        {tableQRs.length === 0 ? (
          <div className="text-center py-20 print:hidden">
            <p className="text-2xl text-gray-500 mb-4">
              Gib deine Vercel-URL ein und klicke auf "QR-Codes generieren"
            </p>
            <p className="text-gray-400">
              Die QR-Codes werden dann für alle 44 Tische erstellt
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 print:grid-cols-2 print:gap-4">
            {tableQRs.map((qr) => (
              <div 
                key={qr.code} 
                className="bg-white rounded-xl p-4 shadow-lg text-center print:shadow-none print:border print:border-gray-300 print:break-inside-avoid"
              >
                <div className="bg-evm-yellow rounded-lg p-2 mb-3">
                  <p className="text-4xl font-black text-evm-green">
                    Tisch {qr.tableNumber}
                  </p>
                </div>
                <img 
                  src={qr.dataUrl} 
                  alt={`QR Code Tisch ${qr.tableNumber}`}
                  className="mx-auto mb-2"
                />
                <p className="text-sm text-gray-500 font-mono">{qr.code}</p>
                <p className="text-xs text-gray-400 mt-2">
                  Scannen zum Bestellen
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 1cm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
