import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/profile — update current user's profile fields
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = parseInt(session.user.id);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if (
    typeof body.promptPayId !== "string" ||
    !/^(0\d{9}|\d{13})$/.test(body.promptPayId)
  ) {
    return NextResponse.json(
      {
        error:
          "ใส่หมายเลข PromptPay เป็นเบอร์มือถือ 10 หลัก หรือเลขประจำตัว 13 หลัก",
      },
      { status: 400 },
    );
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(body.promptPayId !== undefined && {
        promptPayId: body.promptPayId || null,
      }),
    },
    select: { id: true, promptPayId: true },
  });

  return NextResponse.json({ user: updated });
}

// GET /api/profile — get current user's profile
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = parseInt(session.user.id);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, promptPayId: true },
  });

  return NextResponse.json({ user });
}
