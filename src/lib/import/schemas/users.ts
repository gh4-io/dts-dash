/**
 * Users Import Schema
 *
 * Bulk user import with generated temporary passwords.
 * All imported users are created with forcePasswordChange = true.
 */

import { db } from "@/lib/db/client";
import { users, unifiedImportLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { registerSchema } from "../registry";
import type { ImportSchema, ImportContext, CommitResult } from "../types";

const log = createChildLogger("import/users");

const VALID_ROLES = ["user", "admin", "superadmin"];

const usersSchema: ImportSchema = {
  id: "users",
  display: {
    name: "Users",
    description: "Bulk user account creation",
    icon: "fa-solid fa-users",
    category: "Administration",
  },
  fields: [
    {
      name: "email",
      label: "Email",
      type: "string",
      required: true,
      isKey: true,
      aliases: ["Email", "email_address", "emailAddress"],
      description: "User email address (must be unique)",
      validate: (value) => {
        const email = String(value);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return "Invalid email format";
        }
        return null;
      },
    },
    {
      name: "username",
      label: "Username",
      type: "string",
      required: false,
      aliases: ["Username", "user_name", "userName"],
      description: "Optional username (must be unique if provided)",
    },
    {
      name: "displayName",
      label: "Display Name",
      type: "string",
      required: true,
      aliases: ["display_name", "DisplayName", "name", "fullName", "full_name"],
      description: "User display name",
    },
    {
      name: "role",
      label: "Role",
      type: "string",
      required: false,
      defaultValue: "user",
      aliases: ["Role", "userRole", "user_role"],
      description: `User role (${VALID_ROLES.join(", ")})`,
      validate: (value) => {
        if (value && !VALID_ROLES.includes(String(value))) {
          return `Must be one of: ${VALID_ROLES.join(", ")}`;
        }
        return null;
      },
    },
    {
      name: "isActive",
      label: "Active",
      type: "boolean",
      required: false,
      defaultValue: true,
      aliases: ["is_active", "active", "enabled"],
    },
  ],
  formats: ["json", "csv"],
  commitStrategy: "upsert",
  dedupKey: ["email"],
  maxSizeMB: 5,

  help: {
    description:
      "Bulk import user accounts. All imported users are created with a temporary password and must change it on first login. Existing users (matched by email) will have their profile updated but NOT their password.",
    expectedFormat: 'JSON array or CSV with "email" and "displayName" columns',
    sampleSnippet: `[
  { "email": "john@example.com", "displayName": "John Doe", "role": "user" },
  { "email": "admin@example.com", "displayName": "Admin User", "role": "admin" }
]`,
    notes: [
      "All new users get forcePasswordChange = true",
      "Temporary passwords are auto-generated (not shown in import results)",
      "Existing users matched by email — password is NOT reset on update",
      `Valid roles: ${VALID_ROLES.join(", ")}`,
      "Cannot import superadmin role via bulk import (security restriction)",
    ],
    requirements: ["Email must be valid and unique", "Display name is required"],
    troubleshooting: [
      { error: "Invalid email format", fix: "Ensure all emails are valid (user@domain.tld)" },
      { error: "Duplicate email", fix: "Remove duplicate rows or they will be treated as updates" },
    ],
  },

  export: {
    query: async () => {
      const rows = await db.select().from(users);
      return rows.map((r) => ({
        email: r.email,
        username: r.username,
        displayName: r.displayName,
        role: r.role,
        isActive: r.isActive,
        createdAt: r.createdAt,
      }));
    },
  },

  templateRecords: [
    { email: "john.doe@example.com", displayName: "John Doe", role: "user" },
    { email: "jane.admin@example.com", displayName: "Jane Admin", role: "admin" },
  ],

  async postMapValidate(records) {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for superadmin role attempts
    for (let i = 0; i < records.length; i++) {
      if (String(records[i].role) === "superadmin") {
        errors.push(`Row ${i + 1}: Cannot bulk-import superadmin role (security restriction)`);
      }
    }

    // Check for duplicate emails within the import
    const emails = new Set<string>();
    for (let i = 0; i < records.length; i++) {
      const email = String(records[i].email).toLowerCase();
      if (emails.has(email)) {
        warnings.push(`Row ${i + 1}: Duplicate email "${email}" — later row will overwrite`);
      }
      emails.add(email);
    }

    return { errors, warnings };
  },

  async commit(records, ctx: ImportContext): Promise<CommitResult> {
    const now = new Date().toISOString();
    const errors: string[] = [];
    const warnings: string[] = [];
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    const logEntry = db
      .insert(unifiedImportLog)
      .values({
        importedAt: now,
        dataType: "users",
        source: ctx.source,
        format: ctx.format,
        fileName: ctx.fileName || null,
        importedBy: ctx.userId,
        status: "success",
        recordsTotal: records.length,
      })
      .returning({ id: unifiedImportLog.id })
      .get();
    const logId = logEntry.id;

    try {
      const existing = await db.select().from(users);
      const emailMap = new Map(existing.map((u) => [u.email.toLowerCase(), u]));

      for (const record of records) {
        const email = String(record.email ?? "")
          .toLowerCase()
          .trim();

        if (!email) {
          warnings.push("Skipping record with empty email");
          skipped++;
          continue;
        }

        const displayName = String(record.displayName).trim();
        const role = String(record.role || "user");
        const username = record.username ? String(record.username).trim() : null;

        // Security: prevent bulk superadmin creation
        if (role === "superadmin") {
          warnings.push(`Skipping "${email}": superadmin cannot be bulk-imported`);
          skipped++;
          continue;
        }

        const ex = emailMap.get(email);

        if (!ex) {
          // Generate temp password hash (random UUID — user must reset)
          const tempAuthId = crypto.randomUUID();
          // Use a random hash — user MUST change password on first login
          const tempHash = `$temp$${crypto.randomUUID()}`;

          db.insert(users)
            .values({
              authId: tempAuthId,
              email,
              username,
              displayName,
              passwordHash: tempHash,
              role: role as "user" | "admin" | "superadmin",
              isActive: record.isActive !== false,
              forcePasswordChange: true,
              tokenVersion: 0,
            })
            .run();
          inserted++;
        } else {
          // Update profile (NOT password)
          db.update(users)
            .set({
              displayName,
              username: username ?? ex.username,
              role: role as "user" | "admin" | "superadmin",
              isActive: record.isActive !== false,
              updatedAt: now,
            })
            .where(eq(users.id, ex.id))
            .run();
          updated++;
        }
      }

      db.update(unifiedImportLog)
        .set({
          recordsInserted: inserted,
          recordsUpdated: updated,
          recordsSkipped: skipped,
          warnings: warnings.length > 0 ? JSON.stringify(warnings) : null,
        })
        .where(eq(unifiedImportLog.id, logId))
        .run();

      log.info({ logId, inserted, updated, skipped }, "Users import committed");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(errMsg);
      log.error({ err, logId }, "Users import failed");
      db.update(unifiedImportLog)
        .set({ status: "failed", errors: JSON.stringify([errMsg]) })
        .where(eq(unifiedImportLog.id, logId))
        .run();
    }

    return {
      success: errors.length === 0,
      logId,
      recordsTotal: records.length,
      recordsInserted: inserted,
      recordsUpdated: updated,
      recordsSkipped: skipped,
      errors,
      warnings,
    };
  },
};

registerSchema(usersSchema);
