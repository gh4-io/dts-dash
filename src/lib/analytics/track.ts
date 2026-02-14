/**
 * Event Tracking Utility
 * Client-side analytics tracking
 * Fire-and-forget (never blocks UI)
 */

export interface TrackEventProps {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Track an analytics event
 * Sends event to /api/analytics/events
 * Fire-and-forget: never throws, never blocks
 *
 * @param eventType - Event type (e.g., "page_view", "filter_change")
 * @param props - Additional event properties
 */
export function trackEvent(eventType: string, props?: TrackEventProps): void {
  // Don't track in development (optional - remove if you want dev tracking)
  if (process.env.NODE_ENV === "development") {
    console.log(`[analytics] ${eventType}`, props);
    return;
  }

  // Fire and forget
  fetch("/api/analytics/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventType,
      props: props ?? {},
    }),
  }).catch((error) => {
    // Silently fail - never block UI
    console.warn("[analytics] Failed to track event:", error);
  });
}

/**
 * Track page view
 * Convenience wrapper for page_view events
 */
export function trackPageView(page: string, props?: TrackEventProps): void {
  trackEvent("page_view", { page, ...props });
}

/**
 * Track filter change
 * Convenience wrapper for filter_change events
 */
export function trackFilterChange(filters: TrackEventProps): void {
  trackEvent("filter_change", filters);
}

/**
 * Track user action
 * Convenience wrapper for user actions
 */
export function trackAction(action: string, props?: TrackEventProps): void {
  trackEvent(`action_${action}`, props);
}
