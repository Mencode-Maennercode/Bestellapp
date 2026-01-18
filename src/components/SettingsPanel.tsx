import { useState, useEffect, useRef } from 'react';
import { 
  AppSettings, 
  defaultSettings, 
  getSettings, 
  saveSettings, 
  ThekeConfig,
  Language,
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
  const [activeTab, setActiveTab] = useState<'general' | 'theken' | 'colors' | 'broadcast'>('general');

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

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Fehler beim Speichern!');
    }
    setSaving(false);
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
          { id: 'general', label: '🌐 Allgemein' },
          { id: 'theken', label: '🍺 Theken' },
          { id: 'colors', label: '🎨 Logo/Farben' },
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

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Language */}
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

          {/* Table Plan Image */}
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
                    className="w-full py-4 border-2 border-dashed border-blue-600 rounded-lg hover:border-blue-500 transition-colors text-blue-400"
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

          {/* Admin URLs Info */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h3 className="text-lg font-semibold mb-3">🔐 Admin-Zugang</h3>
            <p className="text-slate-400 text-sm mb-3">
              Code: <span className="font-mono font-bold text-blue-400">A267</span>
            </p>
            <div className="space-y-1 text-sm font-mono text-slate-400">
              <div>/bar/A267 - Haupttheke</div>
              <div>/bar1/A267 - Theke 2</div>
              <div>/kellner/A267 - Kellner</div>
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

      {/* Colors Tab */}
      {activeTab === 'colors' && (
        <div className="space-y-4">
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
    </div>
  );
}
