import { RefObject, useEffect, useRef, useState } from "react";

interface Options {
  onRefresh: () => void | Promise<void>;
  /** Pull distance (px) at which release triggers the refresh. */
  threshold?: number;
  /** Maximum visual pull distance — drag past this is dampened. */
  maxPull?: number;
  /** Skip touch handlers if false. Use to disable on desktop. */
  enabled?: boolean;
}

interface State {
  /** Current visible pull distance in px. 0 when not pulling. */
  pullDistance: number;
  /** True once the refresh has been triggered until the page reloads. */
  isRefreshing: boolean;
  /** True once the user has crossed the threshold and a release will trigger. */
  reachedThreshold: boolean;
}

// Pull-to-refresh on a passed scroll container. iOS standalone PWAs lack the
// native gesture so we synthesize it here. Only activates when the container
// is already scrolled to the top AND the gesture is predominantly vertical
// (so WeekView's horizontal swipes don't get hijacked).
export function usePullToRefresh(
  scrollRef: RefObject<HTMLElement>,
  { onRefresh, threshold = 80, maxPull = 140, enabled = true }: Options,
): State {
  const [state, setState] = useState<State>({
    pullDistance: 0,
    isRefreshing: false,
    reachedThreshold: false,
  });

  // Refs to avoid re-binding event listeners on every render.
  const trackingRef = useRef(false);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const directionLockedRef = useRef<"vertical" | "horizontal" | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only consider single-finger pulls and only when already at the top.
      if (e.touches.length !== 1) return;
      if (el.scrollTop > 0) return;
      trackingRef.current = true;
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      directionLockedRef.current = null;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!trackingRef.current) return;
      const touch = e.touches[0];
      const deltaY = touch.clientY - startYRef.current;
      const deltaX = touch.clientX - startXRef.current;

      // Lock direction once movement is meaningful so horizontal swipes
      // (e.g. WeekView) don't trigger a fake pull-down.
      if (directionLockedRef.current === null && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
        directionLockedRef.current = Math.abs(deltaY) > Math.abs(deltaX) ? "vertical" : "horizontal";
      }
      if (directionLockedRef.current === "horizontal") return;

      // Ignore upward drags entirely.
      if (deltaY <= 0) {
        if (state.pullDistance !== 0) setState(s => ({ ...s, pullDistance: 0, reachedThreshold: false }));
        return;
      }

      // Dampen past the threshold so the indicator never feels boundless.
      const damped = deltaY < maxPull
        ? deltaY
        : maxPull + (deltaY - maxPull) * 0.2;

      // Block native scroll/rubber-band so the indicator owns the gesture.
      if (e.cancelable) e.preventDefault();

      setState(s => ({
        ...s,
        pullDistance: damped,
        reachedThreshold: damped >= threshold,
      }));
    };

    const handleTouchEnd = () => {
      if (!trackingRef.current) return;
      trackingRef.current = false;
      directionLockedRef.current = null;

      setState(s => {
        if (s.reachedThreshold && !s.isRefreshing) {
          // Fire after state update; setTimeout(0) is enough.
          setTimeout(() => onRefresh(), 0);
          return { pullDistance: threshold, isRefreshing: true, reachedThreshold: true };
        }
        return { pullDistance: 0, isRefreshing: false, reachedThreshold: false };
      });
    };

    // `passive: false` on touchmove so we can preventDefault — that's what
    // lets us suppress iOS's native overscroll while we own the gesture.
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
    };
    // onRefresh / threshold / maxPull are stable from the caller's
    // perspective (the consumer holds them in a hook), so we intentionally
    // skip them in deps to avoid re-binding listeners on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRef, enabled]);

  return state;
}
