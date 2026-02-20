import { getPasswordRequirements, type PasswordRequirements } from "@/lib/config/loader";

// ─── Common Password Blocklist ──────────────────────────────────────────────

const COMMON_PASSWORDS = new Set([
  // Original 21 + expanded to ~100 entries
  "password",
  "password1",
  "password12",
  "password123",
  "password1234",
  "password12345",
  "password123456",
  "qwerty",
  "qwerty123",
  "qwerty1234",
  "qwerty12345",
  "qwerty123456",
  "letmein",
  "letmein123",
  "letmein1234",
  "letmein12345",
  "welcome",
  "welcome1",
  "welcome12",
  "welcome123",
  "welcome1234",
  "welcome12345",
  "admin",
  "admin1",
  "admin12",
  "admin123",
  "admin1234",
  "admin12345",
  "admin123456",
  "admin1234567",
  "changeme",
  "changeme1",
  "changeme12",
  "changeme123",
  "changeme1234",
  "123456",
  "12345678",
  "123456789",
  "1234567890",
  "123456789012",
  "abcdefgh",
  "abcdefghi",
  "abcdefghij",
  "abcdefghijk",
  "abcdefghijkl",
  "iloveyou",
  "iloveyou1",
  "iloveyou12",
  "iloveyou123",
  "iloveyou1234",
  "trustno1",
  "trustno11",
  "trustno112",
  "trustno1123",
  "trustno11234",
  "master",
  "master1",
  "master12",
  "master123",
  "master1234",
  "master12345",
  "master123456",
  "dragon",
  "dragon1",
  "dragon12",
  "dragon123",
  "dragon1234",
  "dragon12345",
  "dragon123456",
  "monkey",
  "monkey1",
  "monkey12",
  "monkey123",
  "monkey1234",
  "monkey12345",
  "monkey123456",
  "shadow",
  "shadow1",
  "shadow12",
  "shadow123",
  "shadow1234",
  "shadow12345",
  "shadow123456",
  "sunshine",
  "sunshine1",
  "sunshine12",
  "sunshine123",
  "sunshine1234",
  "princess",
  "princess1",
  "princess12",
  "princess123",
  "princess1234",
  "football",
  "football1",
  "football12",
  "football123",
  "football1234",
  "charlie",
  "charlie1",
  "charlie12",
  "charlie123",
  "charlie1234",
  "charlie12345",
  "access",
  "access1",
  "access12",
  "access123",
  "access1234",
  "access12345",
  "access123456",
  "superman",
  "superman1",
  "superman12",
  "superman123",
  "batman",
  "batman1",
  "batman12",
  "batman123",
  "starwars",
  "starwars1",
  "starwars12",
  "starwars123",
  "baseball",
  "baseball1",
  "baseball12",
  "baseball123",
]);

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  entropy?: number;
}

// ─── Entropy Calculation ────────────────────────────────────────────────────

/**
 * Calculate password entropy score (0-100)
 * Higher score = more complex password
 * Takes into account charset size, length, and pattern penalties
 */
export function calculateEntropy(password: string): number {
  // 1. Determine charset size based on character types present
  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26; // lowercase
  if (/[A-Z]/.test(password)) charsetSize += 26; // uppercase
  if (/[0-9]/.test(password)) charsetSize += 10; // digits
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32; // special chars

  if (charsetSize === 0) return 0; // No valid characters

  // 2. Calculate base entropy: log2(charsetSize^length)
  const baseEntropy = password.length * Math.log2(charsetSize);

  // 3. Apply penalties for common patterns
  let penalty = 0;

  // Repeated characters (aaa, bbb, etc.)
  if (/(.)\1{2,}/.test(password)) penalty += 10;

  // Common pattern: Capital letter + lowercase + digits + special at end
  // e.g., "Password123!", "Welcome2024!"
  if (/^[A-Z][a-z]+\d+!*$/.test(password)) penalty += 15;

  // All digits
  if (/^\d+$/.test(password)) penalty += 20;

  // All letters (no numbers or special chars)
  if (/^[a-zA-Z]+$/.test(password)) penalty += 10;

  // Common words in password (case-insensitive)
  const commonWords = [
    "password",
    "admin",
    "user",
    "login",
    "welcome",
    "qwerty",
    "letmein",
    "changeme",
    "master",
    "dragon",
    "monkey",
    "shadow",
  ];
  for (const word of commonWords) {
    if (password.toLowerCase().includes(word)) {
      penalty += 25;
      break; // Only apply once
    }
  }

  // Sequential characters (abc, 123, xyz)
  if (
    /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(
      password,
    ) ||
    /(012|123|234|345|456|567|678|789)/.test(password)
  ) {
    penalty += 15;
  }

  // Keyboard patterns (qwer, asdf, zxcv)
  if (/(qwer|asdf|zxcv|qaz|wsx|edc|rfv|tgb|yhn|ujm)/i.test(password)) {
    penalty += 20;
  }

  // 4. Return score clamped to 0-100
  const finalScore = Math.max(0, Math.min(100, baseEntropy - penalty));

  return Math.round(finalScore);
}

// ─── Validation Function ────────────────────────────────────────────────────

/**
 * Validate password against configured requirements
 * Requirements loaded from: YAML config → ENV vars → hardcoded defaults
 */
export function validatePassword(
  password: string,
  customRequirements?: PasswordRequirements,
): PasswordValidationResult {
  // Use custom requirements or load from config
  const requirements = customRequirements || getPasswordRequirements();

  const errors: string[] = [];
  const warnings: string[] = [];

  // Length checks
  if (password.length < requirements.minLength) {
    errors.push(`Must be at least ${requirements.minLength} characters`);
  }

  if (password.length > requirements.maxLength) {
    errors.push(`Must be no more than ${requirements.maxLength} characters`);
  }

  // Character requirement checks
  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Must contain a lowercase letter");
  }

  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Must contain an uppercase letter");
  }

  if (requirements.requireDigits && !/[0-9]/.test(password)) {
    errors.push("Must contain a digit");
  }

  if (requirements.requireSpecialChars && !/[^a-zA-Z0-9]/.test(password)) {
    errors.push("Must contain a special character");
  }

  // Common password check
  if (requirements.preventCommon && COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("This password is too common and easily guessed");
  }

  // Entropy check
  const entropy = calculateEntropy(password);

  if (requirements.minEntropy > 0 && entropy < requirements.minEntropy) {
    errors.push(`Password is not complex enough (strength: ${entropy}/${requirements.minEntropy})`);
  }

  // Add warnings (not blocking, but helpful)
  if (entropy < 40 && entropy >= requirements.minEntropy) {
    warnings.push("Consider using a longer or more varied password");
  }

  if (/(.)\1{2,}/.test(password)) {
    warnings.push("Avoid repeating the same character multiple times");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
    entropy,
  };
}

/**
 * Format validation errors into a single string
 */
export function formatPasswordErrors(errors: string[]): string {
  return errors.join(". ");
}

/**
 * Export requirements for use in UI components
 */
export { type PasswordRequirements };
