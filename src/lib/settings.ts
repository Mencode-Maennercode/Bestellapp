import { database, ref, onValue, set, get } from './firebase';

// ============ TYPES ============

export type Language = 'koelsch' | 'hochdeutsch';

export interface ThekeConfig {
  id: string;
  name: string;
  assignedTables: number[];
}

export interface ColorConfig {
  primaryKellner: string;
  secondaryKellner: string;
  primaryTisch: string;
  secondaryTisch: string;
}

export interface BroadcastMessage {
  id: string;
  message: string;
  timestamp: number;
  target: 'all' | 'tables' | 'waiters' | 'bars';
  active: boolean;
  readBy?: {
    tables: number[];
    waiters: string[];
    bars: string[];
  };
}

export interface PinProtection {
  adminPin?: string; // Admin PIN (hashed)
  protectedActions: {
    productsPage?: boolean;
    systemShutdown?: boolean;
    orderFormToggle?: boolean;
    tableManagement?: boolean;
    statistics?: boolean;
    settings?: boolean;
    broadcast?: boolean;
  };
}

export interface CustomTable {
  id: string;
  name: string; // Can be any string like "VIP1", "Terrasse 3", etc.
  createdAt: number;
}

export interface AppSettings {
  language: Language;
  colors: ColorConfig;
  theken: ThekeConfig[];
  tablePlanImage?: string; // Base64 encoded image (deprecated, use tablePlans)
  tablePlans?: TablePlan[]; // Multiple table plans with swipe support
  logo?: string; // Base64 encoded logo image
  orderAutoHideMinutes?: number; // Auto-hide orders after X minutes (0 = never)
  pinProtection?: PinProtection;
  customTables?: CustomTable[]; // User-defined custom tables
}

export interface TablePlan {
  id: string;
  name: string;
  image: string; // Base64 encoded image
  uploadedAt: number;
}

// ============ DEFAULT VALUES ============

export const defaultColors: ColorConfig = {
  primaryKellner: '#009640',
  secondaryKellner: '#FFCC00',
  primaryTisch: '#009640', 
  secondaryTisch: '#FFCC00',
};

export const defaultSettings: AppSettings = {
  language: 'koelsch',
  colors: defaultColors,
  theken: [
    { id: 'theke-main', name: 'Haupttheke', assignedTables: [] }
  ],
  orderAutoHideMinutes: 6, // Default: 6 minutes
  pinProtection: {
    protectedActions: {
      productsPage: false,
      systemShutdown: false,
      orderFormToggle: false,
      tableManagement: false,
      statistics: false,
      settings: false,
      broadcast: false
    }
  }
};

// ============ TRANSLATIONS ============

