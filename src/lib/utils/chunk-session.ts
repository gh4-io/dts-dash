/**
 * In-memory chunk session manager for Microsoft Power Automate chunked uploads.
 *
 * When PA has chunking enabled, it splits large payloads into multiple requests:
 * 1. POST with x-ms-transfer-mode: chunked (empty body) → server returns Location
 * 2. PATCH to Location with Content-Range chunks
 * 3. Server assembles chunks and processes on final chunk
 *
 * Sessions are stored in-memory (same pattern as rate-limit.ts).
 * Lazy cleanup evicts expired sessions on new session creation.
 * Resets on server restart — PA will retry the full upload.
 */

import { createChildLogger } from "@/lib/logger";
import crypto from "crypto";

const log = createChildLogger("chunk-session");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChunkSession {
  id: string;
  expectedSize: number; // from x-ms-content-length
  receivedBytes: number; // running total
  chunks: Buffer[]; // ordered chunk buffers
  createdAt: number; // Date.now()
  keyHash: string; // API key hash (ownership verification)
  idempotencyKey: string | null;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const sessions = new Map<string, ChunkSession>();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new chunk upload session.
 * Performs lazy cleanup of expired sessions first.
 */
export function createChunkSession(
  expectedSize: number,
  keyHash: string,
  idempotencyKey: string | null,
  timeoutMs: number,
): ChunkSession {
  cleanupExpiredSessions(timeoutMs);

  const id = crypto.randomUUID();
  const session: ChunkSession = {
    id,
    expectedSize,
    receivedBytes: 0,
    chunks: [],
    createdAt: Date.now(),
    keyHash,
    idempotencyKey,
  };

  sessions.set(id, session);
  log.info({ sessionId: id, expectedSize }, "Chunk session created");
  return session;
}

/**
 * Retrieve a session by ID. Returns null if not found or expired.
 */
export function getChunkSession(sessionId: string, timeoutMs: number): ChunkSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  if (Date.now() - session.createdAt > timeoutMs) {
    sessions.delete(sessionId);
    log.warn({ sessionId }, "Chunk session expired");
    return null;
  }

  return session;
}

/**
 * Append a chunk to the session.
 * Validates that rangeStart matches current receivedBytes (sequential ordering).
 * Returns the new total received bytes.
 */
export function appendChunk(
  sessionId: string,
  chunk: Buffer,
  rangeStart: number,
  rangeEnd: number,
): number {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("Session not found");

  if (rangeStart !== session.receivedBytes) {
    throw new Error(`Expected chunk starting at byte ${session.receivedBytes}, got ${rangeStart}`);
  }

  session.chunks.push(chunk);
  session.receivedBytes += chunk.length;

  log.info(
    {
      sessionId,
      rangeStart,
      rangeEnd,
      receivedBytes: session.receivedBytes,
      expectedSize: session.expectedSize,
    },
    "Chunk appended",
  );

  return session.receivedBytes;
}

/**
 * Check if all expected bytes have been received.
 */
export function isComplete(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  return session.receivedBytes >= session.expectedSize;
}

/**
 * Assemble all chunks into a single UTF-8 string. Deletes the session.
 * Uses Buffer.concat to handle multi-byte characters split across chunks.
 */
export function assembleAndDelete(sessionId: string): string {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("Session not found");

  const assembled = Buffer.concat(session.chunks).toString("utf-8");
  sessions.delete(sessionId);

  log.info({ sessionId, totalBytes: assembled.length }, "Chunk session assembled and deleted");

  return assembled;
}

/**
 * Delete a session (error cleanup).
 */
export function deleteSession(sessionId: string): void {
  if (sessions.has(sessionId)) {
    sessions.delete(sessionId);
    log.info({ sessionId }, "Chunk session deleted");
  }
}

/**
 * Get count of active sessions (for diagnostics/health checks).
 */
export function getActiveSessionCount(): number {
  return sessions.size;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function cleanupExpiredSessions(timeoutMs: number): void {
  const now = Date.now();
  let cleaned = 0;
  for (const [id, session] of sessions) {
    if (now - session.createdAt > timeoutMs) {
      sessions.delete(id);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    log.info({ cleaned }, "Expired chunk sessions cleaned up");
  }
}
