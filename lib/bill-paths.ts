// Bill IDs are Prisma CUIDs. Restrict public root paths so account pages stay protected.
export const sharedBillPath = (id: string) => `/${encodeURIComponent(id)}`;
export const shortBillPath = (username: string, code: string) => `/@${encodeURIComponent(username)}/${encodeURIComponent(code)}`;
export const isShortBillPath = (pathname: string) => /^\/@[a-z0-9_]{3,24}\/[a-z0-9]{8}\/?$/.test(pathname);
export const manageBillPath = (id: string) => `/manage/${encodeURIComponent(id)}`;
export const participantPaymentPath = (id: string, participantId: string) =>
  `${sharedBillPath(id)}/${encodeURIComponent(participantId)}`;
export const isSharedBillPath = (pathname: string) => /^\/c[a-z0-9]{24}\/?$/.test(pathname) || isShortBillPath(pathname);
export const billIdFromPagePath = (pathname: string) => /^\/(c[a-z0-9]{24})(?:\/[^/]+)?\/?$/.exec(pathname)?.[1] ?? null;

export function legacyBillRedirect(pathname: string): string | null {
  const edit = /^\/bills\/(c[a-z0-9]{24})\/edit\/?$/.exec(pathname);
  if (edit) return manageBillPath(edit[1]);
  const match = /^\/bill\/(c[a-z0-9]{24})(?:\/([^/]+))?\/?$/.exec(pathname);
  if (!match) return null;
  try {
    return match[2] ? participantPaymentPath(match[1], decodeURIComponent(match[2])) : sharedBillPath(match[1]);
  } catch { return null; }
}
