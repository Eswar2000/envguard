/**
 * Mask a value for safe display in error messages.
 * Used for fields marked `.secret()`.
 *
 * Rules:
 *  - <= 2 chars  → "***"
 *  - <= 6 chars  → first + "***" + last
 *  - otherwise   → first + "*****" + last
 */
export function maskSecret(value: string): string {
  if (value.length <= 2) return '***';
  if (value.length <= 6) return `${value[0]}***${value[value.length - 1]}`;
  return `${value[0]}*****${value[value.length - 1]}`;
}

/**
 * Heuristic: detect env var names that *probably* hold secrets, even when the
 * schema author forgot to call `.secret()`.
 */
const SECRET_NAME_PATTERN = /(SECRET|KEY|TOKEN|PASSWORD|PASS|PWD|DSN|CREDENTIAL)/i;
export function looksLikeSecret(name: string): boolean {
  return SECRET_NAME_PATTERN.test(name);
}
