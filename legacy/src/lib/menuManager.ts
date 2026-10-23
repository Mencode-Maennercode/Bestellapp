import { ref, set, get, update } from 'firebase/database';
import { database } from './firebase';
import { MenuItem } from './menu';

// Firebase Realtime Database paths
export const MENU_CONFIG_PATH = 'config/menu';
export const MENU_REFRESH_PATH = 'system/menuRefresh';
export const DRINK_DATABASE_PATH = 'database/drinks'; // New path for drink database
export const CATEGORY_DATABASE_PATH = 'database/categories'; // New path for product categories

// Menu configuration interface
export interface MenuConfiguration {
  items: {
    [id: string]: {
      isPremium: boolean;
      isPopular: boolean;
      isSoldOut?: boolean;
      name?: string;
      emoji?: string;
      price?: number;
      description?: string;
      size?: string;
      category?: string; // Optional override for category
      askForGlasses?: boolean; // Should prompt for glass quantity when ordering
      glassType?: 'beer' | 'wine' | 'sekt'; // Which glass type to offer (Bierglas, Weinglas, Sektglas)
      tableSection?: 'bottle-nonalc' | 'beer-crate' | 'wine-bottle' | 'shots-crate' | null; // Which "Für den Tisch" section this appears in
    };
  };
  lastUpdated: number;
}

// Drink database interface
export interface DrinkDatabase {
  drinks: {
    [id: string]: {
      name: string;
      emoji: string;
      price: number;
      size?: string;
      category: string;
      description?: string;
      isCustom?: boolean; // User-added drinks
      addedAt?: number;
    };
  };
  lastUpdated: number;
}

// Category database interface
export interface CategoryDatabase {
  categories: {
    [id: string]: {
      name: string;
      emoji: string;
      description?: string;
      isCustom?: boolean;
      addedAt?: number;
      isActive?: boolean; // Track if category is active or deleted
      deletedAt?: number; // When category was marked as deleted
    };
  };
  // Optional ordering for categories (array of category IDs)
  order?: string[];
  lastUpdated: number;
}

// Get current menu configuration from Firebase
export const getMenuConfiguration = async (): Promise<MenuConfiguration> => {
  const menuConfigRef = ref(database, MENU_CONFIG_PATH);
  const snapshot = await get(menuConfigRef);
  
  if (snapshot.exists()) {
    return snapshot.val();
  }
  
  // Return default configuration if none exists
  return {
    items: {},
    lastUpdated: Date.now()
  };
};

// Update menu configuration in Firebase
export const updateMenuConfiguration = async (updates: Partial<MenuConfiguration>): Promise<void> => {
  const menuRef = ref(database, MENU_CONFIG_PATH);
  const currentConfig = await getMenuConfiguration();
  
  const updatedConfig = {
    ...currentConfig,
    ...updates,
    lastUpdated: Date.now()
  };
  
  await set(menuRef, updatedConfig);
};

// Update specific item configuration
export const updateItemConfiguration = async (itemId: string, updates: {
  name?: string;
  emoji?: string;
  price?: number;
  description?: string;
  size?: string;
  isPremium?: boolean;
  isPopular?: boolean;
  isSoldOut?: boolean;
  category?: string;
  askForGlasses?: boolean;
  glassType?: 'beer' | 'wine' | 'sekt';
  tableSection?: 'bottle-nonalc' | 'beer-crate' | 'wine-bottle' | 'shots-crate' | null;
}): Promise<void> => {
  const config = await getMenuConfiguration();
  
  if (!config.items[itemId]) {
    config.items[itemId] = {
      isPremium: false,
      isPopular: false
    };
  }
  
  // Update only the provided fields
  Object.keys(updates).forEach(key => {
    const value = updates[key as keyof typeof updates];
    if (value !== undefined) {
      (config.items[itemId] as any)[key] = value;
    }
  });
  
  // Update lastUpdated timestamp
  config.lastUpdated = Date.now();
  
  // Save to Firebase
  await set(ref(database, MENU_CONFIG_PATH), config);
  
  // CRITICAL: Also update the lastUpdated path that Kellner/Tisch pages listen to
  await set(ref(database, 'config/menu/lastUpdated'), Date.now());
};



// Toggle popular status for a specific item
export const togglePopularStatus = async (itemId: string, isPopular: boolean): Promise<void> => {
  await updateItemConfiguration(itemId, { isPopular });
};

// Clear menu configuration completely
export const clearMenuConfiguration = async (): Promise<void> => {
  const emptyConfig: MenuConfiguration = {
    items: {},
    lastUpdated: Date.now()
  };
  
  await set(ref(database, MENU_CONFIG_PATH), emptyConfig);
};

