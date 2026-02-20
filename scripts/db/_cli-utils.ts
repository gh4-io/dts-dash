/**
 * Shared CLI utilities for db:* scripts.
 * ANSI colors, prompts, formatting, banners.
 */

import readline from "readline";

// ─── ANSI Colors ─────────────────────────────────────────────────────────────

export const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
} as const;

export type Color = keyof typeof c;

// ─── Logging ─────────────────────────────────────────────────────────────────

export function log(msg: string, color: Color = "reset"): void {
  process.stdout.write(`${c[color]}${msg}${c.reset}\n`);
}

export function banner(title: string): void {
  log("═══════════════════════════════════════════════════════════", "blue");
  log(`  ${title}`, "blue");
  log("═══════════════════════════════════════════════════════════", "blue");
  log("");
}

export function success(msg: string): void {
  log(`✓ ${msg}`, "green");
}

export function warn(msg: string): void {
  log(`⚠ ${msg}`, "yellow");
}

export function error(msg: string): void {
  log(`✗ ${msg}`, "red");
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function padRight(str: string, len: number): string {
  return str.padEnd(len);
}

// ─── CLI Helpers ─────────────────────────────────────────────────────────────

export function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

export function timestamp(): string {
  return new Date().toISOString().split(".")[0].replace(/[:.]/g, "-");
}

export async function confirm(question: string): Promise<boolean> {
  // Skip prompt if --yes or -y flag
  if (hasFlag("--yes") || hasFlag("-y")) return true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${c.yellow}${question}${c.reset} `, (answer) => {
      rl.close();
      const a = answer.toLowerCase().trim();
      resolve(a === "y" || a === "yes");
    });
  });
}
