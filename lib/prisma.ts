import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { billPrisma?: PrismaClient };
// A dev hot reload after adding models must not reuse the previous schema client.
export const prisma = globalDb.billPrisma && "passkey" in globalDb.billPrisma && "personalAlias" in globalDb.billPrisma
  ? globalDb.billPrisma : new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.billPrisma = prisma;
