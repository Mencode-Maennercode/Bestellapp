import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { database, ref, onValue, remove, push, set } from '@/lib/firebase';
import { menuItems, categories, formatPrice, MenuItem } from '@/lib/menu';
import { getMenuConfiguration, type MenuConfiguration, getDrinkDatabase, type DrinkDatabase, getCategoryDatabase } from '@/lib/menuManager';
import { AppSettings, defaultSettings, subscribeToSettings, t, Language, BroadcastMessage, subscribeToBroadcast, markBroadcastAsRead, saveWaiterAssignment, getContrastTextColor } from '@/lib/settings';
import { getActualGeneratedTableNumbers } from '@/lib/tables';
import { getTableByNumber } from '@/lib/dynamicTables';
import TablePlanCarousel from '@/components/TablePlanCarousel';

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
  claimedBy?: string; // Waiter who claimed this order (for multi-waiter scenario)
  claimedAt?: number;
  hiddenFromBar?: boolean; // Hide from bar view (after waiter double-click)
  completedByWaiter?: boolean; // Waiter completed this order (after long-click)
  statsRecorded?: boolean; // Statistics already recorded for this order
}

type AlertPhase = 'red' | 'orange' | 'green' | 'expired';

function getAlertPhase(timestamp: number, autoHideMinutes: number = 6): AlertPhase {
  const elapsed = Date.now() - timestamp;
  const minutes = elapsed / 60000;
  if (minutes < 2) return 'red';
  if (minutes < 4) return 'orange';
  // After 4 minutes: green until auto-hide threshold
  // Use autoHideMinutes setting (0 = never expire)
  if (autoHideMinutes === 0) return 'green'; // Never expire
  if (minutes >= autoHideMinutes) return 'expired';
  return 'green';
}

function getAlertBgColor(phase: AlertPhase): string {
  switch (phase) {
    case 'red': return 'bg-red-500';
    case 'orange': return 'bg-orange-500';
    case 'green': return 'bg-green-500';
    default: return 'bg-gray-400';
  }
}

// ============ AUDIO ALARM SYSTEM ============
// Creates a LOUD alarm using Web Audio API - works on ALL devices!
class AlarmSystem {
  private audioContext: AudioContext | null = null;
  private isPlaying = false;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  // Initialize audio context (must be called from user gesture)
  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext.state === 'running';
  }

  // Play a beep sound
  private playBeep(frequency: number, duration: number) {
    if (!this.audioContext) return;
    
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    
    osc.frequency.value = frequency;
    osc.type = 'square'; // Loud, harsh sound
    
    gain.gain.setValueAtTime(0.5, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + duration);
  }

  // Start the alarm - plays repeatedly until stopped
  startAlarm() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    // Play alarm pattern immediately and every 2 seconds
    const playPattern = () => {
      if (!this.isPlaying) return;
      
      // Alarm pattern: high-low-high-low beeps
      this.playBeep(880, 0.2);  // A5
      setTimeout(() => this.playBeep(660, 0.2), 250);  // E5
      setTimeout(() => this.playBeep(880, 0.2), 500);  // A5
      setTimeout(() => this.playBeep(660, 0.2), 750);  // E5
      
      // Also trigger vibration
      if (navigator.vibrate) {
        navigator.vibrate([300, 100, 300, 100, 300, 100, 300]);
      }
    };

    playPattern();
    this.intervalId = setInterval(playPattern, 2000);
  }

  // Stop the alarm
  stopAlarm() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (navigator.vibrate) {
      navigator.vibrate(0); // Stop vibration
    }
  }

  // Test alarm (single beep)
  testAlarm() {
    this.init();
    this.playBeep(880, 0.3);
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  }
}

// Global alarm instance
const alarm = typeof window !== 'undefined' ? new AlarmSystem() : null;

