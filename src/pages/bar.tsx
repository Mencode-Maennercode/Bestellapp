import { useState, useEffect, useCallback, useRef } from 'react';
import { database, ref, onValue, remove, set, get } from '@/lib/firebase';
import { getTableNumber } from '@/lib/tables';
import QRCode from 'qrcode';
import AdminMenu from '@/components/AdminMenu';
import SystemPrepModal from '@/components/SystemPrepModal';
import SlidePanel from '@/components/SlidePanel';
import SettingsPanel from '@/components/SettingsPanel';
import StatisticsPanel from '@/components/StatisticsPanel';
import BroadcastPanel from '@/components/BroadcastPanel';
import { AppSettings, defaultSettings, subscribeToSettings, getWaitersForTable, WaiterAssignment, BroadcastMessage, subscribeToBroadcast, markBroadcastAsRead, verifyAdminPin } from '@/lib/settings';

interface Order {
  id: string;
  tableCode: string;
  tableNumber: number;
  type: 'order' | 'waiter_call';
  items?: { name: string; price: number; quantity: number }[];
  total?: number;
  timestamp: number;
  status: string;
  orderedBy?: string; // Waiter name if order was placed by waiter
  claimedBy?: string; // Waiter who claimed this order
  claimedAt?: number;
  hiddenFromBar?: boolean; // Hide from bar view (after waiter double-click)
  completedByWaiter?: boolean; // Waiter completed this order (after long-click)
  statsRecorded?: boolean; // Statistics already recorded for this order
}

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

type AlertPhase = 'red-blink' | 'red-solid' | 'orange' | 'green' | 'expired';

function getAlertPhase(timestamp: number, autoHideMinutes: number = 6): AlertPhase {
  const elapsed = Date.now() - timestamp;
  const minutes = elapsed / 60000;
  
  if (minutes < 1) return 'red-blink'; // 0-1 Min: Rot blinkend
  if (minutes < 2) return 'red-solid'; // 1-2 Min: Rot ohne blinken
  if (minutes < 4) return 'orange'; // 2-4 Min: Orange ohne blinken
  // Use autoHideMinutes setting (0 = never expire)
  if (autoHideMinutes === 0) return 'green'; // Never expire
  if (minutes < autoHideMinutes) return 'green'; // Within auto-hide window
  return 'expired';
}

function getAlertClass(phase: AlertPhase): string {
  switch (phase) {
    case 'red-blink': return 'alert-red-blink';
    case 'red-solid': return 'bg-red-600';
    case 'orange': return 'bg-orange-500';
    case 'green': return 'bg-green-600';
    default: return '';
  }
}

interface BarDashboardProps {
  thekeIndex?: number; // 0 = Haupttheke, 1 = bar1, 2 = bar2, etc.
}

