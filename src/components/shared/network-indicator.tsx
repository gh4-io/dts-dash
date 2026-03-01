"use client";

import { useEffect, useState } from "react";

interface NavigatorConnection extends EventTarget {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  addEventListener: (event: string, handler: EventListener) => void;
  removeEventListener: (event: string, handler: EventListener) => void;
}

export function NetworkIndicator() {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window === "undefined") return true;
    return navigator.onLine;
  });
  const [isSlowNetwork, setIsSlowNetwork] = useState(() => {
    if (typeof window === "undefined" || !("connection" in navigator)) {
      return false;
    }
    const conn = navigator.connection as NavigatorConnection;
    return conn.effectiveType === "2g" || conn.effectiveType === "3g";
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Detect slow network (optional)
    if ("connection" in navigator) {
      const conn = navigator.connection as NavigatorConnection;

      const handleConnectionChange = () => {
        if (conn.effectiveType) {
          const isSlow = conn.effectiveType === "2g" || conn.effectiveType === "3g";
          setIsSlowNetwork(isSlow);
        }
      };

      conn.addEventListener("change", handleConnectionChange);

      return () => {
        conn.removeEventListener("change", handleConnectionChange);
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !isSlowNetwork) {
    return null;
  }

  return (
    <div className="bg-amber-600 text-white px-3 py-2 text-xs flex items-center gap-2 justify-center">
      {!isOnline ? (
        <>
          <i className="fa-solid fa-wifi-slash" />
          <span>You are offline</span>
        </>
      ) : (
        <>
          <i className="fa-solid fa-wifi" />
          <span>Slow network detected</span>
        </>
      )}
    </div>
  );
}
