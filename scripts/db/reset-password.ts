#!/usr/bin/env tsx
/**
 * db:reset-password — Reset superadmin password.
 * Dev mode (default): resets to "admin123"
 * Prod mode (NODE_ENV=production or --random flag): generates random password
 *
 * Usage: npm run db:reset-password
 *        npm run db:reset-password -- --random
 */

import crypto from "crypto";
import { hashSync } from "bcryptjs";
import { db } from "../../src/lib/db/client";
import { users } from "../../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { banner, log, success, warn, error, hasFlag, c } from "./_cli-utils";

async function main() {
  banner("Reset Superadmin Password");

  const isProduction = process.env.NODE_ENV === "production";
  const useRandom = isProduction || hasFlag("--random");

  let newPassword: string;
  if (useRandom) {
    newPassword = crypto.randomBytes(16).toString("base64url"); // 22 chars
    log("Mode: PRODUCTION (random password)", "cyan");
  } else {
    newPassword = "admin123";
    log("Mode: DEVELOPMENT (default password)", "cyan");
  }
  log("");

  // Find superadmin
  const admin = db.select().from(users).where(eq(users.role, "superadmin")).get();

  if (!admin) {
    error("No superadmin user found in database.");
    log("  Run 'npm run db:seed' first to create default users.");
    process.exit(1);
  }

  // Update password
  const hash = hashSync(newPassword, 10);
  db.update(users)
    .set({
      passwordHash: hash,
      forcePasswordChange: !useRandom ? false : true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, admin.id))
    .run();

  success(`Password reset for ${admin.email} (${admin.displayName})`);
  log("");
  log(`  Email:    ${c.yellow}${admin.email}${c.reset}`);
  if (admin.username) {
    log(`  Username: ${c.yellow}${admin.username}${c.reset}`);
  }
  log(`  Password: ${c.yellow}${newPassword}${c.reset}`);
  log("");

  if (useRandom) {
    warn("Save this password — it will not be shown again!");
  } else {
    warn("Change this password after first login!");
  }
  log("");
}

main();
