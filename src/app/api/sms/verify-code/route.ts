import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { randomUUID, timingSafeEqual } from "crypto";

const MAX_FAILED_ATTEMPTS = 5;
const VERIFIED_TOKEN_TTL_MS = 60 * 1000;

function isCodeMatch(storedCode: string | null, providedCode: string) {
  if (!storedCode) return false;
  if (storedCode.length !== providedCode.length) return false;
  return timingSafeEqual(Buffer.from(storedCode), Buffer.from(providedCode));
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "CONTRACTOR") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const code = String(body.code || "").trim();
    if (!code) {
      return NextResponse.json({ error: "Missing verification code" }, { status: 400 });
    }

    const contractor = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { smsCode: true, smsCodeExpiry: true, smsFailedAttempts: true },
    });

    if (!contractor) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    if ((contractor.smsFailedAttempts ?? 0) >= MAX_FAILED_ATTEMPTS) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { smsCode: null, smsCodeExpiry: null },
      });
      return NextResponse.json(
        { error: "Too many failed attempts. Request a new code." },
        { status: 429 }
      );
    }

    if (!contractor.smsCodeExpiry || contractor.smsCodeExpiry.getTime() < Date.now()) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { smsCode: null, smsCodeExpiry: null },
      });
      return NextResponse.json({ error: "Verification code expired" }, { status: 400 });
    }

    if (!isCodeMatch(contractor.smsCode, code)) {
      const nextAttempts = (contractor.smsFailedAttempts ?? 0) + 1;
      const lockout = nextAttempts >= MAX_FAILED_ATTEMPTS;

      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          smsFailedAttempts: nextAttempts,
          smsCode: lockout ? null : contractor.smsCode,
          smsCodeExpiry: lockout ? null : contractor.smsCodeExpiry,
        },
      });

      const status = lockout ? 429 : 400;
      const error = lockout
        ? "Too many failed attempts. Request a new code."
        : "Invalid verification code";
      return NextResponse.json({ error }, { status });
    }

    const token = randomUUID();
    const tokenExpiry = new Date(Date.now() + VERIFIED_TOKEN_TTL_MS);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        smsCode: null,
        smsCodeExpiry: null,
        smsFailedAttempts: 0,
        smsVerifiedToken: token,
        smsVerifiedExpiry: tokenExpiry,
      },
    });

    return NextResponse.json({ success: true, token, expiresAt: tokenExpiry.toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("SMS verify code failed:", { message, stack, error });
    return NextResponse.json({ error: "Unable to verify code" }, { status: 500 });
  }
}
