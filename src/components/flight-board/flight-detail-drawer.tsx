"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useFilters } from "@/lib/hooks/use-filters";
import { useSession } from "next-auth/react";
import type { SerializedWorkPackage } from "@/lib/hooks/use-work-packages";
import type { FlightComment, GroundEventType } from "@/types";
import { GROUND_EVENTS, GROUND_EVENT_TYPES } from "@/lib/utils/ground-events";
import { FOCUS_SCOPES, focusHref, type FocusScope } from "@/lib/utils/flight-board-focus";
import { buildFilterUrlParams } from "@/lib/utils/filter-helpers";
import { trackAction } from "@/lib/analytics/track";

interface FlightDetailDrawerProps {
  wp: SerializedWorkPackage | null;
  open: boolean;
  onClose: () => void;
  onWpUpdated?: () => void;
}

export function FlightDetailDrawer({ wp, open, onClose, onWpUpdated }: FlightDetailDrawerProps) {
  const { getColor } = useCustomers();
  const { timezone } = useFilters();
  const { data: session } = useSession();

  const [comments, setComments] = useState<FlightComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [groundEvents, setGroundEvents] = useState<GroundEventType[]>([]);
  const [savingEvents, setSavingEvents] = useState(false);

  // MH override editing (OI-104)
  const [overrideInput, setOverrideInput] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideMessage, setOverrideMessage] = useState<string | null>(null);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "superadmin";
  const userId = session?.user?.id ? Number(session.user.id) : null;

  // Fetch comments when drawer opens
  const fetchComments = useCallback(async () => {
    if (!wp) return;
    try {
      const res = await fetch(`/api/work-packages/${wp.id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch {
      // ignore fetch errors
    }
  }, [wp]);

  // Reset local edit state when a *different* work package is shown, not on
  // every re-render of the same one. The parent re-reads `wp` from the store
  // after each save, so keying off object identity would wipe the confirmation
  // message the save just produced.
  const shownWpId = useRef<number | null>(null);

  useEffect(() => {
    if (!open || !wp) {
      shownWpId.current = null;
      return;
    }
    if (shownWpId.current === wp.id) return;
    shownWpId.current = wp.id;

    fetchComments();
    setGroundEvents((wp.groundEventTypes as GroundEventType[]) ?? []);
    setCommentBody("");
    setReplyingTo(null);
    setReplyBody("");
    setOverrideInput(wp.manualMHOverride !== null ? String(wp.manualMHOverride) : "");
    setOverrideMessage(null);
    setOverrideError(null);
  }, [open, wp, fetchComments]);

  if (!wp) return null;

  const arrival = new Date(wp.arrival);
  const departure = new Date(wp.departure);
  const groundH = Math.floor(wp.groundHours);
  const groundM = Math.round((wp.groundHours - groundH) * 60);

  const tzLabel = timezone === "UTC" ? "UTC" : "ET";
  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: timezone,
    }) +
    " " +
    d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    }) +
    ` ${tzLabel}`;

  const mhLabel =
    wp.mhSource === "manual"
      ? "Override"
      : wp.mhSource === "workpackage"
        ? "WP MH"
        : wp.mhSource === "contract"
          ? "Contract"
          : "Default";

  const color = getColor(wp.customer);

  // Toggle ground event pill
  const toggleGroundEvent = async (type: GroundEventType) => {
    if (!isAdmin || savingEvents) return;
    const updated = groundEvents.includes(type)
      ? groundEvents.filter((t) => t !== type)
      : [...groundEvents, type];

    setSavingEvents(true);
    try {
      const res = await fetch(`/api/work-packages/${wp.id}/ground-event`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groundEventTypes: updated }),
      });
      if (res.ok) {
        setGroundEvents(updated);
        onWpUpdated?.();
      }
    } finally {
      setSavingEvents(false);
    }
  };

  // Save or clear the manual MH override (OI-104).
  // The server owns the redundancy rule — a value equal to the imported WP MH
  // clears the override instead of storing it — so the response tells us what
  // actually happened rather than the client assuming.
  const submitOverride = async (mode: "save" | "clear") => {
    if (!isAdmin || savingOverride) return;
    setSavingOverride(true);
    setOverrideMessage(null);
    setOverrideError(null);

    try {
      const res = await fetch(
        `/api/admin/mh-overrides/${wp.id}`,
        mode === "clear"
          ? { method: "DELETE" }
          : {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ overrideMH: overrideInput }),
            },
      );

      const data = await res.json();
      if (!res.ok) {
        setOverrideError(data.error ?? "Failed to update override");
        return;
      }

      setOverrideMessage(data.decision?.reason ?? "Saved");
      if (data.detail?.overrideMH === null || data.detail?.overrideMH === undefined) {
        setOverrideInput("");
      }
      onWpUpdated?.();
    } catch {
      setOverrideError("Failed to update override");
    } finally {
      setSavingOverride(false);
    }
  };

  // Post a comment
  const postComment = async (parentId: number | null, body: string) => {
    if (!body.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/work-packages/${wp.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), parentId }),
      });
      if (res.ok) {
        await fetchComments();
        onWpUpdated?.();
        if (parentId === null) {
          setCommentBody("");
        } else {
          setReplyingTo(null);
          setReplyBody("");
        }
      }
    } finally {
      setPosting(false);
    }
  };

  // Delete a comment
  const deleteComment = async (commentId: number) => {
    try {
      const res = await fetch(`/api/work-packages/${wp.id}/comments?commentId=${commentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchComments();
        onWpUpdated?.();
      }
    } catch {
      // ignore
    }
  };

  // Build nested comment tree
  const rootComments = comments.filter((c) => c.parentId === null);
  const repliesMap = new Map<number, FlightComment[]>();
  for (const c of comments) {
    if (c.parentId !== null) {
      const arr = repliesMap.get(c.parentId) ?? [];
      arr.push(c);
      repliesMap.set(c.parentId, arr);
    }
  }

  const canDeleteComment = (c: FlightComment) =>
    isAdmin || (userId !== null && c.authorId === userId);

  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[400px] overflow-y-auto sm:w-[440px] px-6">
        <SheetHeader>
          <SheetTitle>Workpackage Detail</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Aircraft Section */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Aircraft</h3>
            <div className="space-y-1.5 text-sm">
              <Row label="Registration" value={wp.aircraftReg} bold />
              <Row label="Customer">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {wp.customer}
                </span>
              </Row>
              <Row label="Type" value={wp.inferredType} />
              <FocusLink scope="aircraft" subject={wp.aircraftReg} onNavigate={onClose} />
            </div>
          </section>

          <Separator />

          {/* Schedule Section */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Schedule</h3>
            <div className="space-y-1.5 text-sm">
              {wp.flightId && <Row label="Flight ID" value={wp.flightId} />}
              <Row label="Arrival" value={fmtDate(arrival)} />
              <Row label="Departure" value={fmtDate(departure)} />
              <Row label="Ground Time" value={`${groundH}h ${groundM}m`} />
              <Row label="Status">
                <Badge variant="secondary" className="text-xs">
                  {wp.status}
                </Badge>
              </Row>
            </div>
          </section>

          <Separator />

          {/* Work Package Section */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Work Package
            </h3>
            <div className="space-y-1.5 text-sm">
              <Row label="WP Number" value={wp.workpackageNo ?? "—"} />
              <Row label="Has WP">
                <Badge variant={wp.hasWorkpackage ? "default" : "secondary"} className="text-xs">
                  {wp.hasWorkpackage ? "Yes" : "No"}
                </Badge>
              </Row>
              <Row label="Imported MH" value={wp.totalMH === null ? "—" : `${wp.totalMH} MH`} />
              <Row label="Effective MH" value={`${wp.effectiveMH} MH`} bold />
              <Row label="MH Source">
                <Badge
                  variant={wp.mhSource === "manual" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {mhLabel}
                </Badge>
              </Row>
            </div>

            {/* Manual override editor (OI-104) — admin only */}
            {isAdmin && (
              <div className="mt-3 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Manual Override</span>
                  {wp.manualMHOverride !== null && (
                    <span className="text-[10px] text-muted-foreground">
                      active — {wp.manualMHOverride} MH
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    inputMode="decimal"
                    placeholder="MH"
                    value={overrideInput}
                    onChange={(e) => setOverrideInput(e.target.value)}
                    className="h-8 w-24 text-sm"
                    disabled={savingOverride}
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    disabled={savingOverride || overrideInput.trim() === ""}
                    onClick={() => submitOverride("save")}
                  >
                    Save Override
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={savingOverride || wp.manualMHOverride === null}
                    onClick={() => submitOverride("clear")}
                  >
                    Clear
                  </Button>
                </div>

                <p className="mt-2 text-[10px] text-muted-foreground">
                  Override beats WP MH, contract MH and the default. Entering the imported value (
                  {wp.totalMH === null ? "none" : `${wp.totalMH} MH`}) clears the override instead
                  of storing a copy of it.
                </p>

                {overrideMessage && (
                  <p className="mt-1 text-[10px] text-emerald-500">{overrideMessage}</p>
                )}
                {overrideError && (
                  <p className="mt-1 text-[10px] text-destructive">{overrideError}</p>
                )}
              </div>
            )}
          </section>

          <Separator />

          {/* Ground Events Section */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Ground Events
            </h3>
            <div className="flex flex-wrap gap-2">
              {GROUND_EVENT_TYPES.map((type) => {
                const meta = GROUND_EVENTS[type];
                const active = groundEvents.includes(type);
                return (
                  <button
                    key={type}
                    disabled={!isAdmin || savingEvents}
                    onClick={() => toggleGroundEvent(type)}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors
                      ${
                        active
                          ? "text-white border border-transparent"
                          : "border text-muted-foreground"
                      }
                      ${isAdmin ? "cursor-pointer hover:opacity-80" : "cursor-default"}
                    `}
                    style={
                      active
                        ? { backgroundColor: meta.color, borderColor: meta.color }
                        : { borderColor: "hsl(var(--border))" }
                    }
                    title={meta.description}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
            {!isAdmin && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Admin access required to modify
              </p>
            )}
          </section>

          {wp.calendarComments && (
            <>
              <Separator />
              <section>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Notes
                </h3>
                <p className="text-sm italic text-muted-foreground">
                  &ldquo;{wp.calendarComments}&rdquo;
                </p>
              </section>
            </>
          )}

          <Separator />

          {/* Comments Section */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Comments ({comments.length})
            </h3>

            {/* Comment thread */}
            <div className="max-h-64 overflow-y-auto space-y-3 mb-3">
              {rootComments.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No comments yet.</p>
              )}
              {rootComments.map((c) => (
                <CommentNode
                  key={c.id}
                  comment={c}
                  replies={repliesMap}
                  canDelete={canDeleteComment}
                  onDelete={deleteComment}
                  onReply={(id) => {
                    setReplyingTo(id);
                    setReplyBody("");
                  }}
                  replyingTo={replyingTo}
                  replyBody={replyBody}
                  setReplyBody={setReplyBody}
                  onPostReply={(parentId) => postComment(parentId, replyBody)}
                  posting={posting}
                  relativeTime={relativeTime}
                  depth={0}
                />
              ))}
            </div>

            {/* New comment form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                postComment(null, commentBody);
              }}
              className="flex gap-2"
            >
              <Textarea
                placeholder="Add a comment..."
                rows={2}
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                className="text-sm min-h-[60px]"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!commentBody.trim() || posting}
                className="shrink-0 self-end"
              >
                Post
              </Button>
            </form>
          </section>

          <Separator />

          {/* Linked Information */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Linked Information
            </h3>
            <div className="space-y-1.5">
              <FocusLink scope="operator" subject={wp.customer} onNavigate={onClose} />
            </div>
          </section>

          {/* Metadata footer */}
          <div className="pt-2 text-xs text-muted-foreground">
            ID: {wp.id} · Document Set: {wp.documentSetId}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Nested Comment Component ─────────────────────────────────────────────

function CommentNode({
  comment,
  replies,
  canDelete,
  onDelete,
  onReply,
  replyingTo,
  replyBody,
  setReplyBody,
  onPostReply,
  posting,
  relativeTime,
  depth,
}: {
  comment: FlightComment;
  replies: Map<number, FlightComment[]>;
  canDelete: (c: FlightComment) => boolean;
  onDelete: (id: number) => void;
  onReply: (id: number) => void;
  replyingTo: number | null;
  replyBody: string;
  setReplyBody: (v: string) => void;
  onPostReply: (parentId: number) => void;
  posting: boolean;
  relativeTime: (iso: string) => string;
  depth: number;
}) {
  const childReplies = replies.get(comment.id) ?? [];
  const maxDepth = 3;

  return (
    <div className={depth > 0 ? "ml-4 border-l border-border pl-3" : ""}>
      <div className="text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-xs">{comment.authorName}</span>
          <span className="text-[10px] text-muted-foreground">
            {relativeTime(comment.createdAt)}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {depth < maxDepth && (
              <button
                className="text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => onReply(comment.id)}
              >
                Reply
              </button>
            )}
            {canDelete(comment) && (
              <button
                className="text-[10px] text-destructive hover:text-destructive/80"
                onClick={() => onDelete(comment.id)}
              >
                Delete
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap break-words">
          {comment.body}
        </p>
      </div>

      {/* Inline reply form */}
      {replyingTo === comment.id && (
        <div className="mt-2 flex gap-2">
          <Textarea
            placeholder="Reply..."
            rows={1}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            className="text-sm min-h-[36px]"
            autoFocus
          />
          <div className="flex flex-col gap-1 shrink-0">
            <Button
              size="sm"
              className="text-xs h-7"
              disabled={!replyBody.trim() || posting}
              onClick={() => onPostReply(comment.id)}
            >
              Reply
            </Button>
            <button
              className="text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => onReply(-1)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Nested replies */}
      {childReplies.length > 0 && (
        <div className="mt-2 space-y-2">
          {childReplies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              replies={replies}
              canDelete={canDelete}
              onDelete={onDelete}
              onReply={onReply}
              replyingTo={replyingTo}
              replyBody={replyBody}
              setReplyBody={setReplyBody}
              onPostReply={onPostReply}
              posting={posting}
              relativeTime={relativeTime}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────────────────

function Row({
  label,
  value,
  bold,
  children,
}: {
  label: string;
  value?: string;
  bold?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      {children ?? <span className={bold ? "font-semibold" : ""}>{value}</span>}
    </div>
  );
}

/**
 * Navigates to the Focus view for one aircraft or operator.
 *
 * A real `<Link>`, not a filter mutation: it pushes a history entry (so Back
 * returns to the board), carries the current date window across in the query
 * string, and leaves the shared filter store untouched — which is what stops
 * the selection following the user around. It also makes middle-click and
 * open-in-new-tab work.
 */
function FocusLink({
  scope,
  subject,
  onNavigate,
}: {
  scope: FocusScope;
  subject: string;
  onNavigate: () => void;
}) {
  const filters = useFilters();
  const label = FOCUS_SCOPES[scope].label(subject);
  // Build the window from the store rather than the current URL: the store→URL
  // mirror is debounced, so the address bar can still be bare on first load and
  // the link would carry no dates at all. This also makes the href meaningful
  // when opened in a new tab.
  const href = focusHref(scope, subject, buildFilterUrlParams(filters));
  return (
    <Link
      href={href}
      className="block text-xs text-primary hover:underline"
      onClick={() => {
        trackAction("focus_link_follow", { scope, subject });
        onNavigate();
      }}
    >
      → {label}
    </Link>
  );
}
