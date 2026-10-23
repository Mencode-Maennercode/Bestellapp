// Scrambled table IDs - maps internal table number (1-44) to a scrambled code
// Pattern: Letter + 2 digits + Letter (e.g., A17K, B23M) - orderly but not obvious
const TABLE_CODES: { [key: number]: string } = {
  1: 'K17A', 2: 'M23B', 3: 'R09C', 4: 'F31D', 5: 'P42E',
  6: 'J15F', 7: 'W28G', 8: 'L06H', 9: 'T39I', 10: 'N21J',
  11: 'S12K', 12: 'B44L', 13: 'G35M', 14: 'D03N', 15: 'H26O',
  16: 'V18P', 17: 'X41Q', 18: 'C08R', 19: 'Z33S', 20: 'A25T',
  21: 'E14U', 22: 'Y37V', 23: 'U02W', 24: 'Q29X', 25: 'I46Y',
  26: 'O19Z', 27: 'K32A', 28: 'M05B', 29: 'R38C', 30: 'F11D',
  31: 'P24E', 32: 'J47F', 33: 'W16G', 34: 'L43H', 35: 'T07I',
  36: 'N34J', 37: 'S22K', 38: 'B04L', 39: 'G27M', 40: 'D48N',
  41: 'H13O', 42: 'V36P', 43: 'X01Q', 44: 'C45R',
};

// Reverse mapping: code -> table number
const CODE_TO_TABLE: { [key: string]: number } = {};
Object.entries(TABLE_CODES).forEach(([num, code]) => {
  CODE_TO_TABLE[code] = parseInt(num);
});

export function getTableCode(tableNumber: number): string | null {
  return TABLE_CODES[tableNumber] || null;
}

export function getTableNumber(code: string): number | null {
  return CODE_TO_TABLE[code.toUpperCase()] || null;
}

export function getAllTableCodes(): { tableNumber: number; code: string }[] {
  return Object.entries(TABLE_CODES).map(([num, code]) => ({
    tableNumber: parseInt(num),
    code,
  }));
}

export function isValidTableCode(code: string): boolean {
  return code.toUpperCase() in CODE_TO_TABLE;
}

export function getMaxTableNumber(): number {
  return Math.max(...Object.keys(TABLE_CODES).map(k => parseInt(k)));
}

export function getGeneratedTableNumbers(): number[] {
  return Object.keys(TABLE_CODES).map(k => parseInt(k)).sort((a, b) => a - b);
}

// Get actually generated table numbers from Firebase
import { getAllTables } from './dynamicTables';

export async function getActualGeneratedTableNumbers(): Promise<number[]> {
  const tables = await getAllTables();
  return tables.map(t => t.number).sort((a, b) => a - b);
}