export const translations: Record<Language, Record<string, string>> = {
  koelsch: {
    // Tisch page
    'call_waiter': '🙋 Köbes kumm ran',
    'call_waiter_hint': 'Hier kannst du einfach die Kellner:in rufen',
    'waiter_called': '✅ Kellner wird gerufen!',
    'order_sent': '✅ Bestellung gesendet!',
    'table': 'Tisch',
    'demo_table': 'Demo Tisch',
    'all': 'Alle',
    'for_table': '✨ Für den ganzen Tisch',
    'drinks': '🥤 Getränke',
    'popular': '⭐ Beliebt',
    'items': 'Artikel',
    'order': '🛒 Bestellen',
    'clear_cart': '🔄 Warenkorb leeren',
    'view_cart': 'anzeigen',
    'cart_title': '🛒 Dein Warenkorb',
    'cart_empty': 'Warenkorb ist leer',
    'total_sum': 'Gesamtsumme:',
    'payment_at_table': 'Bezahlung erfolgt am Tisch',
    'save_as_app': 'als App speichern',
    'choose_bottle': '🍾 Flasche wählen',
    'choose_crate': '📦 Kiste wählen',
    'choose_wine': '🍾 Wein/Sekt wählen',
    'choose_shots': '🥃 Schnaps wählen',
    'add': 'Hinzufügen',
    'your_orders': '📋 Deine Bestellungen',
    'orders_shown_6min': 'Bestellungen werden 6 Minuten angezeigt',
    'bottle_nonalc': 'Unalkoholisch',
    'water_cola_limo': 'Wasser / Cola / Limo',
    'beer_crate': 'Bier',
    '24_bottles': '24 Flaschen',
    'wine_secco': 'Wein/Sekt',
    'various_types': 'Verschiedene Sorten',
    'shots_crate': 'Schnaps',
    'shots_types': 'Bärbelchen / Glitter Pitter',
    'from': 'ab',
    'system_shutdown': 'System außer Betrieb',
    'system_shutdown_msg': 'Das System wurde aus technischen Gründen abgeschaltet. Kellner kommen jetzt regelmäßig an Ihren Tisch.',
    'order_not_possible': 'Bestellung momentan nicht möglich',
    'use_waiter_button': 'Bitte rufen Sie den Köbes über den Button oben.',
    'loading': 'Laden...',
    'cooldown_active': 'Warte noch',
    'seconds': 'Sekunden',
    'minutes': 'Minuten',

    // Kellner page
    'waiter_view': '👤 Kellner-Ansicht',
    'setup': 'Einrichtung',
    'your_name': 'Dein Name',
    'your_tables': 'Deine Tische',
    'enter_number': 'Nur Zahl eingeben (1-44)',
    'quick_select': 'Schnellauswahl:',
    'start': 'Starten',
    'change': 'Ändern',
    'test': 'Test',
    'alarm_active': '✅ Alarm aktiv - Handy laut lassen!',
    'no_orders': 'Keine Bestellungen',
    'alarm_on_new': 'Alarm ertönt bei neuen Bestellungen',
    'test_alarm': '🔊 Alarm testen',
    'activate_alarm': '⚠️ Alarm aktivieren',
    'new_order': 'NEUE BESTELLUNG!',
    'waiter_called_short': '🙋 Kellner gerufen!',
    'understood_stop': '✅ VERSTANDEN - ALARM STOPPEN',
    'activate_alarm_title': 'Alarm aktivieren',
    'alarm_important': '⚠️ WICHTIG!',
    'alarm_tap_msg': 'Tippe auf den Button um den LAUTEN ALARM zu aktivieren. Bei jeder neuen Bestellung ertönt ein lauter Alarm + Vibration!',
    'phone_volume': '📱 Handy-Lautstärke!',
    'phone_not_silent': 'Stelle sicher dass dein Handy NICHT auf lautlos ist! Der Alarm funktioniert über den Lautsprecher.',
    'activate_alarm_btn': '🔊 ALARM AKTIVIEREN',
    'test_sound_confirm': 'Du hörst einen Test-Ton wenn aktiviert',
    'tap_to_complete': 'Tippen zum Erledigen',
    'order_for': '🛒 Bestellung aufgeben für:',
    'order_table': '🛒 Bestellung',
    'total': 'Gesamt',
    'cancel': 'Abbrechen',
    'place_order': 'Bestellen',
    'add_table': 'Tisch hinzufügen',
    'free_booking': '📝 Freie Buchung',
    'free_booking_desc': 'Bestellung für nicht zugeordneten Tisch',
    'select_table_number': 'Tischnummer auswählen',

    // Bar/Theke page
    'bar': '🍺 Theke',
    'active_notifications': 'aktive Meldungen',
    'statistics': '📊 Statistik',
    'waiter_qr': '👤 Kellner-QR',
    'admin': '⚙️ Admin',
    'system_management': 'System-Verwaltung',
    'system_prep': 'Systemvorbereitung',
    'products_prices': '🍺 Produkte & Preise',
    'message_all_tables': '📢 Nachricht an alle Tische',
    'activate_orders': 'Bestellungen aktivieren',
    'block_orders': 'Bestellungen sperren',
    'activate_system': 'System aktivieren',
    'emergency_stop': 'NOTFALL-STOPP',
    'pin_protected': 'PIN geschützt',
    'coming_soon': 'Demnächst verfügbar',
    'no_active_notifications': 'Keine aktiven Meldungen',
    'click_to_remove': 'Klicken zum Entfernen',
    'waiter_access': '👤 Kellner-Zugang',
    'waiter_scan_qr': 'Kellner können diesen QR-Code scannen, um sich anzumelden.',
    'close': 'Schließen',
    'total_stats': '📈 Gesamt',
    'orders': 'Bestellungen',
    'revenue': 'Umsatz',
    'most_ordered': '🏆 Meistbestellt:',
    'by_table': '🪑 Nach Tisch',
    'no_orders_completed': 'Noch keine Bestellungen abgeschlossen',
    'system_shutdown_banner': '⚠️ SYSTEM ABGESCHALTET ⚠️',
    'guests_see_shutdown': 'Gäste sehen eine Abschaltungs-Meldung',
    'order_form_blocked': '🚫 BESTELLFORMULAR GESPERRT 🚫',
    'guests_waiter_only': 'Gäste können nur den Köbes-Button nutzen',
    'ordered_by': 'Bestellt von',

    // Settings
    'settings': '⚙️ Einstellungen',
    'language': 'Sprache',
    'koelsch_dialect': 'Kölsch (Dialekt)',
    'hochdeutsch_standard': 'Hochdeutsch (Standard)',
    'colors': 'Farben',
    'primary_color': 'Primärfarbe',
    'secondary_color': 'Sekundärfarbe',
    'kellner_colors': 'Kellner-Seite Farben',
    'tisch_colors': 'Tisch-Seite Farben',
    'logo': 'Logo',
    'logo_upload': 'Logo hochladen',
    'logo_remove': 'Logo entfernen',
    'logo_max_size': 'Max. 25MB',
    'theken_management': 'Theken-Verwaltung',
    'add_theke': 'Theke hinzufügen',
    'theke_name': 'Theken-Name',
    'assigned_tables': 'Zugeordnete Tische',
    'save_settings': 'Einstellungen speichern',
    'settings_saved': 'Einstellungen gespeichert!',
  },
  hochdeutsch: {
    // Tisch page
    'call_waiter': '🙋 Kellner rufen',
    'call_waiter_hint': 'Hier können Sie den Kellner rufen',
    'waiter_called': '✅ Kellner wird gerufen!',
    'order_sent': '✅ Bestellung gesendet!',
    'table': 'Tisch',
    'demo_table': 'Demo Tisch',
    'all': 'Alle',
    'for_table': '✨ Für den ganzen Tisch',
    'drinks': '🥤 Getränke',
    'popular': '⭐ Beliebt',
    'items': 'Artikel',
    'order': '🛒 Bestellen',
    'clear_cart': '🔄 Warenkorb leeren',
    'view_cart': 'anzeigen',
    'cart_title': '🛒 Ihr Warenkorb',
    'cart_empty': 'Warenkorb ist leer',
    'total_sum': 'Gesamtsumme:',
    'payment_at_table': 'Bezahlung erfolgt am Tisch',
    'save_as_app': 'als App speichern',
    'choose_bottle': '🍾 Flasche wählen',
    'choose_crate': '📦 Kiste wählen',
    'choose_wine': '🍾 Wein/Sekt wählen',
    'choose_shots': '🥃 Kurze wählen',
    'add': 'Hinzufügen',
    'your_orders': '📋 Ihre Bestellungen',
    'orders_shown_6min': 'Bestellungen werden 6 Minuten angezeigt',
    'bottle_nonalc': 'Flasche Alkoholfrei',
    'water_cola_limo': 'Wasser / Cola / Limonade',
    'beer_crate': 'Kasten Bier',
    '24_bottles': '24 Flaschen',
    'wine_secco': 'Wein / Sekt Flasche',
    'various_types': 'Verschiedene Sorten',
    'shots_crate': 'Kiste Kurze',
    'shots_types': 'Bärbelchen / Glitter Pitter',
    'from': 'ab',
    'system_shutdown': 'System außer Betrieb',
    'system_shutdown_msg': 'Das System wurde aus technischen Gründen abgeschaltet. Kellner kommen jetzt regelmäßig an Ihren Tisch.',
    'order_not_possible': 'Bestellung momentan nicht möglich',
    'use_waiter_button': 'Bitte rufen Sie den Kellner über den Button oben.',
    'loading': 'Laden...',
    'cooldown_active': 'Bitte warten',
    'seconds': 'Sekunden',
    'minutes': 'Minuten',

    // Kellner page
    'waiter_view': '👤 Kellner-Ansicht',
    'setup': 'Einrichtung',
    'your_name': 'Ihr Name',
    'your_tables': 'Ihre Tische',
    'enter_number': 'Nur Zahl eingeben (1-44)',
    'quick_select': 'Schnellauswahl:',
    'start': 'Starten',
    'change': 'Ändern',
    'test': 'Test',
    'alarm_active': '✅ Alarm aktiv - Handy laut lassen!',
    'no_orders': 'Keine Bestellungen',
    'alarm_on_new': 'Alarm ertönt bei neuen Bestellungen',
    'test_alarm': '🔊 Alarm testen',
    'activate_alarm': '⚠️ Alarm aktivieren',
    'new_order': 'NEUE BESTELLUNG!',
    'waiter_called_short': '🙋 Kellner gerufen!',
    'understood_stop': '✅ VERSTANDEN - ALARM STOPPEN',
    'activate_alarm_title': 'Alarm aktivieren',
    'alarm_important': '⚠️ WICHTIG!',
    'alarm_tap_msg': 'Tippen Sie auf den Button um den LAUTEN ALARM zu aktivieren. Bei jeder neuen Bestellung ertönt ein lauter Alarm + Vibration!',
    'phone_volume': '📱 Handy-Lautstärke!',
    'phone_not_silent': 'Stellen Sie sicher dass Ihr Handy NICHT auf lautlos ist! Der Alarm funktioniert über den Lautsprecher.',
    'activate_alarm_btn': '🔊 ALARM AKTIVIEREN',
    'test_sound_confirm': 'Sie hören einen Test-Ton wenn aktiviert',
    'tap_to_complete': 'Tippen zum Erledigen',
    'order_for': '🛒 Bestellung aufgeben für:',
    'order_table': '🛒 Bestellung',
    'total': 'Gesamt',
    'cancel': 'Abbrechen',
    'place_order': 'Bestellen',
    'add_table': 'Tisch hinzufügen',
    'free_booking': '📝 Freie Buchung',
    'free_booking_desc': 'Bestellung für nicht zugeordneten Tisch',
    'select_table_number': 'Tischnummer auswählen',

    // Bar/Theke page
    'bar': '🍺 Theke',
    'active_notifications': 'aktive Meldungen',
    'statistics': '📊 Statistik',
    'waiter_qr': '👤 Kellner-QR',
    'admin': '⚙️ Admin',
    'system_management': 'System-Verwaltung',
    'system_prep': 'Systemvorbereitung',
    'products_prices': '🍺 Produkte & Preise',
    'message_all_tables': '📢 Nachricht an alle Tische',
    'activate_orders': 'Bestellungen aktivieren',
    'block_orders': 'Bestellungen sperren',
    'activate_system': 'System aktivieren',
    'emergency_stop': 'NOTFALL-STOPP',
    'pin_protected': 'PIN geschützt',
    'coming_soon': 'Demnächst verfügbar',
    'no_active_notifications': 'Keine aktiven Meldungen',
    'click_to_remove': 'Klicken zum Entfernen',
    'waiter_access': '👤 Kellner-Zugang',
    'waiter_scan_qr': 'Kellner können diesen QR-Code scannen, um sich anzumelden.',
    'close': 'Schließen',
    'total_stats': '📈 Gesamt',
    'orders': 'Bestellungen',
    'revenue': 'Umsatz',
    'most_ordered': '🏆 Meistbestellt:',
    'by_table': '🪑 Nach Tisch',
    'no_orders_completed': 'Noch keine Bestellungen abgeschlossen',
    'system_shutdown_banner': '⚠️ SYSTEM ABGESCHALTET ⚠️',
    'guests_see_shutdown': 'Gäste sehen eine Abschaltungs-Meldung',
    'order_form_blocked': '🚫 BESTELLFORMULAR GESPERRT 🚫',
    'guests_waiter_only': 'Gäste können nur den Kellner-Button nutzen',
    'ordered_by': 'Bestellt von',

    // Settings
    'settings': '⚙️ Einstellungen',
    'language': 'Sprache',
    'koelsch_dialect': 'Kölsch (Dialekt)',
    'hochdeutsch_standard': 'Hochdeutsch (Standard)',
    'colors': 'Farben',
    'primary_color': 'Primärfarbe',
    'secondary_color': 'Sekundärfarbe',
    'kellner_colors': 'Kellner-Seite Farben',
    'tisch_colors': 'Tisch-Seite Farben',
    'logo': 'Logo',
    'logo_upload': 'Logo hochladen',
    'logo_remove': 'Logo entfernen',
    'logo_max_size': 'Max. 25MB',
    'theken_management': 'Theken-Verwaltung',
    'add_theke': 'Theke hinzufügen',
    'theke_name': 'Theken-Name',
    'assigned_tables': 'Zugeordnete Tische',
    'save_settings': 'Einstellungen speichern',
    'settings_saved': 'Einstellungen gespeichert!',
  }
};

