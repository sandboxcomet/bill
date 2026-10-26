import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AccessError, requireUserId, optionalUserId } from "./authorization";
import { ownsAccount, primaryProfile } from "./account-identity";

function signingKey() {
  const key = process.env.PAYMENT_LINK_SECRET || process.env.AUTH_SECRET;
  if (!key) throw new Error("Payment link signing is not configured");
  return key;
}

export function billAccessRevision(bill: {
  isPublic: boolean;
  passcode: string | null;
  status: string;
  version?: number;
}) {
  return createHmac("sha256", signingKey())
    .update(
      JSON.stringify([
        bill.isPublic,
        bill.passcode,
        bill.status,
        bill.version ?? 0,
      ]),
    )
    .digest("base64url");
}

export function createParticipantToken(
  billId: string,
  participantId: string,
  revision: string,
) {
  const data = Buffer.from(
    JSON.stringify({
      scope: "participant:submit",
      billId,
      participantId,
      revision,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    }),
  ).toString("base64url");
  return `${data}.${createHmac("sha256", signingKey()).update(data).digest("base64url")}`;
}

function verifyParticipantToken(
  token: string,
  billId: string,
  participantId: string,
  revision: string,
) {
  if (!token || token.length > 2048) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [data, signature] = parts;
    const expected = createHmac("sha256", signingKey()).update(data).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return false;
    const claims = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    return (
      claims.scope === "participant:submit" &&
      claims.billId === billId &&
      claims.participantId === participantId &&
      claims.revision === revision &&
      Number.isSafeInteger(claims.exp) &&
      claims.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

export async function requireParticipantAccess(
  request: Request,
  billId: string,
  participantId: string,
  ownerOnly = false,
  allowUnlinked = false,
) {
  const userId = await requireUserId();
  const participant = await prisma.participant.findFirst({
    where: { id: participantId, billId, archived: false },
    include: {
      bill: { include: { owner: { select: { promptPayId: true, mergedInto: { select: { promptPayId: true } } } } } },
    },
  });
  if (!participant) throw new AccessError("Not found", 404);
  participant.bill.owner = { ...primaryProfile(participant.bill.owner), mergedInto: null };
  const isOwner = await ownsAccount(userId, participant.bill.userId);
  if (isOwner) return { participant, isOwner, userId };
  if (ownerOnly || participant.bill.status !== "PUBLISHED")
    throw new AccessError("Forbidden");
  if (participant.accountUserId && !await ownsAccount(userId, participant.accountUserId))
    throw new AccessError("payment.linkedToAnotherAccount", 403);
  const token = request.headers.get("x-payment-token") ?? "";
  if (
    !verifyParticipantToken(
      token,
      billId,
      participantId,
      billAccessRevision(participant.bill),
    )
  ) {
    throw new AccessError("Open this payment from the bill share page", 403);
  }
  if (!participant.accountUserId && !allowUnlinked)
    throw new AccessError("payment.claimRequired", 403);
  return { participant, isOwner, userId };
}

// The receipt's amount explanation remains available with its PIN-derived token.
// It cannot authorize payment uploads, identity claims or private slip images.
export async function requireExpenseAccess(request: Request, billId: string, participantId: string) {
  const participant = await prisma.participant.findFirst({ where: { id: participantId, billId, archived: false }, include: { bill: true } });
  if (!participant) throw new AccessError("Not found", 404);
  if (await ownsAccount(await optionalUserId(), participant.bill.userId)) return;
  if (participant.bill.status !== "PUBLISHED" || !verifyParticipantToken(
    request.headers.get("x-payment-token") ?? "", billId, participantId, billAccessRevision(participant.bill),
  )) throw new AccessError("Open this payment from the bill share page", 403);
}
