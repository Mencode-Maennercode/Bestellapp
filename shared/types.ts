// Domain types shared by the web app and Cloud Functions.
// All money values are integer cents.

export type GlassType = 'beer' | 'wine' | 'sekt';
export type TableSection = 'bottle-nonalc' | 'beer-crate' | 'wine-bottle' | 'shots-crate';
export type EventMode = 'tables' | 'noTables';
export type EventStatus = 'draft' | 'live' | 'closed';
export type OrderType = 'order' | 'call' | 'tab';
export type OrderSource = 'guest' | 'waiter';
export type OrderStatus = 'new' | 'accepted' | 'ready' | 'served' | 'cancelled';
export type Language = 'koelsch' | 'hochdeutsch';
/** Waiters (Kellner) and the bar (Theke) have separate links and separate database access. */
export type StaffRole = 'waiter' | 'bar';
export type Role = StaffRole | 'admin';

export interface Category {
  name: string;
  sort: number;
  active: boolean;
}

export interface Product {
  name: string;
  categoryId: string;
  priceCents: number;
  size?: string;
  description?: string;
  /** Image key in /products/<image>.webp; falls back to the category image. */
  image?: string;
  /** Short UI badge, e.g. "0,0 %" or "Zero". */
  badge?: string;
  soldOut: boolean;
  popular: boolean;
  /** When set, ordering this product asks "how many glasses?". */
  glassPrompt?: GlassType;
  /** Marks an empty-glass product (price 0) for the given glass type. */
  glassFor?: GlassType;
  tableSection?: TableSection;
  sort: number;
  active: boolean;
}

export interface Catalog {
  categories: Record<string, Category>;
  products: Record<string, Product>;
}

export interface EventPublic {
  name: string;
  status: EventStatus;
  mode: EventMode;
  startsAt: number;
  endsAt: number;
  language: Language;
  /** Minutes after which served orders and waiter calls leave the boards. */
  archiveMinutes: number;
  accent: { primary: string; secondary: string };
  /** Folder this event is published under on the web host, e.g. "Hochzeit-Meier". */
  slug?: string;
}

/** Admin-only list entry per event (`eventIndex/{id}`), so the admin never downloads whole events. */
export interface EventIndexEntry {
  name: string;
  status: EventStatus;
  mode: EventMode;
  startsAt: number;
  endsAt: number;
  createdAt: number;
  slug?: string;
}

export interface Bar {
  name: string;
  /** Table ids served by this bar. Empty = all tables. */
  tableIds: string[];
}

export interface Table {
  label: string;
  guestCode: string;
  sort: number;
}

export interface Broadcast {
  message: string;
  target: 'all' | 'guests' | 'staff';
  createdAt: number;
}

export interface SystemState {
  shutdown: boolean;
  ordersPaused: boolean;
  broadcast?: Broadcast | null;
}

export interface OrderItem {
  productId: string;
  name: string;
  priceCents: number;
  qty: number;
}

export interface Order {
  type: OrderType;
  source: OrderSource;
  tableId?: string;
  tableLabel?: string;
  /** Waiter uid that placed a waiter order or owns a tab. */
  waiterUid?: string;
  waiterName?: string;
  /** Tabs only: free-text reminder like "Fenster". */
  note?: string;
  /** False = private tab the bar never sees. */
  sendToBar: boolean;
  items: OrderItem[];
  totalCents: number;
  createdAt: number;
  claimedBy?: { uid: string; name: string } | null;
  claimedAt?: number | null;
  readyAt?: number | null;
  servedAt?: number | null;
  cancelledAt?: number | null;
  status: OrderStatus;
  /** True while the order is counted in the statistics. */
  counted: boolean;
  /** Waiter uid credited in the statistics while counted. */
  countedWaiter?: string | null;
  /** True while the order should appear on boards. */
  open: boolean;
  /**
   * Who among the waiters may read this open order: "all" or "w:<uid>" (a private tab).
   * Null once closed. Database rules only allow queries on exactly these values.
   */
  wFeed?: string | null;
  /** "bar" while the order is open and meant for the bar; the bar link may only query this. */
  bFeed?: 'bar' | null;
}

/** What a guest can see about their own table's orders. */
export interface TableStatusEntry {
  type: OrderType;
  status: OrderStatus;
  summary: string;
  totalCents: number;
  waiterName?: string | null;
  createdAt: number;
  /** When it was served or cancelled; the guest view hides it `archiveMinutes` later. */
  doneAt?: number | null;
}

/** Optional guest feedback for PräsenzWert (write-only for guests). */
export interface Feedback {
  rating: number;
  name?: string;
  email?: string;
  message?: string;
  eventId?: string;
  createdAt: number;
}

export interface StatsBucket {
  orders: number;
  cents: number;
}

export interface Stats {
  totalOrders: number;
  totalCents: number;
  byProduct: Record<string, { qty: number; cents: number; name: string }>;
  byTable: Record<string, StatsBucket>;
  byWaiter: Record<string, StatsBucket & { name?: string }>;
}

export interface WaiterProfile {
  name: string;
  tableIds: string[];
  fcmToken?: string | null;
  lastSeen: number;
}
