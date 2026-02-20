/**
 * Extract the integer user ID from an Auth.js session.
 * session.user.id is a stringified integer (Auth.js requires string type).
 */
export function getSessionUserId(session: { user: { id: string } }): number {
  const id = Number(session.user.id);
  if (isNaN(id) || !Number.isInteger(id) || id < 1) {
    throw new Error("Invalid session user ID");
  }
  return id;
}
