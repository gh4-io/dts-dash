"use client";

import { useEffect, useRef } from "react";
import type ReactEChartsCore from "echarts-for-react/lib/core";

/**
 * Shared helper: read current dataZoom state from header chart
 */
function readZoomState(headerRef: React.RefObject<ReactEChartsCore | null>) {
  const instance = headerRef.current?.getEchartsInstance();
  if (!instance) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opt = instance.getOption() as any;
  const dz = opt?.dataZoom?.[0];
  if (!dz) return null;
  return { start: dz.start as number, end: dz.end as number };
}

/**
 * Shared helper: dispatch zoom to both charts
 */
function dispatchZoom(
  headerRef: React.RefObject<ReactEChartsCore | null>,
  bodyRef: React.RefObject<ReactEChartsCore | null>,
  start: number,
  end: number,
) {
  [headerRef, bodyRef].forEach((r) => {
    r.current?.getEchartsInstance()?.dispatchAction({ type: "dataZoom", start, end });
  });
}

// ─── Ctrl+Scroll zoom / Shift+Scroll pan ───────────────────────────────

export function useWheelZoom(
  headerChartRef: React.RefObject<ReactEChartsCore | null>,
  bodyChartRef: React.RefObject<ReactEChartsCore | null>,
  deps: number, // workPackages.length — re-attach when chart rebuilds
) {
  useEffect(() => {
    const bodyEl = bodyChartRef.current?.getEchartsInstance()?.getDom();
    if (!bodyEl) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();

      const dz = readZoomState(headerChartRef);
      if (!dz) return;

      let { start, end } = dz;
      const span = end - start;

      if (e.ctrlKey) {
        const absDelta = Math.min(Math.abs(e.deltaY), 100);
        const rate = absDelta * 0.0015;
        const factor = e.deltaY > 0 ? 1 + rate : 1 / (1 + rate);
        const newSpan = Math.min(100, Math.max(1, span * factor));
        const center = (start + end) / 2;
        start = Math.max(0, center - newSpan / 2);
        end = Math.min(100, center + newSpan / 2);
      } else if (e.shiftKey) {
        const absDelta = Math.min(Math.abs(e.deltaY), 100);
        const shift = Math.sign(e.deltaY) * span * absDelta * 0.001;
        start = Math.max(0, Math.min(100 - span, start + shift));
        end = start + span;
      }

      dispatchZoom(headerChartRef, bodyChartRef, start, end);
    };

    bodyEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => bodyEl.removeEventListener("wheel", handleWheel);
  }, [deps]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ─── Click+drag pan (hand tool) ─────────────────────────────────────────

export function useDragPan(
  headerChartRef: React.RefObject<ReactEChartsCore | null>,
  bodyChartRef: React.RefObject<ReactEChartsCore | null>,
  panMode: boolean | undefined,
  deps: number,
) {
  const dragState = useRef<{
    startX: number;
    startPct: number;
    span: number;
    dragging: boolean;
  }>({ startX: 0, startPct: 0, span: 0, dragging: false });

  useEffect(() => {
    const bodyEl = bodyChartRef.current?.getEchartsInstance()?.getDom();
    if (!bodyEl) return;

    if (panMode) {
      bodyEl.style.cursor = "grab";
    } else {
      bodyEl.style.cursor = "";
    }

    if (!panMode) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const dz = readZoomState(headerChartRef);
      if (!dz) return;

      dragState.current = {
        startX: e.clientX,
        startPct: dz.start,
        span: dz.end - dz.start,
        dragging: true,
      };
      bodyEl.style.cursor = "grabbing";
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.current.dragging) return;
      const dx = e.clientX - dragState.current.startX;
      const chartWidth = bodyEl.clientWidth;
      const pctDelta = -(dx / chartWidth) * dragState.current.span * 1.5;
      let start = dragState.current.startPct + pctDelta;
      start = Math.max(0, Math.min(100 - dragState.current.span, start));
      const end = start + dragState.current.span;
      dispatchZoom(headerChartRef, bodyChartRef, start, end);
    };

    const handleMouseUp = () => {
      if (dragState.current.dragging) {
        dragState.current.dragging = false;
        bodyEl.style.cursor = "grab";
      }
    };

    bodyEl.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      bodyEl.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      bodyEl.style.cursor = "";
    };
  }, [panMode, deps]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ─── Touch pinch-to-zoom + two-finger pan ───────────────────────────────

/** Minimum px distance change before pinch gesture activates (dead zone) */
const PINCH_DEAD_ZONE = 8;

interface PointerState {
  id: number;
  x: number;
  y: number;
}

