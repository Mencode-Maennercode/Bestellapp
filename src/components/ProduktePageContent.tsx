import { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import React, { useState, useEffect, useMemo } from 'react';
import { menuItems, categories } from '@/lib/menu';
import { 
  getMenuConfiguration, 
  updateMenuConfiguration, 
  updateItemConfiguration,
  toggleSoldOutStatus,
  resetMenuConfiguration,
  clearMenuConfiguration,
  getDrinkDatabase,
  addProductToMenu,
  removeProductFromMenu,
  addDrinkToDatabase,
  DrinkDatabase,
  MenuConfiguration,
  initializeMenuWithDefaults,
  clearDrinkDatabase,
  getCategoryDatabase,
  addCategoryToDatabase,
  deleteCategoryFromDatabase,
  updateCategoryDatabase
} from '@/lib/menuManager';
import { ref, set, database } from '@/lib/firebase';
import type { MenuItem } from '@/lib/menu';

// Helper function to format price
const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2
  }).format(price);
};

const Produkte: NextPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: 100 });
  const [showTableOnly, setShowTableOnly] = useState(false);
  const [showSoldOutOnly, setShowSoldOutOnly] = useState(false);
  const [menuConfig, setMenuConfig] = useState<MenuConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    emoji?: string;
    price: string;
    description: string;
    size: string;
    glassType?: 'beer' | 'wine' | 'sekt';
    askForGlasses?: boolean;
    tableSection?: 'bottle-nonalc' | 'beer-crate' | 'wine-bottle' | 'shots-crate' | null;
  }>({
    name: '',
    emoji: undefined,
    price: '',
    description: '',
    size: '',
    glassType: undefined,
    askForGlasses: false,
    tableSection: null
  });
  const [drinkDatabase, setDrinkDatabase] = useState<DrinkDatabase | null>(null);
  const [showDrinkModal, setShowDrinkModal] = useState(false);
  const [selectedCategoryForDrinks, setSelectedCategoryForDrinks] = useState<string>('all');
  const [targetCategoryForDrinks, setTargetCategoryForDrinks] = useState<string>(''); // The category we're adding drinks TO
  const [drinkSearchTerm, setDrinkSearchTerm] = useState('');
  const [showAddDrinkForm, setShowAddDrinkForm] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(true);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [newDrinkForm, setNewDrinkForm] = useState({
    name: '',
    emoji: '🍺',
    price: '',
    size: '',
    category: '',
    description: ''
  });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [extraCategories, setExtraCategories] = useState<{ id: string; name: string; emoji: string }[]>([]);
  const [allDatabaseCategories, setAllDatabaseCategories] = useState<{ id: string; name: string; emoji: string }[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('📂');
  const [useExistingCategory, setUseExistingCategory] = useState(false);
  const [selectedExistingCategory, setSelectedExistingCategory] = useState('');
  const [emojiSearch, setEmojiSearch] = useState('');
  const [productEmojiSearch, setProductEmojiSearch] = useState('');
  const [categoryEmojiSearch, setCategoryEmojiSearch] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryEmoji, setEditingCategoryEmoji] = useState('');
  const emojiPalette = ['🍺','🥤','🍷','🥂','🥃','🍾','🍋','🍊','🍎','📦','✨','📂','🍸','🍹','🍇','🍓','🍒','🍕','🍔','🌭','🍟','🥙','🌮','🌯','🥗','🍝','🍜','🍲','🥘','🍱','🍛','🍣','🍤','🥟','🍩','🍪','🎂','🍰','🧁','🥧','🍦','🍨','🥞','🧇','🥓','🍖','🍗','🥩','🧀','🥨','🥖','🥐','🍞'];

  // Keyword index to make emoji search useful with text input (German synonyms)
  const emojiKeywords: Record<string, string[]> = useMemo(() => ({
    '🍺': ['bier','pils','helles','lager','krug','beer'],
    '🥤': ['softdrink','cola','fanta','spezi','limonade','limo','saft','schorle','soft'],
    '🍷': ['wein','rotwein','weißwein','weisswein','wine'],
    '🥂': ['sekt','prosecco','schampus','champagner','anstoßen','toast'],
    '🥃': ['whisky','schnaps','shot','short','geist','likör'],
    '🍾': ['flasche','bottle','champagner','sekt','wein'],
    '🍋': ['zitrone','lemon','zitronig','limette'],
    '🍊': ['orange','orangensaft','apfelsine','zitrus'],
    '🍎': ['apfel','apfelsaft','apfelwein'],
    '📦': ['kiste','kasten','crate','gebinde'],
    '✨': ['besonders','highlight','special','premium','glitzer'],
    '📂': ['kategorie','ordner','folder','sammlung'],
    '🍸': ['cocktail','martini','longdrink'],
    '🍹': ['cocktail','pina','colada','mai tai','longdrink','tropisch'],
    '🍇': ['traube','traubensaft','grapes'],
    '🍓': ['erdbeere','strawberry'],
    '🍒': ['kirsche','kirsch','cherry'],
    '🍕': ['pizza','italienisch','italian'],
    '🍔': ['burger','hamburger','cheeseburger'],
    '🌭': ['hotdog','wurst','würstchen'],
    '🍟': ['pommes','fries','fritten','kartoffel'],
    '🥙': ['döner','kebab','wrap','dürüm'],
    '🌮': ['taco','mexikanisch','mexican'],
    '🌯': ['burrito','wrap','mexikanisch'],
    '🥗': ['salat','salad','gesund','healthy'],
    '🍝': ['pasta','nudeln','spaghetti','italienisch'],
    '🍜': ['suppe','ramen','nudelsuppe','soup'],
    '🍲': ['eintopf','stew','topf'],
    '🥘': ['pfanne','paella','gericht'],
    '🍱': ['bento','box','lunchbox'],
    '🍛': ['curry','reis','indisch'],
    '🍣': ['sushi','japanisch','japanese'],
    '🍤': ['garnele','shrimp','meeresfrüchte'],
    '🥟': ['dumpling','teigtasche','gyoza'],
    '🍩': ['donut','süß','sweet','gebäck'],
    '🍪': ['keks','cookie','plätzchen'],
    '🎂': ['kuchen','torte','cake','geburtstag'],
    '🍰': ['torte','kuchen','cake','dessert'],
    '🧁': ['cupcake','muffin','törtchen'],
    '🥧': ['pie','kuchen','apfelkuchen'],
    '🍦': ['eis','eiscreme','ice cream','softeis'],
    '🍨': ['eis','eiscreme','ice cream','becher'],
    '🥞': ['pfannkuchen','pancake','crepe'],
    '🧇': ['waffel','waffle'],
    '🥓': ['speck','bacon','frühstück'],
    '🍖': ['fleisch','meat','knochen'],
    '🍗': ['hähnchen','chicken','geflügel'],
    '🥩': ['steak','fleisch','meat','rind'],
    '🧀': ['käse','cheese'],
    '🥨': ['brezel','pretzel','laugengebäck'],
    '🥖': ['baguette','brot','bread','französisch'],
    '🥐': ['croissant','hörnchen','französisch'],
    '🍞': ['brot','bread','toast']
  }), []);

  // Filter categories by search term
  const filteredCategories = useMemo(() => {
    if (!categorySearchTerm.trim()) return allDatabaseCategories;
    const term = categorySearchTerm.toLowerCase();
    return allDatabaseCategories.filter(cat => 
      cat.name.toLowerCase().includes(term) || 
      cat.id.toLowerCase().includes(term)
    );
  }, [allDatabaseCategories, categorySearchTerm]);

  const filterEmojiBySearch = (search: string) => {
    const s = search.trim().toLowerCase();
    if (!s) return emojiPalette;
    return emojiPalette.filter(e => {
      if (e.includes(s)) return true; // direct match if user pasted emoji
      const keys = emojiKeywords[e] || [];
      return keys.some(k => k.includes(s));
    });
  };

  // Load menu configuration and drink database on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getMenuConfiguration();
        const db = await getDrinkDatabase();
        setDrinkDatabase(db);
        
        // If menu is empty, initialize with default items
        if (!config.items || Object.keys(config.items).length === 0) {
          await initializeMenuWithDefaults(menuItems);
          const newConfig = await getMenuConfiguration();
          setMenuConfig(newConfig);
        } else {
          setMenuConfig(config);
        }
      } catch (error) {
        console.error('Failed to load menu configuration:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadConfig();
  }, []);

  // Load categories from database
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const db = await getCategoryDatabase();
        if (db.categories) {
          const allCats = Object.entries(db.categories).map(([id, cat]: [string, any]) => ({
            id,
            name: cat.name,
            emoji: cat.emoji,
            isActive: cat.isActive !== false // Default to true if not set
          }));
          
          // For active display, only show active categories
          const activeCats = allCats.filter(cat => cat.isActive);
          setExtraCategories(activeCats);
          
          // For "Bestehende wählen", show ALL categories (including deleted ones)
          setAllDatabaseCategories(allCats);
        }
        if (db.order && Array.isArray(db.order)) {
          setCategoryOrder(db.order);
        }
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    };
    loadCategories();
  }, []);

  // Apply configuration to menu items
  const configuredItems = useMemo(() => {
    if (!menuConfig || !menuConfig.items) return [];
    
    // Get all items from menu configuration (active items)
    const activeItemIds = new Set(Object.keys(menuConfig.items));
    
    // Helper to apply config to a base item (menuItems or drinkDatabase)
    const applyConfig = (base: any, itemConfig: any) => {
      return {
        ...base,
        isPopular: itemConfig?.isPopular ?? base.isPopular ?? false,
        isSoldOut: itemConfig?.isSoldOut ?? base.isSoldOut ?? false,
        name: itemConfig?.name ?? base.name,
        emoji: itemConfig?.emoji ?? base.emoji ?? '🍺',
        price: itemConfig?.price ?? base.price,
        description: (itemConfig && "description" in itemConfig)
          ? (itemConfig.description ?? '')
          : (base.description ?? ''),
        size: (itemConfig && "size" in itemConfig)
          ? itemConfig.size
          : base.size,
        category: itemConfig?.category ?? base.category,
        askForGlasses: itemConfig?.askForGlasses ?? base.askForGlasses ?? false,
        glassType: itemConfig?.glassType ?? base.glassType,
        tableSection: itemConfig?.tableSection ?? base.tableSection ?? null
      };
    };

    // Standard-Menu-Items mit Konfiguration
    const activeMenuItems = menuItems
      .filter(item => activeItemIds.has(item.id))
      .map(item => {
        const itemConfig = menuConfig.items[item.id];
        return applyConfig(item, itemConfig);
      });
    
    // Benutzerdefinierte Getränke aus der Datenbank, die im Menü aktiv sind
    const customItems: any[] = [];
    if (drinkDatabase) {
      for (const [id, itemConfig] of Object.entries(menuConfig.items)) {
        if (menuItems.find(mi => mi.id === id)) continue; // schon als Standard-Item abgedeckt
        const drink = drinkDatabase.drinks[id];
        if (drink && drink.isCustom) {
          const base = {
            id,
            name: drink.name,
            emoji: drink.emoji,
            price: drink.price,
            size: drink.size,
            category: drink.category,
            description: drink.description,
            isPremium: false,
            isPopular: false
          };
          customItems.push(applyConfig(base, itemConfig));
        }
      }
    }
    
    return [...activeMenuItems, ...customItems];
  }, [menuConfig, menuItems, drinkDatabase]);

  // Merge default categories with extra categories from database (DB overrides default by id)
  const mergedCategories = useMemo(() => {
    // Start with defaults
    const defaultMap: Record<string, { id: string; name: string; emoji: string }> = {};
    categories.forEach(c => { defaultMap[c.id] = { ...c }; });
    // Overlay DB entries (override emoji/name if same id)
    extraCategories.forEach(ec => { defaultMap[ec.id] = { ...defaultMap[ec.id], ...ec }; });
    // Build list preserving default order, then append DB-only categories
    const defaultsWithOverrides = categories.map(c => defaultMap[c.id]);
    const dbOnly = extraCategories.filter(ec => !categories.find(c => c.id === ec.id));
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
  }, [extraCategories, categoryOrder]);

  // Get all unique categories
  const allCategories = ['all', ...mergedCategories.map(cat => cat.id)];

  // Filter items based on search, category, and price range
  const filteredItems = useMemo(() => {
    return configuredItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesPrice = item.price >= priceRange.min && item.price <= priceRange.max;
      const matchesSoldOut = !showSoldOutOnly || item.isSoldOut;
      const matchesTableOnly = !showTableOnly || !!item.tableSection;
      
      return matchesSearch && matchesCategory && matchesPrice && matchesSoldOut && matchesTableOnly;
    });
  }, [configuredItems, searchTerm, selectedCategory, priceRange, showSoldOutOnly, showTableOnly]);

  // Determine if any filter is active (beyond the default view)
  const isFilterActive = useMemo(() => {
    const defaultMin = 0;
    const defaultMax = 100;
    return (
      searchTerm.trim() !== '' ||
      selectedCategory !== 'all' ||
      showSoldOutOnly ||
      showTableOnly ||
      priceRange.min !== defaultMin ||
      priceRange.max !== defaultMax
    );
  }, [searchTerm, selectedCategory, showSoldOutOnly, showTableOnly, priceRange]);

  // Filter sold out items for statistics
  const availableItems = useMemo(() => {
    return filteredItems.filter(item => !item.isSoldOut);
  }, [filteredItems]);

  // Group filtered items by category and sort by price within each category
  const categorizedItems = useMemo(() => {
    const visibleCategories = selectedCategory === 'all'
      ? mergedCategories
      : mergedCategories.filter(c => c.id === selectedCategory);
    const result = visibleCategories.map(category => ({
      ...category,
      items: configuredItems
        .filter(item => item.category === category.id)
        .filter(item => filteredItems.includes(item))
        .sort((a, b) => a.price - b.price)
    }));
    // When filters are active, only show categories that actually have matching items
    return isFilterActive ? result.filter(c => c.items.length > 0) : result;
  }, [configuredItems, filteredItems, mergedCategories, selectedCategory, isFilterActive]);

  // Calculate statistics for filtered items
  const totalItems = filteredItems.length;
  const availableCount = availableItems.length;
  const soldOutCount = totalItems - availableCount;
  const averagePrice = totalItems > 0 ? filteredItems.reduce((sum, item) => sum + item.price, 0) / totalItems : 0;
  const actualPriceRange = totalItems > 0 ? {
    min: Math.min(...filteredItems.map(item => item.price)),
    max: Math.max(...filteredItems.map(item => item.price))
  } : { min: 0, max: 0 };

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setPriceRange({ min: 0, max: 100 });
    setShowTableOnly(false);
    setShowSoldOutOnly(false);
  };

  // Premium-Funktion entfernt

  // Toggle sold out status
  const handleToggleSoldOut = async (itemId: string, currentStatus: boolean) => {
    setIsUpdating(itemId);
    try {
      console.log('Toggling sold out status for', itemId, 'from', currentStatus, 'to', !currentStatus);
      // Pass the actual current status to toggle
      await toggleSoldOutStatus(itemId, currentStatus);
      console.log('Toggle completed, reloading config...');
      const config = await getMenuConfiguration();
      console.log('Config loaded:', config.items[itemId]);
      setMenuConfig(config);
      console.log('Menu config updated');
    } catch (error) {
      console.error('Failed to toggle sold out status:', error);
      alert('Fehler beim Aktualisieren des Ausverkauft-Status');
    } finally {
      setIsUpdating(null);
    }
  };

  // Toggle glass prompt for product
  const handleToggleGlassPrompt = async (itemId: string, currentStatus: boolean) => {
    setIsUpdating(itemId);
    try {
      const newStatus = !currentStatus;
      await updateItemConfiguration(itemId, { 
        askForGlasses: newStatus,
        glassType: newStatus ? 'beer' : undefined // Default to beer glass
      });
      const config = await getMenuConfiguration();
      setMenuConfig(config);
    } catch (error) {
      console.error('Failed to toggle glass prompt:', error);
      alert('Fehler beim Aktualisieren der Gläser-Einstellung');
    } finally {
      setIsUpdating(null);
    }
  };

  // Reset to defaults
  const handleResetToDefaults = async () => {
    if (!confirm('Möchtest du wirklich alle Produkte auf den Standardzustand zurücksetzen? Dies stellt alle ursprünglichen Produkte wieder her und entfernt alle hinzugefügten Produkte von der Produktseite.')) {
      return;
    }
    
    setIsLoading(true);
    try {
      // Clear the entire menu configuration first
      await clearMenuConfiguration();
      
      // Re-initialize with default items only
      await initializeMenuWithDefaults(menuItems);
      
      const config = await getMenuConfiguration();
      setMenuConfig(config);
      alert('✅ Alle Produkte auf Standardzustand zurückgesetzt!');
    } catch (error) {
      console.error('Failed to reset menu configuration:', error);
      alert('Fehler beim Zurücksetzen der Konfiguration');
    } finally {
      setIsLoading(false);
    }
  };

  // Start editing an item
  const handleStartEdit = (item: MenuItem) => {
    // Get glass settings from config or item defaults
    const configGlassType = menuConfig?.items?.[item.id]?.glassType;
    const configAskForGlasses = menuConfig?.items?.[item.id]?.askForGlasses;
    
    // Determine actual askForGlasses value (config takes precedence)
    const actualAskForGlasses = configAskForGlasses ?? item.askForGlasses ?? false;
    
    // Normalize glass type (handle legacy 'normal' -> 'beer')
    let normalizedGlassType: 'beer' | 'wine' | 'sekt' | undefined = configGlassType || item.glassType;
    if (normalizedGlassType === 'normal' as any) {
      normalizedGlassType = 'beer';
    }
    
    // If askForGlasses is false, set glassType to undefined to show "keine"
    if (!actualAskForGlasses) {
      normalizedGlassType = undefined;
    }
    
    setEditingItem(item.id);
    setEditForm({
      name: item.name,
      emoji: menuConfig?.items?.[item.id]?.emoji ?? item.emoji,
      price: item.price.toString(),
      description: item.description || '',
      size: item.size || '',
      glassType: normalizedGlassType,
      askForGlasses: actualAskForGlasses,
      tableSection: menuConfig?.items?.[item.id]?.tableSection ?? item.tableSection ?? null
    });
  };

  // Save item changes
  const handleSaveEdit = async (itemId: string) => {
    setIsUpdating(itemId);
    try {
      const updates: any = {};
      
      // Get the current configured item (might be from menuItems or drinkDatabase)
      const currentItem = configuredItems.find(ci => ci.id === itemId);
      if (!currentItem) {
        alert('❌ Produkt nicht gefunden');
        return;
      }
      
      // Check each field for changes
      if (editForm.name !== currentItem.name) {
        updates.name = editForm.name;
      }
      // Emoji update - always save if different
      const currentEmoji = menuConfig?.items?.[itemId]?.emoji ?? currentItem.emoji;
      if (editForm.emoji !== currentEmoji) {
        updates.emoji = editForm.emoji;
      }
      if (parseFloat(editForm.price) !== currentItem.price) {
        updates.price = parseFloat(editForm.price);
      }
      
      // Handle size - compare with current value
      const currentSize = currentItem.size || '';
      const newSize = editForm.size.trim();
      if (newSize !== currentSize) {
        updates.size = newSize === '' ? undefined : newSize;
      }
      
      // Handle description - compare with current value.
      // Wichtig: Wenn der Nutzer die Beschreibung leert, speichern wir explizit
      // einen leeren String ('') in der Konfiguration, damit keine
      // ursprüngliche Beschreibung mehr angezeigt wird.
      const currentDesc = currentItem.description || '';
      const newDesc = editForm.description.trim();
      if (newDesc !== currentDesc) {
        updates.description = newDesc; // kann auch '' sein
      }
      
      // Handle glass type settings
      const currentGlassType = menuConfig?.items?.[itemId]?.glassType || currentItem.glassType;
      const currentAskForGlasses = menuConfig?.items?.[itemId]?.askForGlasses ?? currentItem.askForGlasses;
      
      if (editForm.glassType !== currentGlassType) {
        updates.glassType = editForm.glassType;
      }
      if (editForm.askForGlasses !== currentAskForGlasses) {
        updates.askForGlasses = editForm.askForGlasses;
      }
      
      // Handle table section settings
      const currentTableSection = menuConfig?.items?.[itemId]?.tableSection ?? currentItem.tableSection ?? null;
      if (editForm.tableSection !== currentTableSection) {
        updates.tableSection = editForm.tableSection;
      }
      
      console.log('Saving updates for item', itemId, updates);
      
      if (Object.keys(updates).length > 0) {
        await updateItemConfiguration(itemId, updates);
        console.log('Updates saved successfully');
        // Reload configuration
        const config = await getMenuConfiguration();
        console.log('Reloaded config after save:', config);
        setMenuConfig(config);
        console.log('setMenuConfig called with new config');
        alert('✅ Änderungen gespeichert!');
      } else {
        console.log('No changes to save');
        alert('ℹ️ Keine Änderungen zum Speichern');
      }
    } catch (error) {
      console.error('Failed to update item:', error);
      alert('❌ Fehler beim Speichern der Änderungen: ' + error);
    } finally {
      setIsUpdating(null);
      setEditingItem(null);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditForm({
      name: '',
      emoji: undefined,
      price: '',
      description: '',
      size: '',
      glassType: undefined,
      askForGlasses: false,
      tableSection: null
    });
    setProductEmojiSearch('');
  };

  // Menu refresh - trigger refresh for all client devices
  const handleMenuRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Update a timestamp in Firebase to trigger refresh on all devices
      await set(ref(database, 'system/menuRefresh'), Date.now());
      
      // Show success feedback
      alert('✅ Menü-Refresh ausgelöst! Alle Kunden-Geräte werden aktualisiert.');
    } catch (error) {
      console.error('Failed to trigger menu refresh:', error);
      alert('❌ Fehler beim Menü-Refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Reset single item to defaults
  const handleResetItem = async (itemId: string) => {
    if (!confirm('Möchtest du dieses Produkt auf den Standardzustand zurücksetzen?')) {
      return;
    }
    
    setIsUpdating(itemId);
    try {
      const originalItem = menuItems.find(mi => mi.id === itemId);
      if (originalItem) {
        const resetData: any = {
          name: originalItem.name,
          price: originalItem.price,
          isPopular: originalItem.isPopular
        };
        
        // Only include optional fields if they exist in original
        if (originalItem.description) {
          resetData.description = originalItem.description;
        }
        if (originalItem.size) {
          resetData.size = originalItem.size;
        }
        
        await updateItemConfiguration(itemId, resetData);
        
        // Reload configuration
        const config = await getMenuConfiguration();
        setMenuConfig(config);
        alert('✅ Produkt auf Standard zurückgesetzt!');
        
        // Exit edit mode after successful reset
        setEditingItem(null);
        setEditForm({
          name: '',
          price: '',
          description: '',
          size: ''
        });
      }
    } catch (error) {
      console.error('Failed to reset item:', error);
      alert('Fehler beim Zurücksetzen des Produkts');
    } finally {
      setIsUpdating(null);
    }
  };

  // Initialize drink database with all menu items
  const initializeDrinkDatabase = async () => {
    try {
      const db = await getDrinkDatabase();
      
      // Only add menu items that are NOT already in the database
      for (const item of menuItems) {
        await addDrinkToDatabase({
          id: item.id,
          name: item.name,
          emoji: item.emoji,
          price: item.price,
          size: item.size,
          category: item.category,
          description: item.description,
          isCustom: false
        });
      }
    } catch (error) {
      console.error('Failed to initialize drink database:', error);
    }
  };

  // Load drink database
  const loadDrinkDatabase = async () => {
    try {
      await initializeDrinkDatabase(); // Ensure all drinks are in database
      const db = await getDrinkDatabase();
      setDrinkDatabase(db);
    } catch (error) {
      console.error('Failed to load drink database:', error);
    }
  };

  // Open drink selection modal for category
  const handleOpenDrinkModal = (categoryId: string) => {
    setTargetCategoryForDrinks(categoryId); // This is where drinks will be added
    setSelectedCategoryForDrinks('all'); // Start with 'all' filter
    setShowDrinkModal(true);
    setDrinkSearchTerm('');
    setShowAddDrinkForm(false);
    loadDrinkDatabase();
  };

  // Add drink from database to menu
  const handleAddDrinkToMenu = async (drinkId: string) => {
    setIsUpdating(drinkId);
    try {
      // Get the drink from database
      const drink = drinkDatabase?.drinks?.[drinkId];
      if (!drink) {
        alert('❌ Getränk nicht gefunden');
        return;
      }
      
      // Use the TARGET category (where the modal was opened from), not the filter
      const targetCategory = targetCategoryForDrinks;
      
      await updateItemConfiguration(drinkId, {
        isPremium: false,
        isPopular: false,
        category: targetCategory
      });
      
      // Reload configuration
      const config = await getMenuConfiguration();
      setMenuConfig(config);
      
      alert('✅ Getränk zum Menü hinzugefügt!');
    } catch (error) {
      console.error('Failed to add drink to menu:', error);
      alert('❌ Fehler beim Hinzufügen des Getränks');
    } finally {
      setIsUpdating(null);
    }
  };

  // Remove product from menu
  const handleRemoveProduct = async (productId: string) => {
    if (!confirm('Möchtest du dieses Produkt von der Produktseite entfernen? Es bleibt in der Getränke-Datenbank erhalten.')) {
      return;
    }
    
    try {
      setIsUpdating(productId);
      
      // Remove it from the active menu
      await removeProductFromMenu(productId);
      
      // Reload configuration
      const config = await getMenuConfiguration();
      setMenuConfig(config);
      
      alert('✅ Produkt entfernt!');
    } catch (error) {
      console.error('Failed to remove product:', error);
      alert('❌ Fehler beim Entfernen des Produkts');
    } finally {
      setIsUpdating(null);
    }
  };

  // Add new drink to database
  const handleAddNewDrink = async () => {
    if (!newDrinkForm.name || !newDrinkForm.price || !newDrinkForm.category) {
      alert('❌ Bitte fülle alle Pflichtfelder aus (Name, Preis, Kategorie)');
      return;
    }
    
    try {
      const drinkId = await addDrinkToDatabase({
        name: newDrinkForm.name,
        emoji: newDrinkForm.emoji,
        price: parseFloat(newDrinkForm.price),
        size: newDrinkForm.size || undefined,
        category: newDrinkForm.category,
        description: newDrinkForm.description || undefined,
        isCustom: true
      });
      
      // Reload drink database
      await loadDrinkDatabase();
      
      // Reset form
      setNewDrinkForm({
        name: '',
        emoji: '🍺',
        price: '',
        size: '',
        category: '',
        description: ''
      });
      setShowAddDrinkForm(false);
      
      alert('✅ Neues Getränk zur Datenbank hinzugefügt!');
    } catch (error) {
      console.error('Failed to add new drink:', error);
      alert('❌ Fehler beim Hinzufügen des neuen Getränks');
    }
  };

  // Filter drinks for modal
  const filteredDrinks = useMemo(() => {
    if (!drinkDatabase || !drinkDatabase.drinks) return [];
    
    return Object.entries(drinkDatabase.drinks)
      .filter(([id, drink]) => {
        const matchesSearch = drink.name.toLowerCase().includes(drinkSearchTerm.toLowerCase());
        const matchesCategory = selectedCategoryForDrinks === 'all' || drink.category === selectedCategoryForDrinks;
        const notInMenu = !menuConfig?.items[id];
        
        // Show all products if showAllProducts is true, otherwise only show products not in menu
        const shouldShow = showAllProducts || notInMenu;
        
        return matchesSearch && matchesCategory && shouldShow;
      })
      .map(([id, drink]) => ({ id, ...drink }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [drinkDatabase, drinkSearchTerm, selectedCategoryForDrinks, menuConfig, showAllProducts]);

  // Handle moving item to category
  const handleMoveItemToCategory = async (itemId: string, targetCategoryId: string) => {
    setIsUpdating(itemId);
    try {
      await updateItemConfiguration(itemId, { category: targetCategoryId });
      const config = await getMenuConfiguration();
      setMenuConfig(config);
    } catch (error) {
      console.error('Failed to move item to category:', error);
      alert('❌ Fehler beim Verschieben des Produkts');
    } finally {
      setIsUpdating(null);
      setDraggingItemId(null);
    }
  };

  // Handle updating category emoji
  const handleUpdateCategoryEmoji = async (categoryId: string, newEmoji: string) => {
    try {
      const db = await getCategoryDatabase();
      const existing = db.categories?.[categoryId];
      const baseName = mergedCategories.find(c => c.id === categoryId)?.name || existing?.name || 'Kategorie';
      const updatedCategories = {
        ...(db.categories || {}),
        [categoryId]: {
          ...(existing || {}),
          name: baseName,
          emoji: newEmoji,
          // mark as not custom if it came from defaults, but we still persist override
          isCustom: existing?.isCustom ?? false
        }
      } as any;

      await updateCategoryDatabase({
        categories: updatedCategories
      });

      // Reload categories
      const updatedDb = await getCategoryDatabase();
      if (updatedDb.categories) {
        const cats = Object.entries(updatedDb.categories).map(([id, cat]: [string, any]) => ({
          id,
          name: cat.name,
          emoji: cat.emoji
        }));
        setExtraCategories(cats);
      }
      setEditingCategoryId(null);
      setEditingCategoryEmoji('');
      setCategoryEmojiSearch('');
      alert('✅ Emoji aktualisiert!');
    } catch (error) {
      console.error('Failed to update category emoji:', error);
      alert('❌ Fehler beim Aktualisieren des Emojis');
    }
  };

  // Handle adding new category
  const handleAddNewCategory = async () => {
    if (!newCategoryName.trim()) {
      alert('❌ Bitte gib einen Kategorienamen ein');
      return;
    }
    
    try {
      const categoryId = await addCategoryToDatabase({
        name: newCategoryName,
        emoji: newCategoryEmoji,
        isCustom: true
      });
      
      // Reload categories
      const db = await getCategoryDatabase();
      if (db.categories) {
        const allCats = Object.entries(db.categories).map(([id, cat]: [string, any]) => ({
          id,
          name: cat.name,
          emoji: cat.emoji,
          isActive: cat.isActive !== false
        }));
        const activeCats = allCats.filter(cat => cat.isActive);
        setExtraCategories(activeCats);
        setAllDatabaseCategories(allCats); // Update all database categories
      }
      
      // Reset form and close modal
      setNewCategoryName('');
      setNewCategoryEmoji('📂');
      setShowCategoryModal(false);
      
      alert('✅ Kategorie erfolgreich hinzugefügt!');
    } catch (error) {
      console.error('Failed to add category:', error);
      alert('❌ Fehler beim Hinzufügen der Kategorie');
    }
  };

  // Handle deleting a category
  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (!confirm(`Möchtest du die Kategorie "${categoryName}" wirklich löschen? Produkte in dieser Kategorie werden nicht gelöscht.`)) {
      return;
    }
    
    try {
      await deleteCategoryFromDatabase(categoryId);
      
      // Reload categories
      const db = await getCategoryDatabase();
      if (db.categories) {
        const allCats = Object.entries(db.categories).map(([id, cat]: [string, any]) => ({
          id,
          name: cat.name,
          emoji: cat.emoji,
          isActive: cat.isActive !== false
        }));
        const activeCats = allCats.filter(cat => cat.isActive);
        setExtraCategories(activeCats);
        setAllDatabaseCategories(allCats); // Update all database categories
      } else {
        setExtraCategories([]);
        setAllDatabaseCategories([]);
      }
      
      alert('✅ Kategorie erfolgreich gelöscht!');
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert('❌ Fehler beim Löschen der Kategorie');
    }
  };

  return (
    <>
      <Head>
        <title>Produkte & Preise - Karneval Bestellsystem</title>
        <meta name="description" content="Alle Produkte und Preise des Karneval Bestellsystems" />
      </Head>
      
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
                            <h1 className="text-4xl font-bold text-gray-900 mb-2">🍺 Produkte & Preise</h1>
              <p className="text-gray-600">Übersicht aller verfügbaren Produkte und Preise</p>
            </div>
            <div className="text-right">
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="text-sm text-gray-500">Gefilterte Produkte</div>
                <div className="text-2xl font-bold text-blue-600">{totalItems}</div>
                <div className="text-sm text-gray-500">
                  <span className="text-green-600">{availableCount} verfügbar</span>
                  {soldOutCount > 0 && <span className="text-red-600 ml-2">🚫 {soldOutCount} ausverkauft</span>}
                </div>
                <div className="text-sm text-gray-500">Ø Preis: {formatPrice(averagePrice)}</div>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleMenuRefresh}
                  disabled={isRefreshing || isLoading || isUpdating !== null}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                  title="Aktualisiert alle Kunden-Geräte mit der aktuellen Produktliste"
                >
                  {isRefreshing ? '🔄...' : '🔄 Geräte aktualisieren'}
                </button>
                <button
                  onClick={handleResetToDefaults}
                  disabled={isLoading || isUpdating !== null}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                  title="Setzt alle Produkte auf die ursprünglichen Standardwerte zurück"
                >
                  🔄 Zurücksetzen
                </button>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <div className="text-4xl mb-4">⏳</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Lade Konfiguration...</h3>
              <p className="text-gray-600">Produkt-Konfiguration wird geladen</p>
            </div>
          )}

          {/* Filters Section */}
          {!isLoading && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">🔍 Filter & Suche</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Suche</label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Produktname..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kategorie</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {allCategories.map(catId => {
                      const cat = mergedCategories.find(c => c.id === catId);
                      return (
                        <option key={catId} value={catId}>
                          {catId === 'all' ? 'Alle Kategorien' : `${cat?.emoji} ${cat?.name}`}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preis: {formatPrice(priceRange.min)} - {formatPrice(priceRange.max)}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={priceRange.min}
                      onChange={(e) => setPriceRange(prev => ({ ...prev, min: Number(e.target.value) }))}
                      placeholder="Min"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="number"
                      value={priceRange.max}
                      onChange={(e) => setPriceRange(prev => ({ ...prev, max: Number(e.target.value) }))}
                      placeholder="Max"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Reset Button */}
                <div className="flex items-end">
                  <button
                    onClick={resetFilters}
                    className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    🔄 Zurücksetzen
                  </button>
                </div>

                {/* Für den Tisch Filter */}
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showTableOnly}
                      onChange={(e) => setShowTableOnly(e.target.checked)}
                      className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      ✨ Nur Für den Tisch
                    </span>
                  </label>
                </div>

                {/* Sold Out Filter */}
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSoldOutOnly}
                      onChange={(e) => setShowSoldOutOnly(e.target.checked)}
                      className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      🚫 Nur Ausverkaufte
                    </span>
                  </label>
                </div>
              </div>

              {/* Active Filters Display */}
              {(searchTerm || selectedCategory !== 'all' || priceRange.min > 0 || priceRange.max < 100 || showTableOnly || showSoldOutOnly) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex flex-wrap gap-2">
                    {searchTerm && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        Suche: "{searchTerm}"
                      </span>
                    )}
                    {selectedCategory !== 'all' && (
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                        Kategorie: {mergedCategories.find((c) => c.id === selectedCategory)?.name}
                      </span>
                    )}
                    {(priceRange.min > 0 || priceRange.max < 100) && (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                        Preis: {formatPrice(priceRange.min)} - {formatPrice(priceRange.max)}
                      </span>
                    )}
                    {showTableOnly && (
                      <span className="px-3 py-1 bg-yellow-200 text-yellow-900 rounded-full text-sm">
                        ✨ Nur Für den Tisch
                      </span>
                    )}
                    {showSoldOutOnly && (
                      <span className="px-3 py-1 bg-red-200 text-red-900 rounded-full text-sm">
                        🚫 Nur Ausverkaufte
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Statistics Cards */}
          {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500">Günstigstes Produkt</div>
                    <div className="text-xl font-bold text-green-600">
                      {totalItems > 0 ? formatPrice(actualPriceRange.min) : '-'}
                    </div>
                  </div>
                  <span className="text-3xl">💰</span>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500">Teuerstes Produkt</div>
                    <div className="text-xl font-bold text-red-600">
                      {totalItems > 0 ? formatPrice(actualPriceRange.max) : '-'}
                    </div>
                  </div>
                  <span className="text-3xl">👑</span>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500">Kategorien</div>
                    <div className="text-xl font-bold text-purple-600">{categorizedItems.length}</div>
                  </div>
                  <span className="text-3xl">📂</span>
                </div>
              </div>
            </div>
          )}

          {/* No Results Message */}
          {!isLoading && totalItems === 0 && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Keine Produkte gefunden</h3>
              <p className="text-gray-600 mb-4">Versuche es mit anderen Filterkriterien</p>
              <button
                onClick={resetFilters}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Filter zurücksetzen
              </button>
            </div>
          )}

          {/* Products by Category */}
          {!isLoading && categorizedItems.length > 0 && (
            <div className="space-y-8">
              {/* Category header with add-category button */}
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">📂</span>
                  Kategorien & Produkte
                </h2>
                <button
                  onClick={() => setShowCategoryModal(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                >
                  ➕ Kategorie hinzufügen
                </button>
              </div>

              {/* Category reorder controls */}
              <div className="bg-white rounded-xl shadow-md p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">📋 Kategorie-Reihenfolge</h3>
                  <button
                    onClick={async () => {
                      try {
                        await updateCategoryDatabase({ order: categoryOrder });
                        alert('✅ Reihenfolge gespeichert');
                      } catch (error) {
                        console.error('Failed to save category order:', error);
                        alert('❌ Fehler beim Speichern');
                      }
                    }}
                    className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                  >
                    💾 Speichern
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {mergedCategories.map((cat, index) => (
                    <div key={cat.id} className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg border border-gray-200">
                      <span className="text-xl">{cat.emoji}</span>
                      <span className="text-sm font-medium">{cat.name}</span>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => {
                            if (index > 0) {
                              const newOrder = [...mergedCategories.map(c => c.id)];
                              [newOrder[index-1], newOrder[index]] = [newOrder[index], newOrder[index-1]];
                              setCategoryOrder(newOrder);
                            }
                          }}
                          disabled={index === 0}
                          className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Nach oben"
                        >↑</button>
                        <button
                          onClick={() => {
                            if (index < mergedCategories.length - 1) {
                              const newOrder = [...mergedCategories.map(c => c.id)];
                              [newOrder[index+1], newOrder[index]] = [newOrder[index], newOrder[index+1]];
                              setCategoryOrder(newOrder);
                            }
                          }}
                          disabled={index === mergedCategories.length - 1}
                          className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Nach unten"
                        >↓</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {categorizedItems.map((category) => (
                <div
                  key={category.id}
                  className="bg-white rounded-xl shadow-lg overflow-hidden"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => draggingItemId && handleMoveItemToCategory(draggingItemId, category.id)}
                >
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                    <div className="flex justify-between items-center">
                      <h2 className="text-2xl font-bold flex items-center gap-3">
                        <button
                          onClick={() => {
                            setEditingCategoryId(category.id);
                            setEditingCategoryEmoji(category.emoji);
                          }}
                          className="text-3xl hover:scale-110 transition-transform cursor-pointer"
                          title="Emoji ändern"
                        >{category.emoji}</button>
                        {category.name}
                      </h2>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenDrinkModal(category.id)}
                          className="px-3 py-1 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2"
                        >
                          <span className="text-xl">➕</span>
                          <span className="text-sm font-medium">Getränk hinzufügen</span>
                        </button>
                        {/* Delete button only for custom categories */}
                        {extraCategories.some(ec => ec.id === category.id) && (
                          <button
                            onClick={() => handleDeleteCategory(category.id, category.name)}
                            className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
                            title="Kategorie löschen"
                          >
                            <span className="text-xl">🗑️</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-blue-100 mt-1">{category.items.length} Produkte</p>
                  </div>
                  
                  <div className="p-6">
                    {category.items.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4">🍺</div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Keine Produkte in dieser Kategorie</h3>
                        <p className="text-gray-600 mb-4">Füge Getränke hinzu, um diese Kategorie zu füllen</p>
                        <button
                          onClick={() => handleOpenDrinkModal(category.id)}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                        >
                          <span className="text-xl">➕</span>
                          <span>Erstes Getränk hinzufügen</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {category.items.map((item) => (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={() => setDraggingItemId(item.id)}
                          onDragEnd={() => setDraggingItemId(null)}
                          className={`border rounded-lg p-4 hover:shadow-md transition-shadow relative ${
                            item.isSoldOut 
                              ? 'border-red-300 bg-red-50 opacity-75' 
                              : item.isPremium 
                                ? 'border-yellow-400 bg-yellow-50' 
                                : 'border-gray-200'
                          }`}
                        >
                          {item.isSoldOut && (
                            <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-md z-10">
                              🚫 AUSVERKAUFT
                            </div>
                          )}
                          {editingItem === item.id ? (
                            // Edit Mode
                            <div className="space-y-3">
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl cursor-pointer" title="Emoji ändern">{editForm.emoji || item.emoji}</span>
                                  <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="font-semibold text-gray-900 bg-white border border-gray-300 rounded px-2 py-1"
                                    placeholder="Produktname"
                                  />
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-500">€</span>
                                    <input
                                      type="number"
                                      value={editForm.price}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                                      className="text-lg font-bold text-blue-600 bg-white border border-gray-300 rounded px-2 py-1 w-20"
                                      placeholder="Preis"
                                      step="0.10"
                                      min="0"
                                    />
                                  </div>
                                </div>
                              </div>
                              
                              {/* Emoji palette for product */}
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-sm font-medium text-blue-800">🎨 Emoji wählen:</p>
                                  <input
                                    type="text"
                                    value={productEmojiSearch}
                                    onChange={(e) => setProductEmojiSearch(e.target.value)}
                                    placeholder="Suchen..."
                                    className="px-2 py-1 text-xs border border-blue-300 rounded w-24"
                                  />
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {filterEmojiBySearch(productEmojiSearch)
                                    .map(e => (
                                      <button
                                        key={e}
                                        type="button"
                                        onClick={() => setEditForm(prev => ({ ...prev, emoji: e }))}
                                        className={`px-2 py-1 rounded border text-lg hover:bg-blue-100 ${
                                          editForm.emoji === e ? 'border-blue-500 bg-blue-100' : 'border-gray-300'
                                        }`}
                                      >
                                        {e}
                                      </button>
                                    ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-2">
                                <input
                                  type="text"
                                  value={editForm.size}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, size: e.target.value }))}
                                  className="text-sm bg-white border border-gray-300 rounded px-2 py-1"
                                  placeholder="Größe (z.B. 0,2l)"
                                />
                              </div>
                              
                              <textarea
                                value={editForm.description}
                                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                className="w-full text-sm bg-white border border-gray-300 rounded px-2 py-1"
                                placeholder="Beschreibung (optional)"
                                rows={2}
                              />
                              
                              {/* Glass Type Selection */}
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-sm font-medium text-blue-800 mb-2">🥃 Gläser fragen:</p>
                                <div className="flex flex-wrap gap-2">
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`glassType-${item.id}`}
                                      checked={!editForm.askForGlasses && !editForm.glassType}
                                      onChange={() => setEditForm(prev => ({ ...prev, glassType: undefined, askForGlasses: false }))}
                                      className="w-4 h-4"
                                    />
                                    <span className="text-sm">Keine</span>
                                  </label>
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`glassType-${item.id}`}
                                      checked={editForm.glassType === 'beer'}
                                      onChange={() => setEditForm(prev => ({ ...prev, glassType: 'beer', askForGlasses: true }))}
                                      className="w-4 h-4"
                                    />
                                    <span className="text-sm">🍺 Bierglas</span>
                                  </label>
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`glassType-${item.id}`}
                                      checked={editForm.glassType === 'wine'}
                                      onChange={() => setEditForm(prev => ({ ...prev, glassType: 'wine', askForGlasses: true }))}
                                      className="w-4 h-4"
                                    />
                                    <span className="text-sm">🍷 Weinglas</span>
                                  </label>
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`glassType-${item.id}`}
                                      checked={editForm.glassType === 'sekt'}
                                      onChange={() => setEditForm(prev => ({ ...prev, glassType: 'sekt', askForGlasses: true }))}
                                      className="w-4 h-4"
                                    />
                                    <span className="text-sm">🥂 Sektglas</span>
                                  </label>
                                </div>
                              </div>
                              
                              {/* Table Section Selection */}
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <p className="text-sm font-medium text-amber-800 mb-2">✨ "Für den ganzen Tisch" Sektion:</p>
                                <div className="flex flex-wrap gap-2">
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`tableSection-${item.id}`}
                                      checked={!editForm.tableSection}
                                      onChange={() => setEditForm(prev => ({ ...prev, tableSection: null }))}
                                      className="w-4 h-4"
                                    />
                                    <span className="text-sm">Keine</span>
                                  </label>
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`tableSection-${item.id}`}
                                      checked={editForm.tableSection === 'bottle-nonalc'}
                                      onChange={() => setEditForm(prev => ({ ...prev, tableSection: 'bottle-nonalc' }))}
                                      className="w-4 h-4"
                                    />
                                    <span className="text-sm">🍾 Unalkoholisch</span>
                                  </label>
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`tableSection-${item.id}`}
                                      checked={editForm.tableSection === 'beer-crate'}
                                      onChange={() => setEditForm(prev => ({ ...prev, tableSection: 'beer-crate' }))}
                                      className="w-4 h-4"
                                    />
                                    <span className="text-sm">📦 Bier</span>
                                  </label>
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`tableSection-${item.id}`}
                                      checked={editForm.tableSection === 'wine-bottle'}
                                      onChange={() => setEditForm(prev => ({ ...prev, tableSection: 'wine-bottle' }))}
                                      className="w-4 h-4"
                                    />
                                    <span className="text-sm">🍾 Wein/Sekt</span>
                                  </label>
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`tableSection-${item.id}`}
                                      checked={editForm.tableSection === 'shots-crate'}
                                      onChange={() => setEditForm(prev => ({ ...prev, tableSection: 'shots-crate' }))}
                                      className="w-4 h-4"
                                    />
                                    <span className="text-sm">🥃 Schnaps</span>
                                  </label>
                                </div>
                              </div>
                              
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveEdit(item.id)}
                                  disabled={isUpdating === item.id}
                                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 text-sm"
                                >
                                  {isUpdating === item.id ? '💾...' : '💾 Speichern'}
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                                >
                                  ❌ Abbrechen
                                </button>
                                <button
                                  onClick={() => handleResetItem(item.id)}
                                  disabled={isUpdating === item.id}
                                  className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-400 text-sm"
                                >
                                  🔄 Standard
                                </button>
                              </div>
                            </div>
                          ) : (
                            // View Mode
                            <>
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl">{item.emoji}</span>
                                  <div>
                                    <h3 className="font-semibold text-gray-900 flex items-center gap-1">
                                    {item.name}
                                    {item.tableSection && (
                                      <span title="Für den Tisch" className="text-yellow-600">⭐</span>
                                    )}
                                  </h3>
                                    {item.size && (
                                      <span className="text-sm text-gray-500">{item.size}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold text-blue-600">
                                    {formatPrice(item.price)}
                                  </div>
                                  <div className="flex flex-col gap-1 mt-2">
                                    <button
                                      onClick={() => handleToggleSoldOut(item.id, item.isSoldOut || false)}
                                      disabled={isUpdating === item.id}
                                      className={`text-xs px-2 py-1 rounded-full transition-colors ${
                                        item.isSoldOut 
                                          ? 'text-red-600 hover:text-red-700' 
                                          : 'text-gray-400 hover:text-red-600'
                                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                                      title={item.isSoldOut ? 'Ausverkauft-Status aufheben' : 'Als ausverkauft markieren'}
                                    >
                                      {isUpdating === item.id ? '...' : (item.isSoldOut ? '🚫' : '🟢')}
                                    </button>
                                    {/* Show glass type indicator */}
                                    {(() => {
                                      const glassType = menuConfig?.items?.[item.id]?.glassType || item.glassType;
                                      const askForGlasses = menuConfig?.items?.[item.id]?.askForGlasses ?? item.askForGlasses;
                                      if (askForGlasses && glassType) {
                                        const glassEmoji = glassType === 'beer' ? '🍺' : glassType === 'wine' ? '🍷' : '🥂';
                                        return (
                                          <span 
                                            className="text-xs px-2 py-1 rounded-full text-blue-600"
                                            title={`Fragt nach: ${glassType === 'beer' ? 'Bierglas' : glassType === 'wine' ? 'Weinglas' : 'Sektglas'}`}
                                          >
                                            {glassEmoji}
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                </div>
                              </div>
                              {item.description && (
                                <p className="text-sm text-gray-600 mt-2">{item.description}</p>
                              )}
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleStartEdit(item)}
                                    disabled={isUpdating === item.id}
                                    className="px-3 py-1 text-gray-600 hover:text-blue-600 disabled:text-gray-400 text-sm"
                                    title="Produkt bearbeiten"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleRemoveProduct(item.id)}
                                    disabled={isUpdating === item.id}
                                    className="px-3 py-1 text-gray-600 hover:text-red-600 disabled:text-gray-400 text-sm"
                                    title="Produkt von der Produktseite entfernen"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary Table (only show if not too many results) */}
          {!isLoading && totalItems > 0 && totalItems <= 20 && (
            <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">📋 Preisübersicht</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-2">Produkt</th>
                      <th className="text-left py-2">Kategorie</th>
                      <th className="text-left py-2">Größe</th>
                      <th className="text-right py-2">Preis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems
                      .sort((a, b) => a.price - b.price)
                      .map((item) => (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2">
                            <span className="mr-2">{item.emoji}</span>
                            {item.name}
                            {item.tableSection && (
                              <span className="ml-1 text-yellow-600" title="Für den Tisch">⭐</span>
                            )}
                          </td>
                          <td className="py-2 text-gray-600">{item.category}</td>
                          <td className="py-2 text-gray-600">{item.size || '-'}</td>
                          <td className="py-2 text-right font-semibold">{formatPrice(item.price)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer */}
          {!isLoading && (
            <div className="mt-8 text-center text-gray-500 text-sm">
              <p>Preise verstehen sich inklusive MwSt. Änderungen vorbehalten.</p>
              <p className="mt-2">Stand: {new Date().toLocaleDateString('de-DE')}</p>
            </div>
          )}

          {/* Drink Selection Modal */}
          {showDrinkModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">🍹 Getränke auswählen</h2>
                    <button
                      onClick={() => setShowDrinkModal(false)}
                      className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-blue-100 mt-1">
                    Hinzufügen zu: <strong>{mergedCategories.find(c => c.id === targetCategoryForDrinks)?.name || 'Unbekannt'}</strong>
                  </p>
                  <p className="text-blue-100 text-sm">
                    Filter: {mergedCategories.find(c => c.id === selectedCategoryForDrinks)?.name || 'Alle'}
                  </p>
                </div>

                <div className="p-6">
                  {/* Search Bar and Filter Toggle */}
                  <div className="mb-4 space-y-3">
                    <input
                      type="text"
                      value={drinkSearchTerm}
                      onChange={(e) => setDrinkSearchTerm(e.target.value)}
                      placeholder="Getränke suchen..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showAllProducts}
                          onChange={(e) => setShowAllProducts(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Alle Produkte anzeigen (auch bereits hinzugefügte)
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Add New Drink Button */}
                  <div className="mb-4">
                    <button
                      onClick={() => setShowAddDrinkForm(!showAddDrinkForm)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <span className="text-xl">➕</span>
                      <span>Neues Getränk erstellen</span>
                    </button>
                  </div>

                  {/* Add New Drink Form */}
                  {showAddDrinkForm && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-lg font-semibold mb-3">🆕 Neues Getränk hinzufügen</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={newDrinkForm.name}
                          onChange={(e) => setNewDrinkForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Name*"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div>
                          <input
                            type="text"
                            value={newDrinkForm.emoji}
                            onChange={(e) => setNewDrinkForm(prev => ({ ...prev, emoji: e.target.value }))}
                            placeholder="Emoji 🍺"
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                          />
                        </div>
                        <input
                          type="number"
                          value={newDrinkForm.price}
                          onChange={(e) => setNewDrinkForm(prev => ({ ...prev, price: e.target.value }))}
                          placeholder="Preis*"
                          step="0.10"
                          min="0"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <input
                          type="text"
                          value={newDrinkForm.size}
                          onChange={(e) => setNewDrinkForm(prev => ({ ...prev, size: e.target.value }))}
                          placeholder="Größe (z.B. 0,2l)"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <select
                          value={newDrinkForm.category}
                          onChange={(e) => setNewDrinkForm(prev => ({ ...prev, category: e.target.value }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Kategorie wählen*</option>
                          {mergedCategories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={newDrinkForm.description}
                          onChange={(e) => setNewDrinkForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Beschreibung (optional)"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      {/* Emoji Palette for New Drink */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-blue-800">🎨 Emoji wählen:</p>
                          <input
                            type="text"
                            value={emojiSearch}
                            onChange={(e) => setEmojiSearch(e.target.value)}
                            placeholder="Suchen..."
                            className="px-2 py-1 text-xs border border-blue-300 rounded w-32"
                          />
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                          {filterEmojiBySearch(emojiSearch)
                            .map(e => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => setNewDrinkForm(prev => ({ ...prev, emoji: e }))}
                                className={`px-2 py-1 rounded border text-lg hover:bg-blue-100 ${
                                  newDrinkForm.emoji === e ? 'border-blue-500 bg-blue-100' : 'border-gray-300'
                                }`}
                              >
                                {e}
                              </button>
                            ))}
                        </div>
                      </div>
                      
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={handleAddNewDrink}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          💾 Speichern
                        </button>
                        <button
                          onClick={() => setShowAddDrinkForm(false)}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          ❌ Abbrechen
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Category Filter for Drinks */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Kategorie filtern:</label>
                    <select
                      value={selectedCategoryForDrinks}
                      onChange={(e) => setSelectedCategoryForDrinks(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">🍹 Alle Getränke</option>
                      {mergedCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Drinks List */}
                  <div className="max-h-96 overflow-y-auto">
                    {filteredDrinks.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="text-4xl mb-2">🔍</div>
                        <p className="text-gray-600">Keine Getränke gefunden</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {drinkSearchTerm ? 'Versuche eine andere Suche' : 'Erstelle ein neues Getränk'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {filteredDrinks.map((drink) => {
                          const isInMenu = menuConfig?.items[drink.id];
                          const currentCategory = isInMenu ? (menuConfig.items[drink.id].category || drink.category) : drink.category;
                          const categoryName = mergedCategories.find(c => c.id === currentCategory)?.name || currentCategory;
                          
                          return (
                          <div
                            key={drink.id}
                            className={`border rounded-lg p-3 hover:bg-gray-50 transition-colors ${
                              isInMenu ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{drink.emoji}</span>
                                <div>
                                  <h4 className="font-semibold text-gray-900">{drink.name}</h4>
                                  {drink.size && (
                                    <span className="text-sm text-gray-500">{drink.size}</span>
                                  )}
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {drink.isCustom && (
                                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                        Eigenes
                                      </span>
                                    )}
                                    {isInMenu && (
                                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                        In Menü: {categoryName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-blue-600">{formatPrice(drink.price)}</div>
                                <button
                                  onClick={() => handleAddDrinkToMenu(drink.id)}
                                  disabled={isUpdating === drink.id}
                                  className="mt-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                                >
                                  {isUpdating === drink.id ? '...' : (isInMenu ? '➕ Erneut hinzufügen' : '➕ Hinzufügen')}
                                </button>
                              </div>
                            </div>
                            {drink.description && (
                              <p className="text-sm text-gray-600 mt-2">{drink.description}</p>
                            )}
                          </div>
                        );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Category Modal */}
          {showCategoryModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">📂 Kategorie hinzufügen</h3>
                
                <div className="space-y-4">
                  {/* Toggle between new and existing category */}
                  <div className="flex gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={!useExistingCategory}
                        onChange={() => setUseExistingCategory(false)}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-sm font-medium text-gray-700">Neue Kategorie erstellen</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={useExistingCategory}
                        onChange={() => setUseExistingCategory(true)}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-sm font-medium text-gray-700">Bestehende wählen</span>
                    </label>
                  </div>

                  {useExistingCategory ? (
                    /* Select from existing categories - searchable list */
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Kategorie auswählen*</label>
                      <input
                        type="text"
                        value={categorySearchTerm}
                        onChange={(e) => setCategorySearchTerm(e.target.value)}
                        placeholder="Kategorie suchen..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 mb-2"
                      />
                      <div className="border-2 border-purple-300 rounded-lg max-h-96 min-h-[300px] overflow-y-auto bg-white shadow-inner">
                        {filteredCategories.length === 0 ? (
                          <div className="p-8 text-center text-gray-500">
                            <div className="text-4xl mb-2">🔍</div>
                            <p className="font-medium">Keine Kategorien gefunden</p>
                            <p className="text-sm mt-1">Versuche einen anderen Suchbegriff</p>
                          </div>
                        ) : (
                          <>
                            <div className="sticky top-0 bg-purple-50 px-4 py-2 text-xs font-semibold text-purple-700 border-b border-purple-200">
                              {filteredCategories.length} Kategorie{filteredCategories.length !== 1 ? 'n' : ''} gefunden
                            </div>
                            {filteredCategories.map((cat) => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => setSelectedExistingCategory(cat.id)}
                                className={`w-full text-left px-4 py-4 hover:bg-purple-50 border-b border-gray-200 last:border-b-0 transition-all ${
                                  selectedExistingCategory === cat.id ? 'bg-purple-100 font-semibold border-l-4 border-l-purple-600' : ''
                                }`}
                              >
                                <span className="text-2xl mr-3">{cat.emoji}</span>
                                <span className="text-base">{cat.name}</span>
                                {selectedExistingCategory === cat.id && (
                                  <span className="float-right text-purple-600 text-xl">✓</span>
                                )}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Zeigt ALLE jemals erstellten Kategorien aus der Datenbank (auch inaktive).
                      </p>
                    </div>
                  ) : (
                    /* Create new category */
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Kategoriename*</label>
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="z.B. Cocktails"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Emoji</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newCategoryEmoji}
                        onChange={(e) => setNewCategoryEmoji(e.target.value)}
                        placeholder="📂"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                      <input
                        type="text"
                        value={emojiSearch}
                        onChange={(e) => setEmojiSearch(e.target.value)}
                        placeholder="Suchen..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {filterEmojiBySearch(emojiSearch)
                        .map(e => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => setNewCategoryEmoji(e)}
                            className={`px-2 py-1 rounded border hover:bg-purple-50 ${
                              newCategoryEmoji === e ? 'border-purple-500 bg-purple-100' : 'border-gray-300'
                            }`}
                          >
                            <span className="text-xl">{e}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                    </>
                  )}
                </div>
                
                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => {
                      if (useExistingCategory) {
                        if (!selectedExistingCategory) {
                          alert('❌ Bitte wähle eine Kategorie aus');
                          return;
                        }
                        // Just close the modal - the category already exists
                        setShowCategoryModal(false);
                        setSelectedExistingCategory('');
                        setUseExistingCategory(false);
                        alert('✅ Kategorie ist bereits vorhanden und kann verwendet werden!');
                      } else {
                        handleAddNewCategory();
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    {useExistingCategory ? '✅ Auswählen' : '💾 Speichern'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCategoryModal(false);
                      setNewCategoryName('');
                      setNewCategoryEmoji('📂');
                      setEmojiSearch('');
                      setUseExistingCategory(false);
                      setSelectedExistingCategory('');
                      setCategorySearchTerm('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                  >
                    ❌ Abbrechen
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Category Emoji Picker Modal */}
          {editingCategoryId && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">🎨 Emoji für Kategorie wählen</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Aktuelles Emoji:</label>
                    <div className="text-4xl mb-3">{editingCategoryEmoji}</div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Suchen:</label>
                    <input
                      type="text"
                      value={categoryEmojiSearch}
                      onChange={(e) => setCategoryEmojiSearch(e.target.value)}
                      placeholder="Emoji suchen..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Emoji auswählen:</label>
                    <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                      {filterEmojiBySearch(categoryEmojiSearch)
                        .map(e => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => setEditingCategoryEmoji(e)}
                            className={`px-3 py-2 rounded border text-2xl hover:bg-blue-50 transition-colors ${
                              editingCategoryEmoji === e ? 'border-blue-500 bg-blue-100' : 'border-gray-300'
                            }`}
                          >
                            {e}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => handleUpdateCategoryEmoji(editingCategoryId, editingCategoryEmoji)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    💾 Speichern
                  </button>
                  <button
                    onClick={() => {
                      setEditingCategoryId(null);
                      setEditingCategoryEmoji('');
                      setCategoryEmojiSearch('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                  >
                    ❌ Abbrechen
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full-screen Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl shadow-md bg-white border border-gray-200">
            <div className="animate-spin inline-block w-8 h-8 border-[3px] border-current border-t-transparent text-blue-600 rounded-full" role="status" aria-label="loading" />
            <div className="text-gray-700 font-medium">Produkte werden geladen…</div>
          </div>
        </div>
      )}
    </>
  );
};

export default Produkte;
