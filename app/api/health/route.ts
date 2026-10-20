import { prisma } from "@/lib/prisma";
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "database_unavailable" }, { status: 503 });
  }
}