export default function BarDashboard({ thekeIndex = 0 }: BarDashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [showWaiterQR, setShowWaiterQR] = useState(false);
  const [waiterQRCode, setWaiterQRCode] = useState('');
  const [isShutdown, setIsShutdown] = useState(false);
  const [isOrderFormDisabled, setIsOrderFormDisabled] = useState(false);
  const [, setTick] = useState(0);
  const [showStatistics, setShowStatistics] = useState(false);
  const [showSystemPrep, setShowSystemPrep] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [waiterAssignments, setWaiterAssignments] = useState<WaiterAssignment[]>([]);
  const [selectedThekeId, setSelectedThekeId] = useState<string | null>(null);
  
  // PIN Modal State (generalized)
  // Keep showPinModal values identical to settings.pinProtection keys
  const [showPinModal, setShowPinModal] = useState<
    | 'systemShutdown'
    | 'orderFormToggle'
    | 'productsPage'
    | 'settings'
    | 'broadcast'
    | 'tableManagement'
    | 'statistics'
    | null
  >(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);
  const pendingActionRef = useRef<null | (() => Promise<void> | void)>(null);
  const [showTablePlan, setShowTablePlan] = useState(false);
  const [broadcast, setBroadcast] = useState<BroadcastMessage | null>(null);
  const [broadcastDismissed, setBroadcastDismissed] = useState(false);
  const [lastSeenBroadcastTime, setLastSeenBroadcastTime] = useState<number>(0);

  // Load broadcast read status from localStorage on mount
  useEffect(() => {
    const savedBroadcastTime = localStorage.getItem('lastSeenBroadcastTime');
    if (savedBroadcastTime) {
      setLastSeenBroadcastTime(parseInt(savedBroadcastTime, 10));
    }
  }, []);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showProductsPanel, setShowProductsPanel] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [showBroadcastPanel, setShowBroadcastPanel] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPin, setResetPin] = useState('');
  const [resetting, setResetting] = useState(false);
  const [showWaiterResetModal, setShowWaiterResetModal] = useState(false);
  const [pageLoadTime] = useState(() => Date.now()); // Track when page was loaded
  const [statistics, setStatistics] = useState<Statistics>({
    tables: {},
    totalAmount: 0,
    totalOrders: 0,
    itemTotals: {}
  });

  // Force re-render every 10 seconds to update alert phases
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const ordersRef = ref(database, 'orders');
    console.log('Bar: Setting up Firebase listener for orders');
    
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      console.log('Bar: Firebase update received', snapshot.exists());
      const data = snapshot.val();
      if (data) {
        const orderList: Order[] = Object.entries(data).map(([id, order]: [string, any]) => ({
          id,
          ...order,
        }));
        // Filter out expired orders based on auto-hide setting
        // Respect settings: 0 = never auto-hide, otherwise enforce minimum 5 minutes
        const rawAutoHide = settings.orderAutoHideMinutes ?? 6;
        const autoHideMinutes = rawAutoHide === 0 ? 0 : Math.max(rawAutoHide, 5);
        const filteredOrders = orderList.filter(order => 
          getAlertPhase(order.timestamp, autoHideMinutes) !== 'expired'
        );
        // Sort by timestamp descending (newest first)
        filteredOrders.sort((a, b) => b.timestamp - a.timestamp);
        console.log('Bar: Updated orders count:', filteredOrders.length);
        setOrders(filteredOrders);
      } else {
        console.log('Bar: No orders in database');
        setOrders([]);
      }
    }, (error) => {
      console.error('Bar: Firebase listener error:', error);
    });
    
    return () => {
      console.log('Bar: Cleaning up Firebase listener');
      unsubscribe();
    };
  }, [settings.orderAutoHideMinutes]);

  useEffect(() => {
    const shutdownRef = ref(database, 'system/shutdown');
    const unsubscribe = onValue(shutdownRef, (snapshot) => {
      setIsShutdown(snapshot.val() === true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const orderFormRef = ref(database, 'system/orderFormDisabled');
    const unsubscribe = onValue(orderFormRef, (snapshot) => {
      setIsOrderFormDisabled(snapshot.val() === true);
    });
    return () => unsubscribe();
  }, []);

  // Listen for statistics
  useEffect(() => {
    const statsRef = ref(database, 'statistics');
    const unsubscribe = onValue(statsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStatistics(data);
      }
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to settings and auto-select theke based on thekeIndex
  useEffect(() => {
    const unsubscribe = subscribeToSettings((s) => {
      setSettings(s);
      // Auto-select theke based on thekeIndex prop
      if (s.theken && s.theken.length > 0) {
        const targetIndex = Math.min(thekeIndex, s.theken.length - 1);
        setSelectedThekeId(s.theken[targetIndex]?.id || s.theken[0].id);
      }
    });
    return () => unsubscribe();
  }, [thekeIndex]);

  // Subscribe to waiter assignments
  useEffect(() => {
    const assignmentsRef = ref(database, 'waiterAssignments');
    const unsubscribe = onValue(assignmentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setWaiterAssignments(Object.values(data));
      } else {
        setWaiterAssignments([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to broadcast messages
  useEffect(() => {
    const unsubscribe = subscribeToBroadcast((b) => {
      setBroadcast(b);
      // Reset dismissed state when a new message arrives
      if (b && b.active && b.timestamp > lastSeenBroadcastTime) {
        setBroadcastDismissed(false);
      }
    });
    return () => unsubscribe();
  }, [lastSeenBroadcastTime]);

  // Get waiters assigned to a table
  const getWaitersForTableNum = (tableNum: number): string[] => {
    return waiterAssignments
      .filter(a => a.tables && a.tables.includes(tableNum))
      .map(a => a.waiterName);
  };

  // Filter orders by selected theke
  const getFilteredOrders = () => {
    if (!selectedThekeId) return activeOrders;
    
    const selectedTheke = settings.theken?.find(t => t.id === selectedThekeId);
    if (!selectedTheke || !selectedTheke.assignedTables || selectedTheke.assignedTables.length === 0) {
      // No tables assigned = show all orders
      return activeOrders;
    }
    
    // Only show orders for tables assigned to this theke
    return activeOrders.filter(order => 
      selectedTheke.assignedTables.includes(order.tableNumber)
    );
  };

  // BAR SINGLE CLICK - Hide from bar only, stays with waiter
  // Also updates statistics when hiding (order is "done" from bar perspective)
  const handleBarHideOrder = async (orderId: string) => {
    const orderRef = ref(database, `orders/${orderId}`);
    const order = orders.find(o => o.id === orderId);
    if (order) {
      // Update statistics if not already recorded
      if (!order.statsRecorded && order.type === 'order' && order.items) {
        const statsRef = ref(database, 'statistics');
        const currentStats = { 
          tables: statistics.tables || {},
          totalOrders: statistics.totalOrders || 0,
          totalAmount: statistics.totalAmount || 0,
          itemTotals: statistics.itemTotals || {}
        };
        
        if (!currentStats.tables[order.tableNumber]) {
          currentStats.tables[order.tableNumber] = {
            tableNumber: order.tableNumber,
            totalOrders: 0,
            totalAmount: 0,
            items: {}
          };
        }
        
        const tableStats = currentStats.tables[order.tableNumber];
        tableStats.totalOrders += 1;
        tableStats.totalAmount += order.total || 0;
        
        order.items.forEach(item => {
          if (!tableStats.items[item.name]) {
            tableStats.items[item.name] = { quantity: 0, amount: 0 };
          }
          tableStats.items[item.name].quantity += item.quantity;
          tableStats.items[item.name].amount += item.price * item.quantity;
          
          if (!currentStats.itemTotals[item.name]) {
            currentStats.itemTotals[item.name] = { quantity: 0, amount: 0 };
          }
          currentStats.itemTotals[item.name].quantity += item.quantity;
          currentStats.itemTotals[item.name].amount += item.price * item.quantity;
        });
        
        currentStats.totalOrders += 1;
        currentStats.totalAmount += order.total || 0;
        
        await set(statsRef, currentStats);
      }
      
      await set(orderRef, {
        ...order,
        hiddenFromBar: true,
        statsRecorded: true
      });
    }
  };

  // BAR LONG CLICK - Remove completely (from both bar and waiter)
  const handleBarRemoveCompletely = async (orderId: string) => {
    // Find the order to update statistics before removing
    const order = orders.find(o => o.id === orderId);
    // Only update stats if not already recorded
    if (order && !order.statsRecorded && order.type === 'order' && order.items) {
      // Update statistics in Firebase
      const statsRef = ref(database, 'statistics');
      const currentStats = { 
        tables: statistics.tables || {},
        totalOrders: statistics.totalOrders || 0,
        totalAmount: statistics.totalAmount || 0,
        itemTotals: statistics.itemTotals || {}
      };
      
      // Initialize table stats if not exists
      if (!currentStats.tables[order.tableNumber]) {
        currentStats.tables[order.tableNumber] = {
          tableNumber: order.tableNumber,
          totalOrders: 0,
          totalAmount: 0,
          items: {}
        };
      }
      
      const tableStats = currentStats.tables[order.tableNumber];
      tableStats.totalOrders += 1;
      tableStats.totalAmount += order.total || 0;
      
      // Update item counts for table
      order.items.forEach(item => {
        if (!tableStats.items[item.name]) {
          tableStats.items[item.name] = { quantity: 0, amount: 0 };
        }
        tableStats.items[item.name].quantity += item.quantity;
        tableStats.items[item.name].amount += item.price * item.quantity;
        
        // Update global item totals
        if (!currentStats.itemTotals[item.name]) {
          currentStats.itemTotals[item.name] = { quantity: 0, amount: 0 };
        }
        currentStats.itemTotals[item.name].quantity += item.quantity;
        currentStats.itemTotals[item.name].amount += item.price * item.quantity;
      });
      
      // Update global totals
      currentStats.totalOrders += 1;
      currentStats.totalAmount += order.total || 0;
      
      await set(statsRef, currentStats);
    }
    
    // Remove completely
    await remove(ref(database, `orders/${orderId}`));
  };

  // Legacy function - kept for compatibility
  const handleDismiss = async (orderId: string) => {
    await handleBarRemoveCompletely(orderId);
  };

  const isProtected = (key: keyof NonNullable<AppSettings['pinProtection']>['protectedActions']): boolean => {
    return settings.pinProtection?.protectedActions?.[key] === true;
  };

  const requestPinIfNeeded = (
    key: keyof NonNullable<AppSettings['pinProtection']>['protectedActions'],
    action: () => Promise<void> | void
  ) => {
    if (isProtected(key)) {
      pendingActionRef.current = action;
      setShowPinModal(key as any);
      setPin('');
      setPinError(false);
    } else {
      action();
    }
  };

  const handleEmergencyToggle = () => {
    requestPinIfNeeded('systemShutdown', async () => {
      await set(ref(database, 'system/shutdown'), !isShutdown);
    });
  };

  const handleOrderFormToggle = () => {
    requestPinIfNeeded('orderFormToggle', async () => {
      await set(ref(database, 'system/orderFormDisabled'), !isOrderFormDisabled);
    });
  };

  const handlePinConfirm = async () => {
    const ok = await verifyAdminPin(pin);
    if (!ok) {
      setPinError(true);
      setTimeout(() => setPinError(false), 2000);
      return;
    }
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setShowPinModal(null);
    setPin('');
    setPinError(false);
    if (action) await action();
  };

  // Trigger menu refresh on all client devices
  const handleMenuRefresh = async () => {
    await set(ref(database, 'system/menuVersion'), Date.now());
  };

  const handleResetStatistics = async () => {
    const ok = await verifyAdminPin(resetPin);
    if (!ok) { alert('Falscher PIN!'); return; }

    setResetting(true);
    try {
      await set(ref(database, 'statistics'), {
        tables: {},
        totalAmount: 0,
        totalOrders: 0,
        itemTotals: {}
      });
      setShowResetModal(false);
      setResetPin('');
      alert('Statistiken wurden zurückgesetzt!');
    } catch (err) {
      console.error('Error resetting statistics:', err);
      alert('Fehler beim Zurücksetzen!');
    }
    setResetting(false);
  };

  // Reset all waiter assignments
  const handleResetWaiterAssignments = async () => {
    try {
      // Send broadcast to all waiters to clear their local table assignments
      await set(ref(database, 'broadcast'), {
        message: '🔄 Deine Tischzuordnung wurde zurückgesetzt. Du kannst neue Tische hinzufügen.',
        target: 'waiters',
        timestamp: Date.now(),
        active: true
      });
      
      // Clear all table assignments in Firebase
      await set(ref(database, 'waiterAssignments'), null);
      
      setShowWaiterResetModal(false);
      setShowWaiterQR(false);
      alert('✅ Alle Kellner-Zuordnungen wurden zurückgesetzt! Die Kellner bleiben angemeldet und können neue Tische hinzufügen.');
    } catch (err) {
      console.error('Error resetting waiter assignments:', err);
      alert('❌ Fehler beim Zurücksetzen!');
    }
  };

  // Filter out expired orders and orders hidden from bar
  const activeOrders = orders.filter(order => 
    getAlertPhase(order.timestamp) !== 'expired' && 
    !order.hiddenFromBar
  );

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleShowWaiterQR = async () => {
    const waiterUrl = `${window.location.origin}/kellner`;
    const qrDataUrl = await QRCode.toDataURL(waiterUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#009640',
        light: '#FFFFFF',
      },
    });
    setWaiterQRCode(qrDataUrl);
    setShowWaiterQR(true);
  };

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #0f1419 0%, #1a1f26 100%)' }}>
      {/* Modern Header */}
      <header className="sticky top-0 z-10 border-b border-white/5" style={{ background: 'rgba(15,20,25,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-xl font-bold">
                T
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Theke Dashboard</h1>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {getFilteredOrders().length} aktive Bestellungen
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {settings.tablePlanImage && (
                <button
                  onClick={() => setShowTablePlan(true)}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all"
                >
                  🗺️ Plan
                </button>
              )}
              <button
                onClick={() => requestPinIfNeeded('statistics', () => setShowStatistics(true))}
                className="px-6 py-3 rounded-xl font-bold text-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all flex items-center gap-2"
              >
                📊 Statistik
              </button>
              <button
                onClick={handleShowWaiterQR}
                className="px-6 py-3 rounded-xl font-bold text-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-2"
              >
                👤 Kellner
              </button>
              <div className="ml-4">
                <AdminMenu
                  isShutdown={isShutdown}
                  isOrderFormDisabled={isOrderFormDisabled}
                  onEmergencyToggle={handleEmergencyToggle}
                  onOrderFormToggle={handleOrderFormToggle}
                  onMenuRefresh={handleMenuRefresh}
                  onShowWaiterQR={handleShowWaiterQR}
                  onShowSystemPrep={() => setShowSystemPrep(true)}
                  onShowSettings={() => requestPinIfNeeded('settings', () => setShowSettingsPanel(true))}
                  onShowProducts={() => requestPinIfNeeded('productsPage', () => setShowProductsPanel(true))}
                  onShowBroadcast={() => requestPinIfNeeded('broadcast', () => setShowBroadcastPanel(true))}
                  protectedFlags={settings.pinProtection?.protectedActions}
                />
              </div>
            </div>
          </div>
          
          {/* Theke Tabs */}
          {(settings.theken?.length || 0) > 1 && (
            <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
              {(settings.theken || []).map(theke => (
                <button
                  key={theke.id}
                  onClick={() => setSelectedThekeId(theke.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    selectedThekeId === theke.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {theke.name}
                  {(theke.assignedTables?.length || 0) > 0 && (
                    <span className="ml-2 text-xs opacity-60">
                      ({theke.assignedTables.length})
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Shutdown Banner */}
      {isShutdown && (
        <div className="bg-red-600 p-4 text-center">
          <p className="text-2xl font-bold">⚠️ SYSTEM ABGESCHALTET ⚠️</p>
          <p>Gäste sehen eine Abschaltungs-Meldung</p>
        </div>
      )}

      {/* Order Form Disabled Banner */}
      {isOrderFormDisabled && !isShutdown && (
        <div className="bg-yellow-600 p-4 text-center">
          <p className="text-2xl font-bold">🚫 BESTELLFORMULAR GESPERRT 🚫</p>
          <p>Gäste können nur den Köbes-Button nutzen</p>
        </div>
      )}

      {/* Orders Grid */}
      <div className="max-w-6xl mx-auto p-4">
        {getFilteredOrders().length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">☕</p>
            <p className="text-2xl text-gray-500">Keine aktiven Meldungen</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getFilteredOrders().map((order) => {
              const phase = getAlertPhase(order.timestamp);
              const assignedWaiters = getWaitersForTableNum(order.tableNumber);
              const isWaiterOrder = !!order.orderedBy;
              const displayWaiter = order.claimedBy || order.orderedBy;
              let longPressTimer: NodeJS.Timeout | null = null;
              
              const handleBarClick = () => {
                // Single click - hide from bar only (stays with waiter)
                handleBarHideOrder(order.id);
              };
              
              const handleBarLongPressStart = () => {
                longPressTimer = setTimeout(() => {
                  // Long press - remove completely (from both bar and waiter)
                  handleBarRemoveCompletely(order.id);
                }, 800);
              };
              
              const handleBarLongPressEnd = () => {
                if (longPressTimer) {
                  clearTimeout(longPressTimer);
                  longPressTimer = null;
                }
              };
              
              return (
                <div
                  key={order.id}
                  onClick={handleBarClick}
                  onTouchStart={handleBarLongPressStart}
                  onTouchEnd={handleBarLongPressEnd}
                  onMouseDown={handleBarLongPressStart}
                  onMouseUp={handleBarLongPressEnd}
                  onMouseLeave={handleBarLongPressEnd}
                  className={`rounded-xl p-4 mb-3 cursor-pointer transition-all hover:opacity-80 text-white ${getAlertClass(phase)}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="bar-table-number">
                        T{order.tableNumber}
                      </span>
                      {/* Show assigned waiters in parentheses */}
                      {assignedWaiters.length > 0 && (
                        <span className="text-lg ml-2">
                          (
                          {assignedWaiters.map((w, i) => (
                            <span 
                              key={w}
                              className={displayWaiter === w ? 'text-green-300 font-bold' : ''}
                            >
                              {w}{i < assignedWaiters.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                          )
                        </span>
                      )}
                    </div>
                    <span className="text-lg opacity-80">
                      {formatTime(order.timestamp)}
                    </span>
                  </div>
                  
                  {order.type === 'waiter_call' ? (
                    <div className="bar-display">
                      <span className="text-3xl">🙋</span>
                      <span className="ml-2">Kellner gerufen</span>
                    </div>
                  ) : (
                    <div>
                      <div className="bar-display mb-2">
                        <span className="text-3xl">🛒</span>
                        <span className="ml-2">Bestellung</span>
                        {/* Show if waiter placed the order (green) */}
                        {isWaiterOrder && (
                          <span className="ml-2 text-sm bg-green-500 text-white px-2 py-0.5 rounded">
                            von {order.orderedBy}
                          </span>
                        )}
                      </div>
                      {order.items && (
                        <div className="space-y-1 text-xl">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>{item.quantity}x {item.name}</span>
                              <span>{(item.price * item.quantity).toFixed(2)} €</span>
                            </div>
                          ))}
                          <div className="border-t border-white/30 pt-2 mt-2 font-bold text-2xl">
                            Gesamt: {order.total?.toFixed(2)} €
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Show claimed by info */}
                  {order.claimedBy && (
                    <p className="text-sm mt-2 bg-green-600/50 rounded px-2 py-1">
                      ✓ Übernommen von: <span className="font-bold">{order.claimedBy}</span>
                    </p>
                  )}
                  
                  <p className="text-sm mt-3 opacity-70">
                    👆 Klick: Von Bar entfernen | 👆⏱️ Lang: Komplett löschen
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Waiter QR Modal */}
      {showWaiterQR && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowWaiterQR(false)}>
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-black" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-4 text-evm-green text-center">
              👤 Kellner-Zugang
            </h2>
            <p className="mb-4 text-gray-700 text-center">
              Kellner können diesen QR-Code scannen, um sich anzumelden.
            </p>
            {waiterQRCode && (
              <div className="flex justify-center mb-4">
                <img src={waiterQRCode} alt="Kellner QR Code" className="rounded-xl shadow-lg" />
              </div>
            )}
            <p className="text-sm text-gray-500 text-center mb-4">
              {window.location.origin}/kellner
            </p>
            <div className="flex gap-3 mb-3">
              <button
                onClick={() => window.open(`${window.location.origin}/kellner`, '_blank')}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold"
              >
                Demo Kellner öffnen
              </button>
              <button
                onClick={() => setShowWaiterQR(false)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold"
              >
                Schließen
              </button>
            </div>
            <button
              onClick={() => setShowWaiterResetModal(true)}
              className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
            >
              🔄 Alle Kellner zurücksetzen
            </button>
            <p className="text-xs text-gray-500 text-center mt-2">
              Entfernt alle Tisch-Zuordnungen
            </p>
          </div>
        </div>
      )}

      {/* Waiter Reset Confirmation Modal */}
      {showWaiterResetModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-gray-900">
            <h3 className="text-xl font-bold mb-2 text-center text-red-600">🔄 Kellner zurücksetzen?</h3>
            <p className="text-gray-600 text-sm text-center mb-4">
              Alle Kellner-Zuordnungen werden gelöscht. Die Kellner müssen sich neu anmelden und ihre Tische erneut zuordnen.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWaiterResetModal(false)}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold"
              >
                Abbrechen
              </button>
              <button
                onClick={handleResetWaiterAssignments}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold"
              >
                🔄 Zurücksetzen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Modal */}
      {showStatistics && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 overflow-auto">
          <div className="bg-white rounded-2xl p-6 max-w-4xl w-full text-gray-900 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-purple-600">📊 Statistik</h2>
              <button
                onClick={() => setShowStatistics(false)}
                className="text-3xl text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            {/* Global Summary */}
            <div className="bg-purple-100 rounded-xl p-4 mb-6">
              <h3 className="text-xl font-bold text-purple-800 mb-3">📈 Gesamt</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-3xl font-bold text-purple-600">{statistics.totalOrders}</p>
                  <p className="text-gray-600">Bestellungen</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-3xl font-bold text-green-600">{(statistics.totalAmount || 0).toFixed(2)} €</p>
                  <p className="text-gray-600">Umsatz</p>
                </div>
              </div>
              
              {/* Most ordered items globally */}
              {statistics.itemTotals && Object.keys(statistics.itemTotals).length > 0 && (
                <div className="mt-4">
                  <p className="font-bold text-purple-800 mb-2">🏆 Meistbestellt:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(statistics.itemTotals)
                      .sort((a, b) => b[1].quantity - a[1].quantity)
                      .map(([name, data]) => (
                        <span key={name} className="bg-white px-3 py-1 rounded-full text-sm font-bold">
                          {name}: {data.quantity}x ({(data.amount || 0).toFixed(2)} €)
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Per Table Statistics */}
            <h3 className="text-xl font-bold text-gray-800 mb-3">🪑 Nach Tisch</h3>
            {!statistics.tables || Object.keys(statistics.tables).length === 0 ? (
              <p className="text-gray-500 text-center py-8">Noch keine Bestellungen abgeschlossen</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {statistics.tables && Object.values(statistics.tables)
                  .sort((a, b) => b.totalAmount - a.totalAmount)
                  .map((table) => (
                    <div key={table.tableNumber} className="border-2 border-gray-200 rounded-xl p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-2xl font-bold text-evm-green">T{table.tableNumber}</span>
                        <span className="text-lg font-bold text-green-600">{(table.totalAmount || 0).toFixed(2)} €</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{table.totalOrders} Bestellungen</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(table.items)
                          .sort((a, b) => b[1].quantity - a[1].quantity)
                          .map(([name, data]) => (
                            <span key={name} className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                              {name}: {data.quantity}x
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
            
            {/* CSV Export Button */}
            <button
              onClick={() => {
                // Generate CSV content
                let csv = 'Kategorie;Produkt;Anzahl;Umsatz\n';
                
                // Add item totals
                if (statistics.itemTotals) {
                  Object.entries(statistics.itemTotals)
                    .sort((a, b) => b[1].quantity - a[1].quantity)
                    .forEach(([name, data]) => {
                      csv += `Gesamt;${name};${data.quantity};${(data.amount || 0).toFixed(2).replace('.', ',')}\n`;
                    });
                }
                
                csv += '\n';
                csv += 'Tisch;Bestellungen;Umsatz\n';
                
                // Add table statistics
                if (statistics.tables) {
                  Object.values(statistics.tables)
                    .sort((a, b) => b.totalAmount - a.totalAmount)
                    .forEach((table) => {
                      csv += `Tisch ${table.tableNumber};${table.totalOrders};${(table.totalAmount || 0).toFixed(2).replace('.', ',')}\n`;
                    });
                }
                
                csv += '\n';
                csv += 'Zusammenfassung\n';
                csv += `Gesamtbestellungen;${statistics.totalOrders}\n`;
                csv += `Gesamtumsatz;${(statistics.totalAmount || 0).toFixed(2).replace('.', ',')} EUR\n`;
                
                // Download CSV
                const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `statistik-${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              }}
              className="w-full mt-4 py-3 bg-green-600 text-white hover:bg-green-700 rounded-lg font-bold transition-colors"
            >
              📥 Als CSV herunterladen
            </button>
            
            {/* Reset Button above close button */}
            <button
              onClick={() => setShowResetModal(true)}
              className="w-full mt-2 py-3 bg-red-600 text-white hover:bg-red-700 rounded-lg font-bold transition-colors"
            >
              🗑️ Statistiken zurücksetzen
            </button>
            <p className="text-xs text-gray-500 text-center mt-2">PIN geschützt</p>
            
            <button
              onClick={() => setShowStatistics(false)}
              className="w-full mt-4 py-3 bg-purple-600 text-white rounded-xl font-bold text-xl"
            >
              Schließen
            </button>
          </div>
        </div>
      )}

      {/* System Preparation Modal */}
      <SystemPrepModal isOpen={showSystemPrep} onClose={() => setShowSystemPrep(false)} />

      {/* Table Plan Modal */}
      {showTablePlan && settings.tablePlanImage && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTablePlan(false)}
        >
          <div className="relative max-w-6xl w-full max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowTablePlan(false)}
              className="absolute -top-12 right-0 text-white text-xl bg-gray-800 px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              ✕ Schließen
            </button>
            <img 
              src={settings.tablePlanImage} 
              alt="Tischplan" 
              className="w-full h-full object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      
      {/* Slide Panels */}
      <SlidePanel
        isOpen={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        title="⚙️ Einstellungen"
        width="lg"
      >
        <SettingsPanel onSaved={() => {}} />
      </SlidePanel>

      <SlidePanel
        isOpen={showStatsPanel}
        onClose={() => setShowStatsPanel(false)}
        title="📊 Statistiken"
        width="lg"
      >
        <StatisticsPanel statistics={statistics} onResetClick={() => setShowResetModal(true)} />
      </SlidePanel>

      {/* Tische verwalten: jetzt unter Einstellungen im Tab "Tische verwalten" */}

      {/* Full-Screen Products Panel with slide-in animation */}
      <div 
        className={`fixed inset-0 z-50 transition-transform duration-300 ease-in-out ${
          showProductsPanel ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ pointerEvents: showProductsPanel ? 'auto' : 'none' }}
      >
        <div className="h-full bg-gray-100 overflow-auto">
          <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-lg">
            <div className="max-w-6xl mx-auto flex justify-between items-center">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span>🍺</span> Produkte & Preise
              </h2>
              <button
                onClick={() => setShowProductsPanel(false)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-bold transition-colors flex items-center gap-2"
              >
                <span>✕</span> Schließen
              </button>
            </div>
          </div>
          {showProductsPanel && (
            <iframe
              src="/produkte"
              className="w-full border-0"
              style={{ height: 'calc(100vh - 72px)' }}
              title="Produkte & Preise"
            />
          )}
        </div>
      </div>

      <SlidePanel
        isOpen={showBroadcastPanel}
        onClose={() => setShowBroadcastPanel(false)}
        title="📢 Nachricht senden"
        width="md"
      >
        <BroadcastPanel />
      </SlidePanel>

      {/* Reset Statistics Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full border border-slate-700">
            <h3 className="text-xl font-bold mb-2 text-center">🗑️ Statistiken zurücksetzen</h3>
            <p className="text-slate-400 text-sm text-center mb-4">
              Alle Statistiken werden unwiderruflich gelöscht!
            </p>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={resetPin}
              onChange={(e) => setResetPin(e.target.value)}
              placeholder="PIN eingeben"
              className="w-full p-3 text-xl text-center bg-slate-700 border border-slate-600 rounded-xl mb-4 font-mono"
              maxLength={4}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleResetStatistics()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetPin('');
                }}
                className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-xl font-bold"
              >
                Abbrechen
              </button>
              <button
                onClick={handleResetStatistics}
                disabled={resetting}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold"
              >
                {resetting ? '...' : '🗑️ Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-gray-900 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-3xl mx-auto mb-4">
                {{
                  systemShutdown: isShutdown ? '🔓' : '🚨',
                  orderFormToggle: isOrderFormDisabled ? '🛒' : '🚫',
                  productsPage: '🍺',
                  settings: '⚙️',
                  broadcast: '📢',
                  tableManagement: '🪑',
                  statistics: '📊'
                }[showPinModal as Exclude<typeof showPinModal, null>]}
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {{
                  systemShutdown: isShutdown ? 'System aktivieren' : 'Notfall-Abschaltung',
                  orderFormToggle: isOrderFormDisabled ? 'Bestellungen aktivieren' : 'Bestellungen sperren',
                  productsPage: 'Produkte & Preise öffnen',
                  settings: 'Einstellungen öffnen',
                  broadcast: 'Nachricht senden öffnen',
                  tableManagement: 'Tische verwalten öffnen',
                  statistics: 'Statistik öffnen'
                }[showPinModal as Exclude<typeof showPinModal, null>]}
              </h2>
              <p className="text-gray-600 text-sm">
                {{
                  systemShutdown: isShutdown
                    ? 'Gib den PIN ein, um das System wieder zu aktivieren.'
                    : 'Gib den PIN ein, um das Bestellsystem abzuschalten. Gäste sehen dann eine Hinweis-Meldung.',
                  orderFormToggle: isOrderFormDisabled
                    ? 'Gib den PIN ein, um das Bestellformular für alle Tische wieder zu aktivieren.'
                    : 'Gib den PIN ein, um das Bestellformular für alle Tische zu sperren. Der "Köbes komm ran" Button bleibt sichtbar!',
                  productsPage: 'Bitte Admin-PIN eingeben, um Produkte & Preise zu öffnen.',
                  settings: 'Bitte Admin-PIN eingeben, um die Einstellungen zu öffnen.',
                  broadcast: 'Bitte Admin-PIN eingeben, um die Broadcast-Funktion zu öffnen.',
                  tableManagement: 'Bitte Admin-PIN eingeben, um Tische/QR-Verwaltung zu öffnen.',
                  statistics: 'Bitte Admin-PIN eingeben, um Statistiken zu öffnen.'
                }[showPinModal as Exclude<typeof showPinModal, null>]}
              </p>
            </div>
            
            <div className="mb-6">
              <div className="relative">
                <input
                  type={pinVisible ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setPinError(false);
                  }}
                  placeholder="••••"
                  className={`w-full p-4 text-3xl text-center border-2 rounded-xl font-mono transition-all ${
                    pinError 
                      ? 'border-red-500 bg-red-50 text-red-600' 
                      : 'border-gray-300 bg-gray-50 focus:border-blue-500 focus:bg-white'
                  }`}
                  maxLength={4}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handlePinConfirm()}
                />
                <button
                  type="button"
                  onClick={() => setPinVisible(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  aria-label={pinVisible ? 'PIN verbergen' : 'PIN anzeigen'}
                >
                  {pinVisible ? '🙈' : '👁️'}
                </button>
                {pinError && (
                  <div className="absolute -top-6 left-0 right-0 text-center">
                    <span className="text-red-500 text-sm font-medium">❌ Falscher PIN!</span>
                  </div>
                )}
              </div>
              
              {/* PIN Indicators */}
              <div className="flex justify-center gap-2 mt-4">
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className={`w-3 h-3 rounded-full transition-all ${
                      pin.length > index 
                        ? (pinError ? 'bg-red-500' : 'bg-blue-500') 
                        : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPinModal(null);
                  setPin('');
                  setPinError(false);
                }}
                className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
              >
                Abbrechen
              </button>
              <button
                onClick={handlePinConfirm}
                disabled={pin.length !== 4}
                className={`flex-1 px-6 py-4 text-white rounded-xl font-bold transition-all ${
                  pin.length !== 4 
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : (({
                        systemShutdown: isShutdown ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700',
                        orderFormToggle: isOrderFormDisabled ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700',
                        productsPage: 'bg-blue-600 hover:bg-blue-700',
                        settings: 'bg-slate-700 hover:bg-slate-600',
                        broadcast: 'bg-amber-600 hover:bg-amber-700',
                        tableManagement: 'bg-teal-600 hover:bg-teal-700',
                        statistics: 'bg-purple-600 hover:bg-purple-700'
                      } as any)[showPinModal as Exclude<typeof showPinModal, null>])
                }`}
              >
                {{
                  systemShutdown: isShutdown ? '✅ Aktivieren' : '🚨 Abschalten',
                  orderFormToggle: isOrderFormDisabled ? '✅ Aktivieren' : '🔒 Sperren',
                  productsPage: 'Öffnen',
                  settings: 'Öffnen',
                  broadcast: 'Öffnen',
                  tableManagement: 'Öffnen',
                  statistics: 'Öffnen'
                }[showPinModal as Exclude<typeof showPinModal, null>]}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Message Banner (for bars/theken) - show new messages that haven't been seen */}
      {broadcast && broadcast.active && !broadcastDismissed && (broadcast.target === 'all' || broadcast.target === 'bars') && broadcast.timestamp > lastSeenBroadcastTime && (
        <div className="fixed top-20 left-4 right-4 z-40">
          <div className="max-w-lg mx-auto bg-blue-600 text-white p-4 rounded-xl shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📢</span>
              <div className="flex-1">
                <p className="font-bold">{broadcast.message}</p>
                <p className="text-sm opacity-70 mt-1">
                  {new Date(broadcast.timestamp).toLocaleTimeString('de-DE')}
                </p>
              </div>
              <button
                onClick={() => {
                  markBroadcastAsRead(undefined, undefined, 'Haupttheke');
                  setBroadcastDismissed(true);
                  setLastSeenBroadcastTime(broadcast.timestamp);
                  // Save to localStorage to persist across page reloads
                  localStorage.setItem('lastSeenBroadcastTime', broadcast.timestamp.toString());
                }}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-bold transition-colors"
              >
                Gelesen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
