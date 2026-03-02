import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  applyRateLimitHeaders,
  getClientIpFromHeaders,
  rateLimit,
} from "@/lib/ratelimit";

const handler = NextAuth(authOptions);

export const GET = handler;

export async function POST(request: Request) {
  const url = new URL(request.url);
  const isCredentialsCallback = url.pathname.includes(
    "/api/auth/callback/credentials"
  );

  if (isCredentialsCallback) {
    const ip = getClientIpFromHeaders(request.headers);
    const result = rateLimit(`login:${ip}`, {
      limit: 8,
      windowMs: 10 * 60_000,
      sliding: true,
    });

    if (!result.success) {
      const response = NextResponse.json(
        {
          error:
            "You've reached the maximum amount of login tries. You can try again in 10 minutes.",
        },
        { status: 429 }
      );
      applyRateLimitHeaders(response, result);
      return response;
    }

    const response = await handler(request);
    applyRateLimitHeaders(response, result);
    return response;
  }

  return handler(request);
}
