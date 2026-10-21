import { reconcilePendingSlips } from "./pending-slips";

type WorkerState = { timer?: ReturnType<typeof setInterval>; running: boolean; failed: boolean };
const globalWorker = globalThis as unknown as { billSlipWorker?: WorkerState };
export function startSlipWorker() {
  if (process.env.SLIP_WORKER_DISABLED === "1" || globalWorker.billSlipWorker?.timer) return;
  const state: WorkerState = { running: false, failed: false };
  globalWorker.billSlipWorker = state;
  const run = async () => {
    if (state.running) return;
    state.running = true;
    try {
      await reconcilePendingSlips();
      state.failed = false;
    } catch {
      if (!state.failed) console.error("[slip-worker] Pending checks unavailable; will retry");
      state.failed = true;
    } finally { state.running = false; }
  };
  // Durable records and leases survive process restarts and coordinate replicas.
  state.timer = setInterval(() => { void run(); }, 15_000);
  state.timer.unref();
}
