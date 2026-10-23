// Menu configuration for the Karneval ordering system

export interface MenuItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  size?: string;
  category: string;
  isPopular?: boolean; // Shown in quick access
  description?: string;
  volume?: string; // Abgabemenge
  isSoldOut?: boolean; // Product is sold out and cannot be ordered
  askForGlasses?: boolean; // Should prompt for glass quantity when ordering
  glassType?: 'beer' | 'wine' | 'sekt'; // Which glass type to offer (Bierglas, Weinglas, Sektglas)
  tableSection?: 'bottle-nonalc' | 'beer-crate' | 'wine-bottle' | 'shots-crate' | null; // Which "Für den Tisch" section this appears in
}

export interface MenuCategory {
  id: string;
  name: string;
  emoji: string;
  items: MenuItem[];
}

// All menu items organized by category
export const menuItems: MenuItem[] = [
  // Softdrinks
  { id: 'cola', name: 'Cola', emoji: '🥤', price: 2.50, size: '0,2l', category: 'softdrinks', isPopular: true },
  { id: 'cola-zero', name: 'Cola Zero', emoji: '🥤', price: 2.50, size: '0,2l', category: 'softdrinks' },
  { id: 'sprite', name: 'Sprite', emoji: '🍋', price: 2.50, size: '0,2l', category: 'softdrinks' },
  { id: 'fanta', name: 'Fanta', emoji: '🍊', price: 2.50, size: '0,2l', category: 'softdrinks' },
  { id: 'apfelschorle', name: 'Apfelschorle', emoji: '🍎', price: 2.50, size: '0,2l', category: 'softdrinks', isPopular: true },
  { id: 'wasser', name: 'Wasser', emoji: '💧', price: 2.50, size: '0,2l', category: 'softdrinks', isPopular: true },
  { id: 'flasche-wasser', name: 'Flasche Wasser', emoji: '💧', price: 5.00, size: '0,75l', category: 'softdrinks', description: 'Für den ganzen Tisch', askForGlasses: true, glassType: 'beer' },
  { id: 'flasche-cola', name: 'Flasche Cola', emoji: '🍾', price: 6.00, size: '1,0l', category: 'softdrinks', description: 'Zum Teilen', askForGlasses: true, glassType: 'beer' },
  { id: 'flasche-sprite', name: 'Flasche Sprite', emoji: '🍾', price: 6.00, size: '1,0l', category: 'softdrinks', description: 'Zum Teilen', askForGlasses: true, glassType: 'beer' },
  { id: 'flasche-fanta', name: 'Flasche Fanta', emoji: '🍾', price: 6.00, size: '1,0l', category: 'softdrinks', description: 'Zum Teilen', askForGlasses: true, glassType: 'beer' },
  
  // Bier
  { id: 'pils', name: 'Pils', emoji: '🍺', price: 3.00, size: '0,33l', category: 'bier', isPopular: true },
  { id: 'koelsch', name: 'Kölsch', emoji: '🍺', price: 3.00, size: '0,33l', category: 'bier', isPopular: true },
  { id: 'radler-00', name: 'Radler 0,0%', emoji: '🍺', price: 3.00, size: '0,33l', category: 'bier' },
  { id: 'radler', name: 'Radler', emoji: '🍺', price: 3.00, size: '0,33l', category: 'bier' },
  { id: 'kiste-bier-bitburger', name: 'Kiste Bitburger', emoji: '📦', price: 60.00, category: 'bier', description: '24 Flaschen Bitburger' },
  { id: 'kiste-bier-koelsch', name: 'Kiste Kölsch', emoji: '📦', price: 60.00, category: 'bier', description: '24 Flaschen Kölsch' },
  { id: 'kiste-bier-gemischt', name: 'Kiste Gemischt', emoji: '📦', price: 60.00, category: 'bier', description: '10 Bitburger, 10 Kölsch, 4 Radler 0,0%' },
  
  // Wein & Sekt
  { id: 'glas-wein-blanc', name: 'Glas Blanc de noir', emoji: '🍷', price: 6.00, size: '0,2l', category: 'wein', description: 'trocken' },
  { id: 'glas-wein-weissburgunder', name: 'Glas Weißburgunder', emoji: '🍷', price: 6.00, size: '0,2l', category: 'wein', description: 'trocken' },
  { id: 'glas-wein-jubilus', name: 'Glas Jubilus', emoji: '🍷', price: 6.00, size: '0,2l', category: 'wein', description: 'feinherb' },
  { id: 'flasche-wein-blanc', name: 'Flasche Blanc de noir', emoji: '🍾', price: 20.00, category: 'wein', description: 'trocken', askForGlasses: true, glassType: 'wine' },
  { id: 'flasche-wein-weissburgunder', name: 'Flasche Weißburgunder', emoji: '🍾', price: 20.00, category: 'wein', description: 'trocken', askForGlasses: true, glassType: 'wine' },
  { id: 'flasche-wein-jubilus', name: 'Flasche Jubilus', emoji: '🍾', price: 20.00, category: 'wein', description: 'feinherb', askForGlasses: true, glassType: 'wine' },
  { id: 'glas-secco', name: 'Glas Secco', emoji: '🥂', price: 6.00, size: '0,2l', category: 'wein', isPopular: true },
  { id: 'flasche-sekt', name: 'Flasche Sekt', emoji: '🍾', price: 22.00, category: 'wein', askForGlasses: true, glassType: 'sekt' },
  { id: 'flasche-secco', name: 'Flasche Secco', emoji: '🍾', price: 18.00, category: 'wein', askForGlasses: true, glassType: 'sekt' },
  { id: 'luftikuss', name: 'LuftiKuss', emoji: '🍾', price: 20.00, category: 'wein', description: 'Alkoholfreier Sekt', askForGlasses: true, glassType: 'sekt' },
  
  // Kurze (Shots)
  { id: 'baerbelchen', name: 'Bärbelchen', emoji: '🍬', price: 3.00, category: 'kurze' },
  { id: 'glitter-pitter', name: 'Glitter Pitter', emoji: '✨', price: 3.00, category: 'kurze' },
  { id: 'kiste-klopfer-baerbelchen', name: 'Kiste Bärbelchen', emoji: '📦', price: 50.00, category: 'kurze' },
  { id: 'kiste-klopfer-glitter', name: 'Kiste Glitter Pitter', emoji: '📦', price: 50.00, category: 'kurze' },
  
  // Gläser (leer)
  { id: 'glas-normal', name: 'Bierglas (leer)', emoji: '🍺', price: 0.00, category: 'glaeser' },
  { id: 'glas-wein-leer', name: 'Weinglas (leer)', emoji: '🍷', price: 0.00, category: 'glaeser' },
  { id: 'glas-sekt-leer', name: 'Sektglas (leer)', emoji: '🥂', price: 0.00, category: 'glaeser' },
];

export const categories: MenuCategory[] = [
  {
    id: 'softdrinks',
    name: 'Softdrinks',
    emoji: '🥤',
    items: menuItems.filter(item => item.category === 'softdrinks'),
  },
  {
    id: 'bier',
    name: 'Bier',
    emoji: '🍺',
    items: menuItems.filter(item => item.category === 'bier'),
  },
  {
    id: 'wein',
    name: 'Wein & Sekt',
    emoji: '🍷',
    items: menuItems.filter(item => item.category === 'wein'),
  },
  {
    id: 'kurze',
    name: 'Kurze',
    emoji: '🥃',
    items: menuItems.filter(item => item.category === 'kurze'),
  },
  {
    id: 'glaeser',
    name: 'Gläser',
    emoji: '🥃',
    items: menuItems.filter(item => item.category === 'glaeser'),
  },
];

// Get popular items for quick access
export const popularItems = menuItems.filter(item => item.isPopular);

// Get item by ID
export const getItemById = (id: string): MenuItem | undefined => {
  return menuItems.find(item => item.id === id);
};

// Format price in German format
export const formatPrice = (price: number): string => {
  return price.toFixed(2).replace('.', ',') + ' €';
};
