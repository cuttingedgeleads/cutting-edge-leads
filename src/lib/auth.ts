import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import { getClientIpFromHeaders } from "@/lib/ratelimit";
import { sanitizeInput } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 10;

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      name: "__Secure-next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const emailInput = sanitizeInput(String(credentials?.email || "")).toLowerCase();
        const password = String(credentials?.password || "");
        const ip = req?.headers ? getClientIpFromHeaders(new Headers(req.headers)) : "unknown";

        if (!emailInput || !password) {
          await logAudit({ action: "LOGIN_FAILED", email: emailInput, ip, details: { reason: "MISSING_FIELDS" } });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: emailInput },
        });

        if (!user) {
          await logAudit({ action: "LOGIN_FAILED", email: emailInput, ip, details: { reason: "USER_NOT_FOUND" } });
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await logAudit({
            action: "LOGIN_FAILED",
            userId: user.id,
            email: user.email,
            ip,
            details: { reason: "ACCOUNT_LOCKED", lockedUntil: user.lockedUntil },
          });
          throw new Error("ACCOUNT_LOCKED");
        }

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) {
          const failedAttempts = user.failedLoginAttempts + 1;
          const shouldLock = failedAttempts >= MAX_FAILED_ATTEMPTS;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: Math.min(failedAttempts, MAX_FAILED_ATTEMPTS),
              lockedUntil: shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
            },
          });

          await logAudit({
            action: "LOGIN_FAILED",
            userId: user.id,
            email: user.email,
            ip,
            details: { reason: shouldLock ? "ACCOUNT_LOCKED" : "INVALID_PASSWORD", failedAttempts },
          });

          if (shouldLock) {
            throw new Error("ACCOUNT_LOCKED");
          }
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        });

        await logAudit({
          action: "LOGIN_SUCCESS",
          userId: user.id,
          email: user.email,
          ip,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as "ADMIN" | "CONTRACTOR";
        session.user.id = token.sub || "";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
