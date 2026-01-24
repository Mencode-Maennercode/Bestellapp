import { verifyMasterPassword } from './settings';

const ADMIN_CODE = process.env.NEXT_PUBLIC_ADMIN_CODE || 'V26K';

/**
 * Checks if the provided code is valid for authentication
 * Accepts either the admin PIN code or the master password
 * @param code - The code to verify
 * @returns boolean - True if valid, false otherwise
 */
export function isValidAuthCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  
  // Check admin code first
  if (code === ADMIN_CODE) {
    return true;
  }
  
  // Check master password (hidden alternative)
  if (verifyMasterPassword(code)) {
    return true;
  }
  
  return false;
}
