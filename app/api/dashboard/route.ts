import { NextResponse } from "next/server";
import { requireUserId, accessErrorResponse } from "@/lib/server/authorization";
import { listAccountBills } from "@/lib/server/bill-list";

export async function GET() {
  try {
    const userId = await requireUserId();
    return NextResponse.json(await listAccountBills(userId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return accessErrorResponse(error); }
}