// ============ SETTINGS MANAGEMENT ============

export async function getSettings(): Promise<AppSettings> {
  try {
    const settingsRef = ref(database, 'settings');
    const snapshot = await get(settingsRef);
    if (snapshot.exists()) {
      return { ...defaultSettings, ...snapshot.val() };
    }
    return defaultSettings;
  } catch (error) {
    console.error('Error loading settings:', error);
    return defaultSettings;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    // Remove undefined values to prevent Firebase errors
    const cleanSettings = JSON.parse(JSON.stringify(settings));
    const settingsRef = ref(database, 'settings');
    await set(settingsRef, cleanSettings);
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
}

export function subscribeToSettings(callback: (settings: AppSettings) => void): () => void {
  const settingsRef = ref(database, 'settings');
  const unsubscribe = onValue(settingsRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ ...defaultSettings, ...snapshot.val() });
    } else {
      callback(defaultSettings);
    }
  });
  return unsubscribe;
}

// ============ HELPER FUNCTIONS ============

export function t(key: string, language: Language): string {
  return translations[language][key] || translations['hochdeutsch'][key] || key;
}

// ============ COLOR CONTRAST HELPER FUNCTIONS ============

/**
 * Calculates the relative luminance of a color (0.0 to 1.0)
 * Based on WCAG 2.0 formula
 */
