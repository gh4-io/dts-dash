#!/usr/bin/env tsx
/**
 * db:superuser — Create the first superadmin user on a fresh database.
 * Intended for production first-run setup where db:seed is not used.
 *
 * Usage: npm run db:superuser
 *        npm run db:superuser -- --email admin@example.com --username admin --password secret123
 *        npm run db:superuser -- --email admin@example.com --username admin --random
 */

import crypto from "crypto";
import readline from "readline";
import { hashSync } from "bcryptjs";
import { db } from "../../src/lib/db/client";
import { users } from "../../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { createTables, runMigrations } from "../../src/lib/db/schema-init";
import { banner, log, success, warn, error, hasFlag, c } from "./_cli-utils";

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (hidden) {
      // Mask password input
      process.stdout.write(`${c.yellow}${question}${c.reset} `);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      if (stdin.isTTY) stdin.setRawMode(true);

      let input = "";
      const onData = (ch: Buffer) => {
        const char = ch.toString("utf8");
        if (char === "\n" || char === "\r" || char === "\u0004") {
          if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          rl.close();
          resolve(input);
        } else if (char === "\u0003") {
          // Ctrl+C
          rl.close();
          process.exit(0);
        } else if (char === "\u007F" || char === "\b") {
          // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else {
          input += char;
          process.stdout.write("*");
        }
      };
      stdin.on("data", onData);
    } else {
      rl.question(`${c.yellow}${question}${c.reset} `, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function main() {
  banner("Create Superuser");

  // Ensure schema exists
  createTables();
  runMigrations();

  // Check if a superadmin already exists
  const existingAdmin = db.select().from(users).where(eq(users.role, "superadmin")).get();

  if (existingAdmin) {
    warn("A superadmin already exists:");
    log(`  Email: ${c.cyan}${existingAdmin.email}${c.reset}`);
    if (existingAdmin.username) {
      log(`  Username: ${c.cyan}${existingAdmin.username}${c.reset}`);
    }
    log("");
    log("Use 'npm run db:reset-password' to reset their password instead.");
    process.exit(0);
  }

  // Gather email
  let email = getArg("--email");
  if (!email) {
    email = await prompt("Email:");
  }
  if (!email || !email.includes("@")) {
    error("A valid email address is required.");
    process.exit(1);
  }

  // Check for duplicate email
  const existingEmail = db.select().from(users).where(eq(users.email, email)).get();

  if (existingEmail) {
    error(`A user with email '${email}' already exists.`);
    process.exit(1);
  }

  // Gather username
  let username = getArg("--username");
  if (!username) {
    username = await prompt("Username (optional, press Enter to skip):");
  }

  // Check for duplicate username if provided
  if (username) {
    const existingUsername = db.select().from(users).where(eq(users.username, username)).get();

    if (existingUsername) {
      error(`A user with username '${username}' already exists.`);
      process.exit(1);
    }
  }

  // Gather display name
  let displayName = getArg("--name");
  if (!displayName) {
    displayName = await prompt("Display name (default: Admin):");
    if (!displayName) displayName = "Admin";
  }

  // Gather password
  const useRandom = hasFlag("--random");
  let password = getArg("--password");

  if (useRandom) {
    password = crypto.randomBytes(16).toString("base64url");
  } else if (!password) {
    password = await prompt("Password (min 8 chars):", true);
    if (!password || password.length < 8) {
      error("Password must be at least 8 characters.");
      process.exit(1);
    }
    const confirm = await prompt("Confirm password:", true);
    if (password !== confirm) {
      error("Passwords do not match.");
      process.exit(1);
    }
  }

  log("");

  // Create the user
  const now = new Date().toISOString();

  const authId = crypto.randomUUID();

  db.insert(users)
    .values({
      authId,
      email,
      username: username || undefined,
      displayName,
      passwordHash: hashSync(password!, 10),
      role: "superadmin",
      isActive: true,
      forcePasswordChange: useRandom,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  log("═══════════════════════════════════════════════════════════", "green");
  success("Superadmin created successfully");
  log("═══════════════════════════════════════════════════════════", "green");
  log("");
  log(`  Email:    ${c.yellow}${email}${c.reset}`);
  if (username) {
    log(`  Username: ${c.yellow}${username}${c.reset}`);
  }
  log(`  Name:     ${c.yellow}${displayName}${c.reset}`);
  log(`  Password: ${c.yellow}${password}${c.reset}`);
  log(`  Role:     ${c.cyan}superadmin${c.reset}`);
  log("");

  if (useRandom) {
    warn("Save this password — it will not be shown again!");
    log("  You will be prompted to change it on first login.");
  } else {
    warn("Change the default password after first login!");
  }
  log("");
}

main();
