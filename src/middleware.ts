import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  applyRateLimitHeaders,
  getClientIpFromHeaders,
  rateLimit,
} from "@/lib/ratelimit";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host) {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
      }
    }
  }

  const ip = getClientIpFromHeaders(request.headers);
  const result = rateLimit(`api:${ip}`, {
    limit: 100,
    windowMs: 60_000,
  });

  if (!result.success) {
    const response = NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
    applyRateLimitHeaders(response, result);
    return response;
  }

  const response = NextResponse.next();
  applyRateLimitHeaders(response, result);
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
