"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

const STORAGE_KEY = "ios-install-dismissed";
const AUTO_DISMISS_MS = 30_000;

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;

  const ua = navigator.userAgent;

  // Must be an iOS device
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIos) return false;

  // Must NOT be Chrome, Firefox, or other in-app browsers on iOS
  const isChrome = /CriOS/.test(ua);
  const isFirefox = /FxiOS/.test(ua);
  const isEdge = /EdgiOS/.test(ua);
  if (isChrome || isFirefox || isEdge) return false;

  return true;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;

  // iOS-specific standalone check (Safari-only property, not in standard typings)
  if (
    "standalone" in navigator &&
    (navigator as unknown as { standalone: boolean }).standalone === true
  )
    return true;

  // Generic display-mode check
  if (window.matchMedia("(display-mode: standalone)").matches) return true;

  return false;
}

function wasDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // localStorage may be unavailable in private browsing
  }
}

export function IosInstallPrompt() {
  const [visible, setVisible] = useState(false);

  const dismiss = () => {
    setVisible(false);
    saveDismissed();
  };

  useEffect(() => {
    // Determine eligibility after mount (client-only checks)
    if (!isIosSafari() || isStandalone() || wasDismissed()) return;

    // Small delay so the banner animates in after page paint
    const showTimer = setTimeout(() => setVisible(true), 500);

    // Auto-dismiss after 30 seconds
    const autoDismissTimer = setTimeout(() => {
      saveDismissed();
      setVisible(false);
    }, AUTO_DISMISS_MS + 500);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(autoDismissTimer);
    };
  }, []);

  // Render nothing on server and when not visible on non-iOS
  // We still render the container when eligible but transitioning out
  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed left-3 right-3 z-40 animate-in slide-in-from-bottom duration-300",
        // Position above the bottom tab bar (~56px + safe area) with some breathing room
        "bottom-[calc(70px+env(safe-area-inset-bottom))]",
      )}
      role="alert"
    >
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
        {/* iOS Share icon */}
        <i className="fa-solid fa-arrow-up-from-bracket text-lg text-primary shrink-0" />

        {/* Instruction text */}
        <p className="flex-1 text-sm text-foreground leading-snug">
          Install this app: tap <span className="font-semibold">Share</span> then{" "}
          <span className="font-semibold">Add to Home Screen</span>
        </p>

        {/* Dismiss button */}
        <button
          onClick={dismiss}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Dismiss install prompt"
          type="button"
        >
          <i className="fa-solid fa-xmark text-sm" />
        </button>
      </div>
    </div>
  );
}