// Reset all menu configurations to defaults
export const resetMenuConfiguration = async (defaultItems: MenuItem[]): Promise<void> => {
  const defaultConfig: MenuConfiguration = {
    items: {},
    lastUpdated: Date.now()
  };
  
  // Set all items to their default state
  defaultItems.forEach(item => {
    const itemConfig: any = {
      isPopular: item.isPopular || false,
      // Store default values for reset functionality
      name: item.name,
      price: item.price
    };
    
    // Only include optional fields if they exist in original
    if (item.description) {
      itemConfig.description = item.description;
    }
    if (item.size) {
      itemConfig.size = item.size;
    }
    
    defaultConfig.items[item.id] = itemConfig;
  });
  
  await set(ref(database, MENU_CONFIG_PATH), defaultConfig);
};

// Get menu items with applied configuration
export const getMenuItemWithConfig = (item: MenuItem, config: MenuConfiguration): MenuItem => {
  const itemConfig = config.items[item.id];
  
  return {
    ...item,
    // Use configured flags when defined, otherwise fall back to item values
    isPopular: itemConfig?.isPopular ?? item.isPopular ?? false,
    isSoldOut: itemConfig?.isSoldOut ?? item.isSoldOut ?? false,
    // Apply glass configuration from Firebase
    askForGlasses: itemConfig?.askForGlasses ?? item.askForGlasses ?? false,
    glassType: itemConfig?.glassType ?? item.glassType ?? 'beer',
    // Apply table section configuration
    tableSection: itemConfig?.tableSection ?? (item as any).tableSection ?? null,
    // Apply custom values if they exist, otherwise use defaults.
    // Use nullish coalescing instead of `||` so that empty strings are respected.
    name: itemConfig?.name ?? item.name,
    emoji: itemConfig?.emoji ?? item.emoji ?? '🍺',
    price: itemConfig?.price ?? item.price,
    description: (itemConfig && "description" in itemConfig)
      ? itemConfig.description ?? ''
      : (item.description ?? ''),
    size: (itemConfig && "size" in itemConfig)
      ? itemConfig.size
      : item.size,
    category: itemConfig?.category ?? item.category
  };
};

// Apply configuration to all menu items
export const applyMenuConfiguration = (items: MenuItem[], config: MenuConfiguration): MenuItem[] => {
  return items.map(item => getMenuItemWithConfig(item, config));
};

// Clear drink database completely
export const clearDrinkDatabase = async (): Promise<void> => {
  const emptyDb: DrinkDatabase = {
    drinks: {},
    lastUpdated: Date.now()
  };
  
  await set(ref(database, DRINK_DATABASE_PATH), emptyDb);
};

// Get drink database from Firebase
export const getDrinkDatabase = async (): Promise<DrinkDatabase> => {
  const drinkDbRef = ref(database, DRINK_DATABASE_PATH);
  const snapshot = await get(drinkDbRef);
  
  if (snapshot.exists()) {
    return snapshot.val();
  }
  
  // Return empty database if none exists
  return {
    drinks: {},
    lastUpdated: Date.now()
  };
};

// Update drink database in Firebase
export const updateDrinkDatabase = async (db: Partial<DrinkDatabase>): Promise<void> => {
  const drinkDbRef = ref(database, DRINK_DATABASE_PATH);
  const currentDb = await getDrinkDatabase();
  
  const updatedDb = {
    ...currentDb,
    ...db,
    lastUpdated: Date.now()
  };
  
  // Filter out undefined values from drinks
  if (updatedDb.drinks) {
    Object.keys(updatedDb.drinks).forEach(drinkId => {
      const drink = updatedDb.drinks[drinkId];
      Object.keys(drink).forEach(key => {
        const value = (drink as any)[key];
        if (value === undefined) {
          delete (drink as any)[key];
        }
      });
    });
  }
  
  await set(drinkDbRef, updatedDb);
};

// Add new drink to database
export const addDrinkToDatabase = async (drink: {
  id?: string;          // optional explicit ID (e.g. MenuItem.id)
  name: string;
  emoji: string;
  price: number;
  size?: string;
  category: string;
  description?: string;
  isCustom?: boolean;
}): Promise<string> => {
  const db = await getDrinkDatabase();

  // Preferred ID: explizit übergeben (z.B. MenuItem.id), sonst Slug aus dem Namen
  const generatedId = drink.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const id = drink.id ?? generatedId;
  
  // Check if drink already exists with the target ID
  if (db.drinks && db.drinks[id]) {
    return id; // Return existing ID without overwriting
  }
  
  // Create drink object with only defined values
  const drinkData: any = {
    name: drink.name,
    emoji: drink.emoji,
    price: drink.price,
    category: drink.category,
    isCustom: drink.isCustom || false,
    addedAt: Date.now()
  };
  
  // Only include optional fields if they have values
  if (drink.size !== undefined && drink.size !== '') {
    drinkData.size = drink.size;
  }
  if (drink.description !== undefined && drink.description !== '') {
    drinkData.description = drink.description;
  }
  
  const updatedDb = {
    ...db,
    drinks: {
      ...db.drinks,
      [id]: drinkData
    }
  };
  
  await updateDrinkDatabase(updatedDb);
  return id;
};

