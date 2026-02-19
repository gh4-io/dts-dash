#!/usr/bin/env npx tsx
/**
 * db:import — Import SharePoint work package JSON into SQLite.
 * Reuses the same validation and UPSERT logic as the Admin UI.
 *
 * Usage:
 *   npm run db:import -- --file data/input.json
 *   npm run db:import -- --file data/input.json --yes
 *   npm run db:import -- --file data/input.json --source api
 *   cat export.json | npm run db:import -- --stdin
 */

import fs from "fs";
import path from "path";
import { banner, log, success, warn, error, confirm, c } from "./_cli-utils";

// ─── Parse Arguments ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

const filePath = getArg("--file");
const useStdin = args.includes("--stdin");
const source = (getArg("--source") ?? "file") as "file" | "paste" | "api";

async function main() {
  banner("Work Package Import");

  if (!filePath && !useStdin) {
    error("No input specified. Use --file <path> or --stdin");
    log("");
    log("Usage:", "blue");
    log("  npm run db:import -- --file data/input.json");
    log("  npm run db:import -- --file data/input.json --yes");
    log("  npm run db:import -- --file data/input.json --source api");
    log("  cat export.json | npm run db:import -- --stdin");
    log("");
    process.exit(1);
  }

  // ─── Read JSON ───────────────────────────────────────────────────────────

  let jsonContent: string;

  if (filePath) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      error(`File not found: ${resolved}`);
      process.exit(1);
    }
    log(`Reading: ${c.cyan}${resolved}${c.reset}`);
    jsonContent = fs.readFileSync(resolved, "utf-8");
  } else {
    log("Reading from stdin...");
    jsonContent = await readStdin();
  }

  log(`  Size: ${(jsonContent.length / 1024).toFixed(1)} KB`);
  log("");

  // ─── Validate ────────────────────────────────────────────────────────────

  // Dynamic import to avoid loading DB at module level if args are invalid
  const { validateImportData, commitImportData } = await import("../../src/lib/data/import-utils");

  log("Validating...", "blue");
  const validation = validateImportData(jsonContent);

  if (!validation.valid || !validation.records) {
    error("Validation failed:");
    for (const err of validation.errors) {
      log(`  ${c.red}• ${err}${c.reset}`);
    }
    process.exit(1);
  }

  // ─── Summary ─────────────────────────────────────────────────────────────

  const s = validation.summary!;
  log("");
  log("Import Summary:", "blue");
  log(`  Records:    ${c.cyan}${s.recordCount}${c.reset}`);
  log(`  Customers:  ${c.cyan}${s.customerCount}${c.reset}`);
  log(`  Aircraft:   ${c.cyan}${s.aircraftCount}${c.reset}`);
  if (s.dateRange) {
    log(
      `  Date range: ${c.cyan}${s.dateRange.start.slice(0, 10)} → ${s.dateRange.end.slice(0, 10)}${c.reset}`,
    );
  }

  if (validation.warnings.length > 0) {
    log("");
    for (const w of validation.warnings) {
      warn(w);
    }
  }

  log("");

  // ─── Confirm ─────────────────────────────────────────────────────────────

  if (!(await confirm("Proceed with import (UPSERT by GUID)? [y/N]:"))) {
    log("Cancelled.", "blue");
    process.exit(0);
  }

  log("");
  log("Importing...", "blue");

  // ─── Commit ──────────────────────────────────────────────────────────────

  // Look up the system user by authId for CLI imports
  const { db } = await import("@/lib/db/client");
  const { users } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");

  const { SYSTEM_AUTH_ID } = await import("@/lib/constants");
  const systemUser = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.authId, SYSTEM_AUTH_ID))
    .get();
  if (!systemUser) {
    error("System user not found. Run db:seed first.");
    process.exit(1);
  }

  const result = await commitImportData({
    records: validation.records,
    source,
    fileName: filePath ? path.basename(filePath) : "stdin",
    importedBy: systemUser.id,
  });

  if (!result.success) {
    error("Import failed. Check logs for details.");
    process.exit(1);
  }

  // ─── Result ──────────────────────────────────────────────────────────────

  log("");
  log("═══════════════════════════════════════════════════════════", "green");
  success(`Imported ${result.upsertedCount} work packages`);
  log("═══════════════════════════════════════════════════════════", "green");
  log(`  Import log ID: ${c.dim}${result.logId}${c.reset}`);
  log("");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => chunks.push(String(chunk)));
    process.stdin.on("end", () => resolve(chunks.join("")));
    process.stdin.on("error", reject);

    // Timeout after 10 seconds if no data
    setTimeout(() => {
      if (chunks.length === 0) {
        reject(new Error("No data received on stdin after 10 seconds"));
      }
    }, 10000);
  });
}

main().catch((err) => {
  error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
