import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { AppSettings, defaultSettings, getSettings } from '@/lib/settings';
import { 
  createTables, 
  deleteAllTables, 
  getAllTables, 
  getAllTableCodes,
  type Table 
} from '@/lib/dynamicTables';
import TablePreviewModal from './TablePreviewModal';

interface TablesManagementPanelProps {
  baseUrl?: string;
}

interface TableQR {
  tableNumber: number;
  code: string;
  qrDataUrl: string;
}

export default function TablesManagementPanel({ baseUrl = '' }: TablesManagementPanelProps) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [tables, setTables] = useState<TableQR[]>([]);
  const [loading, setLoading] = useState(true);
  const [startTable, setStartTable] = useState(1);
  const [endTable, setEndTable] = useState(10);
  const [generating, setGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Dynamic table management state
  const [tableCount, setTableCount] = useState<string>('');
  const [currentTables, setCurrentTables] = useState<Table[]>([]);
  const [dynamicQRCodes, setDynamicQRCodes] = useState<{ tableNumber: number; code: string; qrDataUrl: string }[]>([]);
  const [showDynamicQRs, setShowDynamicQRs] = useState(false);
  const [showTablePreview, setShowTablePreview] = useState(false);

  // Tab management
  const [activeTab, setActiveTab] = useState<'print' | 'manage' | 'preview'>('print');

  useEffect(() => {
    loadSettingsAndTables();
  }, []);

  const loadSettingsAndTables = async () => {
    try {
      const s = await getSettings();
      setSettings(s);
      // Load existing tables from database
      const existingTables = await getAllTables();
      setCurrentTables(existingTables);
    } catch (err) {
      console.error('Error loading settings:', err);
    }
    setLoading(false);
  };

  // QR Code generation for existing tables
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

  // Dynamic table management
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

    setGenerating(true);
    try {
      const newTables = await createTables(count);
      setCurrentTables(newTables);
      
      const baseUrl = window.location.origin;
      const qrData = await Promise.all(
        newTables.map(async (table) => {
          const tableUrl = `${baseUrl}/tisch/${table.code}`;
          const qrDataUrl = await QRCode.toDataURL(tableUrl, {
            width: 150,
            margin: 2,
            color: {
              dark: settings.colors?.primaryTisch || '#009640',
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
      
      setDynamicQRCodes(qrData);
      setShowDynamicQRs(true);
      
      alert(`✅ Erfolgreich ${count} neue Tische generiert!`);
    } catch (error) {
      console.error('Failed to generate tables:', error);
      alert('❌ Fehler beim Generieren der Tische');
    } finally {
      setGenerating(false);
    }
  };

  const deleteAllTablesAndReset = async () => {
    if (!confirm('Bist du sicher? Alle Tische werden gelöscht und QR-Codes ungültig!')) {
      return;
    }

    setGenerating(true);
    try {
      await deleteAllTables();
      setCurrentTables([]);
      setDynamicQRCodes([]);
      setShowDynamicQRs(false);
      alert('✅ Alle Tische wurden gelöscht');
    } catch (error) {
      console.error('Failed to delete tables:', error);
      alert('❌ Fehler beim Löschen der Tische');
    } finally {
      setGenerating(false);
    }
  };

  // Reprint existing tables
  const reprintExistingTables = async () => {
    if (currentTables.length === 0) {
      alert('❌ Keine Tische vorhanden. Bitte generiere zuerst Tische.');
      return;
    }

    setGenerating(true);
    try {
      const baseUrl = window.location.origin;
      const qrData = await Promise.all(
        currentTables.map(async (table) => {
          const tableUrl = `${baseUrl}/tisch/${table.code}`;
          const qrDataUrl = await QRCode.toDataURL(tableUrl, {
            width: 150,
            margin: 2,
            color: {
              dark: settings.colors?.primaryTisch || '#009640',
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
      
      setDynamicQRCodes(qrData);
      setShowDynamicQRs(true);
      
      alert(`✅ QR-Codes für ${currentTables.length} Tische bereit zum Drucken!`);
    } catch (error) {
      console.error('Failed to generate QR codes:', error);
      alert('❌ Fehler beim Generieren der QR-Codes');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    const tablesToPrint = dynamicQRCodes.length > 0 ? dynamicQRCodes : tables;
    if (tablesToPrint.length === 0) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup-Blocker verhindert das Öffnen. Bitte erlauben Sie Popups für diese Seite.');
      return;
    }

    const primaryColor = settings.colors?.primaryTisch || '#009640';
    const secondaryColor = settings.colors?.secondaryTisch || '#FFCC00';
    const logoUrl = settings.logo || 'https://www.energieschub.evm.de/media/ecb72371a2/1a53b5737ffd_180x180_boxed.jpg';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR-Codes Tische ${startTable}-${endTable}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 8mm; }
          body { font-family: 'Inter', system-ui, sans-serif; }
          .page { 
            display: grid; 
            grid-template-columns: repeat(2, 1fr); 
            grid-template-rows: repeat(2, 1fr);
            gap: 8mm;
            height: 281mm;
            page-break-after: always;
          }
          .page:last-child { page-break-after: auto; }
          .qr-card {
            border: 4px solid ${primaryColor};
            border-radius: 16px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            background: linear-gradient(180deg, ${primaryColor}15 0%, #ffffff 30%, #ffffff 100%);
            position: relative;
            overflow: hidden;
          }
          .logo-container {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 8px;
          }
          .logo {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            object-fit: cover;
            border: 3px solid ${primaryColor};
          }
          .table-number {
            font-size: 56px;
            font-weight: 900;
            color: ${primaryColor};
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
            line-height: 1;
          }
          .table-label {
            font-size: 18px;
            font-weight: 600;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 3px;
            margin-bottom: -5px;
          }
          .qr-image {
            width: 140px;
            height: 140px;
            margin: 8px 0;
            border-radius: 8px;
            border: 3px solid ${primaryColor};
            padding: 5px;
            background: white;
          }
          .scan-text {
            font-size: 16px;
            color: #333;
            text-align: center;
            font-weight: 600;
            background: ${secondaryColor};
            padding: 8px 20px;
            border-radius: 20px;
            margin-top: 5px;
          }
          .footer-text {
            font-size: 11px;
            color: #999;
            text-align: center;
            margin-top: 5px;
          }
          .corner-decoration {
            position: absolute;
            width: 30px;
            height: 30px;
            background: ${primaryColor};
          }
          .corner-tl { top: 0; left: 0; border-radius: 0 0 100% 0; }
          .corner-tr { top: 0; right: 0; border-radius: 0 0 0 100%; }
          .corner-bl { bottom: 0; left: 0; border-radius: 0 100% 0 0; }
          .corner-br { bottom: 0; right: 0; border-radius: 100% 0 0 0; }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${Array.from({ length: Math.ceil(tablesToPrint.length / 4) }, (_, pageIndex) => `
          <div class="page">
            ${tablesToPrint.slice(pageIndex * 4, (pageIndex + 1) * 4).map(table => `
              <div class="qr-card">
                <div class="corner-decoration corner-tl"></div>
                <div class="corner-decoration corner-tr"></div>
                <div class="corner-decoration corner-bl"></div>
                <div class="corner-decoration corner-br"></div>
                <div class="logo-container">
                  <img class="logo" src="${logoUrl}" alt="Logo" />
                </div>
                <div class="table-label">Tisch</div>
                <div class="table-number">${table.tableNumber}</div>
                <img class="qr-image" src="${table.qrDataUrl}" alt="QR Code" />
                <div class="scan-text">📱 Scannen zum Bestellen</div>
                <div class="footer-text">Fastelovend 2026</div>
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

  // Print function for dynamically generated QR codes
  const handlePrintDynamicQRCodes = () => {
    if (dynamicQRCodes.length === 0) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup-Blocker verhindert das Öffnen. Bitte erlauben Sie Popups für diese Seite.');
      return;
    }

    const primaryColor = settings.colors?.primaryTisch || '#009640';
    const secondaryColor = settings.colors?.secondaryTisch || '#FFCC00';
    const logoUrl = settings.logo || 'https://www.energieschub.evm.de/media/ecb72371a2/1a53b5737ffd_180x180_boxed.jpg';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR-Codes - ${dynamicQRCodes.length} Tische</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 8mm; }
          body { font-family: 'Inter', system-ui, sans-serif; }
          .page { 
            display: grid; 
            grid-template-columns: repeat(2, 1fr); 
            grid-template-rows: repeat(2, 1fr);
            gap: 8mm;
            height: 281mm;
            page-break-after: always;
          }
          .page:last-child { page-break-after: auto; }
          .qr-card {
            border: 4px solid ${primaryColor};
            border-radius: 16px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            background: linear-gradient(180deg, ${primaryColor}15 0%, #ffffff 30%, #ffffff 100%);
            position: relative;
            overflow: hidden;
          }
          .logo-container {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 8px;
          }
          .logo {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            object-fit: cover;
            border: 3px solid ${primaryColor};
          }
          .table-number {
            font-size: 56px;
            font-weight: 900;
            color: ${primaryColor};
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
            line-height: 1;
          }
          .table-label {
            font-size: 18px;
            font-weight: 600;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 3px;
            margin-bottom: -5px;
          }
          .qr-image {
            width: 140px;
            height: 140px;
            margin: 8px 0;
            border-radius: 8px;
            border: 3px solid ${primaryColor};
            padding: 5px;
            background: white;
          }
          .scan-text {
            font-size: 16px;
            color: #333;
            text-align: center;
            font-weight: 600;
            background: ${secondaryColor};
            padding: 8px 20px;
            border-radius: 20px;
            margin-top: 5px;
          }
          .footer-text {
            font-size: 11px;
            color: #999;
            text-align: center;
            margin-top: 5px;
          }
          .corner-decoration {
            position: absolute;
            width: 30px;
            height: 30px;
            background: ${primaryColor};
          }
          .corner-tl { top: 0; left: 0; border-radius: 0 0 100% 0; }
          .corner-tr { top: 0; right: 0; border-radius: 0 0 0 100%; }
          .corner-bl { bottom: 0; left: 0; border-radius: 0 100% 0 0; }
          .corner-br { bottom: 0; right: 0; border-radius: 100% 0 0 0; }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${Array.from({ length: Math.ceil(dynamicQRCodes.length / 4) }, (_, pageIndex) => `
          <div class="page">
            ${dynamicQRCodes.slice(pageIndex * 4, (pageIndex + 1) * 4).map(qr => `
              <div class="qr-card">
                <div class="corner-decoration corner-tl"></div>
                <div class="corner-decoration corner-tr"></div>
                <div class="corner-decoration corner-bl"></div>
                <div class="corner-decoration corner-br"></div>
                <div class="logo-container">
                  <img class="logo" src="${logoUrl}" alt="Logo" />
                </div>
                <div class="table-label">Tisch</div>
                <div class="table-number">${qr.tableNumber}</div>
                <img class="qr-image" src="${qr.qrDataUrl}" alt="QR Code" />
                <div class="scan-text">📱 Scannen zum Bestellen</div>
                <div class="footer-text">Fastelovend 2026</div>
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

  const downloadAllQRCodes = () => {
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
          ${dynamicQRCodes.map(qr => `
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white text-xl">Laden...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('print')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'print' 
              ? 'text-blue-400 border-b-2 border-blue-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          📱 QR-Codes drucken
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'manage' 
              ? 'text-blue-400 border-b-2 border-blue-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🪑 Tische verwalten
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'preview' 
              ? 'text-blue-400 border-b-2 border-blue-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          👁️ Tisch-Vorschau
        </button>
      </div>

      {/* Print QR Codes Tab */}
      {activeTab === 'print' && (
        <>
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
        </>
      )}

      {/* Manage Tables Tab */}
      {activeTab === 'manage' && (
        <div className="space-y-6">
          {/* Current Status */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h3 className="text-lg font-semibold mb-3 text-blue-400">📊 Aktueller Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-slate-700/50 rounded-lg">
                <div className="text-2xl font-bold text-blue-400">{currentTables.length}</div>
                <div className="text-sm text-slate-400">Aktive Tische</div>
              </div>
              <div className="text-center p-4 bg-slate-700/50 rounded-lg">
                <div className="text-2xl font-bold text-green-400">
                  {currentTables.filter(t => t.isActive).length}
                </div>
                <div className="text-sm text-slate-400">Aktive Tische</div>
              </div>
              <div className="text-center p-4 bg-slate-700/50 rounded-lg">
                <div className="text-2xl font-bold text-purple-400">
                  {currentTables.length > 0 ? Math.min(...currentTables.map(t => t.number)) : 0} - {currentTables.length > 0 ? Math.max(...currentTables.map(t => t.number)) : 0}
                </div>
                <div className="text-sm text-slate-400">Tisch-Nummern</div>
              </div>
            </div>
          </div>

          {!showDynamicQRs ? (
            <>
              {/* Generate New Tables */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <h3 className="text-lg font-semibold mb-3 text-green-400">🆕 Neue Tische generieren</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Anzahl der Tische (1-100):
                    </label>
                    <input
                      type="number"
                      value={tableCount}
                      onChange={(e) => setTableCount(e.target.value)}
                      min="1"
                      max="100"
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-white"
                      placeholder="z.B. 44"
                    />
                  </div>
                  
                  <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-3">
                    <p className="text-sm text-yellow-400">
                      <span className="font-semibold">⚠️ Achtung:</span> Beim Generieren neuer Tische werden alle alten Tische und deren QR-Codes ungültig!
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={generateNewTables}
                      disabled={generating}
                      className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-600 transition-colors"
                    >
                      {generating ? '🔄 Generiere...' : '🆕 Neue Tische generieren'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Reprint Existing Tables */}
              {currentTables.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <h3 className="text-lg font-semibold mb-3 text-purple-400">🖨️ QR-Codes erneut drucken</h3>
                  <p className="text-slate-300 mb-4">
                    Generiere die QR-Codes für alle {currentTables.length} bestehenden Tische erneut zum Drucken.
                  </p>
                  <button
                    onClick={reprintExistingTables}
                    disabled={generating}
                    className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:bg-gray-600 transition-colors"
                  >
                    🖨️ QR-Codes erneut generieren
                  </button>
                </div>
              )}

              {/* Delete All Tables */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <h3 className="text-lg font-semibold mb-3 text-red-400">🗑️ Alle Tische löschen</h3>
                <p className="text-slate-300 mb-4">
                  Löscht alle aktuellen Tische und ihre QR-Codes. Diese Aktion kann nicht rückgängig gemacht werden!
                </p>
                <button
                  onClick={deleteAllTablesAndReset}
                  disabled={generating || currentTables.length === 0}
                  className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:bg-gray-600 transition-colors"
                >
                  🗑️ Alle Tische löschen
                </button>
              </div>
            </>
          ) : (
            /* QR Codes Display */
            <div className="space-y-6">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-purple-400">📱 Generierte QR-Codes</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePrintDynamicQRCodes}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors"
                    >
                      🖨️ Drucken (4/Seite)
                    </button>
                    <button
                      onClick={downloadAllQRCodes}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-colors"
                    >
                      📥 HTML Download
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-96 overflow-y-auto">
                  {dynamicQRCodes.map((qr) => (
                    <div key={qr.tableNumber} className="text-center border border-slate-600 rounded-lg p-3">
                      <div className="font-bold text-slate-300 mb-2">Tisch {qr.tableNumber}</div>
                      <img src={qr.qrDataUrl} alt={`QR Code for Table ${qr.tableNumber}`} className="mx-auto mb-2" />
                      <div className="text-xs text-slate-500 font-mono">{qr.code}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDynamicQRs(false)}
                  className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 transition-colors"
                >
                  🔧 Zurück zur Konfiguration
                </button>
                <button
                  onClick={() => setShowDynamicQRs(false)}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                >
                  ✅ Fertig
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table Preview Tab */}
      {activeTab === 'preview' && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <h3 className="text-lg font-semibold mb-3 text-teal-400">👁️ Tisch-Demo</h3>
          <p className="text-slate-300 mb-4">
            Öffnet den Demo-Tisch zum Testen der Bestellfunktion.
          </p>
          <button
            onClick={() => window.open(`${window.location.origin}/tisch/DEMO123`, '_blank')}
            className="w-full px-6 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-all"
          >
            🪑 Demo-Tisch öffnen
          </button>
        </div>
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

      {/* Table Preview Modal */}
      <TablePreviewModal 
        isOpen={showTablePreview} 
        onClose={() => setShowTablePreview(false)} 
      />
    </div>
  );
}
