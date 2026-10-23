// Random codes without look-alike characters (no 0/O, 1/I/L).
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function randomCode(length: number, rand: (n: number) => Uint8Array): string {
  const bytes = rand(length * 2);
  let out = '';
  // Rejection sampling keeps the distribution uniform.
  const limit = 256 - (256 % ALPHABET.length);
  for (let i = 0; i < bytes.length && out.length < length; i++) {
    if (bytes[i] < limit) out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out.length === length ? out : randomCode(length, rand);
}

export const GUEST_CODE_LENGTH = 10;
export const STAFF_TOKEN_LENGTH = 24;
export const CODE_PATTERN = /^[23456789A-HJKMNP-Z]{10}$/;
export const TOKEN_PATTERN = /^[23456789A-HJKMNP-Z]{24}$/;