function getLuminance(hexColor: string): number {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  // Apply gamma correction
  const gammaCorrect = (c: number) => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  
  const R = gammaCorrect(r);
  const G = gammaCorrect(g);
  const B = gammaCorrect(b);
  
  // Calculate luminance
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Determines if text should be black or white based on background color
 * Returns the color with better contrast ratio
 */
export function getContrastTextColor(backgroundColor: string): '#000000' | '#FFFFFF' {
  const luminance = getLuminance(backgroundColor);
  
  // WCAG 2.0 recommends using 0.5 as the threshold
  // If background is light (luminance > 0.5), use black text
  // If background is dark (luminance <= 0.5), use white text
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Returns the appropriate Tailwind class for text color based on background
 */
export function getContrastTextClass(backgroundColor: string): string {
  const textColor = getContrastTextColor(backgroundColor);
  return textColor === '#000000' ? 'text-black' : 'text-white';
}

export function getThekeForTable(tableNumber: number, theken: ThekeConfig[]): ThekeConfig | null {
  for (const theke of theken) {
    if (theke.assignedTables.includes(tableNumber)) {
      return theke;
    }
  }
  // If no specific theke assigned, return first theke (main)
  return theken[0] || null;
}

// ============ WAITER ASSIGNMENT HELPERS ============

export interface WaiterAssignment {
  waiterName: string;
  tables: number[];
}

export async function getWaiterAssignments(): Promise<WaiterAssignment[]> {
  try {
    const assignmentsRef = ref(database, 'waiterAssignments');
    const snapshot = await get(assignmentsRef);
    if (snapshot.exists()) {
      return Object.values(snapshot.val());
    }
    return [];
  } catch (error) {
    console.error('Error loading waiter assignments:', error);
    return [];
  }
}

export async function saveWaiterAssignment(waiterName: string, tables: number[]): Promise<void> {
  try {
    const assignmentRef = ref(database, `waiterAssignments/${waiterName}`);
    await set(assignmentRef, { waiterName, tables });
  } catch (error) {
    console.error('Error saving waiter assignment:', error);
    throw error;
  }
}

export function getWaitersForTable(tableNumber: number, assignments: WaiterAssignment[]): string[] {
  return assignments
    .filter(a => a.tables.includes(tableNumber))
    .map(a => a.waiterName);
}

// ============ BROADCAST MESSAGES ============

export async function sendBroadcast(message: string, target: 'all' | 'tables' | 'waiters' | 'bars'): Promise<void> {
  try {
    const broadcastRef = ref(database, 'broadcast');
    await set(broadcastRef, {
      id: `broadcast-${Date.now()}`,
      message,
      timestamp: Date.now(),
      target,
      active: true,
      readBy: {
        tables: [] as number[],
        waiters: [] as string[],
        bars: [] as string[]
      }
    });
  } catch (error) {
    console.error('Error sending broadcast:', error);
    throw error;
  }
}

export async function markBroadcastAsRead(tableNumber?: number, waiterName?: string, barName?: string): Promise<void> {
  try {
    const broadcastRef = ref(database, 'broadcast');
    const snapshot = await get(broadcastRef);
    
    if (snapshot.exists()) {
      const broadcast = snapshot.val() as BroadcastMessage;
      const readBy = {
        tables: (broadcast.readBy?.tables || []) as number[],
        waiters: (broadcast.readBy?.waiters || []) as string[],
        bars: (broadcast.readBy?.bars || []) as string[]
      };
      
      if (tableNumber !== undefined && !readBy.tables.includes(tableNumber)) {
        readBy.tables.push(tableNumber);
      }
      
      if (waiterName && !readBy.waiters.includes(waiterName)) {
        readBy.waiters.push(waiterName);
      }
      
      if (barName && !readBy.bars.includes(barName)) {
        readBy.bars.push(barName);
      }
      
      await set(broadcastRef, {
        ...broadcast,
        readBy
      });
    }
  } catch (error) {
    console.error('Error marking broadcast as read:', error);
    throw error;
  }
}

export async function clearBroadcast(): Promise<void> {
  try {
    const broadcastRef = ref(database, 'broadcast');
    await set(broadcastRef, null);
  } catch (error) {
    console.error('Error clearing broadcast:', error);
    throw error;
  }
}

export function subscribeToBroadcast(callback: (broadcast: BroadcastMessage | null) => void): () => void {
  const broadcastRef = ref(database, 'broadcast');
  const unsubscribe = onValue(broadcastRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    } else {
      callback(null);
    }
  });
  return unsubscribe;
}