export function useTouchGestures(
  headerChartRef: React.RefObject<ReactEChartsCore | null>,
  bodyChartRef: React.RefObject<ReactEChartsCore | null>,
  deps: number,
) {
  const pointers = useRef<PointerState[]>([]);
  const initialPinch = useRef<{
    distance: number;
    centerX: number;
    start: number;
    end: number;
  } | null>(null);
  const gestureActive = useRef(false);
  const rafPending = useRef(false);
  const pendingZoom = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    const bodyEl = bodyChartRef.current?.getEchartsInstance()?.getDom();
    if (!bodyEl) return;

    const getDistance = (a: PointerState, b: PointerState) => Math.hypot(a.x - b.x, a.y - b.y);

    const getCenterX = (a: PointerState, b: PointerState) => (a.x + b.x) / 2;

    const updatePointer = (e: PointerEvent) => {
      const idx = pointers.current.findIndex((p) => p.id === e.pointerId);
      if (idx >= 0) {
        pointers.current[idx] = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }
    };

    // RAF-throttled dispatch — at most one dispatchZoom per animation frame
    const flushZoom = () => {
      rafPending.current = false;
      if (pendingZoom.current) {
        dispatchZoom(
          headerChartRef,
          bodyChartRef,
          pendingZoom.current.start,
          pendingZoom.current.end,
        );
        pendingZoom.current = null;
      }
    };

    const scheduleZoom = (start: number, end: number) => {
      pendingZoom.current = { start, end };
      if (!rafPending.current) {
        rafPending.current = true;
        requestAnimationFrame(flushZoom);
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;

      // Cap at 2 tracked pointers — ignore 3+ finger touches
      if (pointers.current.length >= 2) return;

      pointers.current.push({ id: e.pointerId, x: e.clientX, y: e.clientY });

      // When two fingers land, snapshot the initial state
      if (pointers.current.length === 2) {
        gestureActive.current = false; // not active until dead zone exceeded
        const dz = readZoomState(headerChartRef);
        if (dz) {
          initialPinch.current = {
            distance: getDistance(pointers.current[0], pointers.current[1]),
            centerX: getCenterX(pointers.current[0], pointers.current[1]),
            start: dz.start,
            end: dz.end,
          };
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      updatePointer(e);

      if (pointers.current.length !== 2 || !initialPinch.current) return;

      const [a, b] = pointers.current;
      const currentDist = getDistance(a, b);
      const currentCenterX = getCenterX(a, b);
      const {
        distance: initDist,
        centerX: initCenterX,
        start: initStart,
        end: initEnd,
      } = initialPinch.current;

      // Dead zone: ignore tiny movements to prevent jitter at gesture start
      if (!gestureActive.current) {
        const distDelta = Math.abs(currentDist - initDist);
        const panDelta = Math.abs(currentCenterX - initCenterX);
        if (distDelta < PINCH_DEAD_ZONE && panDelta < PINCH_DEAD_ZONE) return;
        gestureActive.current = true;
      }

      e.preventDefault();

      const initSpan = initEnd - initStart;
      const initCenter = (initStart + initEnd) / 2;

      // Pinch zoom: distance ratio → new span
      const scale = initDist / Math.max(currentDist, 1);
      const newSpan = Math.min(100, Math.max(1, initSpan * scale));

      // Two-finger pan: center point delta → dataZoom shift
      const chartWidth = bodyEl.clientWidth;
      const panDeltaPx = currentCenterX - initCenterX;
      const panDeltaPct = -(panDeltaPx / chartWidth) * initSpan;

      const zoomedCenter = initCenter + panDeltaPct;
      let start = Math.max(0, zoomedCenter - newSpan / 2);
      let end = Math.min(100, zoomedCenter + newSpan / 2);

      if (start <= 0) {
        start = 0;
        end = Math.min(100, newSpan);
      }
      if (end >= 100) {
        end = 100;
        start = Math.max(0, 100 - newSpan);
      }

      scheduleZoom(start, end);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      pointers.current = pointers.current.filter((p) => p.id !== e.pointerId);
      if (pointers.current.length < 2) {
        initialPinch.current = null;
        gestureActive.current = false;
      }
    };

    const handlePointerCancel = handlePointerUp;

    // pan-y: allow single-finger vertical scroll natively.
    // The browser won't handle pinch-zoom with pan-y, so our pointer events
    // fire for two-finger gestures without needing dynamic touch-action switching.
    const prevTouchAction = bodyEl.style.touchAction;
    bodyEl.style.touchAction = "pan-y";

    bodyEl.addEventListener("pointerdown", handlePointerDown);
    bodyEl.addEventListener("pointermove", handlePointerMove, { passive: false });
    bodyEl.addEventListener("pointerup", handlePointerUp);
    bodyEl.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      bodyEl.removeEventListener("pointerdown", handlePointerDown);
      bodyEl.removeEventListener("pointermove", handlePointerMove);
      bodyEl.removeEventListener("pointerup", handlePointerUp);
      bodyEl.removeEventListener("pointercancel", handlePointerCancel);
      bodyEl.style.touchAction = prevTouchAction;
      pointers.current = [];
      initialPinch.current = null;
      gestureActive.current = false;
    };
  }, [deps]); // eslint-disable-line react-hooks/exhaustive-deps
}
