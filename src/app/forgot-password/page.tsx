import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { requestReset, RESET_RESPONSE } from "@/lib/password-reset";

export const dynamic = 'force-dynamic';
async function requestPasswordReset(formData: FormData) {
  "use server";
  const h = await headers();
  // Vercel overwrites this ingress header. Other deployments share a conservative IP bucket.
  const ip = process.env.VERCEL ? h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unknown' : 'local-or-untrusted-proxy';
  await requestReset(prisma, String(formData.get('email') || ''), ip);
  redirect("/forgot-password?sent=1");
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_email: "Please enter your email address.",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const errorKey = params?.error || "";
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] : "";
  const sent = params?.sent === "1";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white shadow-md rounded-2xl p-8">
        <h1 className="text-2xl font-semibold mb-2">Forgot your password?</h1>
        <p className="text-sm text-slate-600 mb-6">
          Enter your email and we&apos;ll send a reset link.
        </p>
        <form action={requestPasswordReset} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input
              id="email" autoComplete="username" maxLength={254}
              name="email"
              type="email"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              required
            />
          </div>
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          {sent ? (
            <p className="text-sm text-green-600">{RESET_RESPONSE}</p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 text-white py-2 font-medium hover:bg-slate-800"
          >
            Send reset link
          </button>
        </form>
        <p className="text-sm text-slate-600 mt-6">
          Remembered your password?{" "}
          <Link href="/login" className="text-slate-900 font-medium hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