// ============ PIN PROTECTION SYSTEM ============

const MASTER_PASSWORD = '2026Veranstaltung';

// Simple hash function for PIN storage
function hashPin(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export function verifyMasterPassword(password: string): boolean {
  return password === MASTER_PASSWORD;
}

export async function setAdminPin(newPin: string): Promise<void> {
  try {
    const settings = await getSettings();
    const hashedPin = hashPin(newPin);
    const updatedSettings: AppSettings = {
      ...settings,
      pinProtection: {
        adminPin: hashedPin,
        protectedActions: settings.pinProtection?.protectedActions || defaultSettings.pinProtection!.protectedActions
      }
    };
    await saveSettings(updatedSettings);
  } catch (error) {
    console.error('Error setting admin PIN:', error);
    throw error;
  }
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  try {
    const settings = await getSettings();
    if (!settings.pinProtection?.adminPin) {
      return false;
    }
    return hashPin(pin) === settings.pinProtection.adminPin;
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return false;
  }
}

export async function resetAdminPin(masterPassword: string, newPin: string): Promise<boolean> {
  if (!verifyMasterPassword(masterPassword)) {
    return false;
  }
  await setAdminPin(newPin);
  return true;
}

export async function isActionProtected(action: keyof PinProtection['protectedActions']): Promise<boolean> {
  try {
    const settings = await getSettings();
    return settings.pinProtection?.protectedActions?.[action] === true;
  } catch (error) {
    console.error('Error checking action protection:', error);
    return false;
  }
}