// Remove drink from database
export const removeDrinkFromDatabase = async (drinkId: string): Promise<void> => {
  const db = await getDrinkDatabase();
  
  if (db.drinks[drinkId]) {
    delete db.drinks[drinkId];
    await updateDrinkDatabase(db);
  }
};

// Get category database from Firebase
export const getCategoryDatabase = async (): Promise<CategoryDatabase> => {
  const categoryRef = ref(database, CATEGORY_DATABASE_PATH);
  const snapshot = await get(categoryRef);

  if (snapshot.exists()) {
    return snapshot.val();
  }

  return {
    categories: {},
    order: [],
    lastUpdated: Date.now()
  };
};

// Update category database in Firebase
export const updateCategoryDatabase = async (db: Partial<CategoryDatabase>): Promise<void> => {
  const categoryRef = ref(database, CATEGORY_DATABASE_PATH);
  const currentDb = await getCategoryDatabase();

  const updatedDb: CategoryDatabase = {
    ...currentDb,
    ...db,
    lastUpdated: Date.now()
  };

  await set(categoryRef, updatedDb);
};

// Add new category to database (id optional, will be generated from name if missing)
export const addCategoryToDatabase = async (category: {
  id?: string;
  name: string;
  emoji: string;
  description?: string;
  isCustom?: boolean;
}): Promise<string> => {
  const db = await getCategoryDatabase();

  // Generate unique ID with timestamp to avoid conflicts when recreating categories with same name
  const baseId = category.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const timestamp = Date.now();
  const generatedId = `${baseId}-${timestamp}`;
  const id = category.id ?? generatedId;

  // If category already exists with this exact ID, return it (shouldn't happen with timestamp)
  if (db.categories && db.categories[id]) {
    return id;
  }

  const data: any = {
    name: category.name,
    emoji: category.emoji,
    isCustom: category.isCustom ?? true,
    addedAt: Date.now(),
    isActive: true // Mark as active by default
  };

  if (category.description) {
    data.description = category.description;
  }

  const updated = {
    ...db,
    categories: {
      ...db.categories,
      [id]: data
    }
  };

  await updateCategoryDatabase(updated);
  return id;
};

// Delete category from database (marks as inactive instead of truly deleting)
export const deleteCategoryFromDatabase = async (categoryId: string): Promise<void> => {
  const db = await getCategoryDatabase();
  
  if (db.categories && db.categories[categoryId]) {
    // Mark as inactive instead of deleting, so it still appears in "Bestehende wählen"
    db.categories[categoryId] = {
      ...db.categories[categoryId],
      isActive: false,
      deletedAt: Date.now()
    };
    await updateCategoryDatabase({ categories: db.categories });
  }
};

// Add product to active menu
export const addProductToMenu = async (drinkId: string): Promise<void> => {
  const db = await getDrinkDatabase();
  const drink = db.drinks[drinkId];
  
  if (!drink) {
    throw new Error('Getränk nicht in Datenbank gefunden');
  }
  
  const config = await getMenuConfiguration();
  
  // Add to menu configuration with only defined values
  const itemConfig: any = {
    isPopular: false,
    name: drink.name,
    price: drink.price
  };
  
  // Only include optional fields if they exist
  if (drink.description !== undefined && drink.description !== '') {
    itemConfig.description = drink.description;
  }
  if (drink.size !== undefined && drink.size !== '') {
    itemConfig.size = drink.size;
  }
  
  config.items[drinkId] = itemConfig;
  
  await updateMenuConfiguration({ items: config.items });
};

// Initialize menu with default items
export const initializeMenuWithDefaults = async (defaultItems: MenuItem[]): Promise<void> => {
  const config = await getMenuConfiguration();
  
  // Ensure items object exists
  if (!config.items) {
    config.items = {};
  }
  
  // Add all default items to menu configuration
  defaultItems.forEach(item => {
    const itemConfig: any = {
      isPopular: item.isPopular || false,
      isSoldOut: item.isSoldOut || false,
      name: item.name,
      price: item.price,
      // Include glass configuration from default items
      askForGlasses: item.askForGlasses || false,
      glassType: item.glassType || 'beer'
    };
    
    // Only include optional fields if they exist in original
    if (item.description) {
      itemConfig.description = item.description;
    }
    if (item.size) {
      itemConfig.size = item.size;
    }
    
    config.items[item.id] = itemConfig;
  });
  
  await updateMenuConfiguration({ items: config.items });
};

// Toggle sold out status
export const toggleSoldOutStatus = async (productId: string, currentStatus: boolean): Promise<void> => {
  console.log('toggleSoldOutStatus called for', productId, 'current:', currentStatus, 'new:', !currentStatus);
  await updateItemConfiguration(productId, { isSoldOut: !currentStatus });
  console.log('Update completed');
};

// Remove product from active menu (but keep in database)
export const removeProductFromMenu = async (productId: string): Promise<void> => {
  const config = await getMenuConfiguration();
  
  if (config.items[productId]) {
    delete config.items[productId];
    await updateMenuConfiguration({ items: config.items });
  }
};
