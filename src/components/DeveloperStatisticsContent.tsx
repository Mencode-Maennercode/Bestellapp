import React, { useState, useEffect } from 'react';
import { database, ref, onValue, set, get } from '@/lib/firebase';

interface Statistics {
  tables: { [key: number]: TableStats };
  totalAmount: number;
  totalOrders: number;
  itemTotals: { [key: string]: { quantity: number; amount: number } };
}

interface TableStats {
  tableNumber: number;
  totalOrders: number;
  totalAmount: number;
  items: { [key: string]: { quantity: number; amount: number } };
}

interface StatisticsHistory {
  timestamp: number;
  statistics: Statistics;
  resetBy?: string;
  resetReason?: string;
}

interface Rating {
  rating: number;
  name: string;
  email?: string;
  message?: string;
  timestamp: number;
  source: string;
  tableNumber?: string;
  tableCode?: string;
}

const DeveloperStatisticsContent: React.FC = () => {
  const [currentStatistics, setCurrentStatistics] = useState<Statistics>({
    tables: {},
    totalAmount: 0,
    totalOrders: 0,
    itemTotals: {}
  });
  const [statisticsHistory, setStatisticsHistory] = useState<StatisticsHistory[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);

  // Listen for current statistics
  useEffect(() => {
    const statsRef = ref(database, 'statistics');
    const unsubscribe = onValue(statsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCurrentStatistics(data);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error loading statistics:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Listen for statistics history
  useEffect(() => {
    const historyRef = ref(database, 'statisticsHistory');
    const unsubscribe = onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const historyArray: StatisticsHistory[] = Object.values(data);
        // Sort by timestamp descending (newest first)
        historyArray.sort((a, b) => b.timestamp - a.timestamp);
        setStatisticsHistory(historyArray);
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen for ratings
  useEffect(() => {
    const ratingsRef = ref(database, 'ratings');
    const unsubscribe = onValue(ratingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const ratingsArray: Rating[] = Object.values(data);
        // Sort by timestamp descending (newest first)
        ratingsArray.sort((a, b) => b.timestamp - a.timestamp);
        setRatings(ratingsArray);
      }
    });
    return () => unsubscribe();
  }, []);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getTableName = (tableNumber: number): string => {
    return `T${tableNumber}`;
  };

  const saveCurrentStatisticsToHistory = async () => {
    const historyEntry: StatisticsHistory = {
      timestamp: Date.now(),
      statistics: { ...currentStatistics },
      resetBy: 'developer',
      resetReason: 'Manuell gespeichert'
    };

    // Get current history
    const historyRef = ref(database, 'statisticsHistory');
    const historySnapshot = await get(historyRef);
    const currentHistory = historySnapshot.val() || {};

    // Add new entry
    const newEntryKey = `history_${Date.now()}`;
    currentHistory[newEntryKey] = historyEntry;

    // Keep only last 10 entries
    const historyArray = Object.values(currentHistory) as StatisticsHistory[];
    historyArray.sort((a, b) => b.timestamp - a.timestamp);
    
    if (historyArray.length > 10) {
      // Remove oldest entries
      const toKeep = historyArray.slice(0, 10);
      const newHistory: { [key: string]: StatisticsHistory } = {};
      toKeep.forEach((entry, index) => {
        // Find the original key or create a new one
        const originalKey = Object.keys(currentHistory).find(key => 
          currentHistory[key].timestamp === entry.timestamp
        ) || `history_${Date.now()}_${index}`;
        newHistory[originalKey] = entry;
      });
      await set(historyRef, newHistory);
    } else {
      await set(historyRef, currentHistory);
    }

    alert('✅ Aktuelle Statistik wurde zur Historie hinzugefügt!');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f1419 0%, #1a1f26 100%)' }}>
        <div className="text-white text-xl">Lade Statistiken...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #0f1419 0%, #1a1f26 100%)' }}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-purple-400 mb-2">🔧 Entwickler-Statistiken</h1>
          <p className="text-gray-400">Detaillierte Statistiken und Historie</p>
        </div>

        {/* Current Statistics */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-purple-300">📊 Aktuelle Statistik</h2>
            <button
              onClick={saveCurrentStatisticsToHistory}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold transition-colors"
            >
              💾 In Historie speichern
            </button>
          </div>
          
          {/* Global Summary */}
          <div className="bg-gray-700 rounded-xl p-4 mb-6">
            <h3 className="text-xl font-bold text-purple-200 mb-3">📈 Gesamt</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-600 rounded-lg p-3 text-center">
                <p className="text-3xl font-bold text-purple-300">{currentStatistics.totalOrders}</p>
                <p className="text-gray-300">Bestellungen</p>
              </div>
              <div className="bg-gray-600 rounded-lg p-3 text-center">
                <p className="text-3xl font-bold text-green-400">{(currentStatistics.totalAmount || 0).toFixed(2)} €</p>
                <p className="text-gray-300">Umsatz</p>
              </div>
            </div>
          </div>

          {/* Per Table Statistics */}
          <h3 className="text-xl font-bold text-gray-200 mb-3">🪑 Nach Tisch</h3>
          {!currentStatistics.tables || Object.keys(currentStatistics.tables).length === 0 ? (
            <p className="text-gray-500 text-center py-8">Noch keine Bestellungen abgeschlossen</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(currentStatistics.tables)
                .sort((a, b) => b.totalAmount - a.totalAmount)
                .map((table) => (
                  <div key={table.tableNumber} className="bg-gray-700 rounded-xl p-4 border border-gray-600">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xl font-bold text-purple-300">{getTableName(table.tableNumber)}</span>
                      <span className="text-lg font-bold text-green-400">{(table.totalAmount || 0).toFixed(2)} €</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{table.totalOrders} Bestellungen</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(table.items)
                        .sort((a, b) => b[1].quantity - a[1].quantity)
                        .slice(0, 3) // Show only top 3 items
                        .map(([name, data]) => (
                          <span key={name} className="bg-gray-600 px-2 py-0.5 rounded text-xs text-gray-300">
                            {name}: {data.quantity}x
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Ratings Section */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-8">
          <h2 className="text-2xl font-bold text-purple-300 mb-6">⭐ Bewertungen & Feedback</h2>
          {ratings.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Noch keine Bewertungen vorhanden</p>
          ) : (
            <div className="space-y-4">
              {/* Rating Summary */}
              <div className="bg-gray-700 rounded-xl p-4 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-3xl font-bold text-yellow-400">{ratings.length}</p>
                    <p className="text-gray-300 text-sm">Gesamt</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-green-400">
                      {ratings.length > 0 ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1) : '0.0'}
                    </p>
                    <p className="text-gray-300 text-sm">⭐ Durchschnitt</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-blue-400">
                      {ratings.filter(r => r.rating === 5).length}
                    </p>
                    <p className="text-gray-300 text-sm">5 Sterne</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-purple-400">
                      {ratings.filter(r => r.message && r.message.trim()).length}
                    </p>
                    <p className="text-gray-300 text-sm">Nachrichten</p>
                  </div>
                </div>
              </div>

              {/* Individual Ratings */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {ratings.slice(0, 50).map((rating, index) => (
                  <div key={`${rating.timestamp}-${index}`} className="bg-gray-700 rounded-xl p-4 border border-gray-600">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className="text-yellow-400">
                          {'⭐'.repeat(rating.rating)}{'☆'.repeat(5 - rating.rating)}
                        </div>
                        <div>
                          <p className="font-bold text-purple-200">{rating.name}</p>
                          <p className="text-xs text-gray-400">
                            {formatTime(rating.timestamp)}
                            {rating.tableNumber && ` • Tisch ${rating.tableNumber}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-1 rounded">
                          {rating.source}
                        </span>
                      </div>
                    </div>
                    
                    {rating.message && rating.message.trim() && (
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        <p className="text-gray-300 text-sm">{rating.message}</p>
                      </div>
                    )}
                    
                    {rating.email && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-400">📧 {rating.email}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {ratings.length > 50 && (
                <p className="text-center text-gray-400 text-sm mt-4">
                  Zeigt die neuesten 50 von {ratings.length} Bewertungen
                </p>
              )}
            </div>
          )}
        </div>

        {/* Statistics History */}
        <div className="bg-gray-800 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-purple-300 mb-6">📚 Statistik-Historie (letzten 10)</h2>
          {statisticsHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Keine Historie vorhanden</p>
          ) : (
            <div className="space-y-4">
              {statisticsHistory.map((entry, index) => (
                <div key={entry.timestamp} className="bg-gray-700 rounded-xl p-4 border border-gray-600">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-purple-200">
                        #{index + 1} - {formatTime(entry.timestamp)}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {entry.resetBy && `Zurückgesetzt von: ${entry.resetBy}`}
                        {entry.resetReason && ` | Grund: ${entry.resetReason}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-400">{entry.statistics.totalAmount.toFixed(2)} €</p>
                      <p className="text-sm text-gray-400">{entry.statistics.totalOrders} Bestellungen</p>
                    </div>
                  </div>
                  
                  {/* Top items from this history entry */}
                  {entry.statistics.itemTotals && Object.keys(entry.statistics.itemTotals).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <p className="text-sm font-bold text-gray-300 mb-2">Top Produkte:</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(entry.statistics.itemTotals)
                          .sort((a, b) => b[1].quantity - a[1].quantity)
                          .slice(0, 5)
                          .map(([name, data]) => (
                            <span key={name} className="bg-gray-600 px-2 py-1 rounded text-xs text-gray-300">
                              {name}: {data.quantity}x ({data.amount.toFixed(2)} €)
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeveloperStatisticsContent;
