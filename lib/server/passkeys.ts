import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
  type RegistrationResponseJSON, type AuthenticationResponseJSON,
} from "@wonglao/webauthn-server";
import { prisma } from "@/lib/prisma";
import { readSessionIdentity } from "./auth-session";
import { accountUserIds } from "./account-identity";
import { requireQuota } from "./quota";

const lifetime = 5 * 60 * 1000;
const recentLogin = 15 * 60 * 1000;
const maxPasskeys = 10;
const algorithms = [-7, -257];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
type Purpose = "REGISTER" | "AUTHENTICATE";
export class PasskeyError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}
const invalid = () => new PasskeyError("passkeys.invalid");

// Bind to this application's exact host, never to a request-supplied Host or
// the parent wonglao.com domain. Local development uses its own credentials.
export function passkeyConfig() {
  const configured = process.env.AUTH_URL;
  if (!configured && process.env.NODE_ENV === "production") throw new Error("AUTH_URL required for passkeys");
  const url = new URL(configured || "http://localhost:3000");
  if (url.username || url.password || (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) {
    throw new Error("Passkeys require HTTPS or localhost");
  }
  return { origin: url.origin, rpID: url.hostname, rpName: "Clear Toh" };
}

export function requirePasskeyOrigin(request: Request) {
  if (request.headers.get("origin") !== passkeyConfig().origin) throw new PasskeyError("passkeys.invalid", 403);
}

export async function passkeyQuota(request: Request, action: string) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  await requireQuota(`passkey:${action}:${ip.slice(0, 100)}`, 40, 300);
}

async function currentIdentity(recent = false) {
  const identity = await readSessionIdentity(await cookies());
  const user = identity && await prisma.user.findUnique({ where: { id: identity.id } });
  if (!identity || !user || user.mergedIntoId || identity.version !== user.authVersion) {
    throw new PasskeyError("passkeys.signInRequired", 401);
  }
  if (recent && (!identity.authenticatedAt || Date.now() - identity.authenticatedAt > recentLogin)) {
    throw new PasskeyError("passkeys.reauthenticate", 403);
  }
  return { identity, user };
}

function cookieName(purpose: Purpose) {
  return `${passkeyConfig().origin.startsWith("https:") ? "__Host-" : ""}wonglao-passkey-${purpose.toLowerCase()}`;
}

async function remember(purpose: Purpose, challenge: string, userId?: number, authVersion?: number) {
  const token = randomBytes(32).toString("hex");
  await prisma.passkeyChallenge.create({ data: {
    id: hash(token), purpose, challenge, userId, authVersion, expiresAt: new Date(Date.now() + lifetime),
  } });
  (await cookies()).set(cookieName(purpose), token, {
    httpOnly: true, secure: passkeyConfig().origin.startsWith("https:"), sameSite: "strict", path: "/", maxAge: lifetime / 1000,
  });
}

async function consume(purpose: Purpose) {
  const token = (await cookies()).get(cookieName(purpose))?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new PasskeyError("passkeys.expired");
  const id = hash(token);
  // Atomic consumption happens before verification, including failed attempts.
  // Retain the record for history instead of deleting expired/used challenges.
  const used = await prisma.passkeyChallenge.updateMany({
    where: { id, purpose, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() },
  });
  if (used.count !== 1) throw new PasskeyError("passkeys.expired");
  return (await prisma.passkeyChallenge.findUniqueOrThrow({ where: { id } }));
}

export async function listPasskeys() {
  const { user } = await currentIdentity();
  return prisma.passkey.findMany({
    where: { userId: { in: await accountUserIds(user.id) }, revokedAt: null },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true }, orderBy: { createdAt: "desc" },
  });
}

