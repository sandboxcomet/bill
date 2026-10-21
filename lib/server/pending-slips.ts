import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Prisma, type PaymentEvidence } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inspectSlip, PaymentError } from "@/lib/payment-contract";
import { storeSlip } from "./payment-storage";
import { serializable, lockTarget, applyVerifiedAmount, slipCreditAmount, type PaymentTarget } from "./payment-ledger";

const retries = [30, 60, 120, 240];

function encryptionKey() {
  const secret = process.env.PAYMENT_LINK_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new PaymentError("ระบบตรวจสอบสลิปยังไม่พร้อมใช้งาน", 503);
  return createHash("sha256").update(`pending-slip:${secret}`).digest();
}
function encryptSlip(payload: string, receiver: string | null) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({ payload, receiver }), "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64");
}
function decryptSlip(value: string) {
  const bytes = Buffer.from(value, "base64");
  if (bytes.length < 29) throw new Error("Invalid encrypted slip");
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), bytes.subarray(0, 12));
  cipher.setAuthTag(bytes.subarray(12, 28));
  const decoded = JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8"));
  if (typeof decoded.payload !== "string" || !decoded.payload || decoded.payload.length > 128 ||
      (decoded.receiver !== null && typeof decoded.receiver !== "string")) throw new Error("Invalid encrypted slip");
  return decoded as { payload: string; receiver: string | null };
}

