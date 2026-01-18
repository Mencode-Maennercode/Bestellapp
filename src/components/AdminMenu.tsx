import { useState } from 'react';

interface AdminMenuProps {
  isShutdown: boolean;
  isOrderFormDisabled: boolean;
  onEmergencyToggle: () => void;
  onOrderFormToggle: () => void;
  onMenuRefresh: () => void;
  onShowWaiterQR: () => void;
  onShowSystemPrep?: () => void;
  onShowBroadcast?: () => void;
  onShowSettings?: () => void;
  onShowProducts?: () => void;
  onShowQRCodes?: () => void;
}

const AdminMenu: React.FC<AdminMenuProps> = (props) => {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    {
      id: 'settings',
      icon: '⚙️',
      label: 'Einstellungen',
      color: 'bg-slate-600 hover:bg-slate-500',
      action: () => { props.onShowSettings?.(); setIsOpen(false); },
      requiresPin: false,
    },
    {
      id: 'products',
      icon: '🍺',
      label: 'Produkte & Preise',
      color: 'bg-blue-600 hover:bg-blue-500',
      action: () => { props.onShowProducts?.(); setIsOpen(false); },
      requiresPin: false,
    },
        {
      id: 'tables',
      icon: '🪑',
      label: 'Tische',
      color: 'bg-teal-600 hover:bg-teal-500',
      action: () => { props.onShowQRCodes?.(); setIsOpen(false); },
      requiresPin: false,
    },
    {
      id: 'broadcast',
      icon: '📢',
      label: 'Nachricht senden',
      color: 'bg-amber-600 hover:bg-amber-500',
      action: () => { props.onShowBroadcast?.(); setIsOpen(false); },
      requiresPin: false,
    },
        {
      id: 'order-form',
      icon: props.isOrderFormDisabled ? '🛒' : '🚫',
      label: props.isOrderFormDisabled ? 'Bestellungen aktivieren' : 'Bestellungen sperren',
      color: props.isOrderFormDisabled ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-orange-600 hover:bg-orange-500',
      action: () => { props.onOrderFormToggle(); setIsOpen(false); },
      requiresPin: true,
    },
    {
      id: 'emergency',
      icon: props.isShutdown ? '✅' : '🚨',
      label: props.isShutdown ? 'System aktivieren' : 'NOTFALL-STOPP',
      color: props.isShutdown ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500',
      action: () => { props.onEmergencyToggle(); setIsOpen(false); },
      requiresPin: true,
    },
  ];

  return (
    <>
      {/* Admin Menu Button */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-6 py-3 rounded-xl font-bold text-xl bg-gray-700 hover:bg-gray-600 transition-all flex items-center gap-2"
        >
          ⚙️
          <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 z-50">
            <div className="p-2">
              <div className="px-4 py-2 text-sm text-gray-400 font-semibold border-b border-gray-700 mb-2">
                System-Verwaltung
              </div>
              
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={item.action}
                  className={`w-full px-4 py-3 rounded-lg text-left flex items-center gap-3 transition-all ${item.color} text-white mb-1`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <div className="flex-1">
                    <div className="font-semibold">{item.label}</div>
                    {item.requiresPin && (
                      <div className="text-xs opacity-75">PIN geschützt</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminMenu;
