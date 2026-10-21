import { createHmac, timingSafeEqual } from "node:crypto";
import { wakePendingSlip } from "@/lib/server/pending-slips";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.EASYSLIP_WEBHOOK_SECRET;
  if (!secret) return new Response(null, { status: 401 });
  const header = request.headers.get("x-easyslip-signature") ?? "";
  if (!/^sha256=[a-f0-9]{64}$/.test(header)) return new Response(null, { status: 401 });
  // Bound streamed bodies too; Content-Length is not authoritative.
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const chunks: Uint8Array[] = []; let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 64 * 1024) { await reader.cancel(); return new Response(null, { status: 413 }); }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks);
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  if (!timingSafeEqual(Buffer.from(header.slice(7)), Buffer.from(expected))) return new Response(null, { status: 401 });
  let event: { jobId?: unknown };
  try { event = JSON.parse(raw.toString("utf8")); } catch { return new Response(null, { status: 400 }); }
  if (!event || typeof event.jobId !== "string" || !/^[a-f0-9-]{36}$/i.test(event.jobId)) return new Response(null, { status: 400 });
  // Never credit callback data: wake a saved job, then retrieve its authoritative
  // result with our API key. A replay only schedules an idempotent reconciliation.
  try { await wakePendingSlip(event.jobId); } catch { return new Response(null, { status: 503 }); }
  return new Response(null, { status: 204 });
}
