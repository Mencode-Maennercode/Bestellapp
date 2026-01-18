import { useState, useEffect, useRef } from 'react';
import { 
  AppSettings, 
  defaultSettings, 
  getSettings, 
  saveSettings, 
  ThekeConfig,
  Language,
  t,
  sendBroadcast,
  clearBroadcast,
  PinProtection,
  setAdminPin,
  verifyAdminPin,
  resetAdminPin,
  verifyMasterPassword
} from '@/lib/settings';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newThekeName, setNewThekeName] = useState('');
  const [newTableInput, setNewTableInput] = useState<{ [thekeId: string]: string }>({});
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'tables' | 'waiters'>('all');
  const [broadcastSending, setBroadcastSending] = useState(false);
  
  // PIN Management State
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showPinReset, setShowPinReset] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await getSettings();
      setSettings(s);
    } catch (e) {
      console.error('Error loading settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Error saving settings:', e);
      alert('Fehler beim Speichern!');
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setSettings(prev => ({ ...prev, language: lang }));
  };

  // Image upload handler (max 25MB)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (25MB max)
    if (file.size > 25 * 1024 * 1024) {
      alert('Bild ist zu groß! Maximal 25MB erlaubt.');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Bitte nur Bilddateien hochladen!');
      return;
    }

    setImageUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setSettings(prev => ({ ...prev, tablePlanImage: base64 }));
        setImageUploading(false);
      };
      reader.onerror = () => {
        alert('Fehler beim Lesen der Datei!');
        setImageUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert('Fehler beim Hochladen!');
      setImageUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setSettings(prev => ({ ...prev, tablePlanImage: undefined }));
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setBroadcastSending(true);
    try {
      await sendBroadcast(broadcastMessage, broadcastTarget);
      alert('Nachricht gesendet!');
      setBroadcastMessage('');
    } catch (err) {
      alert('Fehler beim Senden!');
    }
    setBroadcastSending(false);
  };

  const handleClearBroadcast = async () => {
    try {
      await clearBroadcast();
      alert('Nachricht entfernt!');
    } catch (err) {
      alert('Fehler beim Entfernen!');
    }
  };

  const handleSetupPin = async () => {
    setPinError('');
    if (!newPin || newPin.length < 4) {
      setPinError('PIN muss mindestens 4 Zeichen lang sein');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PINs stimmen nicht überein');
      return;
    }
    try {
      await setAdminPin(newPin);
      await loadSettings();
      setShowPinSetup(false);
      setNewPin('');
      setConfirmPin('');
      alert('✅ PIN erfolgreich eingerichtet!');
    } catch (error) {
      setPinError('Fehler beim Einrichten des PINs');
    }
  };

  const handleResetPin = async () => {
    setPinError('');
    if (!masterPassword) {
      setPinError('Master-Passwort erforderlich');
      return;
    }
    if (!verifyMasterPassword(masterPassword)) {
      setPinError('Falsches Master-Passwort');
      return;
    }
    if (!newPin || newPin.length < 4) {
      setPinError('PIN muss mindestens 4 Zeichen lang sein');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PINs stimmen nicht überein');
      return;
    }
    try {
      await resetAdminPin(masterPassword, newPin);
      await loadSettings();
      setShowPinReset(false);
      setNewPin('');
      setConfirmPin('');
      setMasterPassword('');
      alert('✅ PIN erfolgreich zurückgesetzt!');
    } catch (error) {
      setPinError('Fehler beim Zurücksetzen des PINs');
    }
  };

  const handleColorChange = (key: keyof typeof settings.colors, value: string) => {
    setSettings(prev => ({
      ...prev,
      colors: { ...prev.colors, [key]: value }
    }));
  };

  const handleAddTheke = () => {
    if (!newThekeName.trim()) return;
    const id = `theke-${Date.now()}`;
    const newTheke: ThekeConfig = {
      id,
      name: newThekeName.trim(),
      assignedTables: []
    };
    setSettings(prev => ({
      ...prev,
      theken: [...prev.theken, newTheke]
    }));
    setNewThekeName('');
  };

  const handleRemoveTheke = (thekeId: string) => {
    if (settings.theken.length <= 1) {
      alert('Mindestens eine Theke muss vorhanden sein!');
      return;
    }
    setSettings(prev => ({
      ...prev,
      theken: prev.theken.filter(t => t.id !== thekeId)
    }));
  };

  const handleAddTableToTheke = (thekeId: string) => {
    const tableNum = parseInt(newTableInput[thekeId] || '');
    if (isNaN(tableNum) || tableNum < 1 || tableNum > 100) return;
    
    setSettings(prev => ({
      ...prev,
      theken: prev.theken.map(theke => {
        if (theke.id === thekeId && !theke.assignedTables.includes(tableNum)) {
          return {
            ...theke,
            assignedTables: [...theke.assignedTables, tableNum].sort((a, b) => a - b)
          };
        }
        return theke;
      })
    }));
    setNewTableInput(prev => ({ ...prev, [thekeId]: '' }));
  };

  const handleRemoveTableFromTheke = (thekeId: string, tableNum: number) => {
    setSettings(prev => ({
      ...prev,
      theken: prev.theken.map(theke => {
        if (theke.id === thekeId) {
          return {
            ...theke,
            assignedTables: theke.assignedTables.filter(t => t !== tableNum)
          };
        }
        return theke;
      })
    }));
  };

  const handleThekeNameChange = (thekeId: string, newName: string) => {
    setSettings(prev => ({
      ...prev,
      theken: prev.theken.map(theke => {
        if (theke.id === thekeId) {
          return { ...theke, name: newName };
        }
        return theke;
      })
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f1419 0%, #1a1f26 100%)' }}>
        <div className="text-white text-xl">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #0f1419 0%, #1a1f26 100%)' }}>
      {/* Modern Header */}
      <header className="sticky top-0 z-10 border-b border-white/5" style={{ background: 'rgba(15,20,25,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xl">
              ⚙️
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Einstellungen</h1>
              <p className="text-sm text-slate-400">System-Konfiguration</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/bar/A267"
              className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-all"
            >
              ← Theke
            </a>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                saved 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {saving ? '...' : saved ? '✓ Gespeichert' : '💾 Speichern'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Language Settings */}
        <section className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🌐</span> Sprache
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Wähle die Sprache für die Benutzeroberfläche. Kölsch ist der Standard-Dialekt.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleLanguageChange('koelsch')}
              className={`p-4 rounded-xl border-2 transition-all ${
                settings.language === 'koelsch'
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-slate-600 hover:border-slate-500'
              }`}
            >
              <div className="text-lg font-bold">🎭 Kölsch</div>
              <div className="text-sm text-slate-400">Dialekt (Köbes kumm ran)</div>
            </button>
            <button
              onClick={() => handleLanguageChange('hochdeutsch')}
              className={`p-4 rounded-xl border-2 transition-all ${
                settings.language === 'hochdeutsch'
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-slate-600 hover:border-slate-500'
              }`}
            >
              <div className="text-lg font-bold">🇩🇪 Hochdeutsch</div>
              <div className="text-sm text-slate-400">Standard (Kellner rufen)</div>
            </button>
          </div>
          
          {/* Preview */}
          <div className="mt-4 p-4 bg-slate-700/50 rounded-xl">
            <p className="text-sm text-slate-400 mb-2">Vorschau:</p>
            <div 
              className="py-3 px-4 rounded-lg text-center font-bold text-lg"
              style={{ backgroundColor: settings.colors.secondaryTisch, color: '#000' }}
            >
              {t('call_waiter', settings.language)}
            </div>
          </div>
        </section>

        {/* Color Settings */}
        <section className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🎨</span> Farben
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Wähle die Hauptfarben für Kellner- und Tischseite. Die Theke hat maximalen Kontrast (dunkel).
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Kellner Colors */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg border-b border-slate-600 pb-2">👤 Kellner-Seite</h3>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Primärfarbe</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={settings.colors.primaryKellner}
                    onChange={(e) => handleColorChange('primaryKellner', e.target.value)}
                    className="w-16 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.colors.primaryKellner}
                    onChange={(e) => handleColorChange('primaryKellner', e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Sekundärfarbe</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={settings.colors.secondaryKellner}
                    onChange={(e) => handleColorChange('secondaryKellner', e.target.value)}
                    className="w-16 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.colors.secondaryKellner}
                    onChange={(e) => handleColorChange('secondaryKellner', e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
              </div>

              {/* Kellner Preview */}
              <div 
                className="p-4 rounded-xl mt-2"
                style={{ background: `linear-gradient(135deg, ${settings.colors.primaryKellner}, ${settings.colors.primaryKellner}dd)` }}
              >
                <div className="text-white font-bold">Kellner-Vorschau</div>
                <div 
                  className="mt-2 py-2 px-4 rounded-lg text-center font-bold"
                  style={{ backgroundColor: settings.colors.secondaryKellner, color: '#000' }}
                >
                  T12
                </div>
              </div>
            </div>

            {/* Tisch Colors */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg border-b border-slate-600 pb-2">🪑 Tisch-Seite</h3>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Primärfarbe</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={settings.colors.primaryTisch}
                    onChange={(e) => handleColorChange('primaryTisch', e.target.value)}
                    className="w-16 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.colors.primaryTisch}
                    onChange={(e) => handleColorChange('primaryTisch', e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Sekundärfarbe</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={settings.colors.secondaryTisch}
                    onChange={(e) => handleColorChange('secondaryTisch', e.target.value)}
                    className="w-16 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.colors.secondaryTisch}
                    onChange={(e) => handleColorChange('secondaryTisch', e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
              </div>

              {/* Tisch Preview */}
              <div 
                className="p-4 rounded-xl mt-2"
                style={{ background: `linear-gradient(135deg, ${settings.colors.primaryTisch}, ${settings.colors.primaryTisch}dd)` }}
              >
                <div className="text-white font-bold">Tisch-Vorschau</div>
                <div 
                  className="mt-2 py-2 px-4 rounded-lg text-center font-bold"
                  style={{ backgroundColor: settings.colors.secondaryTisch, color: '#000' }}
                >
                  {t('call_waiter', settings.language)}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="mt-6 pt-4 border-t border-slate-700">
            <p className="text-sm text-slate-400 mb-3">Schnellvorlagen:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSettings(prev => ({
                  ...prev,
                  colors: {
                    primaryKellner: '#009640',
                    secondaryKellner: '#FFCC00',
                    primaryTisch: '#009640',
                    secondaryTisch: '#FFCC00',
                  }
                }))}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm flex items-center gap-2"
              >
                <span className="w-4 h-4 rounded" style={{ background: '#009640' }}></span>
                <span className="w-4 h-4 rounded" style={{ background: '#FFCC00' }}></span>
                EVM Standard
              </button>
              <button
                onClick={() => setSettings(prev => ({
                  ...prev,
                  colors: {
                    primaryKellner: '#1e40af',
                    secondaryKellner: '#60a5fa',
                    primaryTisch: '#1e40af',
                    secondaryTisch: '#60a5fa',
                  }
                }))}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm flex items-center gap-2"
              >
                <span className="w-4 h-4 rounded" style={{ background: '#1e40af' }}></span>
                <span className="w-4 h-4 rounded" style={{ background: '#60a5fa' }}></span>
                Blau Modern
              </button>
              <button
                onClick={() => setSettings(prev => ({
                  ...prev,
                  colors: {
                    primaryKellner: '#7c3aed',
                    secondaryKellner: '#a78bfa',
                    primaryTisch: '#7c3aed',
                    secondaryTisch: '#a78bfa',
                  }
                }))}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm flex items-center gap-2"
              >
                <span className="w-4 h-4 rounded" style={{ background: '#7c3aed' }}></span>
                <span className="w-4 h-4 rounded" style={{ background: '#a78bfa' }}></span>
                Violett
              </button>
              <button
                onClick={() => setSettings(prev => ({
                  ...prev,
                  colors: {
                    primaryKellner: '#dc2626',
                    secondaryKellner: '#fbbf24',
                    primaryTisch: '#dc2626',
                    secondaryTisch: '#fbbf24',
                  }
                }))}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm flex items-center gap-2"
              >
                <span className="w-4 h-4 rounded" style={{ background: '#dc2626' }}></span>
                <span className="w-4 h-4 rounded" style={{ background: '#fbbf24' }}></span>
                Rot-Gold
              </button>
            </div>
          </div>
        </section>

        {/* PIN Protection System */}
        <section className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🔒</span> PIN-Schutz System
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Schütze wichtige Funktionen mit einem Admin-PIN. Master-Passwort: <code className="bg-slate-700 px-2 py-1 rounded">2026Veranstaltung</code>
          </p>
          
          {/* PIN Setup/Reset Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setShowPinSetup(true)}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors"
            >
              {settings.pinProtection?.adminPin ? '🔄 PIN ändern' : '🔑 PIN einrichten'}
            </button>
            {settings.pinProtection?.adminPin && (
              <button
                onClick={() => setShowPinReset(true)}
                className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-500 rounded-lg font-bold transition-colors"
              >
                🔓 PIN zurücksetzen
              </button>
            )}
          </div>
          
          {/* Protected Actions */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-300 mb-2">Geschützte Aktionen:</h3>
            {[
              { key: 'productsPage', label: '🍺 Produkte & Preise Seite' },
              { key: 'systemShutdown', label: '⚠️ System Notfall-Stopp' },
              { key: 'orderFormToggle', label: '🚫 Bestellformular sperren' },
              { key: 'tableManagement', label: '🪑 Tische verwalten' },
              { key: 'statistics', label: '📊 Statistiken' },
              { key: 'settings', label: '⚙️ Einstellungen' },
              { key: 'broadcast', label: '📢 Broadcast-Nachrichten' }
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-700">
                <input
                  type="checkbox"
                  checked={settings.pinProtection?.protectedActions?.[key as keyof PinProtection['protectedActions']] || false}
                  onChange={(e) => {
                    setSettings(prev => ({
                      ...prev,
                      pinProtection: {
                        ...prev.pinProtection,
                        adminPin: prev.pinProtection?.adminPin,
                        protectedActions: {
                          ...prev.pinProtection?.protectedActions,
                          [key]: e.target.checked
                        }
                      }
                    }));
                  }}
                  className="w-5 h-5 rounded"
                />
                <span className="text-slate-300">{label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Order Auto-Hide Setting */}
        <section className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>⏰</span> Bestellungen automatisch ausblenden
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Lege fest, nach wie vielen Minuten Bestellungen automatisch von der Theke und Kellner-Ansicht verschwinden. 0 = nie ausblenden.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min="0"
              max="60"
              value={settings.orderAutoHideMinutes || 6}
              onChange={(e) => setSettings(prev => ({ ...prev, orderAutoHideMinutes: parseInt(e.target.value) || 0 }))}
              className="w-24 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-center font-bold text-lg"
            />
            <span className="text-slate-300">Minuten</span>
            {(settings.orderAutoHideMinutes || 6) === 0 && (
              <span className="text-amber-400 text-sm">⚠️ Bestellungen werden nie ausgeblendet</span>
            )}
          </div>
          <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
            <p className="text-sm text-slate-400">
              💡 <strong>Tipp:</strong> Standard ist 6 Minuten. Bei 0 bleiben alle Bestellungen sichtbar, bis sie manuell erledigt werden.
            </p>
          </div>
        </section>

        {/* Theken Management */}
        <section className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🍺</span> Theken-Verwaltung
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Erstelle mehrere Theken und ordne Tische zu. Bestellungen von zugeordneten Tischen erscheinen nur bei der entsprechenden Theke.
            Tische ohne Zuordnung erscheinen bei allen Theken.
          </p>

          <div className="space-y-4">
            {(settings.theken || []).map((theke) => (
              <div key={theke.id} className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="text"
                    value={theke.name}
                    onChange={(e) => handleThekeNameChange(theke.id, e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 font-bold"
                  />
                  {(settings.theken?.length || 0) > 1 && (
                    <button
                      onClick={() => handleRemoveTheke(theke.id)}
                      className="px-3 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded-lg"
                    >
                      🗑️
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      placeholder="Tischnummer"
                      value={newTableInput[theke.id] || ''}
                      onChange={(e) => setNewTableInput(prev => ({ ...prev, [theke.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTableToTheke(theke.id)}
                      className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                    />
                    <button
                      onClick={() => handleAddTableToTheke(theke.id)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold"
                    >
                      + Tisch
                    </button>
                  </div>

                  {theke.assignedTables && theke.assignedTables.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {theke.assignedTables.map(tableNum => (
                        <span
                          key={tableNum}
                          onClick={() => handleRemoveTableFromTheke(theke.id, tableNum)}
                          className="px-3 py-1 bg-blue-600/30 text-blue-300 rounded-lg cursor-pointer hover:bg-red-600/30 hover:text-red-300 transition-colors"
                        >
                          T{tableNum} ✕
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm italic">
                      Keine Tische zugeordnet – alle Bestellungen werden angezeigt
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Add New Theke */}
            <div className="border-2 border-dashed border-slate-600 rounded-xl p-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Name der neuen Theke"
                  value={newThekeName}
                  onChange={(e) => setNewThekeName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTheke()}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                />
                <button
                  onClick={handleAddTheke}
                  disabled={!newThekeName.trim()}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-bold"
                >
                  + Theke hinzufügen
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Table Plan Image Upload */}
        <section className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🗺️</span> Tischplan
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Lade ein Bild des Tischplans hoch (max. 25MB). Dieses wird auf der Thekenseite angezeigt.
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          
          {settings.tablePlanImage ? (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-slate-600">
                <img 
                  src={settings.tablePlanImage} 
                  alt="Tischplan" 
                  className="w-full max-h-96 object-contain bg-slate-900"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold"
                >
                  🔄 Bild ändern
                </button>
                <button
                  onClick={handleRemoveImage}
                  className="px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded-lg font-bold"
                >
                  🗑️ Entfernen
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading}
              className="w-full py-8 border-2 border-dashed border-slate-600 rounded-xl hover:border-blue-500 hover:bg-slate-700/50 transition-all"
            >
              {imageUploading ? (
                <span className="text-slate-400">Wird hochgeladen...</span>
              ) : (
                <div className="text-center">
                  <div className="text-4xl mb-2">📤</div>
                  <div className="text-slate-300 font-bold">Tischplan hochladen</div>
                  <div className="text-slate-500 text-sm">Klicken oder Bild hierher ziehen</div>
                </div>
              )}
            </button>
          )}
        </section>

        {/* Broadcast Message */}
        <section className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>📢</span> Nachricht senden
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Sende eine Nachricht an alle Tische, Kellner oder beide.
          </p>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setBroadcastTarget('all')}
                className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                  broadcastTarget === 'all' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                Alle
              </button>
              <button
                onClick={() => setBroadcastTarget('tables')}
                className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                  broadcastTarget === 'tables' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                Nur Tische
              </button>
              <button
                onClick={() => setBroadcastTarget('waiters')}
                className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                  broadcastTarget === 'waiters' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                Nur Kellner
              </button>
            </div>
            
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="Nachricht eingeben..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 min-h-24 resize-none"
            />
            
            <div className="flex gap-3">
              <button
                onClick={handleSendBroadcast}
                disabled={!broadcastMessage.trim() || broadcastSending}
                className="flex-1 py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-bold"
              >
                {broadcastSending ? 'Wird gesendet...' : '📤 Nachricht senden'}
              </button>
              <button
                onClick={handleClearBroadcast}
                className="px-4 py-3 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded-lg font-bold"
              >
                🗑️ Löschen
              </button>
            </div>
          </div>
        </section>

        {/* Admin Access Info */}
        <section className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🔐</span> Admin-Zugang
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Diese Seiten sind mit dem Code <span className="font-mono font-bold text-blue-400">A267</span> geschützt.
          </p>
          
          <div className="bg-slate-700/50 rounded-xl p-4">
            <div className="text-sm text-slate-400 mb-2">Admin-URLs:</div>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Theke:</span>
                <code className="text-green-400">/bar/A267</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Kellner:</span>
                <code className="text-green-400">/kellner/A267</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Einstellungen:</span>
                <code className="text-green-400">/settings/A267</code>
              </div>
            </div>
          </div>
        </section>

        {/* Save Button (bottom) */}
        <div className="flex justify-end pb-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-8 py-3 rounded-xl font-bold text-lg transition-all ${
              saved 
                ? 'bg-green-600 text-white' 
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {saving ? 'Speichern...' : saved ? '✓ Einstellungen gespeichert!' : '💾 Einstellungen speichern'}
          </button>
        </div>
      </div>

      {/* PIN Setup Modal */}
      {showPinSetup && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700">
            <h2 className="text-2xl font-bold mb-4 text-white">🔑 Admin-PIN einrichten</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Neuer PIN (min. 4 Zeichen)</label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  placeholder="PIN eingeben"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">PIN bestätigen</label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  placeholder="PIN wiederholen"
                />
              </div>
              {pinError && (
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
                  {pinError}
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPinSetup(false);
                    setNewPin('');
                    setConfirmPin('');
                    setPinError('');
                  }}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSetupPin}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold"
                >
                  💾 Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PIN Reset Modal */}
      {showPinReset && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700">
            <h2 className="text-2xl font-bold mb-4 text-white">🔓 PIN zurücksetzen</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Master-Passwort</label>
                <input
                  type="password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  placeholder="2026Veranstaltung"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Neuer PIN (min. 4 Zeichen)</label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  placeholder="PIN eingeben"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">PIN bestätigen</label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  placeholder="PIN wiederholen"
                />
              </div>
              {pinError && (
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
                  {pinError}
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPinReset(false);
                    setNewPin('');
                    setConfirmPin('');
                    setMasterPassword('');
                    setPinError('');
                  }}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleResetPin}
                  className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-500 rounded-lg font-bold"
                >
                  🔓 Zurücksetzen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
