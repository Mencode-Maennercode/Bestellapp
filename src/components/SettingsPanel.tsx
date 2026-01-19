import { useState, useEffect, useRef } from 'react';
import TablesManagementPanel from '@/components/TablesManagementPanel';
import { 
  AppSettings, 
  defaultSettings, 
  getSettings, 
  saveSettings, 
  ThekeConfig,
  Language,
  PinProtection,
  setAdminPin,
  resetAdminPin,
  verifyMasterPassword,
  verifyAdminPin,
  sendBroadcast,
  clearBroadcast
} from '@/lib/settings';

interface SettingsPanelProps {
  onSaved?: () => void;
}

export default function SettingsPanel({ onSaved }: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newThekeName, setNewThekeName] = useState('');
  const [newTableInput, setNewTableInput] = useState<{ [thekeId: string]: string }>({});
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tables' | 'theken' | 'colors' | 'broadcast' | 'security'>('tables');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showPinReset, setShowPinReset] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [authCurrentOrMaster, setAuthCurrentOrMaster] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [showMaster, setShowMaster] = useState(false);
  const [showAuthCurrent, setShowAuthCurrent] = useState(false);
  const [showSaveAuth, setShowSaveAuth] = useState(false);
  const [saveAuth, setSaveAuth] = useState('');
  const [saveAuthError, setSaveAuthError] = useState('');
  const [showSaveAuthVisible, setShowSaveAuthVisible] = useState(false);
  const [originalProtected, setOriginalProtected] = useState<PinProtection['protectedActions']>({});
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await getSettings();
      setSettings(s);
      setOriginalProtected(s.pinProtection?.protectedActions || {});
    } catch (err) {
      console.error('Error loading settings:', err);
    }
    setLoading(false);
  };

  const protectedChanged = () => {
    const curr = settings.pinProtection?.protectedActions || {};
    const prev = originalProtected || {};
    const keys = new Set([
      ...Object.keys(curr),
      ...Object.keys(prev)
    ] as (keyof NonNullable<PinProtection['protectedActions']>)[]);
    for (const k of Array.from(keys)) {
      if ((curr as any)[k] !== (prev as any)[k]) return true;
    }
    return false;
  };

  const performSave = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      setSaved(true);
      setOriginalProtected(settings.pinProtection?.protectedActions || {});
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Fehler beim Speichern!');
    }
    setSaving(false);
  };

  const handleSave = async () => {
    if (protectedChanged()) {
      setShowSaveAuth(true);
      setSaveAuth('');
      setSaveAuthError('');
      return;
    }
    await performSave();
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
      const authOk = (await verifyAdminPin(authCurrentOrMaster)) || verifyMasterPassword(authCurrentOrMaster);
      if (!authOk) {
        setPinError('Aktueller PIN oder Master-Passwort ist falsch');
        return;
      }
      await setAdminPin(newPin);
      const s = await getSettings();
      setSettings(s);
      setShowPinSetup(false);
      setNewPin('');
      setConfirmPin('');
      setAuthCurrentOrMaster('');
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
      const s = await getSettings();
      setSettings(s);
      setShowPinReset(false);
      setNewPin('');
      setConfirmPin('');
      setMasterPassword('');
      alert('✅ PIN erfolgreich zurückgesetzt!');
    } catch (error) {
      setPinError('Fehler beim Zurücksetzen des PINs');
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setSettings(prev => ({ ...prev, language: lang }));
  };

  const handleColorChange = (key: keyof AppSettings['colors'], value: string) => {
    setSettings(prev => ({
      ...prev,
      colors: { ...prev.colors, [key]: value }
    }));
  };

  const handleAddTheke = () => {
    if (!newThekeName.trim()) return;
    const newTheke: ThekeConfig = {
      id: `theke-${Date.now()}`,
      name: newThekeName.trim(),
      assignedTables: []
    };
    setSettings(prev => ({
      ...prev,
      theken: [...(prev.theken || []), newTheke]
    }));
    setNewThekeName('');
  };

  const handleRemoveTheke = (thekeId: string) => {
    if ((settings.theken?.length || 0) <= 1) return;
    setSettings(prev => ({
      ...prev,
      theken: (prev.theken || []).filter(t => t.id !== thekeId)
    }));
  };

  const handleAddTableToTheke = (thekeId: string) => {
    const tableNum = parseInt(newTableInput[thekeId] || '');
    if (isNaN(tableNum) || tableNum < 1 || tableNum > 100) return;
    
    setSettings(prev => ({
      ...prev,
      theken: (prev.theken || []).map(theke => {
        if (theke.id === thekeId && !(theke.assignedTables || []).includes(tableNum)) {
          return {
            ...theke,
            assignedTables: [...(theke.assignedTables || []), tableNum].sort((a, b) => a - b)
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
      theken: (prev.theken || []).map(theke => {
        if (theke.id === thekeId) {
          return {
            ...theke,
            assignedTables: (theke.assignedTables || []).filter(t => t !== tableNum)
          };
        }
        return theke;
      })
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 25 * 1024 * 1024) {
      alert('Datei zu groß! Max. 25MB erlaubt.');
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      alert('Nur Bilddateien erlaubt!');
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
      reader.readAsDataURL(file);
    } catch (err) {
      alert('Fehler beim Hochladen!');
      setImageUploading(false);
    }
  };

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      // Create camera modal
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4';
      modal.innerHTML = `
        <div class="bg-white rounded-2xl p-4 max-w-lg w-full">
          <h3 class="text-xl font-bold mb-4 text-gray-800">📸 Tischplan fotografieren</h3>
          <div class="relative">
            <video id="camera-video" class="w-full rounded-lg" autoplay playsinline></video>
            <div class="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              <button id="capture-btn" class="px-6 py-3 bg-blue-600 text-white rounded-full font-bold">
                📸 Foto machen
              </button>
              <button id="cancel-btn" class="px-6 py-3 bg-gray-600 text-white rounded-full font-bold">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      const videoElement = document.getElementById('camera-video') as HTMLVideoElement;
      videoElement.srcObject = stream;
      
      const captureBtn = document.getElementById('capture-btn');
      const cancelBtn = document.getElementById('cancel-btn');
      
      captureBtn?.addEventListener('click', () => {
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        context?.drawImage(videoElement, 0, 0);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        setSettings(prev => ({ ...prev, tablePlanImage: base64 }));
        
        // Cleanup
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(modal);
      });
      
      cancelBtn?.addEventListener('click', () => {
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(modal);
      });
      
    } catch (err) {
      console.error('Camera access error:', err);
      alert('Kamera nicht verfügbar. Bitte verwenden Sie die Datei-Upload Option.');
    }
  };

  const handleRemoveImage = () => {
    setSettings(prev => {
      const newSettings = { ...prev };
      delete newSettings.tablePlanImage;
      return newSettings;
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 25 * 1024 * 1024) {
      alert('Datei zu groß! Max. 25MB erlaubt.');
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      alert('Nur Bilddateien erlaubt!');
      return;
    }
    
    setLogoUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setSettings(prev => ({ ...prev, logo: base64 }));
        setLogoUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert('Fehler beim Hochladen!');
      setLogoUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setSettings(prev => {
      const newSettings = { ...prev };
      delete newSettings.logo;
      return newSettings;
    });
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
      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-4">
        {[
          { id: 'tables', label: '🪑 Tische' },
          { id: 'theken', label: '🍺 Theken' },
          { id: 'colors', label: '🎨 Darstellung' },
          { id: 'security', label: '🔒 Sicherheit' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>


      {/* Tables Tab */}
      {activeTab === 'tables' && (
        <div className="space-y-6">
          <TablesManagementPanel />
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h3 className="text-lg font-semibold mb-2">🔑 Admin-PIN</h3>
            <p className="text-slate-400 text-sm mb-4">
              Richte einen Admin-PIN ein, um sensible Aktionen zu schützen. Master-Passwort ist im Vertrag hinterlegt.
            </p>
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => { setShowPinSetup(true); setShowPinReset(false); setPinError(''); }}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors"
              >
                {settings.pinProtection?.adminPin ? '🔄 PIN ändern' : '🔑 PIN einrichten'}
              </button>
              {settings.pinProtection?.adminPin && (
                <button
                  onClick={() => { setShowPinReset(true); setShowPinSetup(false); setPinError(''); }}
                  className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-500 rounded-lg font-bold transition-colors"
                >
                  🔓 PIN zurücksetzen
                </button>
              )}
            </div>
            {showPinSetup && (
              <div className="space-y-3 bg-slate-900/40 p-3 rounded-lg border border-slate-700">
                {pinError && (<div className="text-red-400 text-sm">{pinError}</div>)}
                <div className="relative">
                  <input
                    type={showAuthCurrent ? 'text' : 'password'}
                    placeholder="Aktueller PIN oder Master-Passwort"
                    value={authCurrentOrMaster}
                    onChange={(e) => setAuthCurrentOrMaster(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 pr-10"
                  />
                  <button type="button" onClick={() => setShowAuthCurrent(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300">{showAuthCurrent ? '🙈' : '👁️'}</button>
                </div>
                <div className="relative">
                  <input
                    type={showNewPin ? 'text' : 'password'}
                    placeholder="Neuer PIN (min. 4)"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 pr-10"
                  />
                  <button type="button" onClick={() => setShowNewPin(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300">{showNewPin ? '🙈' : '👁️'}</button>
                </div>
                <div className="relative">
                  <input
                    type={showConfirmPin ? 'text' : 'password'}
                    placeholder="PIN bestätigen"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 pr-10"
                  />
                  <button type="button" onClick={() => setShowConfirmPin(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300">{showConfirmPin ? '🙈' : '👁️'}</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSetupPin} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold">Speichern</button>
                  <button onClick={() => { setShowPinSetup(false); setNewPin(''); setConfirmPin(''); setPinError(''); }} className="px-4 py-2 bg-slate-700 rounded-lg">Abbrechen</button>
                </div>
              </div>
            )}
            {showPinReset && (
              <div className="space-y-3 bg-slate-900/40 p-3 rounded-lg border border-slate-700">
                {pinError && (<div className="text-red-400 text-sm">{pinError}</div>)}
                <div className="relative">
                  <input
                    type={showMaster ? 'text' : 'password'}
                    placeholder="Master-Passwort"
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 pr-10"
                  />
                  <button type="button" onClick={() => setShowMaster(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300">{showMaster ? '🙈' : '👁️'}</button>
                </div>
                <div className="relative">
                  <input
                    type={showNewPin ? 'text' : 'password'}
                    placeholder="Neuer PIN (min. 4)"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 pr-10"
                  />
                  <button type="button" onClick={() => setShowNewPin(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300">{showNewPin ? '🙈' : '👁️'}</button>
                </div>
                <div className="relative">
                  <input
                    type={showConfirmPin ? 'text' : 'password'}
                    placeholder="PIN bestätigen"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 pr-10"
                  />
                  <button type="button" onClick={() => setShowConfirmPin(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300">{showConfirmPin ? '🙈' : '👁️'}</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleResetPin} className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg font-bold">Zurücksetzen</button>
                  <button onClick={() => { setShowPinReset(false); setNewPin(''); setConfirmPin(''); setMasterPassword(''); setPinError(''); }} className="px-4 py-2 bg-slate-700 rounded-lg">Abbrechen</button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h3 className="text-lg font-semibold mb-3">Geschützte Aktionen</h3>
            <div className="space-y-2">
              {[
                { key: 'productsPage', label: '🍺 Produkte & Preise Seite' },
                { key: 'systemShutdown', label: '⚠️ System Notfall-Stopp' },
                { key: 'orderFormToggle', label: '🚫 Bestellformular sperren' },
                { key: 'tableManagement', label: '🪑 Tische verwalten' },
                { key: 'statistics', label: '📊 Statistiken' },
                { key: 'settings', label: '⚙️ Einstellungen' },
                { key: 'broadcast', label: '📢 Broadcast-Nachrichten' },
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
          </div>
        </div>
      )}

      {/* Theken Tab */}
      {activeTab === 'theken' && (
        <div className="space-y-4">
          {(settings.theken || []).map((theke) => (
            <div key={theke.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="text"
                  value={theke.name}
                  onChange={(e) => {
                    setSettings(prev => ({
                      ...prev,
                      theken: (prev.theken || []).map(t => 
                        t.id === theke.id ? { ...t, name: e.target.value } : t
                      )
                    }));
                  }}
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

              <div className="flex gap-2 mb-3">
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
                  Keine Tische zugeordnet
                </p>
              )}
            </div>
          ))}

          {/* Add New Theke */}
          <div className="border-2 border-dashed border-slate-600 rounded-xl p-4">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Neue Theke Name..."
                value={newThekeName}
                onChange={(e) => setNewThekeName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTheke()}
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
              />
              <button
                onClick={handleAddTheke}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold"
              >
                + Theke
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Darstellung Tab */}
      {activeTab === 'colors' && (
        <div className="space-y-4">
          {/* Sprache */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h3 className="text-lg font-semibold mb-3">Sprache</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleLanguageChange('koelsch')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  settings.language === 'koelsch'
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-slate-600 hover:border-slate-500'
                }`}
              >
                <div className="text-2xl mb-1">🍺</div>
                <div className="font-semibold">Kölsch</div>
              </button>
              <button
                onClick={() => handleLanguageChange('hochdeutsch')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  settings.language === 'hochdeutsch'
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-slate-600 hover:border-slate-500'
                }`}
              >
                <div className="text-2xl mb-1">🇩🇪</div>
                <div className="font-semibold">Hochdeutsch</div>
              </button>
            </div>
          </div>

          {/* Tischplan */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h3 className="text-lg font-semibold mb-3">🗺️ Tischplan</h3>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            {settings.tablePlanImage ? (
              <div className="space-y-3">
                <img 
                  src={settings.tablePlanImage} 
                  alt="Tischplan" 
                  className="w-full h-40 object-cover rounded-lg"
                />
                <button
                  onClick={handleRemoveImage}
                  className="w-full py-2 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded-lg"
                >
                  🗑️ Bild entfernen
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imageUploading}
                    className="w-full py-4 border-2 border-dashed border-slate-600 rounded-lg hover:border-slate-500 transition-colors"
                  >
                    {imageUploading ? 'Hochladen...' : '📁 Datei hochladen (max. 25MB)'}
                  </button>
                  <button
                    onClick={handleCameraCapture}
                    className="w-full py-4 border-2 border-dashed border-blue-600 rounded-lg hover-border-blue-500 transition-colors text-blue-400"
                  >
                    📸 Mit Kamera fotografieren
                  </button>
                </div>
                <p className="text-xs text-slate-500 text-center">
                  Oder fotografieren Sie den Tischplan direkt mit Ihrer Kamera
                </p>
              </div>
            )}
          </div>
          {/* Logo Upload Section */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h3 className="text-lg font-semibold mb-3">🖼️ Logo</h3>
            <div className="text-sm text-slate-400 mb-3">
              Empfohlene Auflösung: 512×512px (quadratisch) • Max. 25MB
            </div>
            <input
              type="file"
              ref={logoInputRef}
              onChange={handleLogoUpload}
              accept="image/*"
              className="hidden"
            />
            {settings.logo ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center p-4 bg-slate-900/50 rounded-lg">
                  <img 
                    src={settings.logo} 
                    alt="Logo" 
                    className="max-h-24 max-w-full object-contain"
                  />
                </div>
                <button
                  onClick={handleRemoveLogo}
                  className="w-full py-2 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded-lg"
                >
                  🗑️ Logo entfernen
                </button>
              </div>
            ) : (
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                className="w-full py-4 border-2 border-dashed border-slate-600 rounded-lg hover:border-slate-500 transition-colors"
              >
                {logoUploading ? 'Hochladen...' : '📁 Logo hochladen (max. 25MB)'}
              </button>
            )}
          </div>

          {/* Kellner Farben */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h3 className="text-lg font-semibold mb-4">👤 Kellner Farben</h3>
            <div className="space-y-3">
              {[
                { key: 'primaryKellner', label: 'Kellner Primär' },
                { key: 'secondaryKellner', label: 'Kellner Sekundär' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="w-32 text-sm text-slate-400">{label}</label>
                  <div 
                    className="w-20 h-12 rounded-lg border-2 border-slate-600"
                    style={{ backgroundColor: settings.colors?.[key as keyof typeof settings.colors] || '#009640' }}
                  />
                  <input
                    type="text"
                    value={settings.colors?.[key as keyof typeof settings.colors] || '#009640'}
                    onChange={(e) => handleColorChange(key as keyof typeof settings.colors, e.target.value)}
                    className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 font-mono text-xs"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Tisch Farben */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h3 className="text-lg font-semibold mb-4">🪑 Tisch Farben</h3>
            <div className="space-y-3">
              {[
                { key: 'primaryTisch', label: 'Tisch Primär' },
                { key: 'secondaryTisch', label: 'Tisch Sekundär' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="w-32 text-sm text-slate-400">{label}</label>
                  <div 
                    className="w-20 h-12 rounded-lg border-2 border-slate-600"
                    style={{ backgroundColor: settings.colors?.[key as keyof typeof settings.colors] || '#009640' }}
                  />
                  <input
                    type="text"
                    value={settings.colors?.[key as keyof typeof settings.colors] || '#009640'}
                    onChange={(e) => handleColorChange(key as keyof typeof settings.colors, e.target.value)}
                    className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 font-mono text-xs"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Bestellungen automatisch ausblenden */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h3 className="text-lg font-semibold mb-2">⏰ Bestellungen automatisch ausblenden</h3>
            <p className="text-slate-400 text-sm mb-3">
              Lege fest, ob Bestellungen automatisch aus der Theken- und Kellner-Ansicht verschwinden sollen. Wenn aktiviert, gib die Minuten an (mind. 5). 0 = aus.
            </p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-700">
                <input
                  type="checkbox"
                  checked={(settings.orderAutoHideMinutes ?? 6) !== 0}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setSettings(prev => ({
                      ...prev,
                      orderAutoHideMinutes: enabled
                        ? Math.max(prev.orderAutoHideMinutes && prev.orderAutoHideMinutes > 0 ? prev.orderAutoHideMinutes : 5, 5)
                        : 0
                    }));
                  }}
                  className="w-5 h-5 rounded"
                />
                <span className="text-slate-300 font-medium">Automatisch ausblenden</span>
              </label>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="5"
                  max="60"
                  disabled={(settings.orderAutoHideMinutes ?? 6) === 0}
                  value={(settings.orderAutoHideMinutes ?? 6) === 0 ? 5 : Math.max(settings.orderAutoHideMinutes ?? 6, 5)}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSettings(prev => ({ ...prev, orderAutoHideMinutes: isNaN(val) ? 0 : Math.max(val, 5) }));
                  }}
                  className={`w-24 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-center font-bold ${((settings.orderAutoHideMinutes ?? 6) === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
                <span className="text-slate-300">Minuten</span>
                {(settings.orderAutoHideMinutes ?? 6) === 0 && (
                  <span className="text-amber-400 text-xs">Automatisches Ausblenden ist deaktiviert</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="pt-4 border-t border-white/10">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-3 rounded-lg font-bold transition-all ${
            saved 
              ? 'bg-emerald-600 text-white' 
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {saving ? 'Speichern...' : saved ? '✓ Gespeichert!' : '💾 Einstellungen speichern'}
        </button>
      </div>

      {/* Auth Modal for saving protected actions changes */}
      {showSaveAuth && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <h3 className="text-xl font-bold mb-2 text-center">PIN erforderlich</h3>
            <p className="text-sm text-gray-600 mb-3 text-center">
              Bitte Admin-PIN oder Master-Passwort eingeben, um geschützte Aktionen zu ändern.
            </p>
            <div className="relative mb-3">
              <input
                type={showSaveAuthVisible ? 'text' : 'password'}
                value={saveAuth}
                onChange={(e) => { setSaveAuth(e.target.value); setSaveAuthError(''); }}
                className={`w-full bg-slate-100 border ${saveAuthError ? 'border-red-500' : 'border-slate-300'} rounded-lg px-3 py-2 pr-10`}
                placeholder="PIN oder Master-Passwort"
                autoFocus
                onKeyDown={async (e) => { if (e.key === 'Enter') {
                  const ok = (await verifyAdminPin(saveAuth)) || verifyMasterPassword(saveAuth);
                  if (!ok) { setSaveAuthError('Falscher PIN/Master-Passwort'); return; }
                  setShowSaveAuth(false);
                  setSaveAuth('');
                  setSaveAuthError('');
                  await performSave();
                }}}
              />
              <button
                type="button"
                onClick={() => setShowSaveAuthVisible(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
              >
                {showSaveAuthVisible ? '🙈' : '👁️'}
              </button>
              {saveAuthError && (
                <div className="text-red-500 text-xs mt-1">{saveAuthError}</div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowSaveAuth(false); setSaveAuth(''); setSaveAuthError(''); }}
                className="flex-1 py-2 bg-slate-200 rounded-lg font-bold"
              >
                Abbrechen
              </button>
              <button
                onClick={async () => {
                  const ok = (await verifyAdminPin(saveAuth)) || verifyMasterPassword(saveAuth);
                  if (!ok) { setSaveAuthError('Falscher PIN/Master-Passwort'); return; }
                  setShowSaveAuth(false);
                  setSaveAuth('');
                  setSaveAuthError('');
                  await performSave();
                }}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold"
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