export async function registrationOptions() {
  const { user, identity } = await currentIdentity(true);
  await requireQuota(`passkey:register:${user.id}`, 15, 900);
  const keys = await prisma.passkey.findMany({ where: { userId: { in: await accountUserIds(user.id) }, revokedAt: null } });
  if (keys.length >= maxPasskeys) throw new PasskeyError("passkeys.limit");
  if (!user.passkeyUserHandle) {
    await prisma.user.updateMany({ where: { id: user.id, passkeyUserHandle: null },
      data: { passkeyUserHandle: randomBytes(32).toString("base64url") } });
  }
  const profile = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const options = await generateRegistrationOptions({
    ...passkeyConfig(), userID: new Uint8Array(Buffer.from(profile.passkeyUserHandle!, "base64url")),
    userName: profile.username || profile.email || `account-${profile.id}`,
    userDisplayName: profile.nickname || profile.name || profile.username || "Clear Toh",
    attestationType: "none", supportedAlgorithmIDs: algorithms,
    excludeCredentials: keys.map(key => ({ id: key.credentialId })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  await remember("REGISTER", options.challenge, user.id, identity.version);
  return options;
}

export async function registerPasskey(response: RegistrationResponseJSON, name: unknown) {
  const attempt = await consume("REGISTER");
  const { user, identity } = await currentIdentity(true);
  if (attempt.userId !== user.id || attempt.authVersion !== identity.version) throw invalid();
  if (typeof name !== "string" || !name.trim() || name.trim().length > 80 || /\p{Cc}/u.test(name)) {
    throw new PasskeyError("passkeys.nameInvalid");
  }
  let verified;
  try {
    verified = await verifyRegistrationResponse({ response, expectedChallenge: attempt.challenge,
      expectedOrigin: passkeyConfig().origin, expectedRPID: passkeyConfig().rpID,
      requireUserVerification: true, supportedAlgorithmIDs: algorithms });
  } catch { throw invalid(); }
  if (!verified.verified) throw invalid();
  const { credential, credentialDeviceType, credentialBackedUp } = verified.registrationInfo;
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
    const active = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    if (active.mergedIntoId || active.authVersion !== attempt.authVersion || !active.passkeyUserHandle) throw invalid();
    const ids = await accountUserIds(user.id, tx);
    if (await tx.passkey.count({ where: { userId: { in: ids }, revokedAt: null } }) >= maxPasskeys) throw new PasskeyError("passkeys.limit");
    await tx.passkey.create({ data: {
      userId: user.id, credentialId: credential.id, credentialHash: hash(credential.id),
      publicKey: Buffer.from(credential.publicKey), counter: BigInt(credential.counter),
      userHandle: active.passkeyUserHandle, transports: credential.transports || [],
      deviceType: credentialDeviceType, backedUp: credentialBackedUp, name: name.trim(),
    } });
  });
}

export async function authenticationOptions() {
  const options = await generateAuthenticationOptions({ rpID: passkeyConfig().rpID, userVerification: "required" });
  await remember("AUTHENTICATE", options.challenge);
  return options;
}

export async function authenticatePasskey(serialized: unknown, request: Request) {
  requirePasskeyOrigin(request);
  await passkeyQuota(request, "verify");
  const attempt = await consume("AUTHENTICATE");
  if (typeof serialized !== "string" || serialized.length > 40000) throw invalid();
  let response: AuthenticationResponseJSON;
  try { response = JSON.parse(serialized); } catch { throw invalid(); }
  if (!response || typeof response.id !== "string" || !/^[A-Za-z0-9_-]{1,2048}$/.test(response.id)) throw invalid();
  const existingIdentity = await readSessionIdentity(await cookies());
  return prisma.$transaction(async tx => {
    const keyHash = hash(response.id);
    await tx.$queryRaw`SELECT id FROM passkeys WHERE credential_hash = ${keyHash} FOR UPDATE`;
    const key = await tx.passkey.findUnique({ where: { credentialHash: keyHash }, include: { user: { include: { mergedInto: true } } } });
    if (!key || key.revokedAt || key.credentialId !== response.id || response.response?.userHandle !== key.userHandle) throw invalid();
    const user = key.user.mergedInto || key.user;
    if (user.mergedIntoId) throw invalid();
    if (existingIdentity && existingIdentity.id !== user.id) {
      const current = await tx.user.findUnique({ where: { id: existingIdentity.id }, select: { mergedIntoId: true, authVersion: true } });
      // An invalidated pre-merge session must not prevent fresh authentication.
      if (current && !current.mergedIntoId && current.authVersion === existingIdentity.version) throw invalid();
    }
    let result;
    try {
      result = await verifyAuthenticationResponse({ response, expectedChallenge: attempt.challenge,
        expectedOrigin: passkeyConfig().origin, expectedRPID: passkeyConfig().rpID,
        credential: { id: key.credentialId, publicKey: new Uint8Array(key.publicKey), counter: Number(key.counter) },
        requireUserVerification: true });
    } catch { throw invalid(); }
    if (!result.verified) throw invalid();
    await tx.passkey.update({ where: { id: key.id }, data: {
      counter: BigInt(result.authenticationInfo.newCounter), lastUsedAt: new Date(),
      deviceType: result.authenticationInfo.credentialDeviceType, backedUp: result.authenticationInfo.credentialBackedUp,
    } });
    return { id: String(user.id), name: user.name, email: user.email, image: user.image,
      passkeyId: key.id, passkeyAuthVersion: user.authVersion };
  });
}

export async function revokePasskey(id: unknown) {
  const { user, identity } = await currentIdentity(true);
  if (typeof id !== "string" || id.length > 100) throw invalid();
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
    const active = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    if (active.mergedIntoId || active.authVersion !== identity.version) throw invalid();
    const ids = await accountUserIds(user.id, tx);
    const changed = await tx.passkey.updateMany({ where: { id, userId: { in: ids }, revokedAt: null }, data: { revokedAt: new Date() } });
    if (changed.count !== 1) throw invalid();
  });
}
