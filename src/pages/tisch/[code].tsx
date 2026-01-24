import { useRouter } from 'next/router';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { database, ref, push, onValue } from '@/lib/firebase';
import { getTableByCode, isValidTableCode } from '@/lib/dynamicTables';
import { menuItems, categories, formatPrice, MenuItem } from '@/lib/menu';
import { AppSettings, defaultSettings, subscribeToSettings, t, Language, BroadcastMessage, subscribeToBroadcast, markBroadcastAsRead, getContrastTextColor, getCachedSettings } from '@/lib/settings';
import { getMenuConfiguration, MenuConfiguration, getCategoryDatabase, getDrinkDatabase, DrinkDatabase } from '@/lib/menuManager';
import PraesenzWertBanner from '@/components/PraesenzWertBanner';
import PraesenzWertPopup from '@/components/PraesenzWertPopup';

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

interface OrderHistory {
  items: OrderItem[];
  total: number;
  timestamp: number;
}

interface CartItem {
  item: MenuItem;
  quantity: number;
}

export default function TablePage() {
  const router = useRouter();
  const { code } = router.query;
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [tableName, setTableName] = useState<string | null>(null);
  const [isShutdown, setIsShutdown] = useState(false);
  const [isOrderFormDisabled, setIsOrderFormDisabled] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [waiterCalled, setWaiterCalled] = useState(false);
  const [waiterCooldown, setWaiterCooldown] = useState(0);
  // Use cached settings initially for instant color display
  const [settings, setSettings] = useState<AppSettings>(() => getCachedSettings());
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [broadcast, setBroadcast] = useState<BroadcastMessage | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderHistory[]>([]);
  const [statistics, setStatistics] = useState<{ itemTotals: { [key: string]: { quantity: number; amount: number } } }>({ itemTotals: {} });
  const [, setTick] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [showIOSInstallHint, setShowIOSInstallHint] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  
  // New menu state
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [activeCategory, setActiveCategory] = useState<string>('alle');
  const [showCart, setShowCart] = useState(false);
  
  // Selection modals
  const [showBottleSelection, setShowBottleSelection] = useState(false);
  const [showBeerCrateSelection, setShowBeerCrateSelection] = useState(false);
  const [showWineBottleSelection, setShowWineBottleSelection] = useState(false);
  const [showShotSelection, setShowShotSelection] = useState(false);
  
  // Glass selection modal
  const [showGlassModal, setShowGlassModal] = useState(false);
  const [pendingBottleItem, setPendingBottleItem] = useState<MenuItem | null>(null);
  const [glassQuantity, setGlassQuantity] = useState(0);
  
  // Temporary quantity for modals
  const [tempQuantity, setTempQuantity] = useState<{ [key: string]: number }>({});
  
  // Queue system for multiple items requiring glasses
  const [itemQueue, setItemQueue] = useState<{ itemId: string; quantity: number }[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  
  // Menu configuration for glass settings etc.
  const [menuConfig, setMenuConfig] = useState<MenuConfiguration | null>(null);
  
  // Configured items with all settings applied from Firebase
  const [configuredItems, setConfiguredItems] = useState<MenuItem[]>(menuItems);
  const [drinkDatabase, setDrinkDatabase] = useState<DrinkDatabase | null>(null);
  
  // Custom categories from database
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string; emoji: string }[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  
  // PräsenzWert popup state
  const [showPraesenzWertPopup, setShowPraesenzWertPopup] = useState(false);

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
  }, [categories, customCategories, categoryOrder]);

  const [pageLoadTime] = useState(() => Date.now()); // Track when page was loaded
  const [broadcastDismissed, setBroadcastDismissed] = useState(false);
  const [lastSeenBroadcastTime, setLastSeenBroadcastTime] = useState<number>(0);

  // Load broadcast read status from localStorage on mount
  useEffect(() => {
    const savedBroadcastTime = localStorage.getItem('lastSeenBroadcastTime');
    if (savedBroadcastTime) {
      setLastSeenBroadcastTime(parseInt(savedBroadcastTime, 10));
    }
  }, []);

  // PräsenzWert popup timer - show 1h after first open, then 1.5h later
  useEffect(() => {
    const isDemoTable = code === 'DEMO123';
    const ONE_HOUR = 1 * 60 * 60 * 1000; // 1 hour in milliseconds
    const ONE_AND_HALF_HOURS = 1.5 * 60 * 60 * 1000; // 1.5 hours in milliseconds
    const now = Date.now();
    
    // Get first open time and popup count from localStorage
    const firstOpenTime = localStorage.getItem('firstOpenTime');
    const lastPopupTime = localStorage.getItem('lastPraesenzWertPopup');
    const popupCount = parseInt(localStorage.getItem('praesenzWertPopupCount') || '0', 10);
    
    // Set first open time if not exists
    if (!firstOpenTime) {
      localStorage.setItem('firstOpenTime', now.toString());
    }
    
    if (isDemoTable) {
      // For demo table: show immediately on every page load
      const timer = setTimeout(() => {
        setShowPraesenzWertPopup(true);
      }, 1000); // Show after 1 second
      return () => clearTimeout(timer);
    } else {
      // For real tables: check timing logic
      const firstOpen = parseInt(firstOpenTime || now.toString(), 10);
      const lastPopup = lastPopupTime ? parseInt(lastPopupTime, 10) : 0;
      
      const shouldShowPopup = () => {
        // First popup: 1 hour after first open
        if (popupCount === 0 && (now - firstOpen) >= ONE_HOUR) {
          return true;
        }
        // Second popup: 1.5 hours after first popup
        if (popupCount === 1 && (now - lastPopup) >= ONE_AND_HALF_HOURS) {
          return true;
        }
        return false;
      };

      if (shouldShowPopup()) {
        const timer = setTimeout(() => {
          setShowPraesenzWertPopup(true);
          localStorage.setItem('lastPraesenzWertPopup', now.toString());
          localStorage.setItem('praesenzWertPopupCount', (popupCount + 1).toString());
        }, 1000); // Show after 1 second on page load

        return () => clearTimeout(timer);
      }
    }
  }, [code]);

  useEffect(() => {
    const loadTable = async () => {
      if (code && typeof code === 'string') {
        // Special handling for demo table
        if (code === 'DEMO123') {
          setTableNumber(999); // Use special number for demo table
        } else {
          const isValid = await isValidTableCode(code);
          if (isValid) {
            const table = await getTableByCode(code);
            if (table) {
              setTableNumber(table.number);
              setTableName(table.name || null); // Set custom name if available
            }
          }
        }
      }
    };

    loadTable();
  }, [code]);

  useEffect(() => {
    const shutdownRef = ref(database, 'system/shutdown');
    const unsubscribe = onValue(shutdownRef, (snapshot) => {
      setIsShutdown(snapshot.val() === true);
    });
    return () => unsubscribe();
  }, []);

  // Mirror waiter orders in local history for 6 minutes
  useEffect(() => {
    if (!tableNumber) return;
    const ordersRef = ref(database, 'orders');
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const now = Date.now();
      const recentWaiterOrders = Object.values<any>(data)
        .filter((o: any) => o.tableNumber === tableNumber && !!o.orderedBy && o.type === 'order')
        .filter((o: any) => now - o.timestamp < 6 * 60 * 1000);

      // Merge into local orderHistory (dedupe by timestamp+total signature)
      setOrderHistory((prev) => {
        const signatures = new Set(prev.map(p => `${p.timestamp}-${p.total}`));
        const additions = recentWaiterOrders
          .filter((o: any) => !signatures.has(`${o.timestamp}-${o.total}`))
          .map((o: any) => ({ items: o.items || [], total: o.total || 0, timestamp: o.timestamp }));
        // Also keep only those still within 6 minutes
        const cleaned = prev.filter(p => now - p.timestamp < 6 * 60 * 1000);
        return [...additions, ...cleaned].sort((a, b) => b.timestamp - a.timestamp);
      });
    });
    return () => unsubscribe();
  }, [tableNumber]);

  useEffect(() => {
    const orderFormRef = ref(database, 'system/orderFormDisabled');
    const unsubscribe = onValue(orderFormRef, (snapshot) => {
      setIsOrderFormDisabled(snapshot.val() === true);
    });
    return () => unsubscribe();
  }, []);

  // Auto-refresh when menu version changes (silent reload)
  useEffect(() => {
    let currentVersion: number | null = null;
    const menuVersionRef = ref(database, 'system/menuVersion');
    const unsubscribe = onValue(menuVersionRef, (snapshot) => {
      const newVersion = snapshot.val();
      if (currentVersion !== null && newVersion !== null && newVersion !== currentVersion) {
        // Version changed - reload silently
        window.location.reload();
      }
      currentVersion = newVersion;
    });
    return () => unsubscribe();
  }, []);

  // Set the tisch manifest for PWA with dynamic start_url
  useEffect(() => {
    if (!code) return;
    
    // Create dynamic manifest with current table URL
    const manifest = {
      name: `Karneval ${tableNumber === 999 ? 'Demo Tisch' : `Tisch ${tableNumber}`}`,
      short_name: tableNumber === 999 ? 'Demo' : `T${tableNumber}`,
      description: 'Tisch-App für das Karneval Bestellsystem - Bestelle Getränke direkt vom Tisch',
      start_url: `/tisch/${code}`,
      scope: `/tisch/${code}`,
      display: 'standalone',
      background_color: '#009640',
      theme_color: '#009640',
      orientation: 'portrait',
      icons: [
        {
          src: '/icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable any'
        },
        {
          src: '/icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable any'
        }
      ]
    };

    // Create blob URL for dynamic manifest
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(blob);

    // Update or create manifest link
    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    if (manifestLink) {
      manifestLink.href = manifestUrl;
    } else {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = manifestUrl;
      document.head.appendChild(manifestLink);
    }

    return () => {
      URL.revokeObjectURL(manifestUrl);
    };
  }, [code, tableNumber]);

  // PWA Install Detection
  useEffect(() => {
    // Check if already installed as PWA
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    setIsStandalone(isInStandaloneMode);

    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    if (isInStandaloneMode) {
      // Already installed, don't show button
      return;
    }

    if (isIOS) {
      // iOS doesn't support beforeinstallprompt, show manual instructions
      setShowInstallButton(true);
    }

    // Android/Chrome install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Subscribe to statistics for popular items calculation
  useEffect(() => {
    const statsRef = ref(database, 'statistics');
    const unsubscribe = onValue(statsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStatistics(data);
      } else {
        setStatistics({ itemTotals: {} });
      }
    });
    return () => unsubscribe();
  }, []);

  // Force re-render every 30 seconds to clean up old orders
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
      // Clean up orders older than 6 minutes
      setOrderHistory(prev => 
        prev.filter(order => {
          const elapsed = Date.now() - order.timestamp;
          return elapsed < 6 * 60 * 1000; // 6 minutes
        })
      );
    }, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Subscribe to settings
  useEffect(() => {
    const unsubscribe = subscribeToSettings((s) => {
      setSettings(s);
      setSettingsLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  // Load menu configuration and build configured items (same as Kellner page)
  const loadMenuConfig = useCallback(async () => {
    try {
      const config = await getMenuConfiguration();
      setMenuConfig(config);
      const db = await getDrinkDatabase();
      setDrinkDatabase(db);
      
      // Build configured items with all settings applied
      if (!config.items) {
        setConfiguredItems(menuItems);
        return;
      }
      
      const activeItemIds = new Set(Object.keys(config.items));
      
      const applyConfig = (base: MenuItem, itemConfig: any | undefined): MenuItem => {
        return {
          ...base,
          isPopular: itemConfig?.isPopular ?? base.isPopular ?? false,
          isSoldOut: itemConfig?.isSoldOut ?? base.isSoldOut ?? false,
          // Apply emoji override from configuration
          emoji: itemConfig?.emoji ?? base.emoji,
          askForGlasses: itemConfig?.askForGlasses ?? base.askForGlasses ?? false,
          glassType: itemConfig?.glassType ?? base.glassType ?? 'beer',
          tableSection: itemConfig?.tableSection ?? base.tableSection ?? null,
          name: itemConfig?.name ?? base.name,
          price: itemConfig?.price ?? base.price,
          description: itemConfig && 'description' in itemConfig
            ? itemConfig.description ?? ''
            : base.description ?? '',
          size: itemConfig && 'size' in itemConfig
            ? itemConfig.size
            : base.size,
          category: itemConfig?.category ?? base.category,
        };
      };
      
      const standardItems = menuItems
        .filter((item) => activeItemIds.has(item.id))
        .map((item) => {
          const itemConfig = config.items[item.id];
          return applyConfig(item, itemConfig);
        });

      const customItems: MenuItem[] = [];
      if (db && db.drinks) {
        for (const [id, itemConfig] of Object.entries(config.items)) {
          if (menuItems.find(mi => mi.id === id)) continue;
          const drink = db.drinks[id];
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
    } catch (error) {
      console.error('Failed to load menu config:', error);
      setConfiguredItems(menuItems);
    }
  }, []);

  useEffect(() => {
    loadMenuConfig();
    
    // Also subscribe to menu and drink database changes to reload config
    const menuVersionRef = ref(database, 'config/menu/lastUpdated');
    const drinkVersionRef = ref(database, 'database/drinks/lastUpdated');
    const unsubMenu = onValue(menuVersionRef, () => { loadMenuConfig(); });
    const unsubDrinks = onValue(drinkVersionRef, () => { loadMenuConfig(); });
    return () => { unsubMenu(); unsubDrinks(); };
  }, [loadMenuConfig]);

  // Load custom categories from database
  const loadCustomCategories = useCallback(async () => {
    try {
      const db = await getCategoryDatabase();
      if (db.categories) {
        const cats = Object.entries(db.categories).map(([id, cat]: [string, any]) => ({
          id,
          name: cat.name,
          emoji: cat.emoji
        }));
        setCustomCategories(cats);
      }
      if (db.order && Array.isArray(db.order)) {
        setCategoryOrder(db.order);
      }
    } catch (error) {
      console.error('Failed to load custom categories:', error);
    }
  }, []);

  useEffect(() => {
    loadCustomCategories();
    
    // Subscribe to category database changes
    const categoryRef = ref(database, 'database/categories/lastUpdated');
    const unsubscribe = onValue(categoryRef, () => {
      loadCustomCategories();
    });
    return () => unsubscribe();
  }, [loadCustomCategories]);

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

  // Waiter cooldown timer (5 minutes = 300 seconds)
  useEffect(() => {
    if (waiterCooldown <= 0) return;
    const timer = setInterval(() => {
      setWaiterCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [waiterCooldown]);

  // Cart helper functions
  const addToCart = (itemId: string) => {
    const item = configuredItems.find(i => i.id === itemId);
    
    if (!item) return;
    // Prevent adding sold out items
    if (item.isSoldOut) return;
    
    // Check if this item should prompt for glasses (already in configured item)
    const shouldAskForGlasses = item.askForGlasses === true;
    
    if (shouldAskForGlasses) {
      setPendingBottleItem(item);
      setGlassQuantity(0);
      setShowGlassModal(true);
      return;
    }
    
    setCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
  };
  
  // Add bottle with glasses to cart
  const addBottleWithGlasses = () => {
    if (!pendingBottleItem) return;
    
    // Add the bottle
    setCart(prev => ({ ...prev, [pendingBottleItem.id]: (prev[pendingBottleItem.id] || 0) + 1 }));
    
    // Add glasses if quantity > 0
    if (glassQuantity > 0) {
      // Determine glass type based on product setting
      let glassId = 'glas-normal'; // default: Bierglas
      if (pendingBottleItem.glassType === 'wine') {
        glassId = 'glas-wein-leer';
      } else if (pendingBottleItem.glassType === 'sekt') {
        glassId = 'glas-sekt-leer';
      }
      setCart(prev => ({ ...prev, [glassId]: (prev[glassId] || 0) + glassQuantity }));
    }
    
    // Reset and close modal
    setPendingBottleItem(null);
    setGlassQuantity(0);
    setShowGlassModal(false);
    
    // Process next item in queue if any
    processNextItemInQueue();
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
        setCart(cartPrev => ({ ...cartPrev, [nextItem.itemId]: (cartPrev[nextItem.itemId] || 0) + 1 }));
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
        setCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
      }
    });
    
    // Process items that need glasses in queue
    if (itemsNeedingGlasses.length > 0) {
      setIsProcessingQueue(true);
      setItemQueue(itemsNeedingGlasses);
      processNextItemInQueue();
    }
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[itemId] > 1) {
        newCart[itemId]--;
      } else {
        delete newCart[itemId];
      }
      return newCart;
    });
  };

  const getCartQuantity = (itemId: string) => cart[itemId] || 0;

  const cartTotal = Object.entries(cart).reduce((sum, [itemId, qty]) => {
    const item = configuredItems.find(i => i.id === itemId);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const cartItemCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

  // Calculate top 5 popular items based on statistics (excluding glasses)
  const getTop5PopularItems = (): Set<string> => {
    const itemCounts: { [key: string]: number } = {};
    
    // Use statistics.itemTotals which contains completed orders
    if (statistics.itemTotals) {
      Object.entries(statistics.itemTotals).forEach(([itemName, data]) => {
        const menuItem = configuredItems.find(m => m.name === itemName);
        if (menuItem && menuItem.category !== 'glaeser') {
          itemCounts[menuItem.id] = data.quantity;
        }
      });
    }
    
    const sortedItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([itemId]) => itemId);
    
    return new Set(sortedItems);
  };

  const top5PopularIds = getTop5PopularItems();

  // Get items with dynamic popularity
  const getItemsWithDynamicPopularity = () => {
    return configuredItems.map(item => ({
      ...item,
      isPopular: top5PopularIds.has(item.id)
    }));
  };

  const dynamicMenuItems = getItemsWithDynamicPopularity();

  const handleOrder = async () => {
    if (cartItemCount === 0) return;
    
    const items: OrderItem[] = Object.entries(cart).map(([itemId, qty]) => {
      // Try to find in configuredItems first, fallback to menuItems (for glasses, etc.)
      const item = configuredItems.find(i => i.id === itemId) || menuItems.find(i => i.id === itemId);
      if (!item) {
        console.error(`Item ${itemId} not found in configuredItems or menuItems`);
        return { name: 'Unknown', price: 0, quantity: qty };
      }
      return { name: item.name, price: item.price, quantity: qty };
    });

    const timestamp = Date.now();

    await push(ref(database, 'orders'), {
      tableCode: code,
      tableNumber: tableNumber,
      items: items,
      total: cartTotal,
      type: 'order',
      timestamp: timestamp,
      status: 'new',
    });

    // Add to order history
    setOrderHistory(prev => [{ items, total: cartTotal, timestamp }, ...prev]);

    setOrderSent(true);
    setCart({});
    setShowCart(false);
    
    // Vibration feedback
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
    
    setTimeout(() => setOrderSent(false), 3000);
  };

  const handleClearCart = () => {
    setCart({});
    setShowCart(false);
  };

  // Get quantity sold for an item from statistics
  const getItemQuantity = (itemName: string): number => {
    return statistics.itemTotals?.[itemName]?.quantity || 0;
  };

  // Filter items by category and sort by popularity (quantity sold descending, then by price)
  const getFilteredItems = () => {
    let items = activeCategory === 'alle' ? dynamicMenuItems : dynamicMenuItems.filter(i => i.category === activeCategory);
    // Do NOT hide sold out items; they should remain visible but be disabled for ordering
    
    // Sort by quantity sold (descending), then by price (descending) as tiebreaker
    items = [...items].sort((a, b) => {
      const qtyA = getItemQuantity(a.name);
      const qtyB = getItemQuantity(b.name);
      
      // First sort by quantity (most sold first)
      if (qtyB !== qtyA) return qtyB - qtyA;
      
      // If same quantity, sort by price (more expensive first)
      return b.price - a.price;
    });
    
    return items;
  };

  // Filter order history to only show orders from last 6 minutes
  const recentOrders = orderHistory.filter(order => {
    const elapsed = Date.now() - order.timestamp;
    return elapsed < 6 * 60 * 1000; // 6 minutes
  });

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCallWaiter = async () => {
    if (waiterCooldown > 0) return;
    
    await push(ref(database, 'orders'), {
      tableCode: code,
      tableNumber: tableNumber,
      type: 'waiter_call',
      timestamp: Date.now(),
      status: 'new',
    });

    setWaiterCalled(true);
    setWaiterCooldown(300); // 5 minutes = 300 seconds
    
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
    
    setTimeout(() => setWaiterCalled(false), 3000);
  };

  // Format cooldown time
  const formatCooldown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleInstallClick = async () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    if (isIOS) {
      setShowIOSInstallHint(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallButton(false);
      }
      setDeferredPrompt(null);
    }
  };

  // Show loading screen until settings are loaded (prevents color flash)
  if (!settingsLoaded || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#1a1a1a' }}>
        <div className="text-center text-white">
          <div className="animate-spin w-12 h-12 border-4 border-white/20 border-t-white rounded-full mx-auto mb-4"></div>
          <p className="text-xl">Laden...</p>
        </div>
      </div>
    );
  }

  if (!code || !tableNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: settings.colors?.primaryTisch || '#009640' }}>
        <div className="text-center" style={{ color: getContrastTextColor(settings.colors?.primaryTisch || '#009640') }}>
          <p className="text-2xl">Laden...</p>
        </div>
      </div>
    );
  }

  if (isShutdown) {
    return (
      <div className="min-h-screen bg-red-700 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md shadow-2xl">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-red-700 mb-4">System außer Betrieb</h1>
          <p className="text-gray-700 text-lg">
            Das System wurde aus technischen Gründen abgeschaltet. 
            Kellner kommen jetzt regelmäßig an Ihren Tisch.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${settings.colors.primaryTisch} 0%, ${settings.colors.primaryTisch}dd 100%)` }}
    >
      {/* PräsenzWert Banner - Above Header */}
      <PraesenzWertBanner />

      {/* Background Logo Watermark */}
      <div className="pointer-events-none absolute top-6 right-[-4%] opacity-10 rotate-12">
        <img
          src={settings.logo || "https://www.energieschub.evm.de/media/ecb72371a2/1a53b5737ffd_180x180_boxed.jpg"}
          alt="Logo Hintergrund"
          className="w-96 md:w-[36rem] mix-blend-multiply rounded-full saturate-150 brightness-110"
        />
      </div>
      {/* Header - Kompakt */}
      <div 
        className="p-3 shadow-lg relative z-10"
        style={{ 
          backgroundColor: settings.colors.secondaryTisch,
          color: getContrastTextColor(settings.colors.secondaryTisch)
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img 
              src={settings.logo || "https://www.energieschub.evm.de/media/ecb72371a2/1a53b5737ffd_180x180_boxed.jpg"} 
              alt="Logo" 
              className="w-12 h-12 rounded-full shadow-md"
            />
            <h1 
              className="text-lg font-bold drop-shadow"
              style={{ color: getContrastTextColor(settings.colors.secondaryTisch) }}
            >
              Fastelovend 2026
            </h1>
          </div>
          <span 
            className="px-4 py-1.5 rounded-full bg-white/90 backdrop-blur font-black text-lg shadow-lg whitespace-nowrap"
            style={{ color: getContrastTextColor(settings.colors.secondaryTisch) }}
          >
            {tableNumber === 999 ? t('demo_table', settings.language) : (
            tableName ? tableName : `${t('table', settings.language)} ${tableNumber}`
          )}
          </span>
        </div>
      </div>

      <div className="p-4 max-w-6xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column - Order Form */}
          <div>
            {/* Success Messages */}
            {orderSent && (
              <div className="bg-white/90 backdrop-blur rounded-xl p-4 mb-4 text-center shadow-lg animate-pulse">
                <p className="text-evm-green font-bold text-lg">✅ Bestellung gesendet!</p>
              </div>
            )}
            {waiterCalled && (
              <div className="bg-white/90 backdrop-blur rounded-xl p-4 mb-4 text-center shadow-lg animate-pulse">
                <p className="text-evm-green font-bold text-lg">✅ Kellner wird gerufen!</p>
              </div>
            )}

            {/* Call Waiter Button - Above Order Form with 5min cooldown */}
            <div className="relative mb-4">
              <button 
                onClick={handleCallWaiter}
                disabled={waiterCooldown > 0}
                className={`w-full py-5 rounded-2xl text-xl font-bold shadow-xl transition-all ring-2 ring-white/30 relative overflow-hidden ${
                  waiterCooldown > 0 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'active:scale-95'
                }`}
                style={{ 
                  backgroundColor: settings.colors.secondaryTisch,
                  color: getContrastTextColor(settings.colors.secondaryTisch)
                }}
              >
                {/* Original button content (always visible as background) */}
                <div className={`transition-opacity ${waiterCooldown > 0 ? 'opacity-30' : 'opacity-100'}`}>
                  {t('call_waiter', settings.language)}
                  <div className="text-sm font-normal mt-1">
                    {t('call_waiter_hint', settings.language)}
                  </div>
                </div>
                
                {/* Timer overlay (only visible during cooldown) */}
                {waiterCooldown > 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-2xl">
                    <div className="text-3xl font-mono font-black text-white">{formatCooldown(waiterCooldown)}</div>
                    <div className="text-sm font-normal mt-1 text-white">
                      {t('cooldown_active', settings.language)} {Math.ceil(waiterCooldown / 60)} {t('minutes', settings.language)}
                    </div>
                    <div className="text-xs text-white/80 mt-2">
                      🙋 Köbes wurde gerufen
                    </div>
                  </div>
                )}
              </button>
            </div>

            {/* Your Orders - Directly under Call Waiter Button */}
            {recentOrders.length > 0 && (
              <div className="bg-white/90 backdrop-blur rounded-2xl p-4 shadow-xl mb-4">
                <h2 className="text-lg font-bold text-center mb-3 text-gray-800">
                  {t('your_orders', settings.language)}
                </h2>
                <div className="space-y-3">
                  {recentOrders.map((order, idx) => (
                    <div key={idx} className="border-2 border-evm-green rounded-xl p-3 bg-green-50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">{formatTime(order.timestamp)}</span>
                        <span className="text-lg font-bold text-evm-green">{order.total.toFixed(2)} €</span>
                      </div>
                      <div className="space-y-1">
                        {order.items.map((item, itemIdx) => (
                          <div key={itemIdx} className="flex justify-between text-gray-700">
                            <span>{item.quantity}x {item.name}</span>
                            <span>{(item.price * item.quantity).toFixed(2)} €</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 text-center mt-3">
                  {t('orders_shown_6min', settings.language)}
                </p>
              </div>
            )}

            {/* Cart Summary - Moved to top (under Köbes Rufen) */}
            {!isOrderFormDisabled && cartItemCount > 0 && (
              <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl mb-4 p-4">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-700">{cartItemCount} Artikel</span>
                    <button
                      onClick={() => setShowCart(true)}
                      className="px-3 py-1 bg-evm-green text-white rounded-lg text-sm font-bold hover:bg-evm-green/80 transition-colors"
                    >
                      {t('view_cart', settings.language)}
                    </button>
                  </div>
                  <span className="text-2xl font-bold text-evm-green">{formatPrice(cartTotal)}</span>
                </div>
                <button
                  onClick={handleOrder}
                  className="w-full py-4 rounded-xl text-xl font-bold active:scale-95 shadow-lg transition-all"
                  style={{ 
                    backgroundColor: settings.colors.secondaryTisch,
                    color: getContrastTextColor(settings.colors.secondaryTisch)
                  }}
                >
                  🛒 Bestellen ({formatPrice(cartTotal)})
                </button>
                <button
                  onClick={handleClearCart}
                  className="w-full mt-2 py-2 rounded-lg text-sm font-bold bg-gray-200 text-gray-600"
                >
                  🔄 Warenkorb leeren
                </button>
              </div>
            )}

            {/* Order Form - only show when not disabled */}
        {!isOrderFormDisabled ? (
          <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl mb-4 overflow-hidden">
            {/* Category Tabs */}
            <div className="flex overflow-x-auto bg-gray-100 p-1 gap-1">
              <button
                onClick={() => setActiveCategory('alle')}
                className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${
                  activeCategory === 'alle' ? 'bg-evm-green text-white' : 'bg-white text-gray-700'
                }`}
              >
                🍹 Alle
              </button>
              {/* Merged and ordered categories */}
              {mergedCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${
                    activeCategory === cat.id ? 'bg-evm-green text-white' : 'bg-white text-gray-700'
                  }`}
                >
                  {cat.emoji} {cat.name}
                </button>
              ))}
            </div>

            <div className="p-4">
              {/* Premium Items - "Für den Tisch" Section - Dynamic based on tableSection */}
              {activeCategory === 'alle' && (() => {
                // Use configuredItems which already have all settings applied
                const bottleNonalcItems = configuredItems.filter(i => i.tableSection === 'bottle-nonalc');
                const beerCrateItems = configuredItems.filter(i => i.tableSection === 'beer-crate');
                const wineBottleItems = configuredItems.filter(i => i.tableSection === 'wine-bottle');
                const shotsCrateItems = configuredItems.filter(i => i.tableSection === 'shots-crate');
                
                const hasAnyTableSection = bottleNonalcItems.length > 0 || beerCrateItems.length > 0 || 
                                         wineBottleItems.length > 0 || shotsCrateItems.length > 0;
                
                if (!hasAnyTableSection) return null;
                
                return (
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-2">
                      <span className="text-lg">✨</span> Für den ganzen Tisch
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {bottleNonalcItems.length > 0 && (
                        <button
                          onClick={() => setShowBottleSelection(true)}
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
                          onClick={() => setShowBeerCrateSelection(true)}
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
                          onClick={() => setShowWineBottleSelection(true)}
                          className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-3 text-left hover:shadow-md transition-shadow"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-2xl">🍾</span>
                            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              ab {formatPrice(Math.min(...wineBottleItems.map(i => i.price)))}
                            </span>
                          </div>
                          <p className="font-bold text-sm text-gray-800">Wein / Secco Flasche</p>
                          <p className="text-xs text-gray-500">{wineBottleItems.length} Sorten</p>
                        </button>
                      )}

                      {shotsCrateItems.length > 0 && (
                        <button
                          onClick={() => setShowShotSelection(true)}
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
                  </div>
                );
              })()}

              {/* Regular Items */}
              <h3 className="text-sm font-bold text-gray-600 mb-2">
                {activeCategory === 'alle' ? '🥤 Getränke' : mergedCategories.find(c => c.id === activeCategory)?.emoji + ' ' + mergedCategories.find(c => c.id === activeCategory)?.name}
              </h3>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {getFilteredItems().map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-xl ${
                      item.isPopular ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.emoji}</span>
                      <div>
                        <p className="font-bold text-gray-800">
                          {item.name}
                          {item.isPopular && <span className="ml-2 text-xs text-green-600">⭐ Beliebt</span>}
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
                      {getCartQuantity(item.id) > 0 && (
                        <>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="w-10 h-10 bg-gray-200 rounded-full text-xl font-bold active:bg-gray-300"
                          >
                            -
                          </button>
                          <span className="font-bold text-xl w-8 text-center">{getCartQuantity(item.id)}</span>
                        </>
                      )}
                      <button
                        onClick={() => addToCart(item.id)}
                        disabled={item.isSoldOut}
                        className={`w-10 h-10 rounded-full text-xl font-bold ${item.isSoldOut ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                        style={{ 
                          backgroundColor: settings.colors.secondaryTisch,
                          color: getContrastTextColor(settings.colors.secondaryTisch)
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        ) : (
          <div className="bg-yellow-100/90 backdrop-blur rounded-2xl p-6 shadow-xl mb-4 text-center">
            <div className="text-4xl mb-3">🚫</div>
            <h2 className="text-xl font-bold text-yellow-800 mb-2">Bestellung momentan nicht möglich</h2>
            <p className="text-yellow-700">Bitte rufen Sie den Köbes über den Button oben.</p>
          </div>
        )}

        {/* PWA Install Button */}
        {showInstallButton && !isStandalone && (
          <button
            onClick={handleInstallClick}
            className="w-full bg-white/90 backdrop-blur py-4 rounded-2xl text-lg font-bold shadow-xl active:scale-95 transition-transform mt-4 flex items-center justify-center gap-2"
            style={{ color: settings.colors.secondaryTisch }}
          >
            <span className="text-2xl">📲</span>
            <span>Tisch {tableNumber} als App speichern</span>
          </button>
        )}

        {/* Footer - Kompakt mit PräsenzWert */}
        <div className="mt-8 pt-6 border-t border-white/20 text-center space-y-2">
          <p className="text-white/70 text-sm">Bezahlung erfolgt am Tisch</p>
          <PraesenzWertPopup />
          <div className="flex items-center justify-center gap-2 text-xs text-white/50">
            <span>© 2026</span>
            <span>•</span>
            <button onClick={() => router.push('/impressum')} className="hover:text-white/70 underline">
              Impressum
            </button>
            <span>•</span>
            <button onClick={() => router.push('/datenschutz')} className="hover:text-white/70 underline">
              Datenschutz
            </button>
          </div>
        </div>

        {/* Selection Modals */}
        {/* Bottle Selection Modal */}
        {showBottleSelection && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">🍾 Flasche wählen</h2>
                <button onClick={() => { setShowBottleSelection(false); setTempQuantity({}); }} className="text-2xl text-gray-500">✕</button>
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
                        <span className="text-lg font-bold text-evm-green">{formatPrice(item.price)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => setTempQuantity(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] || 0) - 1) }))}
                        disabled={item.isSoldOut}
                        className={`w-10 h-10 rounded-full text-xl font-bold ${item.isSoldOut ? 'bg-gray-200 opacity-50 cursor-not-allowed' : 'bg-gray-200 active:bg-gray-300'}`}
                      >
                        -
                      </button>
                      <span className="text-2xl font-bold w-12 text-center">{tempQuantity[item.id] || 0}</span>
                      <button
                        onClick={() => setTempQuantity(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))}
                        disabled={item.isSoldOut}
                        className={`w-10 h-10 rounded-full text-xl font-bold ${item.isSoldOut ? 'opacity-50 cursor-not-allowed bg-gray-200' : 'active:scale-95'}`}
                        style={{ 
                          backgroundColor: settings.colors.secondaryTisch,
                          color: getContrastTextColor(settings.colors.secondaryTisch)
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {Object.values(tempQuantity).some(q => q > 0) && (
                <button
                  onClick={() => {
                    const itemsToAdd = Object.entries(tempQuantity)
                      .filter(([, qty]) => qty > 0)
                      .map(([itemId, qty]) => ({ itemId, quantity: qty }));
                    
                    addMultipleItemsToCart(itemsToAdd);
                    setTempQuantity({});
                    setShowBottleSelection(false);
                  }}
                  className="w-full py-3 rounded-xl font-bold text-lg"
                  style={{ 
                    backgroundColor: settings.colors.secondaryTisch,
                    color: getContrastTextColor(settings.colors.secondaryTisch)
                  }}
                >
                  Hinzufügen
                </button>
              )}
            </div>
          </div>
        )}

        {/* Beer Crate Selection Modal */}
        {showBeerCrateSelection && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">📦 Kiste wählen</h2>
                <button onClick={() => { setShowBeerCrateSelection(false); setTempQuantity({}); }} className="text-2xl text-gray-500">✕</button>
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
                        <span className="text-lg font-bold text-evm-green">{formatPrice(item.price)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => setTempQuantity(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] || 0) - 1) }))}
                        disabled={item.isSoldOut}
                        className={`w-10 h-10 rounded-full text-xl font-bold ${item.isSoldOut ? 'bg-gray-200 opacity-50 cursor-not-allowed' : 'bg-gray-200 active:bg-gray-300'}`}
                      >
                        -
                      </button>
                      <span className="text-2xl font-bold w-12 text-center">{tempQuantity[item.id] || 0}</span>
                      <button
                        onClick={() => setTempQuantity(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))}
                        disabled={item.isSoldOut}
                        className={`w-10 h-10 rounded-full text-xl font-bold ${item.isSoldOut ? 'opacity-50 cursor-not-allowed bg-gray-200' : 'active:scale-95'}`}
                        style={{ 
                          backgroundColor: settings.colors.secondaryTisch,
                          color: getContrastTextColor(settings.colors.secondaryTisch)
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {Object.values(tempQuantity).some(q => q > 0) && (
                <button
                  onClick={() => {
                    const itemsToAdd = Object.entries(tempQuantity)
                      .filter(([, qty]) => qty > 0)
                      .map(([itemId, qty]) => ({ itemId, quantity: qty }));
                    
                    addMultipleItemsToCart(itemsToAdd);
                    setTempQuantity({});
                    setShowBeerCrateSelection(false);
                  }}
                  className="w-full py-3 rounded-xl font-bold text-lg"
                  style={{ 
                    backgroundColor: settings.colors.secondaryTisch,
                    color: getContrastTextColor(settings.colors.secondaryTisch)
                  }}
                >
                  Hinzufügen
                </button>
              )}
            </div>
          </div>
        )}

        {/* Wine Bottle Selection Modal */}
        {showWineBottleSelection && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">🍾 Wein/Sekt wählen</h2>
                <button onClick={() => { setShowWineBottleSelection(false); setTempQuantity({}); }} className="text-2xl text-gray-500">✕</button>
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
                        <span className="text-lg font-bold text-evm-green">{formatPrice(item.price)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => setTempQuantity(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] || 0) - 1) }))}
                        disabled={item.isSoldOut}
                        className={`w-10 h-10 rounded-full text-xl font-bold ${item.isSoldOut ? 'bg-gray-200 opacity-50 cursor-not-allowed' : 'bg-gray-200 active:bg-gray-300'}`}
                      >
                        -
                      </button>
                      <span className="text-2xl font-bold w-12 text-center">{tempQuantity[item.id] || 0}</span>
                      <button
                        onClick={() => setTempQuantity(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))}
                        disabled={item.isSoldOut}
                        className={`w-10 h-10 rounded-full text-xl font-bold ${item.isSoldOut ? 'opacity-50 cursor-not-allowed bg-gray-200' : 'active:scale-95'}`}
                        style={{ 
                          backgroundColor: settings.colors.secondaryTisch,
                          color: getContrastTextColor(settings.colors.secondaryTisch)
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {Object.values(tempQuantity).some(q => q > 0) && (
                <button
                  onClick={() => {
                    const itemsToAdd = Object.entries(tempQuantity)
                      .filter(([, qty]) => qty > 0)
                      .map(([itemId, qty]) => ({ itemId, quantity: qty }));
                    
                    addMultipleItemsToCart(itemsToAdd);
                    setTempQuantity({});
                    setShowWineBottleSelection(false);
                  }}
                  className="w-full py-3 rounded-xl font-bold text-lg"
                  style={{ 
                    backgroundColor: settings.colors.secondaryTisch,
                    color: getContrastTextColor(settings.colors.secondaryTisch)
                  }}
                >
                  Hinzufügen
                </button>
              )}
            </div>
          </div>
        )}

        {/* Shot/Kurze Selection Modal */}
        {showShotSelection && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">🥃 Schnaps wählen</h2>
                <button onClick={() => { setShowShotSelection(false); setTempQuantity({}); }} className="text-2xl text-gray-500">✕</button>
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
                        <span className="text-lg font-bold text-evm-green">{formatPrice(item.price)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => setTempQuantity(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] || 0) - 1) }))}
                        disabled={item.isSoldOut}
                        className={`w-10 h-10 rounded-full text-xl font-bold ${item.isSoldOut ? 'bg-gray-200 opacity-50 cursor-not-allowed' : 'bg-gray-200 active:bg-gray-300'}`}
                      >
                        -
                      </button>
                      <span className="text-2xl font-bold w-12 text-center">{tempQuantity[item.id] || 0}</span>
                      <button
                        onClick={() => setTempQuantity(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))}
                        disabled={item.isSoldOut}
                        className={`w-10 h-10 rounded-full text-xl font-bold ${item.isSoldOut ? 'opacity-50 cursor-not-allowed bg-gray-200' : 'active:scale-95'}`}
                        style={{ 
                          backgroundColor: settings.colors.secondaryTisch,
                          color: getContrastTextColor(settings.colors.secondaryTisch)
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {Object.values(tempQuantity).some(q => q > 0) && (
                <button
                  onClick={() => {
                    const itemsToAdd = Object.entries(tempQuantity)
                      .filter(([, qty]) => qty > 0)
                      .map(([itemId, qty]) => ({ itemId, quantity: qty }));
                    
                    addMultipleItemsToCart(itemsToAdd);
                    setTempQuantity({});
                    setShowShotSelection(false);
                  }}
                  className="w-full py-3 rounded-xl font-bold text-lg"
                  style={{ 
                    backgroundColor: settings.colors.secondaryTisch,
                    color: getContrastTextColor(settings.colors.secondaryTisch)
                  }}
                >
                  Hinzufügen
                </button>
              )}
            </div>
          </div>
        )}
          </div>
        </div>
      </div>

      {/* Glass Selection Modal */}
      {showGlassModal && pendingBottleItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">🥃 Gläser dazu?</h2>
              <button 
                onClick={() => {
                  setShowGlassModal(false);
                  setPendingBottleItem(null);
                  setGlassQuantity(0); // Reset glass quantity
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
                <span className="text-4xl font-bold text-evm-green">{glassQuantity}</span>
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
                  // Add bottle without glasses
                  setCart(prev => ({ ...prev, [pendingBottleItem.id]: (prev[pendingBottleItem.id] || 0) + 1 }));
                  setShowGlassModal(false);
                  setPendingBottleItem(null);
                  setGlassQuantity(0); // Reset glass quantity
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

      {/* iOS Install Hint Modal */}
      {showIOSInstallHint && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowIOSInstallHint(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-5xl mb-4">🍺</div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">{tableNumber === 999 ? 'Demo' : `Tisch ${tableNumber}`} App installieren</h2>
            <p className="text-sm text-gray-600 mb-4">
              Installiere diese Seite als App auf deinem Handy - so findest du sie immer schnell wieder!
            </p>
            <div className="text-left space-y-3 mb-6">
              <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-xl">
                <span className="text-2xl">1️⃣</span>
                <span className="text-gray-700">Tippe unten auf <strong>Teilen</strong> (das Quadrat mit Pfeil)</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-xl">
                <span className="text-2xl">2️⃣</span>
                <span className="text-gray-700">Scrolle und tippe auf <strong>"Zum Home-Bildschirm"</strong></span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-xl">
                <span className="text-2xl">3️⃣</span>
                <span className="text-gray-700">Tippe oben rechts auf <strong>"Hinzufügen"</strong></span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Die App öffnet immer direkt {tableNumber === 999 ? 'den Demo Tisch' : `Tisch ${tableNumber}`}!
            </p>
            <button
              onClick={() => setShowIOSInstallHint(false)}
              className="w-full py-3 bg-evm-green text-white rounded-xl font-bold"
            >
              Verstanden
            </button>
          </div>
        </div>
      )}

      {/* Broadcast Message Banner (for guests) - show new messages that haven't been seen */}
      {broadcast && broadcast.active && !broadcastDismissed && (broadcast.target === 'all' || broadcast.target === 'tables') && broadcast.timestamp > lastSeenBroadcastTime && (
        <div className="fixed top-20 left-4 right-4 z-40">
          <div className="max-w-lg mx-auto bg-blue-600 text-white p-4 rounded-xl shadow-2xl animate-pulse">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📢</span>
              <div className="flex-1">
                <p className="font-bold">{broadcast.message}</p>
              </div>
              <button
                onClick={() => {
                  markBroadcastAsRead(tableNumber || undefined);
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

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">{t('cart_title', settings.language)}</h2>
                <button
                  onClick={() => setShowCart(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {Object.entries(cart).length === 0 ? (
                <p className="text-gray-500 text-center py-8">{t('cart_empty', settings.language)}</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(cart).map(([itemId, quantity]) => {
                    const item = configuredItems.find(i => i.id === itemId);
                    if (!item) return null;
                    
                    return (
                      <div key={itemId} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-2xl">{item.emoji}</span>
                          <div>
                            <h3 className="font-bold text-gray-800">{item.name}</h3>
                            <p className="text-sm text-gray-500">{formatPrice(item.price)} × {quantity}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-evm-green">{formatPrice(item.price * quantity)}</span>
                          <button
                            onClick={() => removeFromCart(itemId)}
                            className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {Object.entries(cart).length > 0 && (
              <div className="p-4 border-t border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-lg font-bold text-gray-800">{t('total_sum', settings.language)}</span>
                  <span className="text-2xl font-bold text-evm-green">{formatPrice(cartTotal)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowCart(false);
                      handleOrder();
                    }}
                    className="flex-1 py-3 bg-evm-green text-white rounded-xl font-bold active:scale-95 transition-all"
                  >
                    🛒 Bestellen ({formatPrice(cartTotal)})
                  </button>
                  <button
                    onClick={handleClearCart}
                    className="px-4 py-3 bg-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                  >
                    🔄
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PräsenzWert Popup */}
      {showPraesenzWertPopup && (
        <PraesenzWertPopup onClose={() => setShowPraesenzWertPopup(false)} />
      )}
    </div>
  );
}
