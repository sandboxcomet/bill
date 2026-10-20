import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { billPrisma?: PrismaClient };
export const prisma = globalDb.billPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.billPrisma = prisma;
