const COMMON_PASSWORDS = new Set([
  "password1234",
  "password12345",
  "qwerty123456",
  "letmein12345",
  "welcome12345",
  "admin1234567",
  "changeme1234",
  "123456789012",
  "abcdefghijkl",
  "iloveyou1234",
  "trustno11234",
  "master123456",
  "dragon123456",
  "monkey123456",
  "shadow123456",
  "sunshine1234",
  "princess1234",
  "football1234",
  "charlie12345",
  "access123456",
]);

const MIN_LENGTH = 12;

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < MIN_LENGTH) {
    errors.push(`Must be at least ${MIN_LENGTH} characters`);
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Must contain a lowercase letter");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Must contain an uppercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Must contain a digit");
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push("Must contain a special character");
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("This password is too common");
  }

  return { valid: errors.length === 0, errors };
}

export function formatPasswordErrors(errors: string[]): string {
  return errors.join(". ");
}
