/**
 * Password validation utilities — bcrypt 72-byte limit compliance
 */

const MIN_LENGTH = 8;
const MAX_BYTES = 72; // bcrypt input limit

/**
 * Get UTF-8 byte length of a string
 */
function utf8ByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

/**
 * Truncate password to max 72 bytes (bcrypt limit).
 * Safe to call before every auth API — env-agnostic.
 * Cuts at character boundary (no broken multi-byte chars).
 */
export function truncatePasswordTo72Bytes(password: string): string {
  if (!password) return password;
  const encoder = new TextEncoder();
  if (encoder.encode(password).length <= MAX_BYTES) return password;
  let result = '';
  for (const char of password) {
    if (encoder.encode(result + char).length > MAX_BYTES) break;
    result += char;
  }
  return result;
}

/**
 * Validate password for register/login before API call.
 * Returns { valid: true } or { valid: false, message: string }.
 */
export function validatePassword(password: string): { valid: true } | { valid: false; message: string } {
  if (!password || password.length < MIN_LENGTH) {
    return { valid: false, message: 'Password must be at least 8 characters.' };
  }
  if (password.length > MAX_BYTES) {
    return { valid: false, message: 'Password must be at most 72 characters.' };
  }
  const bytes = utf8ByteLength(password);
  if (bytes > MAX_BYTES) {
    return { valid: false, message: 'Password is too long. Use fewer special characters or emoji.' };
  }
  return { valid: true };
}
