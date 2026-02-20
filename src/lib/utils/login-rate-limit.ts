const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const attempts = new Map<string, AttemptRecord>();

function makeKey(ip: string, email: string): string {
  return `${ip}:${email.toLowerCase()}`;
}

function cleanup(): void {
  const now = Date.now();
  for (const [key, record] of attempts) {
    if (record.lockedUntil && now > record.lockedUntil) {
      attempts.delete(key);
    } else if (now - record.firstAttempt > WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

export function isRateLimited(ip: string, email: string): boolean {
  cleanup();
  const key = makeKey(ip, email);
  const record = attempts.get(key);

  if (!record) return false;

  if (record.lockedUntil) {
    return Date.now() < record.lockedUntil;
  }

  return false;
}

export function recordFailedAttempt(ip: string, email: string): void {
  const key = makeKey(ip, email);
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttempt: now, lockedUntil: null });
    return;
  }

  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
  }
}

export function clearAttempts(ip: string, email: string): void {
  attempts.delete(makeKey(ip, email));
}

export function getRateLimitInfo(
  ip: string,
  email: string
): { locked: boolean; remainingMs: number } {
  const key = makeKey(ip, email);
  const record = attempts.get(key);

  if (!record?.lockedUntil) return { locked: false, remainingMs: 0 };

  const remaining = record.lockedUntil - Date.now();
  if (remaining <= 0) {
    attempts.delete(key);
    return { locked: false, remainingMs: 0 };
  }

  return { locked: true, remainingMs: remaining };
}
