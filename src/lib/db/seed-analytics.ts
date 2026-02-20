/**
 * Seed sample analytics events for development testing.
 * Run: npx tsx src/lib/db/seed-analytics.ts
 */
import { db } from "./client";
import { analyticsEvents, users } from "./schema";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("seed-analytics");

const EVENT_TYPES = [
  "page_view",
  "page_view",
  "page_view",
  "page_view",
  "filter_change",
  "filter_change",
  "data_import",
  "login",
  "action_export_csv",
  "error",
];

const PAGES = [
  "/dashboard",
  "/dashboard",
  "/dashboard",
  "/flight-board",
  "/flight-board",
  "/capacity",
  "/settings",
  "/admin",
  "/admin/customers",
  "/admin/import",
  "/admin/users",
  "/admin/analytics",
  "/account",
];

async function seedAnalytics() {
  log.info("Seeding analytics events...");

  // Get first user ID
  const allUsers = db.select().from(users).all();
  if (allUsers.length === 0) {
    log.error("No users found. Run the main seed first: npx tsx src/lib/db/seed.ts");
    process.exit(1);
  }

  const userIds = allUsers.map((u) => u.id);
  const now = Date.now();
  const DAY_MS = 86400000;

  const events: Array<{
    userId: number;
    eventType: string;
    eventData: string | null;
    page: string | null;
    createdAt: string;
  }> = [];

  // Generate ~60 events spread across the last 14 days
  for (let i = 0; i < 60; i++) {
    const daysAgo = Math.floor(Math.random() * 14);
    const hourOffset = Math.floor(Math.random() * 24) * 3600000;
    const timestamp = new Date(now - daysAgo * DAY_MS + hourOffset);

    const eventType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
    const page = PAGES[Math.floor(Math.random() * PAGES.length)];
    const userId = userIds[Math.floor(Math.random() * userIds.length)];

    let eventData: string | null = null;
    if (eventType === "page_view") {
      eventData = JSON.stringify({ page });
    } else if (eventType === "filter_change") {
      eventData = JSON.stringify({ operators: ["Kalitta Air"], timezone: "UTC" });
    } else if (eventType === "data_import") {
      eventData = JSON.stringify({
        recordCount: Math.floor(Math.random() * 100) + 10,
        source: "paste",
      });
    } else if (eventType === "error") {
      eventData = JSON.stringify({ message: "Sample error for testing", page });
    }

    events.push({
      userId,
      eventType,
      eventData,
      page: eventType === "page_view" ? page : null,
      createdAt: timestamp.toISOString(),
    });
  }

  // Insert in batch
  db.insert(analyticsEvents).values(events).run();

  log.info(`Seeded ${events.length} analytics events across 14 days`);
  log.info("Done.");
}

seedAnalytics().catch((err) => log.error({ err }, "Seed analytics failed"));
