import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sendVerificationCode } from "@/lib/twilio";
import { randomInt } from "crypto";

const CODE_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 20 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

const sendAttempts = new Map<string, number[]>();

function isRateLimited(userId: string) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const attempts = (sendAttempts.get(userId) || []).filter((timestamp) => timestamp > windowStart);

  if (attempts.length >= RATE_LIMIT_MAX) {
    sendAttempts.set(userId, attempts);
    return true;
  }

  attempts.push(now);
  sendAttempts.set(userId, attempts);
  return false;
}

export async function POST(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "CONTRACTOR") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (isRateLimited(session.user.id)) {
      return NextResponse.json(
        { error: "Too many verification codes sent. Please try again later." },
        { status: 429 }
      );
    }

    const contractor = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true },
    });

    if (!contractor?.phone) {
      return NextResponse.json({ error: "Missing phone number" }, { status: 400 });
    }

    const code = randomInt(100000, 999999).toString();
    const expiry = new Date(Date.now() + CODE_TTL_MS);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        smsCode: code,
        smsCodeExpiry: expiry,
        smsCodeSentAt: new Date(),
        smsFailedAttempts: 0,
        smsVerifiedToken: null,
        smsVerifiedExpiry: null,
      },
    });

    await sendVerificationCode(contractor.phone, code);

    return NextResponse.json({ success: true, expiresAt: expiry.toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("SMS send code failed:", { message, stack, error });
    return NextResponse.json({ error: "Unable to send verification code" }, { status: 500 });
  }
}