export default function WaiterPage() {
  const [waiterName, setWaiterName] = useState('');
  const [assignedTables, setAssignedTables] = useState<number[]>([]);
  const [isSetup, setIsSetup] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tableInput, setTableInput] = useState('');
  const [tableInputError, setTableInputError] = useState<string | null>(null);
  const [availableTables, setAvailableTables] = useState<number[]>([]);
  const [, setTick] = useState(0);
  const [lastOrderCount, setLastOrderCount] = useState(0);
  const [lastSeenOrderTime, setLastSeenOrderTime] = useState<number>(0);
  
  // NEW: Alarm state
  const [alarmActive, setAlarmActive] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [showActivation, setShowActivation] = useState(true);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const router = useRouter();
  
  // Waiter order form state
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderTableNumber, setOrderTableNumber] = useState<number | null>(null);
  const [orderCart, setOrderCart] = useState<{ [key: string]: number }>({});
  const [orderSent, setOrderSent] = useState(false);
  const [activeOrderCategory, setActiveOrderCategory] = useState<string>('alle');
  const [menuConfig, setMenuConfig] = useState<MenuConfiguration | null>(null);
  const [configuredItems, setConfiguredItems] = useState<MenuItem[]>([]);
  const [drinkDatabase, setDrinkDatabase] = useState<DrinkDatabase | null>(null);
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string; emoji: string }[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);

  // Merge default categories with custom categories (DB overrides defaults by id)
  const mergedCategories = useMemo(() => {
    const defaultMap: Record<string, { id: string; name: string; emoji: string }> = {};
    categories.forEach(c => { defaultMap[c.id] = { ...c }; });
    customCategories.forEach(cc => { defaultMap[cc.id] = { ...defaultMap[cc.id], ...cc }; });
    const defaultsWithOverrides = categories.map(c => defaultMap[c.id]);
    const dbOnly = customCategories.filter(cc => !categories.find(c => c.id === cc.id));
    const all = [...defaultsWithOverrides, ...dbOnly];

    if (!categoryOrder || categoryOrder.length === 0) return all;
    const orderIndex: Record<string, number> = {};
    categoryOrder.forEach((id, idx) => { orderIndex[id] = idx; });
    return [...all].sort((a, b) => {
      const ai = orderIndex[a.id];
      const bi = orderIndex[b.id];
      if (ai === undefined && bi === undefined) return 0;
      if (ai === undefined) return 1;
      if (bi === undefined) return -1;
      return ai - bi;
    });
  }, [customCategories, categoryOrder]);
  
  // Selection modals for waiter
  const [showWaiterBottleSelection, setShowWaiterBottleSelection] = useState(false);
  const [showWaiterBeerCrateSelection, setShowWaiterBeerCrateSelection] = useState(false);
  const [showWaiterWineBottleSelection, setShowWaiterWineBottleSelection] = useState(false);
  const [showWaiterShotSelection, setShowWaiterShotSelection] = useState(false);
  
  // Temporary quantity for waiter modals
  const [waiterTempQuantity, setWaiterTempQuantity] = useState<{ [key: string]: number }>({});
  
  // Glass selection modal for waiter
  const [showGlassModal, setShowGlassModal] = useState(false);
  const [pendingBottleItem, setPendingBottleItem] = useState<MenuItem | null>(null);
  const [glassQuantity, setGlassQuantity] = useState(0);
  const [isAddingGlasses, setIsAddingGlasses] = useState(false);
  
  // Queue system for multiple items requiring glasses
  const [itemQueue, setItemQueue] = useState<{ itemId: string; quantity: number }[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  
  // Statistics for sorting by table orders
  const [statistics, setStatistics] = useState<{ tables: { [key: number]: { items: { [key: string]: { quantity: number } } } } }>({ tables: {} });
  
  // Settings integration
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [broadcast, setBroadcast] = useState<BroadcastMessage | null>(null);
  
  // Collapsible state for "Für den ganzen Tisch" (waiter modal)
  const [isTableSectionCollapsed, setIsTableSectionCollapsed] = useState(true);
  const [broadcastDismissed, setBroadcastDismissed] = useState(false);
  const [lastSeenBroadcastTime, setLastSeenBroadcastTime] = useState<number>(0);

  // Load broadcast read status from localStorage on mount
  useEffect(() => {
    const savedBroadcastTime = localStorage.getItem('lastSeenBroadcastTime');
    if (savedBroadcastTime) {
      setLastSeenBroadcastTime(parseInt(savedBroadcastTime, 10));
    }
  }, []);

  // Load last seen order time to prevent re-alert on refresh
  useEffect(() => {
    const saved = localStorage.getItem('waiter_lastSeenOrderTime');
    if (saved) {
      setLastSeenOrderTime(parseInt(saved, 10));
    }
  }, []);
  
  // Table plan modal state
  const [showTablePlan, setShowTablePlan] = useState(false);
  
  // Add table modal
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [addTableInput, setAddTableInput] = useState('');
  const [addTableError, setAddTableError] = useState<string | null>(null);
  
  // Free booking (order for non-assigned table)
  const [showFreeBookingModal, setShowFreeBookingModal] = useState(false);
  const [freeBookingTableNumber, setFreeBookingTableNumber] = useState<number | null>(null);
  
  // Reset confirmation modal
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  
  // Table assignment removed notification
  const [showTableAssignmentRemovedModal, setShowTableAssignmentRemovedModal] = useState(false);
  const [assignmentRemovedReason, setAssignmentRemovedReason] = useState<'manual' | 'bar'>('manual');
  const [manualResetInProgress, setManualResetInProgress] = useState(false);
  const [isSelfRefreshing, setIsSelfRefreshing] = useState(false);
  
  // Cart preview modal state
  const [showCartPreview, setShowCartPreview] = useState(false);
  
  // Für den Tisch collapsible state
  const [showTableProducts, setShowTableProducts] = useState(false);
  
  // Footer collapsible state
  const [isFooterCollapsed, setIsFooterCollapsed] = useState(true);
  
  // PWA install state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [pageLoadTime] = useState(() => Date.now()); // Track when page was loaded

  // Load available tables from Firebase
  useEffect(() => {
    const loadTables = async () => {
      const tables = await getActualGeneratedTableNumbers();
      setAvailableTables(tables);
    };
    loadTables();
  }, []);

  // Force re-render every 10 seconds to update alert phases
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  // PWA Install Detection
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallButton(false);
    }
    setDeferredPrompt(null);
  };

  // Helper: Load menu configuration and build configured items (merge config into ALL items)
  const loadMenu = useCallback(async () => {
    try {
      const config = await getMenuConfiguration();
      setMenuConfig(config);
      const db = await getDrinkDatabase();
      setDrinkDatabase(db);

      const applyConfig = (base: any, itemConfig: any | undefined): MenuItem => {
        return {
          ...base,
          isPopular: itemConfig?.isPopular ?? base.isPopular ?? false,
          isSoldOut: itemConfig?.isSoldOut ?? base.isSoldOut ?? false,
          // Apply emoji override from configuration
          emoji: itemConfig?.emoji ?? base.emoji,
          // Apply glass configuration from Firebase (critical!)
          askForGlasses: itemConfig?.askForGlasses ?? base.askForGlasses ?? false,
          glassType: itemConfig?.glassType ?? base.glassType ?? 'beer',
          // Apply table section configuration
          tableSection: itemConfig?.tableSection ?? base.tableSection ?? null,
          // Apply custom values
          name: itemConfig?.name ?? base.name,
          price: itemConfig?.price ?? base.price,
          description:
            itemConfig && 'description' in itemConfig
              ? itemConfig.description ?? ''
              : base.description ?? '',
          size:
            itemConfig && 'size' in itemConfig
              ? itemConfig.size
              : base.size,
          category: itemConfig?.category ?? base.category,
        };
      };

      // Only include active items defined in configuration (deleted items disappear)
      const activeItemIds = new Set(Object.keys(config.items || {}));
      const standardItems = menuItems
        .filter((item) => activeItemIds.has(item.id))
        .map((item) => {
          const itemConfig = config.items?.[item.id];
          return applyConfig(item, itemConfig);
        });

      const customItems: MenuItem[] = [];
      if (db && db.drinks) {
        for (const [id, itemConfig] of Object.entries(config.items || {})) {
          if (menuItems.find(mi => mi.id === id)) continue;
          const drink = (db as any).drinks[id];
          if (drink) {
            const base: MenuItem = {
              id,
              name: drink.name,
              emoji: drink.emoji,
              price: drink.price,
              size: drink.size,
              category: drink.category,
              description: drink.description,
            } as any;
            customItems.push(applyConfig(base, itemConfig as any));
          }
        }
      }

      setConfiguredItems([...standardItems, ...customItems]);
    } catch (e) {
      console.error('Failed to load menu configuration for waiter page:', e);
      setConfiguredItems(menuItems);
    }
  }, []);

  // Initial menu load and subscribe to changes (like Tisch page)
  useEffect(() => {
    loadMenu();
    
    // Subscribe to menu and drink database changes to reload config
    const menuVersionRef = ref(database, 'config/menu/lastUpdated');
    const drinkVersionRef = ref(database, 'database/drinks/lastUpdated');
    const unsubMenu = onValue(menuVersionRef, () => { loadMenu(); });
    const unsubDrinks = onValue(drinkVersionRef, () => { loadMenu(); });
    return () => { unsubMenu(); unsubDrinks(); };
  }, [loadMenu]);

  // Load custom categories for tabs and subscribe to updates
  useEffect(() => {
    const loadCustomCategories = async () => {
      try {
        const db = await getCategoryDatabase();
        if (db.categories) {
          const cats = Object.entries(db.categories).map(([id, cat]: [string, any]) => ({
            id,
            name: (cat as any).name,
            emoji: (cat as any).emoji,
          }));
          setCustomCategories(cats);
        }
        if (Array.isArray((db as any).order)) {
          setCategoryOrder((db as any).order as string[]);
        }
      } catch (err) {
        console.error('Failed to load custom categories for waiter page:', err);
      }
    };
    loadCustomCategories();
    const categoryRef = ref(database, 'database/categories/lastUpdated');
    const unsubscribe = onValue(categoryRef, () => { loadCustomCategories(); });
    return () => unsubscribe();
  }, []);

  // Check saved settings on mount
  useEffect(() => {
    const enabled = localStorage.getItem('alarmEnabled') === 'true';
    setAlarmEnabled(enabled);
    setShowActivation(!enabled);
  }, []);

  // Request Wake Lock to keep screen active
  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && isSetup && alarmEnabled) {
        try {
          const lock = await (navigator as any).wakeLock.request('screen');
          setWakeLock(lock);
          console.log('Wake Lock activated - screen will stay on');
        } catch (err) {
          console.log('Wake Lock failed:', err);
        }
      }
    };
    
    requestWakeLock();
    
    // Re-acquire wake lock when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isSetup && alarmEnabled) {
        requestWakeLock();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release();
      }
    };
  }, [isSetup, alarmEnabled]);

  // Load saved waiter data from localStorage
  useEffect(() => {
    // Set self-refresh flag on mount to prevent modal during initial load
    setIsSelfRefreshing(true);
    
    const savedName = localStorage.getItem('waiterName');
    const savedTables = localStorage.getItem('waiterTables');
    
    if (savedName && savedTables) {
      setWaiterName(savedName);
      setAssignedTables(JSON.parse(savedTables));
      setIsSetup(true);
      // Clear manual reset flag since user is now properly logged in again
      setManualResetInProgress(false);
    }
    
    // Clear self-refresh flag after a short delay to allow Bar-triggered resets to work
    const timer = setTimeout(() => {
      setIsSelfRefreshing(false);
    }, 2000); // 2 seconds should be enough for initial load
    
    return () => clearTimeout(timer);
  }, []);

  // Listen to Firebase waiter assignments to detect if current waiter's assignment is removed
  useEffect(() => {
    if (!waiterName || !isSetup) return;

    const assignmentsRef = ref(database, 'waiterAssignments');
    const unsubscribe = onValue(assignmentsRef, (snapshot) => {
      const data = snapshot.val();
      
      // If assignments are completely deleted or this waiter's assignment is missing
      // AND this is not a manual reset (user logging back in after manual reset)
      // AND this is not a self-refresh (waiter refreshing their own page)
      if (!data || !data[waiterName]) {
        // Only clear tables, keep waiter logged in
        setAssignedTables([]);
        localStorage.setItem('waiterTables', JSON.stringify([]));
        
        // Show notification that assignment was removed, but only if not a manual reset and not self-refreshing
        if (!manualResetInProgress && !isSelfRefreshing) {
          setAssignmentRemovedReason('bar');
          setShowTableAssignmentRemovedModal(true);
        }
      }
    });

    return () => unsubscribe();
  }, [waiterName, isSetup, manualResetInProgress, isSelfRefreshing]);

  // Subscribe to orders - trigger alarm on new orders
  useEffect(() => {
    if (!isSetup) return;

    const ordersRef = ref(database, 'orders');
    
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const orderList: Order[] = Object.entries(data).map(([id, order]: [string, any]) => ({
          id,
          ...order,
        }));
        
        // Filter by assigned tables and not expired
        // Also filter out orders claimed by OTHER waiters (not this waiter)
        // And filter out orders that this waiter has completed (long-click)
        // Respect settings: 0 = never auto-hide, otherwise enforce minimum 5 minutes
        const rawAutoHide = settings.orderAutoHideMinutes ?? 6;
        const autoHideMinutes = rawAutoHide === 0 ? 0 : Math.max(rawAutoHide, 5);
        const myOrders = orderList
          .filter(order => {
            // Must be for one of my assigned tables
            if (!assignedTables.includes(order.tableNumber)) return false;
            // Must not be expired (using auto-hide setting)
            if (getAlertPhase(order.timestamp, autoHideMinutes) === 'expired') return false;
            // If claimed by another waiter, don't show to me
            if (order.claimedBy && order.claimedBy !== waiterName) return false;
            // If I completed this order (long-click), don't show
            if (order.completedByWaiter && order.claimedBy === waiterName) return false;
            return true;
          })
          .sort((a, b) => b.timestamp - a.timestamp);
        
        // NEW ORDER DETECTED - TRIGGER ALARM once per unique timestamp and skip self-placed
        if (myOrders.length > 0 && alarmEnabled) {
          const newest = myOrders[0];
          if (newest.timestamp > lastSeenOrderTime && newest.orderedBy !== waiterName) {
            setNewOrderAlert(newest);
            setAlarmActive(true);
            if (alarm) {
              alarm.startAlarm();
            }
            if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200, 100, 200, 100, 400]);
            }
            setLastSeenOrderTime(newest.timestamp);
            localStorage.setItem('waiter_lastSeenOrderTime', String(newest.timestamp));
          }
        }

        setLastOrderCount(myOrders.length);
        setOrders(myOrders);
      } else {
        setOrders([]);
        setLastOrderCount(0);
      }
    });
    
    return () => unsubscribe();
  }, [isSetup, assignedTables, lastOrderCount, alarmEnabled, lastSeenOrderTime, waiterName]);

  // Subscribe to statistics for table-specific sorting
  useEffect(() => {
    const statsRef = ref(database, 'statistics');
    const unsubscribe = onValue(statsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStatistics(data);
      } else {
        setStatistics({ tables: {} });
      }
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to settings
  useEffect(() => {
    const unsubscribe = subscribeToSettings((s) => setSettings(s));
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

  const handleSetup = async () => {
    if (!waiterName.trim()) {
      alert('Bitte Namen eingeben!');
      return;
    }
    
    localStorage.setItem('waiterName', waiterName);
    localStorage.setItem('waiterTables', JSON.stringify(assignedTables));
    
    // Save to Firebase for multi-waiter tracking
    await saveWaiterAssignment(waiterName, assignedTables);
    
    // Clear manual reset flag since user is now properly logged in again
    setManualResetInProgress(false);
    
    setIsSetup(true);
  };

  // Parse inputs like "1-3", "1;3;4", "1, 3, 4" and tolerate optional leading "T"
  const parseTableEntries = (input: string): { values: number[]; error?: string } => {
    const cleaned = (input || '').trim();
    if (!cleaned) return { values: [], error: 'Bitte eine Zahl oder einen Bereich eingeben.' };
    const parts = cleaned.split(/[;,\s]+/).filter(Boolean);
    const values: number[] = [];
    for (const part of parts) {
      const p = part.replace(/^t/i, '');
      if (/^\d+-\d+$/.test(p)) {
        const [aStr, bStr] = p.split('-');
        const a = parseInt(aStr, 10);
        const b = parseInt(bStr, 10);
        if (isNaN(a) || isNaN(b) || a < 1 || b < 1 || b < a) {
          return { values: [], error: `Ungültiger Bereich: ${part}` };
        }
        for (let n = a; n <= b; n++) values.push(n);
      } else if (/^\d+$/.test(p)) {
        const n = parseInt(p, 10);
        if (n < 1) return { values: [], error: `Ungültige Tischnummer: ${part}` };
        values.push(n);
      } else {
        return { values: [], error: `Ungültiger Eintrag: ${part}` };
      }
    }
    return { values: Array.from(new Set(values)) };
  };

  const handleAddTable = () => {
    const parseResult = parseTableEntries(tableInput);
    if (parseResult.values.length === 0) {
      setTableInputError(parseResult.error || 'Ungültige Eingabe. Erlaubt sind z. B. 1-3 oder 1;3;4');
      return;
    }
    const invalid = parseResult.values.filter(v => !availableTables.includes(v));
    if (invalid.length > 0) {
      setTableInputError(`Diese Tische gibt es nicht: ${invalid.join(', ')}`);
      return;
    }
    const toAdd = parseResult.values.filter(v => !assignedTables.includes(v));
    if (toAdd.length === 0) {
      setTableInputError('Keine neuen Tische zum Hinzufügen.');
      return;
    }
    setTableInputError(null);
    setAssignedTables([...assignedTables, ...toAdd].sort((a, b) => a - b));
    setTableInput('');
  };

  // Add table while already set up (no restart needed)
  const handleAddTableWhileRunning = async () => {
    const parseResult = parseTableEntries(addTableInput);
    if (parseResult.values.length === 0) {
      setAddTableError(parseResult.error || 'Ungültige Eingabe. Erlaubt sind z. B. 1-3 oder 1;3;4');
      return;
    }
    const invalid = parseResult.values.filter(v => !availableTables.includes(v));
    if (invalid.length > 0) {
      setAddTableError(`Diese Tische gibt es nicht: ${invalid.join(', ')}`);
      return;
    }
    const toAdd = parseResult.values.filter(v => !assignedTables.includes(v));
    if (toAdd.length === 0) {
      setAddTableError('Keine neuen Tische zum Hinzufügen.');
      return;
    }
    setAddTableError(null);
    const newTables = [...assignedTables, ...toAdd].sort((a, b) => a - b);
    setAssignedTables(newTables);
    localStorage.setItem('waiterTables', JSON.stringify(newTables));
    await saveWaiterAssignment(waiterName, newTables);
    setAddTableInput('');
    setShowAddTableModal(false);
  };

  // Free booking - order for a table not in assigned list
  const handleStartFreeBooking = () => {
    setFreeBookingTableNumber(null);
    setShowFreeBookingModal(true);
  };

  const handleConfirmFreeBooking = () => {
    if (freeBookingTableNumber && freeBookingTableNumber >= 1) {
      handleOpenOrderForm(freeBookingTableNumber);
      setShowFreeBookingModal(false);
    }
  };

  const handleRemoveTable = async (num: number) => {
    const newTables = assignedTables.filter(t => t !== num);
    setAssignedTables(newTables);
    localStorage.setItem('waiterTables', JSON.stringify(newTables));
    
    // Update Firebase assignment
    if (waiterName) {
      try {
        await saveWaiterAssignment(waiterName, newTables);
      } catch (error) {
        console.error('Error updating waiter assignment:', error);
      }
    }
  };

  const handleDismiss = async (orderId: string) => {
    // Find the order to update statistics before removing
    const order = orders.find(o => o.id === orderId);
    if (order && order.type === 'order' && order.items) {
      // Update statistics in Firebase
      const statsRef = ref(database, 'statistics');
      const currentStats = { ...statistics } as any;
      
      // Initialize tables if not exists
      if (!currentStats.tables) {
        currentStats.tables = {};
      }
      if (!currentStats.itemTotals) {
        currentStats.itemTotals = {};
      }
      
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
      currentStats.totalOrders = (currentStats.totalOrders || 0) + 1;
      currentStats.totalAmount = (currentStats.totalAmount || 0) + (order.total || 0);
      
      await set(statsRef, currentStats);
    }
    
    await remove(ref(database, `orders/${orderId}`));
  };

  const handleReset = async () => {
    // Set flag to indicate this is a manual reset
    setManualResetInProgress(true);
    
    // Remove from Firebase first
    if (waiterName) {
      try {
        await remove(ref(database, `waiterAssignments/${waiterName}`));
      } catch (error) {
        console.error('Error removing waiter assignment from Firebase:', error);
      }
    }
    
    // Clear local storage
    localStorage.removeItem('waiterName');
    localStorage.removeItem('waiterTables');
    
    // Clear local state
    setWaiterName('');
    setAssignedTables([]);
    setIsSetup(false);
    // Do NOT show the removal modal on manual reset; user already knows
  };

  // Get display name for a table (handles both regular and custom tables)
  const getTableName = async (tableNumber: number): Promise<string> => {
    if (tableNumber >= 1000) {
      // For custom tables, try to get name from database first
      try {
        const table = await getTableByNumber(tableNumber);
        if (table && table.name) {
          return table.name;
        }
      } catch (error) {
        console.error('Error getting table name:', error);
      }
      
      // Fallback to settings
      if (settings.customTables) {
        const customIndex = tableNumber - 1000;
        const customTable = settings.customTables[customIndex];
        if (customTable && customTable.name) {
          return customTable.name;
        }
      }
    }
    return `T${tableNumber}`;
  };

  // Synchronous version for display (fallback to cached data)
  const getTableNameSync = (tableNumber: number): string => {
    if (tableNumber >= 1000 && settings.customTables) {
      const customIndex = tableNumber - 1000;
      const customTable = settings.customTables[customIndex];
      if (customTable && customTable.name) {
        return customTable.name;
      }
    }
    return `T${tableNumber}`;
  };

  // Handle order claim - SINGLE CLICK (for multi-waiter scenario)
  // First waiter to click claims the order, it disappears for other waiters
  const handleClaimOrder = async (orderId: string) => {
    const orderRef = ref(database, `orders/${orderId}`);
    const order = orders.find(o => o.id === orderId);
    if (order && !order.claimedBy) {
      await set(orderRef, {
        ...order,
        claimedBy: waiterName,
        claimedAt: Date.now()
      });
    }
  };

  // Handle DOUBLE CLICK - Hide from bar but keep for waiter
  // Waiter can still see the order details, but bar won't see it anymore
  // Also updates statistics when hiding (order is "done" from bar perspective)
  const handleHideFromBar = async (orderId: string) => {
    const orderRef = ref(database, `orders/${orderId}`);
    const order = orders.find(o => o.id === orderId);
    if (order && order.claimedBy === waiterName) {
      // Update statistics if not already recorded
      if (!order.statsRecorded && order.type === 'order' && order.items) {
        const statsRef = ref(database, 'statistics');
        const currentStats = { ...statistics } as any;
        
        if (!currentStats.tables) currentStats.tables = {};
        if (!currentStats.itemTotals) currentStats.itemTotals = {};
        
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
        
        currentStats.totalOrders = (currentStats.totalOrders || 0) + 1;
        currentStats.totalAmount = (currentStats.totalAmount || 0) + (order.total || 0);
        
        await set(statsRef, currentStats);
      }
      
      await set(orderRef, {
        ...order,
        hiddenFromBar: true,
        statsRecorded: true
      });
    }
  };

  // Handle LONG CLICK - Complete order and remove from waiter view
  // Also removes from bar if still visible there
  const handleCompleteOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      // Update statistics before removing (only if not already recorded)
      if (!order.statsRecorded && order.type === 'order' && order.items) {
        const statsRef = ref(database, 'statistics');
        const currentStats = { ...statistics } as any;
        
        if (!currentStats.tables) currentStats.tables = {};
        if (!currentStats.itemTotals) currentStats.itemTotals = {};
        
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
        
        currentStats.totalOrders = (currentStats.totalOrders || 0) + 1;
        currentStats.totalAmount = (currentStats.totalAmount || 0) + (order.total || 0);
        
        await set(statsRef, currentStats);
      }
      
      // Remove the order completely
      await remove(ref(database, `orders/${orderId}`));
    }
  };

  // ACTIVATE ALARM SYSTEM - must be called from user tap!
  const handleActivateAlarm = () => {
    if (alarm) {
      alarm.init();
      alarm.testAlarm(); // Play test sound to confirm it works
    }
    setAlarmEnabled(true);
    setShowActivation(false);
    localStorage.setItem('alarmEnabled', 'true');
  };

  // Stop alarm and dismiss the alert
  const handleDismissAlarm = () => {
    if (alarm) {
      alarm.stopAlarm();
    }
    setAlarmActive(false);
    setNewOrderAlert(null);
  };

  // Test the alarm
  const handleTestAlarm = () => {
    if (alarm) {
      alarm.init();
      alarm.testAlarm();
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Open order form for a specific table (reload menu so changes are reflected immediately)
  const handleOpenOrderForm = async (tableNum: number) => {
    await loadMenu();
    setOrderTableNumber(tableNum);
    setOrderCart({});
    setOrderSent(false);
    setActiveOrderCategory('alle');
    setShowOrderForm(true);
  };

  // Cart helper functions for waiter order
  const addToOrderCart = (itemId: string) => {
    // Only check Firebase configuration (configuredItems), ignore local menuItems
    const item = configuredItems.find(i => i.id === itemId);
    
    // Prevent adding sold-out items
    if (item && item.isSoldOut) return;

    if (item && item.askForGlasses && !isAddingGlasses) {
      // Show glass selection modal
      setPendingBottleItem(item);
      setShowGlassModal(true);
      setGlassQuantity(0);
    } else {
      // Add directly to cart
      setOrderCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
    }
  };

  const removeFromOrderCart = (itemId: string) => {
    setOrderCart(prev => {
      const newCart = { ...prev };
      if (newCart[itemId] > 1) {
        newCart[itemId]--;
      } else {
        delete newCart[itemId];
      }
      return newCart;
    });
  };

  const getOrderCartQuantity = (itemId: string) => orderCart[itemId] || 0;

  const orderCartTotal = Object.entries(orderCart).reduce((sum, [itemId, qty]) => {
    // Prefer configuredItems, but fall back to menuItems (covers glasses etc.)
    const item = configuredItems.find(i => i.id === itemId) || menuItems.find(i => i.id === itemId);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const orderCartItemCount = Object.values(orderCart).reduce((sum, qty) => sum + qty, 0);

  // Add bottle with glasses function
  const addBottleWithGlasses = () => {
    if (pendingBottleItem) {
      // Set flag to prevent recursive modal opening
      setIsAddingGlasses(true);
      
      // Add the bottle directly
      setOrderCart(prev => ({ ...prev, [pendingBottleItem.id]: (prev[pendingBottleItem.id] || 0) + 1 }));
      
      // Add glasses if requested
      if (glassQuantity > 0) {
        // Only check Firebase configuration (configuredItems), ignore local menuItems
        let glassId = '';
        if (pendingBottleItem.glassType === 'wine') {
          glassId = 'glas-wein-leer';
        } else if (pendingBottleItem.glassType === 'sekt') {
          glassId = 'glas-sekt-leer';
        } else {
          glassId = 'glas-normal'; // Default to beer glass
        }
        
        const glassItem = configuredItems.find(item => item.id === glassId);
        if (glassItem) {
          for (let i = 0; i < glassQuantity; i++) {
            setOrderCart(prev => ({ ...prev, [glassItem.id]: (prev[glassItem.id] || 0) + 1 }));
          }
        }
      }
      
      // Reset modal state
      setShowGlassModal(false);
      setPendingBottleItem(null);
      setGlassQuantity(0);
      setIsAddingGlasses(false);
      
      // Process next item in queue if any
      processNextItemInQueue();
    }
  };
  
  // Process the next item in the queue
  const processNextItemInQueue = () => {
    setItemQueue(prev => {
      if (prev.length === 0) {
        setIsProcessingQueue(false);
        return [];
      }
      
      const [nextItem, ...remaining] = prev;
      const item = configuredItems.find(i => i.id === nextItem.itemId);
      
      if (item && item.askForGlasses) {
        // Show glass modal for this item
        setPendingBottleItem(item);
        setShowGlassModal(true);
        setGlassQuantity(0);
      } else {
        // Add directly to cart and continue processing
        setOrderCart(cartPrev => ({ ...cartPrev, [nextItem.itemId]: (cartPrev[nextItem.itemId] || 0) + 1 }));
        // Recursively process next item
        setTimeout(() => processNextItemInQueue(), 0);
      }
      
      return remaining;
    });
  };
  
  // Add multiple items to cart with queue support
  const addMultipleItemsToCart = (items: { itemId: string; quantity: number }[]) => {
    const itemsNeedingGlasses: { itemId: string; quantity: number }[] = [];
    const itemsToAddDirectly: { itemId: string; quantity: number }[] = [];
    
    // Separate items that need glasses from those that don't
    items.forEach(({ itemId, quantity }) => {
      const item = configuredItems.find(i => i.id === itemId);
      if (item && item.askForGlasses) {
        itemsNeedingGlasses.push({ itemId, quantity });
      } else {
        itemsToAddDirectly.push({ itemId, quantity });
      }
    });
    
    // Add items that don't need glasses directly
    itemsToAddDirectly.forEach(({ itemId, quantity }) => {
      for (let i = 0; i < quantity; i++) {
        setOrderCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
      }
    });
    
    // Process items that need glasses in queue
    if (itemsNeedingGlasses.length > 0) {
      setIsProcessingQueue(true);
      setItemQueue(itemsNeedingGlasses);
      processNextItemInQueue();
    }
  };

  const getFilteredOrderItems = () => {
    // Only use Firebase configuration (configuredItems), ignore local menuItems
    const sourceItems = configuredItems;

    let items =
      activeOrderCategory === 'alle'
        ? sourceItems
        : sourceItems.filter((i) => i.category === activeOrderCategory);
    
    // Sort by most ordered items for this table (applies to all categories)
    if (orderTableNumber) {
      const tableStats = statistics.tables?.[orderTableNumber]?.items || {};
      items = [...items].sort((a, b) => {
        const countA = tableStats[a.name]?.quantity || 0;
        const countB = tableStats[b.name]?.quantity || 0;
        
        // First sort by quantity (most ordered first)
        if (countB !== countA) return countB - countA;
        
        // If same quantity, sort by price (more expensive first)
        return b.price - a.price;
      });
    }
    
    return items;
  };

  // Calculate event-wide popular items (exclude glasses)
  const popularIds = useMemo(() => {
    const counts: { [key: string]: number } = {};
    const itemTotals = (statistics as any)?.itemTotals || {};
    Object.entries(itemTotals).forEach(([itemName, data]: any) => {
      const menuItem = configuredItems.find(m => m.name === itemName);
      if (menuItem && menuItem.category !== 'glaeser') {
        counts[menuItem.id] = data.quantity;
      }
    });
    return new Set(
      Object.entries(counts)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 5)
        .map(([id]) => id)
    );
  }, [statistics, configuredItems]);

  // Submit waiter order
  const handleSubmitWaiterOrder = async () => {
    if (!orderTableNumber || orderCartItemCount === 0) return;

    const items = Object.entries(orderCart).map(([itemId, qty]) => {
      // Prefer configuredItems, fallback to menuItems to ensure glasses are included
      const item = configuredItems.find(i => i.id === itemId) || menuItems.find(i => i.id === itemId);
      if (!item) {
        console.error(`Item ${itemId} not found in configuredItems or menuItems`);
        return { name: 'Unknown', price: 0, quantity: qty };
      }
      return { name: item.name, price: item.price, quantity: qty };
    });

    await push(ref(database, 'orders'), {
      tableCode: `waiter-${orderTableNumber}`,
      tableNumber: orderTableNumber,
      items: items,
      total: orderCartTotal,
      type: 'order',
      timestamp: Date.now(),
      status: 'new',
      orderedBy: waiterName,
    });

    setOrderSent(true);
    
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }

    setTimeout(() => {
      setShowOrderForm(false);
      setOrderSent(false);
      setOrderCart({});
    }, 1500);
  };

  // Setup Screen
  if (!isSetup) {
    return (
      <div className="min-h-screen p-4" style={{ background: 'linear-gradient(135deg, #0f1419 0%, #1a1f26 100%)' }}>
        <div className="max-w-md mx-auto">
          <div className="text-center text-white mb-8 pt-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-3xl mx-auto mb-4">
              👤
            </div>
            <h1 className="text-2xl font-semibold mb-2">Kellner-Ansicht</h1>
            <p className="text-slate-400">Einrichtung</p>
          </div>

          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
            {/* Name Input */}
            <div className="mb-6">
              <label className="block text-slate-300 font-medium mb-2">Dein Name</label>
              <input
                type="text"
                value={waiterName}
                onChange={(e) => setWaiterName(e.target.value)}
                placeholder="z.B. Max"
                className="w-full p-4 text-lg bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400"
              />
            </div>

            {/* Table Selection */}
            <div className="mb-6">
              <label className="block text-slate-300 font-medium mb-2">Normale Tische (optional)</label>
              <p className="text-xs text-slate-400 mb-3">
                Du kannst auch ohne Tische arbeiten und Bestellungen für beliebige Tische aufnehmen.
              </p>
              <div className="flex gap-2 mb-1">
                <input
                  type="text"
                  value={tableInput}
                  onChange={(e) => setTableInput(e.target.value)}
                  placeholder="z. B. 1-3 oder 1;3;4"
                  className="flex-1 p-3 bg-slate-700 border border-slate-600 rounded-xl text-white"
                />
                <button
                  onClick={handleAddTable}
                  disabled={!tableInput.trim()}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
              {tableInputError && (
                <p className="text-red-400 text-sm mb-3">{tableInputError}</p>
              )}
              
              {assignedTables.filter(num => num >= 1).length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">
                    💡 Klicke auf einen Tisch um ihn zu entfernen:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {assignedTables.filter(num => num >= 1).map(num => (
                      <button
                        key={num}
                        onClick={() => handleRemoveTable(num)}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg font-bold hover:bg-red-100 hover:text-red-700 transition-colors"
                        title={`Tisch ${num} entfernen`}
                      >
                        T{num} ✕
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Select */}
            <div className="mb-6">
              <p className="text-sm text-slate-400 mb-2">Schnellauswahl:</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAssignedTables([1,2,3,4,5,6,7,8,9,10,11])}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-300 transition-colors"
                >
                  1-11
                </button>
                <button
                  onClick={() => setAssignedTables([12,13,14,15,16,17,18,19,20,21,22])}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-300 transition-colors"
                >
                  12-22
                </button>
                <button
                  onClick={() => setAssignedTables([23,24,25,26,27,28,29,30,31,32,33])}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-300 transition-colors"
                >
                  23-33
                </button>
                <button
                  onClick={() => setAssignedTables([34,35,36,37,38,39,40,41,42,43,44])}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-300 transition-colors"
                >
                  34-44
                </button>
              </div>
            </div>

            {/* Custom Tables Quick Select */}
            {(settings.customTables || []).length > 0 && (
              <div className="mb-6">
                <label className="block text-slate-300 font-medium mb-2">🪑 Individuelle Tische</label>
                <p className="text-xs text-slate-400 mb-3">
                  Klicke auf einen individuellen Tisch um ihn hinzuzufügen/zu entfernen:
                </p>
                <div className="flex flex-wrap gap-2">
                  {settings.customTables?.map((table) => {
                    const customTableNum = (settings.customTables?.findIndex(t => t.id === table.id) || 0) + 1000;
                    const isAssigned = assignedTables.includes(customTableNum);
                    return (
                      <button
                        key={table.id}
                        onClick={() => {
                          if (isAssigned) {
                            handleRemoveTable(customTableNum);
                          } else {
                            const newTables = [...assignedTables, customTableNum].sort((a, b) => a - b);
                            setAssignedTables(newTables);
                            localStorage.setItem('waiterTables', JSON.stringify(newTables));
                            saveWaiterAssignment(waiterName, newTables);
                          }
                        }}
                        className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                          isAssigned
                            ? 'bg-green-500 text-white'
                            : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                        }`}
                      >
                        {table.name} {isAssigned ? '✓' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={handleSetup}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xl font-bold transition-colors"
            >
              {assignedTables.length > 0 ? 'Starten' : 'Ohne Tische starten'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Waiter View
  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #0f1419 0%, #1a1f26 100%)' }}>
      {/* FULL SCREEN ALARM ALERT - Flashing! */}
      {alarmActive && newOrderAlert && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-pulse"
          style={{ 
            background: 'linear-gradient(45deg, #ff0000, #ff6600, #ff0000)',
            animation: 'flash 0.5s infinite alternate'
          }}
          onClick={handleDismissAlarm}
        >
          <style jsx>{`
            @keyframes flash {
              0% { background: #ff0000; }
              100% { background: #ffff00; }
            }
          `}</style>
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="text-8xl mb-4">🚨</div>
            <h1 className="text-4xl font-black text-red-600 mb-4">
              NEUE BESTELLUNG!
            </h1>
            <div className="text-6xl font-black text-gray-900 mb-4">
              {getTableNameSync(newOrderAlert.tableNumber)}
            </div>
            {newOrderAlert.type === 'waiter_call' ? (
              <p className="text-2xl text-orange-600 font-bold">🙋 Kellner gerufen!</p>
            ) : (
              <p className="text-2xl text-green-600 font-bold">
                💰 {newOrderAlert.total?.toFixed(2)} €
              </p>
            )}
            <button
              onClick={handleDismissAlarm}
              className="mt-8 w-full py-6 bg-green-600 text-white rounded-2xl text-2xl font-black"
            >
              ✅ VERSTANDEN - ALARM STOPPEN
            </button>
          </div>
        </div>
      )}

      {/* ONE-TAP ACTIVATION SCREEN */}
      {showActivation && !alarmActive && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
            <div className="text-6xl mb-4">🔊</div>
            <h2 className="text-3xl font-bold mb-4 text-gray-900">Alarm aktivieren</h2>
            
            <div className="bg-red-100 border-2 border-red-500 rounded-xl p-4 mb-6 text-left">
              <p className="font-bold text-red-700 mb-2">⚠️ WICHTIG!</p>
              <p className="text-red-600">
                Tippe auf den Button um den <strong>LAUTEN ALARM</strong> zu aktivieren.
                Bei jeder neuen Bestellung ertönt ein lauter Alarm + Vibration!
              </p>
            </div>

            <div className="bg-yellow-100 border-2 border-yellow-500 rounded-xl p-4 mb-6 text-left">
              <p className="font-bold text-yellow-700 mb-2">📱 Handy-Lautstärke!</p>
              <p className="text-yellow-600">
                Stelle sicher dass dein <strong>Handy NICHT auf lautlos</strong> ist!
                Der Alarm funktioniert über den Lautsprecher.
              </p>
            </div>

            <button
              onClick={handleActivateAlarm}
              className="w-full py-6 bg-red-600 text-white rounded-2xl text-2xl font-black animate-pulse"
            >
              🔊 ALARM AKTIVIEREN
            </button>
            
            <p className="mt-4 text-gray-500 text-sm">
              Du hörst einen Test-Ton wenn aktiviert
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-4 sticky top-0 z-10 shadow-lg" style={{ 
        backgroundColor: settings.colors.primaryKellner,
        color: getContrastTextColor(settings.colors.primaryKellner)
      }}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold">👤 {waiterName}</h1>
              <p className="text-sm opacity-80">
                Tische: {assignedTables.length > 0 ? assignedTables.map(t => getTableNameSync(t)).join(', ') : 'Keine Tische zugewiesen'}
              </p>
            </div>
            <button
              onClick={() => setShowResetConfirmModal(true)}
              className="px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.3)',
                color: getContrastTextColor(settings.colors.primaryKellner)
              }}
            >
              🔄
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(settings.tablePlans && settings.tablePlans.length > 0) && (
              <button
                onClick={() => setShowTablePlan(true)}
                className="px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  color: getContrastTextColor(settings.colors.primaryKellner)
                }}
              >
                🗺️ Pläne ({settings.tablePlans.length})
              </button>
            )}
            <button
              onClick={handleTestAlarm}
              className="px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: getContrastTextColor(settings.colors.primaryKellner)
              }}
            >
              🔊 Test
            </button>
          </div>
        </div>
        {alarmEnabled && (
          <div className="mt-2 rounded-lg px-3 py-1 text-sm text-center"
               style={{
                 backgroundColor: '#10b981',
                 color: getContrastTextColor('#10b981')
               }}>
            ✅ Alarm aktiv - Handy laut lassen!
          </div>
        )}
      </div>

      {/* Orders */}
      <div className="p-4">
        {orders.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">✨</p>
            <p className="text-xl text-gray-500">Keine Bestellungen</p>
            <p className="text-gray-400 mt-2">Alarm ertönt bei neuen Bestellungen</p>
            
            {/* Test Alarm Button */}
            <button
              onClick={handleTestAlarm}
              className="mt-6 px-6 py-3 rounded-xl font-bold"
              style={{ 
                backgroundColor: settings.colors.secondaryKellner,
                color: getContrastTextColor(settings.colors.secondaryKellner)
              }}
            >
              🔊 Alarm testen
            </button>
            
            {!alarmEnabled && (
              <button
                onClick={() => setShowActivation(true)}
                className="mt-3 px-6 py-3 rounded-xl font-bold block mx-auto"
                style={{ 
                  backgroundColor: settings.colors.secondaryKellner,
                  color: getContrastTextColor(settings.colors.secondaryKellner)
                }}
              >
                ⚠️ Alarm aktivieren
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const phase = getAlertPhase(order.timestamp);
              const isClaimed = order.claimedBy === waiterName;
              const isHiddenFromBar = order.hiddenFromBar;
              let longPressTimer: NodeJS.Timeout | null = null;
              let clickCount = 0;
              let clickTimer: NodeJS.Timeout | null = null;
              
              const handleOrderInteraction = (e: React.MouseEvent | React.TouchEvent) => {
                e.preventDefault();
                
                // If not claimed yet, single click claims it
                if (!order.claimedBy) {
                  handleClaimOrder(order.id);
                  return;
                }
                
                // If claimed by this waiter, handle double click
                if (isClaimed) {
                  clickCount++;
                  if (clickCount === 1) {
                    clickTimer = setTimeout(() => {
                      clickCount = 0;
                    }, 300);
                  } else if (clickCount === 2) {
                    if (clickTimer) clearTimeout(clickTimer);
                    clickCount = 0;
                    // Double click - hide from bar
                    handleHideFromBar(order.id);
                  }
                }
              };
              
              const handleLongPressStart = () => {
                if (isClaimed) {
                  longPressTimer = setTimeout(() => {
                    // Long press - complete order
                    handleCompleteOrder(order.id);
                    if (navigator.vibrate) navigator.vibrate(200);
                  }, 800);
                }
              };
              
              const handleLongPressEnd = () => {
                if (longPressTimer) {
                  clearTimeout(longPressTimer);
                  longPressTimer = null;
                }
              };
              
              return (
                <div
                  key={order.id}
                  onClick={handleOrderInteraction}
                  onTouchStart={handleLongPressStart}
                  onTouchEnd={handleLongPressEnd}
                  onMouseDown={handleLongPressStart}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  className={`${getAlertBgColor(phase)} text-white rounded-xl p-4 shadow-lg cursor-pointer active:scale-98 transition-transform ${isClaimed ? 'ring-4 ring-white/50' : ''}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-4xl font-black">
                        {getTableNameSync(order.tableNumber)}
                      </span>
                      {isClaimed && (
                        <span className="bg-white/30 px-2 py-1 rounded text-sm">
                          ✓ Übernommen
                        </span>
                      )}
                    </div>
                    <span className="text-lg opacity-80">
                      {formatTime(order.timestamp)}
                    </span>
                  </div>
                  
                  {order.type === 'waiter_call' ? (
                    <div className="text-xl font-bold">
                      🙋 Kellner gerufen!
                    </div>
                  ) : (
                    <div>
                      <div className="text-xl font-bold mb-2">🛒 Bestellung</div>
                      {order.items && (
                        <div className="space-y-1">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-lg">
                              <span>{item.quantity}x {item.name}</span>
                              <span>{(item.price * item.quantity).toFixed(2)} €</span>
                            </div>
                          ))}
                          <div className="border-t border-white/30 pt-2 mt-2 font-bold text-xl">
                            Gesamt: {order.total?.toFixed(2)} €
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Status hints */}
                  {isHiddenFromBar && (
                    <p className="text-sm mt-2 bg-blue-600/50 rounded px-2 py-1">
                      👁️ Nicht mehr auf der Theke sichtbar
                    </p>
                  )}
                  
                  <p className="text-sm mt-3 opacity-70">
                    {!order.claimedBy 
                      ? '👆 Tippen zum Übernehmen' 
                      : isClaimed 
                        ? '👆👆 Doppelklick: Von Bar entfernen | 👆⏱️ Lang drücken: Erledigt'
                        : 'Übernommen von anderem Kellner'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order Count Badge - positioned above footer */}
      {orders.length > 0 && (
        <div className="fixed bottom-32 right-4 w-14 h-14 bg-red-600 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-xl z-40">
          {orders.length}
        </div>
      )}

      {/* Footer with Quick Order Buttons - Collapsible */}
      <div className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 transition-all duration-300 ${isFooterCollapsed ? 'p-2' : 'p-4 pb-8'}`}>
        <div className="max-w-lg mx-auto">
          {/* Toggle Button */}
          <div className="flex justify-center mb-2">
            <button
              onClick={() => setIsFooterCollapsed(!isFooterCollapsed)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
            >
              <svg 
                className={`w-4 h-4 transition-transform duration-300 ${isFooterCollapsed ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          
          {/* Table Buttons - Always Visible */}
          <div className="flex flex-wrap gap-2 justify-center">
            {assignedTables.map((tableNum) => {
              const isCustom = tableNum >= 1000;
              const customTable = isCustom ? settings.customTables?.[tableNum - 1000] : null;
              return (
                <button
                  key={tableNum}
                  onClick={() => handleOpenOrderForm(tableNum)}
                  className="px-4 py-2 h-10 min-w-[3.5rem] flex items-center justify-center rounded-xl font-bold text-sm active:scale-95 transition-transform shadow-sm border border-amber-500 bg-amber-400 text-black"
                >
                  {isCustom ? customTable?.name : `T${tableNum}`}
                </button>
              );
            })}
            {/* Free Booking Button */}
            <button
              onClick={handleStartFreeBooking}
              className="px-4 py-2 h-10 rounded-xl font-bold text-sm active:scale-95 transition-transform shadow-sm border border-amber-500 bg-amber-400 text-black"
            >
              📝 Frei
            </button>
            {/* Add Table Button */}
            <button
              onClick={() => setShowAddTableModal(true)}
              className="px-4 py-2 h-10 rounded-xl font-bold text-sm active:scale-95 transition-transform shadow-sm border border-amber-500 bg-amber-400 text-black"
            >
              +/- Tisch
            </button>
          </div>
          
          {/* Expanded Content - Only visible when not collapsed */}
          {!isFooterCollapsed && (
            <div className="space-y-3 mt-3">
              {/* App Download Button in Footer - always visible for testing */}
              <div className="flex justify-center">
                <button
                  onClick={handleInstallPWA}
                  className="px-6 py-2 rounded-xl font-bold text-sm bg-green-500 text-white active:scale-95 transition-transform shadow-sm"
                >
                  📲 Als App installieren
                </button>
              </div>
              
              {/* Footer Links */}
              <div className="flex justify-center gap-4 mt-4 pb-4">
                <span className="text-xs text-gray-500">© 2026 PräsenzWert</span>
                <button
                  onClick={() => router.push('/impressum')}
                  className="text-xs text-gray-600 hover:text-gray-800 underline"
                >
                  Impressum
                </button>
                <button
                  onClick={() => router.push('/datenschutz')}
                  className="text-xs text-gray-600 hover:text-gray-800 underline"
                >
                  Datenschutz
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Waiter Order Form Modal */}
      {showOrderForm && orderTableNumber && (
        <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 pt-16 overflow-auto">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl mb-10">
            {orderSent ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">✅</div>
                <p className="text-2xl font-bold text-green-600">Bestellung gesendet!</p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b bg-gray-50">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">
                      🛍️ Bestellung für {getTableNameSync(orderTableNumber)}
                    </h2>
                    <button
                      onClick={() => setShowOrderForm(false)}
                      className="text-2xl text-gray-500"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Cart Summary - moved to appear after header */}
                <div className="p-4 border-b bg-gray-50">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-700">{orderCartItemCount} Artikel</span>
                      {orderCartItemCount > 0 && (
                        <button
                          onClick={() => setShowCartPreview(true)}
                          className="px-3 py-1 bg-evm-green text-white rounded-lg text-sm font-bold"
                        >
                          Anzeigen
                        </button>
                      )}
                    </div>
                    <span className="text-2xl font-bold text-evm-green">{formatPrice(orderCartTotal)}</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowOrderForm(false)}
                      className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={handleSubmitWaiterOrder}
                      disabled={orderCartItemCount === 0}
                      className={`flex-1 py-3 rounded-xl font-bold ${
                        orderCartItemCount > 0
                          ? ''
                          : 'bg-gray-300 text-gray-500'
                      }`}
                      style={orderCartItemCount > 0 ? { 
                        backgroundColor: settings.colors.secondaryKellner,
                        color: getContrastTextColor(settings.colors.secondaryKellner)
                      } : {}}
                    >
                      Bestellen ({formatPrice(orderCartTotal)})
                    </button>
                  </div>
                </div>

                {/* Category Tabs - match table page styling */}
                <div className="flex overflow-x-auto bg-gray-100 p-1 gap-1">
                  <button
                    onClick={() => setActiveOrderCategory('alle')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${
                      activeOrderCategory === 'alle' ? 'bg-evm-green text-white' : 'bg-white text-gray-700'
                    }`}
                  >
                    🍹 Alle
                  </button>
                  {/* Merged and ordered categories */}
                  {mergedCategories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveOrderCategory(cat.id)}
                      className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${
                        activeOrderCategory === cat.id ? 'bg-evm-green text-white' : 'bg-white text-gray-700'
                      }`}
                    >
                      {cat.emoji} {cat.name}
                    </button>
                  ))}
                </div>

                {/* Premium Items - "Für den Tisch" Section - collapsible */}
                {activeOrderCategory === 'alle' && (() => {
                  const bottleNonalcItems = configuredItems.filter(i => i.tableSection === 'bottle-nonalc');
                  const beerCrateItems = configuredItems.filter(i => i.tableSection === 'beer-crate');
                  const wineBottleItems = configuredItems.filter(i => i.tableSection === 'wine-bottle');
                  const shotsCrateItems = configuredItems.filter(i => i.tableSection === 'shots-crate');

                  const hasAnyTableSection = bottleNonalcItems.length > 0 || beerCrateItems.length > 0 || wineBottleItems.length > 0 || shotsCrateItems.length > 0;
                  if (!hasAnyTableSection) return null;

                  return (
                    <div className="mb-3 p-4">
                      <button
                        className="w-full text-left text-sm font-bold text-amber-700 mb-2 flex items-center justify-between"
                        onClick={() => setIsTableSectionCollapsed(c => !c)}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-lg">✨</span> Für den ganzen Tisch
                        </span>
                        <span className="text-xl text-amber-700">{isTableSectionCollapsed ? '▼' : '▲'}</span>
                      </button>
                      {!isTableSectionCollapsed && (
                      <div className="grid grid-cols-2 gap-2">
                        {bottleNonalcItems.length > 0 && (
                          <button
                            onClick={() => setShowWaiterBottleSelection(true)}
                            className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-3 text-left hover:shadow-md transition-shadow"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-2xl">🍾</span>
                              <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                ab {formatPrice(Math.min(...bottleNonalcItems.map(i => i.price)))}
                              </span>
                            </div>
                            <p className="font-bold text-sm text-gray-800">Unalkoholisch</p>
                            <p className="text-xs text-gray-500">{bottleNonalcItems.length} Sorten</p>
                          </button>
                        )}

                        {beerCrateItems.length > 0 && (
                          <button
                            onClick={() => setShowWaiterBeerCrateSelection(true)}
                            className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-3 text-left hover:shadow-md transition-shadow"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-2xl">📦</span>
                              <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                ab {formatPrice(Math.min(...beerCrateItems.map(i => i.price)))}
                              </span>
                            </div>
                            <p className="font-bold text-sm text-gray-800">Bier</p>
                            <p className="text-xs text-gray-500">{beerCrateItems.length} Sorten</p>
                          </button>
                        )}

                        {wineBottleItems.length > 0 && (
                          <button
                            onClick={() => setShowWaiterWineBottleSelection(true)}
                            className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-3 text-left hover:shadow-md transition-shadow"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-2xl">🍾</span>
                              <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                ab {formatPrice(Math.min(...wineBottleItems.map(i => i.price)))}
                              </span>
                            </div>
                            <p className="font-bold text-sm text-gray-800">Wein/Sekt</p>
                            <p className="text-xs text-gray-500">{wineBottleItems.length} Sorten</p>
                          </button>
                        )}

                        {shotsCrateItems.length > 0 && (
                          <button
                            onClick={() => setShowWaiterShotSelection(true)}
                            className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-3 text-left hover:shadow-md transition-shadow"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-2xl">🥃</span>
                              <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                ab {formatPrice(Math.min(...shotsCrateItems.map(i => i.price)))}
                              </span>
                            </div>
                            <p className="font-bold text-sm text-gray-800">Schnaps</p>
                            <p className="text-xs text-gray-500">{shotsCrateItems.length} Sorten</p>
                          </button>
                        )}
                      </div>
                      )}
                    </div>
                  );
                })()}

                {/* Items List - match table page styling */}
                <div className="p-4">
                  <h3 className="text-sm font-bold text-gray-600 mb-2">
                    {activeOrderCategory === 'alle' ? '🥤 Getränke' : mergedCategories.find(c => c.id === activeOrderCategory)?.emoji + ' ' + mergedCategories.find(c => c.id === activeOrderCategory)?.name}
                  </h3>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {getFilteredOrderItems().map(item => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-3 rounded-xl ${
                          popularIds.has(item.id) ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{item.emoji}</span>
                          <div>
                            <p className="font-bold text-gray-800">
                              {item.name}
                              {popularIds.has(item.id) && <span className="ml-2 text-xs text-green-600">⭐ Beliebt</span>}
                              {item.isSoldOut && <span className="ml-2 text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">AUSVERKAUFT</span>}
                            </p>
                            {item.description && (
                              <p className="text-xs text-gray-500">{item.description}</p>
                            )}
                            <p className="text-sm text-gray-500">
                              {item.size && <span>{item.size} · </span>}
                              <span className="font-semibold text-evm-green">{formatPrice(item.price)}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getOrderCartQuantity(item.id) > 0 && (
                            <>
                              <button
                                onClick={() => removeFromOrderCart(item.id)}
                                className="w-10 h-10 bg-gray-200 rounded-full text-xl font-bold active:bg-gray-300"
                              >
                                -
                              </button>
                              <span className="font-bold text-xl w-8 text-center text-gray-900">{getOrderCartQuantity(item.id)}</span>
                            </>
                          )}
                          <button
                            onClick={() => addToOrderCart(item.id)}
                            disabled={item.isSoldOut}
                            className={`w-10 h-10 rounded-full text-xl font-bold ${item.isSoldOut ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                            style={{ 
                              backgroundColor: settings.colors.secondaryKellner,
                              color: getContrastTextColor(settings.colors.secondaryKellner)
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cart Preview Modal */}
      {showCartPreview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">🛒 Warenkorb</h2>
              <button onClick={() => setShowCartPreview(false)} className="text-2xl text-gray-500">✕</button>
            </div>
            {orderCartItemCount === 0 ? (
              <p className="text-gray-500 text-center py-4">Warenkorb ist leer</p>
            ) : (
              <div className="space-y-3 mb-4">
                {Object.entries(orderCart).map(([itemId, qty]) => {
                  // Only check Firebase configuration (configuredItems), ignore local menuItems
                  const item = configuredItems.find(i => i.id === itemId);
                  if (!item) return null;
                  return (
                    <div key={itemId} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{item.emoji}</span>
                        <div>
                          <p className="font-bold text-gray-800">{item.name}</p>
                          <p className="text-sm text-gray-500">{formatPrice(item.price)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => removeFromOrderCart(itemId)}
                          className="w-6 h-6 bg-gray-200 rounded-full text-sm font-bold text-gray-800"
                        >
                          -
                        </button>
                        <span className="font-bold text-gray-800 text-sm w-6 text-center bg-white rounded-full border border-gray-300">{qty}</span>
                        <button
                          onClick={() => addToOrderCart(itemId)}
                          className="w-6 h-6 bg-evm-green text-white rounded-full text-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="border-t pt-3">
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold text-gray-700">Gesamt:</span>
                <span className="text-xl font-bold text-evm-green">{formatPrice(orderCartTotal)}</span>
              </div>
              <button
                onClick={() => setShowCartPreview(false)}
                className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg font-bold"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Glass Selection Modal */}
      {showGlassModal && pendingBottleItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">🥃 Gläser dazu?</h2>
              <button 
                onClick={() => {
                  setShowGlassModal(false);
                  setPendingBottleItem(null);
                  setGlassQuantity(0);
                }} 
                className="text-2xl text-gray-500"
              >
                ✕
              </button>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{pendingBottleItem.emoji}</span>
                <div>
                  <p className="font-bold text-gray-800">{pendingBottleItem.name}</p>
                  <p className="text-sm text-gray-500">{pendingBottleItem.description}</p>
                </div>
              </div>
            </div>
            
            <p className="text-gray-600 text-sm mb-4">
              Wie viele {pendingBottleItem.glassType === 'wine' ? 'Weingläser' : 'Gläser'} benötigen Sie?
            </p>
            
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={() => setGlassQuantity(Math.max(0, glassQuantity - 1))}
                className="w-12 h-12 bg-gray-200 rounded-full text-2xl font-bold"
              >
                -
              </button>
              <div className="text-center">
                <span className="text-4xl font-bold text-evm-green">{glassQuantity}</span>
                <p className="text-sm text-gray-500">{pendingBottleItem.glassType === 'wine' ? 'Weingläser' : 'Gläser'}</p>
              </div>
              <button
                onClick={() => setGlassQuantity(glassQuantity + 1)}
                className="w-12 h-12 bg-gray-200 rounded-full text-2xl font-bold"
              >
                +
              </button>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  // Set flag to prevent recursive modal opening
                  setIsAddingGlasses(true);
                  // Add bottle without glasses directly
                  setOrderCart(prev => ({ ...prev, [pendingBottleItem.id]: (prev[pendingBottleItem.id] || 0) + 1 }));
                  // Reset modal state
                  setShowGlassModal(false);
                  setPendingBottleItem(null);
                  setGlassQuantity(0);
                  setIsAddingGlasses(false);
                }}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold"
              >
                Ohne Gläser
              </button>
              <button
                onClick={addBottleWithGlasses}
                className="flex-1 py-3 bg-evm-green text-white rounded-xl font-bold"
              >
                {glassQuantity > 0 ? `Mit ${glassQuantity} Gläsern` : 'Hinzufügen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waiter Selection Modals */}
      {showWaiterBottleSelection && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">🍾 Flasche wählen</h2>
              <button onClick={() => { setShowWaiterBottleSelection(false); setWaiterTempQuantity({}); }} className="text-2xl text-gray-500">✕</button>
            </div>
            <div className="space-y-3 mb-4">
              {configuredItems.filter(i => i.tableSection === 'bottle-nonalc').map(item => (
                <div key={item.id} className={`p-4 rounded-xl ${item.isSoldOut ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.emoji}</span>
                      <div className="text-left">
                        <p className="font-bold text-gray-800">{item.name}</p>
                        {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
                        {item.size && <p className="text-sm text-gray-500">{item.size}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      {item.isSoldOut && (
                        <div className="text-xs font-bold text-white bg-red-500 px-2 py-1 rounded-full mb-1">AUSVERKAUFT</div>
                      )}
                      <span className="text-lg font-bold" style={{ color: settings.colors.secondaryKellner }}>{formatPrice(item.price)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setWaiterTempQuantity(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] || 0) - 1) }))}
                      disabled={item.isSoldOut}
                      className={`w-6 h-6 rounded-full text-sm font-bold ${item.isSoldOut ? 'bg-gray-200 opacity-50 cursor-not-allowed' : 'bg-gray-200'}`}
                    >
                      -
                    </button>
                    <span className="font-bold text-gray-800 text-sm w-6 text-center bg-white rounded-full border border-gray-300">{waiterTempQuantity[item.id] || 0}</span>
                    <button
                      onClick={() => setWaiterTempQuantity(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))}
                      disabled={item.isSoldOut}
                      className={`w-6 h-6 rounded-full text-sm font-bold ${item.isSoldOut ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{ 
                        backgroundColor: settings.colors.secondaryKellner,
                        color: getContrastTextColor(settings.colors.secondaryKellner)
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {Object.entries(waiterTempQuantity).some(([, q]) => q > 0) && (
              <button
                onClick={() => {
                  const itemsToAdd = Object.entries(waiterTempQuantity)
                    .filter(([, qty]) => qty > 0)
                    .map(([itemId, qty]) => ({ itemId, quantity: qty }));
                  
                  addMultipleItemsToCart(itemsToAdd);
                  setWaiterTempQuantity({});
                  setShowWaiterBottleSelection(false);
                }}
                className="w-full py-3 rounded-xl font-bold text-lg"
                style={{ 
                  backgroundColor: settings.colors.secondaryKellner,
                  color: getContrastTextColor(settings.colors.secondaryKellner)
                }}
              >
                Hinzufügen
              </button>
            )}
          </div>
        </div>
      )}

      {showWaiterBeerCrateSelection && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">📦 Kiste wählen</h2>
              <button onClick={() => { setShowWaiterBeerCrateSelection(false); setWaiterTempQuantity({}); }} className="text-2xl text-gray-500">✕</button>
            </div>
            <div className="space-y-3 mb-4">
              {configuredItems.filter(i => i.tableSection === 'beer-crate').map(item => (
                <div key={item.id} className={`p-4 rounded-xl ${item.isSoldOut ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.emoji}</span>
                      <div className="text-left">
                        <p className="font-bold text-gray-800">{item.name}</p>
                        <p className="text-sm text-gray-500">{item.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {item.isSoldOut && (
                        <div className="text-xs font-bold text-white bg-red-500 px-2 py-1 rounded-full mb-1">AUSVERKAUFT</div>
                      )}
                      <span className="text-lg font-bold" style={{ color: settings.colors.secondaryKellner }}>{formatPrice(item.price)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setWaiterTempQuantity(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] || 0) - 1) }))}
                      disabled={item.isSoldOut}
                      className={`w-6 h-6 rounded-full text-sm font-bold ${item.isSoldOut ? 'bg-gray-200 opacity-50 cursor-not-allowed' : 'bg-gray-200'}`}
                    >
                      -
                    </button>
                    <span className="font-bold text-gray-800 text-sm w-6 text-center bg-white rounded-full border border-gray-300">{waiterTempQuantity[item.id] || 0}</span>
                    <button
                      onClick={() => setWaiterTempQuantity(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))}
                      disabled={item.isSoldOut}
                      className={`w-6 h-6 rounded-full text-sm font-bold ${item.isSoldOut ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{ 
                        backgroundColor: settings.colors.secondaryKellner,
                        color: getContrastTextColor(settings.colors.secondaryKellner)
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {Object.entries(waiterTempQuantity).some(([, q]) => q > 0) && (
              <button
                onClick={() => {
                  const itemsToAdd = Object.entries(waiterTempQuantity)
                    .filter(([, qty]) => qty > 0)
                    .map(([itemId, qty]) => ({ itemId, quantity: qty }));
                  
                  addMultipleItemsToCart(itemsToAdd);
                  setWaiterTempQuantity({});
                  setShowWaiterBeerCrateSelection(false);
                }}
                className="w-full py-3 rounded-xl font-bold text-lg"
                style={{ 
                  backgroundColor: settings.colors.secondaryKellner,
                  color: getContrastTextColor(settings.colors.secondaryKellner)
                }}
              >
                Hinzufügen
              </button>
            )}
          </div>
        </div>
      )}

      {showWaiterWineBottleSelection && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">🍾 Wein/Sekt wählen</h2>
              <button onClick={() => { setShowWaiterWineBottleSelection(false); setWaiterTempQuantity({}); }} className="text-2xl text-gray-500">✕</button>
            </div>
            <div className="space-y-3 mb-4">
              {configuredItems.filter(i => i.tableSection === 'wine-bottle').map(item => (
                <div key={item.id} className={`p-4 rounded-xl ${item.isSoldOut ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.emoji}</span>
                      <div className="text-left">
                        <p className="font-bold text-gray-800">{item.name}</p>
                        {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      {item.isSoldOut && (
                        <div className="text-xs font-bold text-white bg-red-500 px-2 py-1 rounded-full mb-1">AUSVERKAUFT</div>
                      )}
                      <span className="text-lg font-bold" style={{ color: settings.colors.secondaryKellner }}>{formatPrice(item.price)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setWaiterTempQuantity(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] || 0) - 1) }))}
                      disabled={item.isSoldOut}
                      className={`w-6 h-6 rounded-full text-sm font-bold ${item.isSoldOut ? 'bg-gray-200 opacity-50 cursor-not-allowed' : 'bg-gray-200'}`}
                    >
                      -
                    </button>
                    <span className="font-bold text-gray-800 text-sm w-6 text-center bg-white rounded-full border border-gray-300">{waiterTempQuantity[item.id] || 0}</span>
                    <button
                      onClick={() => setWaiterTempQuantity(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))}
                      disabled={item.isSoldOut}
                      className={`w-6 h-6 rounded-full text-sm font-bold ${item.isSoldOut ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{ 
                        backgroundColor: settings.colors.secondaryKellner,
                        color: getContrastTextColor(settings.colors.secondaryKellner)
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {Object.entries(waiterTempQuantity).some(([, q]) => q > 0) && (
              <button
                onClick={() => {
                  const itemsToAdd = Object.entries(waiterTempQuantity)
                    .filter(([, qty]) => qty > 0)
                    .map(([itemId, qty]) => ({ itemId, quantity: qty }));
                  
                  addMultipleItemsToCart(itemsToAdd);
                  setWaiterTempQuantity({});
                  setShowWaiterWineBottleSelection(false);
                }}
                className="w-full py-3 rounded-xl font-bold text-lg"
                style={{ 
                  backgroundColor: settings.colors.secondaryKellner,
                  color: getContrastTextColor(settings.colors.secondaryKellner)
                }}
              >
                Hinzufügen
              </button>
            )}
          </div>
        </div>
      )}

      {showWaiterShotSelection && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">🥃 Schnaps wählen</h2>
              <button onClick={() => { setShowWaiterShotSelection(false); setWaiterTempQuantity({}); }} className="text-2xl text-gray-500">✕</button>
            </div>
            <div className="space-y-3 mb-4">
              {configuredItems.filter(i => i.tableSection === 'shots-crate').map(item => (
                <div key={item.id} className={`p-4 rounded-xl ${item.isSoldOut ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.emoji}</span>
                      <div className="text-left">
                        <p className="font-bold text-gray-800">{item.name}</p>
                        {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      {item.isSoldOut && (
                        <div className="text-xs font-bold text-white bg-red-500 px-2 py-1 rounded-full mb-1">AUSVERKAUFT</div>
                      )}
                      <span className="text-lg font-bold" style={{ color: settings.colors.secondaryKellner }}>{formatPrice(item.price)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setWaiterTempQuantity(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] || 0) - 1) }))}
                      disabled={item.isSoldOut}
                      className={`w-6 h-6 rounded-full text-sm font-bold ${item.isSoldOut ? 'bg-gray-200 opacity-50 cursor-not-allowed' : 'bg-gray-200'}`}
                    >
                      -
                    </button>
                    <span className="font-bold text-gray-800 text-sm w-6 text-center bg-white rounded-full border border-gray-300">{waiterTempQuantity[item.id] || 0}</span>
                    <button
                      onClick={() => setWaiterTempQuantity(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))}
                      disabled={item.isSoldOut}
                      className={`w-6 h-6 rounded-full text-sm font-bold ${item.isSoldOut ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{ 
                        backgroundColor: settings.colors.secondaryKellner,
                        color: getContrastTextColor(settings.colors.secondaryKellner)
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {Object.entries(waiterTempQuantity).some(([, q]) => q > 0) && (
              <button
                onClick={() => {
                  const itemsToAdd = Object.entries(waiterTempQuantity)
                    .filter(([, qty]) => qty > 0)
                    .map(([itemId, qty]) => ({ itemId, quantity: qty }));
                  
                  addMultipleItemsToCart(itemsToAdd);
                  setWaiterTempQuantity({});
                  setShowWaiterShotSelection(false);
                }}
                className="w-full py-3 rounded-xl font-bold text-lg"
                style={{ 
                  backgroundColor: settings.colors.secondaryKellner,
                  color: getContrastTextColor(settings.colors.secondaryKellner)
                }}
              >
                Hinzufügen
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add Table Modal */}
      {showAddTableModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">🪑 Tische verwalten</h2>
              <button onClick={() => setShowAddTableModal(false)} className="text-2xl text-gray-500">✕</button>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Verwalte deine Tische: Füge neue hinzu oder entferne einzelne Tische von deiner Liste.
            </p>
            
            {/* Custom Tables Quick Add */}
            {(settings.customTables || []).length > 0 && (
              <div className="mb-4">
                <label className="block text-gray-700 font-bold mb-2">🪑 Individuelle Tische</label>
                <div className="flex flex-wrap gap-2">
                  {settings.customTables?.map((table) => {
                    const customTableNum = (settings.customTables?.findIndex(t => t.id === table.id) || 0) + 1000;
                    const isAssigned = assignedTables.includes(customTableNum);
                    return (
                      <button
                        key={table.id}
                        onClick={() => {
                          if (isAssigned) {
                            handleRemoveTable(customTableNum);
                          } else {
                            const newTables = [...assignedTables, customTableNum].sort((a, b) => a - b);
                            setAssignedTables(newTables);
                            localStorage.setItem('waiterTables', JSON.stringify(newTables));
                            saveWaiterAssignment(waiterName, newTables);
                          }
                        }}
                        className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                          isAssigned
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {table.name} {isAssigned ? '✓' : '+'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-gray-700 font-bold mb-2">Tisch hinzufügen</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={addTableInput}
                  onChange={(e) => setAddTableInput(e.target.value)}
                  placeholder="z. B. 1-3 oder 1;3;4"
                  className="flex-1 p-3 border-2 border-gray-300 rounded-xl text-lg text-gray-800"
                  autoFocus
                />
                <button
                  onClick={handleAddTableWhileRunning}
                  disabled={!addTableInput.trim()}
                  className="px-6 py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    backgroundColor: settings.colors.secondaryKellner,
                    color: getContrastTextColor(settings.colors.secondaryKellner)
                  }}
                >
                  +
                </button>
              </div>
              {addTableError && (
                <p className="text-red-600 text-sm mb-4">{addTableError}</p>
              )}
              
              {/* Current tables with remove option */}
              {assignedTables.length > 0 && (
                <div>
                  <label className="block text-gray-700 font-bold mb-2">Aktuelle Tische</label>
                  <p className="text-xs text-gray-500 mb-2">
                    💡 Klicke auf einen Tisch um ihn zu entfernen:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {assignedTables.map(num => {
                      const isCustom = num >= 1000;
                      const customTable = isCustom ? settings.customTables?.[num - 1000] : null;
                      return (
                        <button
                          key={num}
                          onClick={() => handleRemoveTable(num)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg font-bold hover:bg-red-100 hover:text-red-700 transition-colors"
                          title={`Tisch ${isCustom ? customTable?.name : num} entfernen`}
                        >
                          {isCustom ? customTable?.name : `T${num}`} ✕
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Free Booking Modal */}
      {showFreeBookingModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">📝 Freie Buchung</h2>
              <button onClick={() => setShowFreeBookingModal(false)} className="text-2xl text-gray-500">✕</button>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Bestellung für einen Tisch aufnehmen, der nicht zu deiner Liste gehört.
            </p>
            
            {/* Custom Tables Quick Select */}
            {(settings.customTables || []).length > 0 && (
              <div className="mb-4">
                <label className="block text-gray-700 font-bold mb-2">🪑 Individuelle Tische</label>
                <div className="flex flex-wrap gap-2">
                  {settings.customTables?.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => {
                        // Use custom table - store name in a special way (negative ID based on index)
                        const customIndex = (settings.customTables?.findIndex(t => t.id === table.id) || 0) + 1000;
                        setFreeBookingTableNumber(customIndex);
                      }}
                      className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                        freeBookingTableNumber === ((settings.customTables?.findIndex(t => t.id === table.id) || 0) + 1000)
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {table.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-gray-700 font-bold mb-2">Tischnummer</label>
              <input
                type="number"
                min="1"
                max="100"
                value={freeBookingTableNumber && freeBookingTableNumber < 1000 ? freeBookingTableNumber : ''}
                onChange={(e) => setFreeBookingTableNumber(parseInt(e.target.value) || null)}
                placeholder="Tischnummer eingeben"
                className="w-full p-4 text-2xl text-center border-2 border-gray-300 rounded-xl text-gray-800"
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmFreeBooking()}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFreeBookingModal(false)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold"
              >
                Abbrechen
              </button>
              <button
                onClick={handleConfirmFreeBooking}
                disabled={!freeBookingTableNumber || freeBookingTableNumber < 1}
                className={`flex-1 py-3 rounded-xl font-bold ${
                  freeBookingTableNumber && freeBookingTableNumber >= 1
                    ? 'hover:opacity-90'
                    : 'bg-gray-300 text-gray-700 cursor-not-allowed'
                }`}
                style={{
                  backgroundColor: freeBookingTableNumber && freeBookingTableNumber >= 1 ? settings.colors.secondaryKellner : undefined,
                  color: freeBookingTableNumber && freeBookingTableNumber >= 1 ? getContrastTextColor(settings.colors.secondaryKellner) : undefined
                }}
              >
                Weiter →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Plans Modal */}
      {showTablePlan && settings.tablePlans && (
        <TablePlanCarousel 
          tablePlans={settings.tablePlans}
          onClose={() => setShowTablePlan(false)}
        />
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-gray-900">
            <h3 className="text-xl font-bold mb-4 text-center text-red-600">🔄 Kellner zurücksetzen?</h3>
            <div className="text-gray-600 text-sm space-y-3 mb-6">
              <p>
                Wenn du dich zurücksetzt, werden folgende Aktionen ausgeführt:
              </p>
              <ul className="list-disc list-inside space-y-1 text-left ml-2">
                <li>Deine Tischzuordnung wird entfernt</li>
                <li>Du musst dich neu mit Namen anmelden</li>
                <li>Du musst deine Tische erneut zuordnen</li>
                <li>Bestellungen werden nicht mehr an dich weitergeleitet</li>
              </ul>
              <p className="text-orange-600 font-medium">
                💡 Tipp: Einzelne Tische kannst du auch unten entfernen, ohne dich komplett zurückzusetzen.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirmModal(false)}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold"
              >
                Abbrechen
              </button>
              <button
                onClick={() => {
                  setShowResetConfirmModal(false);
                  handleReset();
                }}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold"
              >
                🔄 Trotzdem zurücksetzen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Assignment Removed Modal */}
      {showTableAssignmentRemovedModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-gray-900">
            <div className="text-center mb-4">
              <div className="text-6xl mb-4">🔄</div>
              <h3 className="text-xl font-bold mb-2 text-orange-600">Tischzuordnung entfernt</h3>
              <p className="text-gray-600 text-sm">
                {assignmentRemovedReason === 'bar' 
                  ? 'Deine Tischzuordnung wurde von der Bar-Seite zurückgesetzt. Du bist weiterhin angemeldet und kannst über "+Tisch" neue Tische hinzufügen.'
                  : 'Du hast deine Tischzuordnung zurückgesetzt. Du musst dich neu anmelden.'}
              </p>
            </div>
            <button
              onClick={() => setShowTableAssignmentRemovedModal(false)}
              className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold"
            >
              Verstanden
            </button>
          </div>
        </div>
      )}

      {/* Glass Selection Modal for Waiter */}
      {showGlassModal && pendingBottleItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">🥃 Gläser dazu?</h2>
              <button 
                onClick={() => {
                  setShowGlassModal(false);
                  setPendingBottleItem(null);
                  setGlassQuantity(0);
                }} 
                className="text-2xl text-gray-500"
              >
                ✕
              </button>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{pendingBottleItem.emoji}</span>
                <div>
                  <p className="font-bold text-gray-800">{pendingBottleItem.name}</p>
                  <p className="text-sm text-gray-500">{pendingBottleItem.description}</p>
                </div>
              </div>
            </div>
            
            <p className="text-gray-600 text-sm mb-4">
              Wie viele {pendingBottleItem.glassType === 'wine' ? 'Weingläser' : 'Gläser'} benötigen Sie?
            </p>
            
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={() => setGlassQuantity(Math.max(0, glassQuantity - 1))}
                className="w-12 h-12 bg-gray-200 rounded-full text-2xl font-bold active:bg-gray-300"
              >
                -
              </button>
              <div className="text-center">
                <span className="text-4xl font-bold" style={{ color: settings.colors.secondaryKellner }}>{glassQuantity}</span>
                <p className="text-sm text-gray-500">{pendingBottleItem.glassType === 'wine' ? 'Weingläser' : 'Gläser'}</p>
              </div>
              <button
                onClick={() => setGlassQuantity(glassQuantity + 1)}
                className="w-12 h-12 bg-gray-200 rounded-full text-2xl font-bold active:bg-gray-300"
              >
                +
              </button>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setOrderCart(prev => ({ ...prev, [pendingBottleItem.id]: (prev[pendingBottleItem.id] || 0) + 1 }));
                  setShowGlassModal(false);
                  setPendingBottleItem(null);
                  setGlassQuantity(0);
                }}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold"
              >
                Ohne Gläser
              </button>
              <button
                onClick={addBottleWithGlasses}
                className="flex-1 py-3 rounded-xl font-bold text-white"
                style={{ 
                  backgroundColor: settings.colors.secondaryKellner,
                  color: getContrastTextColor(settings.colors.secondaryKellner)
                }}
              >
                {glassQuantity > 0 ? `Mit ${glassQuantity} Gläsern` : 'Hinzufügen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Message Banner (for waiters) - show new messages that haven't been seen */}
      {broadcast && broadcast.active && !broadcastDismissed && (broadcast.target === 'all' || broadcast.target === 'waiters') && broadcast.timestamp > lastSeenBroadcastTime && (
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
                  markBroadcastAsRead(undefined, waiterName);
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
