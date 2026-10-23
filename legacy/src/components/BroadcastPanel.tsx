import { useState, useEffect } from 'react';
import { sendBroadcast, clearBroadcast, subscribeToBroadcast, type BroadcastMessage } from '@/lib/settings';

export default function BroadcastPanel() {
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<'all' | 'tables' | 'waiters' | 'bars'>('all');
  const [sending, setSending] = useState(false);
  const [currentBroadcast, setCurrentBroadcast] = useState<BroadcastMessage | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToBroadcast((broadcast) => {
      setCurrentBroadcast(broadcast);
    });
    return unsubscribe;
  }, []);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await sendBroadcast(message, target);
      setMessage('');
      alert('Nachricht gesendet!');
    } catch (err) {
      console.error('Error sending broadcast:', err);
      alert('Fehler beim Senden!');
    }
    setSending(false);
  };

  const handleClear = async () => {
    try {
      await clearBroadcast();
      alert('Nachricht gelöscht!');
    } catch (err) {
      console.error('Error clearing broadcast:', err);
      alert('Fehler beim Löschen!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Last Sent Message */}
      {currentBroadcast && (
        <div className="bg-blue-600/20 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📨</span>
            <div className="flex-1">
              <p className="text-xs text-blue-400 mb-1">Letzte Nachricht:</p>
              <p className="font-medium text-white">{currentBroadcast.message}</p>
              <p className="text-xs text-blue-300/70 mt-1">
                Gesendet: {new Date(currentBroadcast.timestamp).toLocaleString('de-DE')} 
                {' '}• An: {currentBroadcast.target === 'all' ? 'Alle' : 
                  currentBroadcast.target === 'tables' ? 'Tische' : 
                  currentBroadcast.target === 'waiters' ? 'Kellner' : 'Theken'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Target Selection */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <h3 className="text-lg font-semibold mb-3">📍 Empfänger</h3>
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: 'all', label: 'Alle', icon: '👥' },
            { id: 'tables', label: 'Tische', icon: '🪑' },
            { id: 'waiters', label: 'Kellner', icon: '🧑‍🍳' },
            { id: 'bars', label: 'Theken', icon: '🍺' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setTarget(opt.id as any)}
              className={`p-3 rounded-lg border-2 transition-all ${
                target === opt.id
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-slate-600 hover:border-slate-500'
              }`}
            >
              <div className="text-2xl mb-1">{opt.icon}</div>
              <div className="text-sm font-medium">{opt.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Message Input */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <h3 className="text-lg font-semibold mb-3">💬 Nachricht</h3>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Nachricht eingeben..."
          rows={4}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSend}
          disabled={sending || !message.trim()}
          className={`flex-1 py-3 rounded-lg font-bold transition-colors ${
            message.trim()
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          {sending ? 'Senden...' : '📢 Nachricht senden'}
        </button>
        <button
          onClick={handleClear}
          className="px-4 py-3 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded-lg font-bold"
        >
          🗑️
        </button>
      </div>

      {/* Read Statistics */}
      {currentBroadcast && currentBroadcast.active && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <h3 className="text-lg font-semibold mb-3">📊 Lesestatistik</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-slate-700/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">
                {currentBroadcast.readBy?.tables?.length || 0}
              </div>
              <div className="text-sm text-slate-400">Tische</div>
            </div>
            <div className="text-center p-3 bg-slate-700/50 rounded-lg">
              <div className="text-2xl font-bold text-green-400">
                {currentBroadcast.readBy?.waiters?.length || 0}
              </div>
              <div className="text-sm text-slate-400">Kellner</div>
            </div>
            <div className="text-center p-3 bg-slate-700/50 rounded-lg">
              <div className="text-2xl font-bold text-amber-400">
                {currentBroadcast.readBy?.bars?.length || 0}
              </div>
              <div className="text-sm text-slate-400">Theken</div>
            </div>
          </div>
          {(currentBroadcast.readBy?.tables?.length || 0) > 0 && (
            <div className="mt-3 p-2 bg-slate-700/30 rounded">
              <p className="text-xs text-slate-400 mb-1">Tische:</p>
              <p className="text-sm text-slate-300">
                {currentBroadcast.readBy?.tables?.sort((a, b) => a - b).map(t => `T${t}`).join(', ')}
              </p>
            </div>
          )}
          {(currentBroadcast.readBy?.waiters?.length || 0) > 0 && (
            <div className="mt-3 p-2 bg-slate-700/30 rounded">
              <p className="text-xs text-slate-400 mb-1">Kellner:</p>
              <p className="text-sm text-slate-300">
                {currentBroadcast.readBy?.waiters?.join(', ')}
              </p>
            </div>
          )}
          {(currentBroadcast.readBy?.bars?.length || 0) > 0 && (
            <div className="mt-3 p-2 bg-slate-700/30 rounded">
              <p className="text-xs text-slate-400 mb-1">Theken:</p>
              <p className="text-sm text-slate-300">
                {currentBroadcast.readBy?.bars?.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">ℹ️</span>
          <div className="text-sm text-amber-200/80">
            <p className="font-semibold mb-1">Hinweis</p>
            <p>Die Nachricht erscheint als Banner auf den ausgewählten Seiten, bis sie gelöscht wird.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
