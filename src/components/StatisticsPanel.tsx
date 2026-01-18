import { database, ref, set } from '@/lib/firebase';

interface TableStats {
  tableNumber: number;
  totalOrders: number;
  totalAmount: number;
  items: { [key: string]: { quantity: number; amount: number } };
}

interface Statistics {
  tables: { [key: number]: TableStats };
  totalAmount: number;
  totalOrders: number;
  itemTotals: { [key: string]: { quantity: number; amount: number } };
}

interface StatisticsPanelProps {
  statistics: Statistics;
  onClose?: () => void;
  onResetClick?: () => void;
}

export default function StatisticsPanel({ statistics, onClose, onResetClick }: StatisticsPanelProps) {

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2).replace('.', ',') + ' €';
  };

  const exportToCSV = () => {
    const csvContent = [
      ['Statistik Export', new Date().toLocaleDateString('de-DE')],
      [''],
      ['Zusammenfassung'],
      ['Gesamtbestellungen', statistics.totalOrders || 0],
      ['Gesamtumsatz (€)', (statistics.totalAmount / 100).toFixed(2)],
      [''],
      ['Top Produkte'],
      ['Produkt', 'Menge', 'Umsatz (€)'],
      ...sortedItems.map(([name, data]) => [
        name,
        data.quantity,
        (data.amount / 100).toFixed(2)
      ]),
      [''],
      ['Top Tische'],
      ['Tisch', 'Bestellungen', 'Umsatz (€)'],
      ...sortedTables.map((table) => [
        `Tisch ${table.tableNumber}`,
        table.totalOrders,
        (table.totalAmount / 100).toFixed(2)
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(';')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `statistiken_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sortedTables = Object.values(statistics.tables || {})
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const sortedItems = Object.entries(statistics.itemTotals || {})
    .sort((a, b) => b[1].quantity - a[1].quantity);

  return (
    <div className="space-y-6">
      {/* Action Buttons at the top */}
      <div className="pb-4 border-b border-gray-200">
        <div className="flex gap-3">
          {onResetClick && (
            <button
              onClick={onResetClick}
              className="flex-1 py-3 bg-red-600 text-white hover:bg-red-700 rounded-lg font-bold transition-colors"
            >
              🗑️ Statistiken zurücksetzen
            </button>
          )}
          <button
            onClick={exportToCSV}
            className="flex-1 py-3 bg-green-600 text-white hover:bg-green-700 rounded-lg font-bold transition-colors"
          >
            📊 CSV Export
          </button>
        </div>
        {onResetClick && <p className="text-xs text-gray-500 text-center mt-2">PIN geschützt</p>}
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-600/5 rounded-xl p-4 border border-blue-500/20">
          <div className="text-3xl font-bold text-blue-400">{statistics.totalOrders || 0}</div>
          <div className="text-sm text-slate-400">Bestellungen</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-600/5 rounded-xl p-4 border border-emerald-500/20">
          <div className="text-3xl font-bold text-emerald-400">{formatPrice(statistics.totalAmount || 0)}</div>
          <div className="text-sm text-slate-400">Gesamtumsatz</div>
        </div>
      </div>

      {/* Top Items */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <h3 className="text-lg font-semibold mb-3">🏆 Top Produkte</h3>
        {sortedItems.length > 0 ? (
          <div className="space-y-2">
            {sortedItems.slice(0, 10).map(([name, data], index) => (
              <div key={name} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="font-medium">{name}</span>
                </div>
                <div className="text-right">
                  <div className="font-bold">{data.quantity}x</div>
                  <div className="text-xs text-slate-400">{formatPrice(data.amount)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm italic">Keine Daten vorhanden</p>
        )}
      </div>

      {/* Top Tables */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <h3 className="text-lg font-semibold mb-3">🪑 Top Tische</h3>
        {sortedTables.length > 0 ? (
          <div className="space-y-2">
            {sortedTables.slice(0, 10).map((table, index) => (
              <div key={table.tableNumber} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="font-medium">Tisch {table.tableNumber}</span>
                </div>
                <div className="text-right">
                  <div className="font-bold">{formatPrice(table.totalAmount)}</div>
                  <div className="text-xs text-slate-400">{table.totalOrders} Bestellungen</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm italic">Keine Daten vorhanden</p>
        )}
      </div>

          </div>
  );
}
