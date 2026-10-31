import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { isUsername, normalizeUsername } from "@/lib/social";
import { isNickname } from "@/lib/profile";
import { AccessError } from "@/lib/server/authorization";
import { prisma } from "@/lib/prisma";
import { requireUserId, accessErrorResponse } from "@/lib/server/authorization";
import { isValidPromptPayId, promptPayErrorKey } from "@/lib/promptpay";

const fields = {
  id: true,
  name: true,
  nickname: true,
  username: true,
  promptPayId: true,
} as const;
const headers = { "Cache-Control": "private, no-store" };

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId(false);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง กรุณาลองใหม่" },
        { status: 400, headers },
      );
    }
    const data: { nickname?: string; promptPayId?: string; username?: string } = {};
    if (Object.hasOwn(body, "username")) {
      const username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
      if (!isUsername(username)) throw new AccessError("account.usernameInvalid", 409);
      data.username = username;
    }
    if (Object.hasOwn(body, "nickname")) {
      if (
        !isNickname(body.nickname)
      ) {
        return NextResponse.json(
          { error: "ใส่ชื่อเล่น 1–40 ตัวอักษร โดยไม่ขึ้นบรรทัดใหม่" },
          { status: 400, headers },
        );
      }
      data.nickname = body.nickname.trim();
    }
    if (Object.hasOwn(body, "promptPayId")) {
      if (typeof body.promptPayId !== "string") {
        return NextResponse.json(
          {
            error:
              "ใส่หมายเลข PromptPay เป็นเบอร์มือถือ 10 หลัก หรือเลขประจำตัว 13 หลัก",
          },
          { status: 400, headers },
        );
      }
      data.promptPayId = body.promptPayId;
    }
    if (!Object.keys(data).length) {
      return NextResponse.json(
        { error: "ระบุชื่อเล่นหรือหมายเลข PromptPay ที่ต้องการบันทึก" },
        { status: 400, headers },
      );
    }
    const user = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const current = await tx.user.findUnique({ where: { id: userId }, select: { username: true, nickname: true, promptPayId: true } });
      if (data.promptPayId !== undefined && data.promptPayId !== current?.promptPayId && !isValidPromptPayId(data.promptPayId))
        throw new AccessError(promptPayErrorKey(data.promptPayId), 409);
      if (current?.username && data.username && current.username !== data.username) throw new AccessError("account.usernameImmutable", 409);
      if (!(data.username ?? current?.username)) throw new AccessError("account.usernameRequired", 403);
      if (!isNickname(data.nickname ?? current?.nickname)) throw new AccessError("account.nicknameRequired", 403);
      return tx.user.update({ where: { id: userId }, data, select: fields });
    });
    return NextResponse.json({ user }, { headers });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return NextResponse.json({ error: "account.usernameTaken" }, { status: 409, headers });
    return accessErrorResponse(error);
  }
}

export async function GET() {
  try {
    const userId = await requireUserId(false);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: fields,
    });
    if (!user)
      return NextResponse.json(
        { error: "ไม่พบบัญชีผู้ใช้" },
        { status: 404, headers },
      );
    return NextResponse.json({ user }, { headers });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
