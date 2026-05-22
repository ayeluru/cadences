import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PERSISTED_CACHE_KEY } from "@/lib/queryClient";

// "Hard reload" — what every web app needs but iOS standalone PWAs lack a
// gesture for. Nukes every layer of cache between the user and a fresh page:
//   1. React Query in-memory cache (queryClient.clear).
//   2. Persisted React Query cache in localStorage.
//   3. Any waiting service worker (skipWaiting → next reload picks up new
//      assets if a deploy is queued).
//   4. window.location.reload() — bypasses the in-page SPA router.
//
// The returned `reload` is idempotent and brief-spinner-aware via `isReloading`.
export function useHardReload() {
  const queryClient = useQueryClient();
  const [isReloading, setIsReloading] = useState(false);

  const reload = useCallback(async () => {
    if (isReloading) return;
    setIsReloading(true);

    try {
      queryClient.clear();
    } catch {
      // queryClient may have been torn down already — ignore.
    }

    try {
      localStorage.removeItem(PERSISTED_CACHE_KEY);
    } catch {
      // localStorage may be unavailable (private mode, quota); not fatal.
    }

    // Activate any waiting SW so the reload below picks up new assets.
    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      } catch {
        // SW APIs flaky in some browsers; not fatal.
      }
    }

    // Brief paint so the user sees the spinner state before the reload kicks in.
    await new Promise(resolve => setTimeout(resolve, 150));
    window.location.reload();
  }, [queryClient, isReloading]);

  return { reload, isReloading };
}
