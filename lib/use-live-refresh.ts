"use client";
import { useEffect, useState } from "react";

export function useLiveRefresh(refresh: (signal: AbortSignal) => Promise<void>, enabled: boolean) {
  const [status, setStatus] = useState<"live" | "reconnecting">("live");
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let inFlight = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const visible = () => document.visibilityState === "visible";
    const schedule = () => {
      if (!disposed && visible()) timer = setTimeout(run, Math.min(3000 * 2 ** failures, 30000));
    };
    async function run() {
      if (disposed || inFlight || !visible()) return;
      if (!navigator.onLine) { setStatus("reconnecting"); schedule(); return; }
      inFlight = true;
      controller = new AbortController();
      const signal = controller.signal;
      const deadline = setTimeout(() => controller?.abort(), 15000);
      try {
        await refresh(signal);
        if (!disposed && !signal.aborted) { failures = 0; setStatus("live"); }
      } catch {
        if (!disposed && visible()) { failures++; setStatus("reconnecting"); }
      } finally {
        clearTimeout(deadline);
        inFlight = false;
        schedule();
      }
    }
    function wake() {
      clearTimeout(timer);
      if (!visible()) { controller?.abort(); return; }
      void run();
    }
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    schedule();
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
    };
  }, [enabled, refresh]);
  return status;
}
