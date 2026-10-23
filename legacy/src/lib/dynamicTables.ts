import { ref, set, get, remove, update } from 'firebase/database';
import { database } from './firebase';

// Table interface
export interface Table {
  id: string;
  number: number;
  code: string;
  name?: string; // Only used for custom tables (number >= 1000) - readable name like "26a"
  createdAt: number;
  isActive: boolean;
}

// Waiter table assignment interface
export interface WaiterAssignment {
  waiterId: string;
  tableIds: string[];
  assignedAt: number;
}

// Firebase paths
export const TABLES_PATH = 'tables';
export const WAITER_ASSIGNMENTS_PATH = 'waiterAssignments';

// Generate random table code
export const generateTableCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  // Pattern: Letter + 2 digits + Letter (e.g., A17B)
  const letter1 = chars[Math.floor(Math.random() * chars.length)];
  const digit1 = numbers[Math.floor(Math.random() * numbers.length)];
  const digit2 = numbers[Math.floor(Math.random() * numbers.length)];
  const letter2 = chars[Math.floor(Math.random() * chars.length)];
  
  return `${letter1}${digit1}${digit2}${letter2}`;
};

// Generate unique table code (avoid collisions)
export const generateUniqueTableCode = async (): Promise<string> => {
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    const code = generateTableCode();
    const existingTable = await getTableByCode(code);
    
    if (!existingTable) {
      return code;
    }
    
    attempts++;
  }
  
  throw new Error('Konnte keinen eindeutigen Tisch-Code generieren');
};

// Get all tables
export const getAllTables = async (): Promise<Table[]> => {
  const tablesRef = ref(database, TABLES_PATH);
  const snapshot = await get(tablesRef);
  
  if (!snapshot.exists()) {
    return [];
  }
  
  const data = snapshot.val();
  return Object.entries(data).map(([id, table]: [string, any]) => ({
    id,
    ...table
  })).sort((a, b) => a.number - b.number);
};

// Get table by code
export const getTableByCode = async (code: string): Promise<Table | null> => {
  const tables = await getAllTables();
  return tables.find(table => table.code === code.toUpperCase()) || null;
};

// Get table by number
export const getTableByNumber = async (number: number): Promise<Table | null> => {
  const tables = await getAllTables();
  return tables.find(table => table.number === number) || null;
};

// Create new tables
export const createTables = async (count: number): Promise<Table[]> => {
  const tablesRef = ref(database, TABLES_PATH);
  const newTables: Table[] = [];
  
  for (let i = 1; i <= count; i++) {
    const code = await generateUniqueTableCode();
    const table: Table = {
      id: `table_${Date.now()}_${i}`,
      number: i,
      code,
      createdAt: Date.now(),
      isActive: true
    };
    
    newTables.push(table);
  }
  
  // Save all tables
  const tablesData: { [key: string]: Table } = {};
  newTables.forEach(table => {
    tablesData[table.id] = table;
  });
  
  await set(tablesRef, tablesData);
  
  return newTables;
};

// Delete all tables
export const deleteAllTables = async (): Promise<void> => {
  const tablesRef = ref(database, TABLES_PATH);
  await remove(tablesRef);
};

// Reset tables (delete old and create new)
export const resetTables = async (count: number): Promise<Table[]> => {
  await deleteAllTables();
  return await createTables(count);
};

// Update table
export const updateTable = async (tableId: string, updates: Partial<Table>): Promise<void> => {
  const tableRef = ref(database, `${TABLES_PATH}/${tableId}`);
  await update(tableRef, updates);
};

// Delete single table
export const deleteTable = async (tableId: string): Promise<void> => {
  const tableRef = ref(database, `${TABLES_PATH}/${tableId}`);
  await remove(tableRef);
};

// Get waiter assignments
export const getWaiterAssignments = async (): Promise<WaiterAssignment[]> => {
  const assignmentsRef = ref(database, WAITER_ASSIGNMENTS_PATH);
  const snapshot = await get(assignmentsRef);
  
  if (!snapshot.exists()) {
    return [];
  }
  
  const data = snapshot.val();
  return Object.entries(data).map(([id, assignment]: [string, any]) => ({
    id,
    ...assignment
  }));
};

// Assign tables to waiter
export const assignTablesToWaiter = async (waiterId: string, tableIds: string[]): Promise<void> => {
  const assignmentsRef = ref(database, WAITER_ASSIGNMENTS_PATH);
  const assignment: WaiterAssignment = {
    waiterId,
    tableIds,
    assignedAt: Date.now()
  };
  
  await update(assignmentsRef, {
    [waiterId]: assignment
  });
};

// Get tables assigned to waiter
export const getTablesForWaiter = async (waiterId: string): Promise<Table[]> => {
  const assignments = await getWaiterAssignments();
  const assignment = assignments.find(a => a.waiterId === waiterId);
  
  if (!assignment) {
    return [];
  }
  
  const allTables = await getAllTables();
  return allTables.filter(table => assignment.tableIds.includes(table.id));
};

// Legacy compatibility functions (for existing code)
export const isValidTableCode = async (code: string): Promise<boolean> => {
  const table = await getTableByCode(code);
  return table !== null;
};

export const getTableNumber = async (code: string): Promise<number | null> => {
  const table = await getTableByCode(code);
  return table ? table.number : null;
};

export const getAllTableCodes = async (): Promise<{ tableNumber: number; code: string }[]> => {
  const tables = await getAllTables();
  return tables.map(table => ({
    tableNumber: table.number,
    code: table.code
  }));
};