export async function recordPendingSlip(
  target: PaymentTarget,
  slip: { payload: string; image: Buffer },
  receiver: string | null,
  actorId: number | null,
) {
  const payloadHash = createHash("sha256").update(slip.payload).digest("hex");
  const encryptedSlip = encryptSlip(slip.payload, receiver);
  let evidence: PaymentEvidence;
  try {
    evidence = await serializable(async tx => {
      const payable = await lockTarget(tx, target);
      const existing = await tx.paymentEvidence.findUnique({ where: { payloadHash } });
      if (existing) return existing;
      return tx.paymentEvidence.create({ data: {
        provider: "easyslip", reference: `pending:${payloadHash}`, payloadHash, encryptedSlip,
        targetType: target.type, targetId: target.id, targetVersion: payable.version,
        submittedBy: actorId, amount: "0.00", status: "PENDING_UPLOAD",
        queuedAt: new Date(), nextCheckAt: new Date(Date.now() + 300_000),
      } });
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    evidence = await prisma.paymentEvidence.findUniqueOrThrow({ where: { payloadHash } });
  }
  if (evidence.targetType !== target.type || evidence.targetId !== target.id)
    throw new PaymentError("สลิปนี้ถูกผูกกับรายการอื่นแล้ว", 409);
  if (evidence.status === "REVERSED") throw new PaymentError("สลิปนี้ถูกย้อนรายการแล้ว กรุณาติดต่อเจ้าของ", 409);
  if (evidence.status === "SUPERSEDED") throw new PaymentError("errors.slipAlreadyRecorded", 409);
  if (evidence.status === "REJECTED") {
    evidence = await serializable(async tx => {
      const payable = await lockTarget(tx, target);
      const current = await tx.paymentEvidence.findUniqueOrThrow({ where: { id: evidence.id } });
      if (current.status !== "REJECTED") return current;
      return tx.paymentEvidence.update({ where: { id: current.id }, data: {
        encryptedSlip, targetVersion: payable.version, status: "PENDING_UPLOAD",
        queuedAt: new Date(),
        providerJobId: null, retryCount: 0, nextCheckAt: new Date(Date.now() + 300_000), leaseUntil: null, reviewReason: null,
      } });
    });
  }
  if (evidence.status !== "PENDING_UPLOAD") return evidence;
  const objectKey = await storeSlip(slip.image, evidence.id);
  await prisma.paymentEvidence.updateMany({ where: { id: evidence.id, status: "PENDING_UPLOAD" }, data: {
    objectKey, status: "PENDING", nextCheckAt: new Date(Date.now() + 30_000),
  } });
  const updated = await prisma.paymentEvidence.findUniqueOrThrow({ where: { id: evidence.id } });
  if (updated.status === "REVERSED") throw new PaymentError("สลิปนี้ถูกย้อนรายการแล้ว กรุณาติดต่อเจ้าของ", 409);
  return updated;
}

// Local development can retry sync without a public callback. Production uses
// EasySlip's async queue; the durable polling worker also recovers lost webhooks.
export function slipCallbackUrl() {
  try {
    const url = process.env.EASY_SLIP_CALLBACK_URL
      ? new URL(process.env.EASY_SLIP_CALLBACK_URL)
      : new URL("/api/webhooks/easyslip", process.env.AUTH_URL);
    if (url.protocol !== "https:" || url.username || url.password ||
        /^(localhost|127\.|0\.|10\.|192\.168\.|\[::1\])/.test(url.hostname) || url.hostname.endsWith(".local")) return null;
    return url.href;
  } catch { return null; }
}

async function providerRequest(path: string, body?: unknown) {
  const key = process.env.EASY_SLIP_KEY;
  if (!key) throw new Error("Slip verification not configured");
  const response = await fetch(`https://api.easyslip.com/v2/verify/bank${path}`, {
    method: body ? "POST" : "GET", cache: "no-store",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json();
  return { response, result };
}

async function finishPending(job: PaymentEvidence, result: unknown, receiver: string | null) {
  const verified = inspectSlip(result, receiver);
  const target: PaymentTarget = { type: job.targetType as PaymentTarget["type"], id: job.targetId, version: job.targetVersion };
  return serializable(async tx => {
    const payable = await lockTarget(tx, target);
    const current = await tx.paymentEvidence.findUniqueOrThrow({ where: { id: job.id } });
    if (current.status !== "PENDING") return current;
    const duplicate = await tx.paymentEvidence.findUnique({ where: {
      provider_reference: { provider: "easyslip", reference: verified.reference },
    } });
    if (duplicate && duplicate.id !== current.id) {
      return tx.paymentEvidence.update({ where: { id: current.id }, data: {
        status: duplicate.targetType === current.targetType && duplicate.targetId === current.targetId ? "SUPERSEDED" : "REJECTED",
        reviewReason: "DUPLICATE_REFERENCE", leaseUntil: null, nextCheckAt: null,
      } });
    }
    const reviewReason = !verified.transactedAt || verified.transactedAt < payable.createdAt ? "DATE_REQUIRES_REVIEW"
        : slipCreditAmount(new Prisma.Decimal(verified.amount.toFixed(2)), payable.remaining).gt(payable.remaining) ? "EXCEEDS_REMAINING" : null;
    const status = reviewReason ? "NEEDS_REVIEW" : "VERIFIED";
    const updated = await tx.paymentEvidence.update({ where: { id: current.id }, data: {
      reference: verified.reference, amount: verified.amount.toFixed(2), transactedAt: verified.transactedAt,
      receiverMatch: verified.receiverMatch, status, reviewReason, leaseUntil: null, nextCheckAt: null,
    } });
    if (status === "VERIFIED") await applyVerifiedAmount(tx, target, new Prisma.Decimal(verified.amount.toFixed(2)));
    return updated;
  });
}

export async function processPendingSlip(id: string) {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 90_000);
  const claimed = await prisma.paymentEvidence.updateMany({ where: {
    id, status: "PENDING", nextCheckAt: { lte: now },
    OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
  }, data: { leaseUntil } });
  if (!claimed.count) return;
  const job = await prisma.paymentEvidence.findUniqueOrThrow({ where: { id } });
  const reschedule = (seconds: number, extra: Prisma.PaymentEvidenceUpdateManyMutationInput = {}) =>
    prisma.paymentEvidence.updateMany({ where: { id, status: "PENDING", leaseUntil }, data: {
      leaseUntil: null, nextCheckAt: new Date(Date.now() + seconds * 1000), ...extra,
    } });
  const reject = (reason: string) => prisma.paymentEvidence.updateMany({ where: { id, status: "PENDING", leaseUntil }, data: {
    status: "REJECTED", reviewReason: reason, leaseUntil: null, nextCheckAt: null,
  } });
  try {
    if (!job.encryptedSlip || !job.objectKey) { await reject("INCOMPLETE_UPLOAD"); return; }
    // Do not leave a job indefinitely pending after a prolonged provider outage.
    if (Date.now() - (job.queuedAt ?? job.createdAt).getTime() > 24 * 60 * 60 * 1000) { await reject("VERIFICATION_EXPIRED"); return; }
    const { payload, receiver } = decryptSlip(job.encryptedSlip);
    if (job.providerJobId) {
      const { response, result } = await providerRequest(`/jobs/${encodeURIComponent(job.providerJobId)}`);
      if (!response.ok || result?.success !== true || result?.data?.jobId !== job.providerJobId) throw new Error("Provider job unavailable");
      const record = result.data;
      if (record.status === "done" && record.result?.status === "success") {
        await finishPending(job, { success: true, data: record.result.data }, receiver); return;
      }
      if (record.status === "failed" || (record.status === "done" && record.result?.status === "not_found")) {
        await reject(record.status === "failed" ? "PROVIDER_FAILED" : "SLIP_NOT_FOUND"); return;
      }
      await reschedule(15); return;
    }
    const callbackUrl = slipCallbackUrl();
    if (callbackUrl) {
      const { response, result } = await providerRequest("/async", { payload, callbackUrl, remark: job.id, checkDuplicate: true });
      if (!response.ok || result?.success !== true || !/^[a-f0-9-]{36}$/i.test(result?.data?.jobId ?? "")) throw new Error("Provider did not enqueue slip");
      await reschedule(15, { providerJobId: result.data.jobId }); return;
    }
    const { response, result } = await providerRequest("", { payload, checkDuplicate: false });
    if (response.ok && result?.success === true) { await finishPending(job, result, receiver); return; }
    if (result?.error?.code === "SLIP_PENDING" || result?.error?.code === "SLIP_NOT_FOUND") {
      const count = job.retryCount + 1;
      if (count >= retries.length) { await reject("SLIP_NOT_FOUND"); return; }
      await reschedule(retries[count], { retryCount: count }); return;
    }
    throw new Error("Provider not available");
  } catch (error) {
    if (error instanceof PaymentError) await reject(error.status === 409 ? "BILL_CHANGED" : "VERIFICATION_FAILED");
    else await reschedule(60);
  }
}

export async function reconcilePendingSlips() {
  const now = new Date();
  await prisma.paymentEvidence.updateMany({ where: { status: "PENDING_UPLOAD", nextCheckAt: { lte: now } },
    data: { status: "REJECTED", reviewReason: "INCOMPLETE_UPLOAD", nextCheckAt: null } });
  const jobs = await prisma.paymentEvidence.findMany({ where: {
    status: "PENDING", nextCheckAt: { lte: now }, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
  }, select: { id: true }, orderBy: { nextCheckAt: "asc" }, take: 5 });
  // Sequential requests bound provider pressure; leases coordinate multiple instances.
  for (const job of jobs) await processPendingSlip(job.id);
}

export async function wakePendingSlip(providerJobId: string) {
  const now = new Date();
  await prisma.paymentEvidence.updateMany({ where: {
    providerJobId, status: "PENDING", OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
  }, data: { nextCheckAt: now } });
}
