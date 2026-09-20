import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { consumeReset } from "@/lib/password-reset";
import { validResetToken } from "@/lib/auth-policy";
export const dynamic = 'force-dynamic';
export const metadata = { referrer: 'no-referrer' as const };

async function resetPassword(formData: FormData) {
  "use server";
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("confirmPassword") || "");
  const error = await consumeReset(prisma, token, password, confirmation);
  if (error) redirect(`/reset-password?${new URLSearchParams({error,...(validResetToken(token) && error !== 'invalid_token' ? {token} : {})})}`);
  redirect("/login?reset=success");
}

const ERROR_MESSAGES: Record<string, string> = {
  weak_password: "Use at least 8 characters, at most 72 UTF-8 bytes.",
  missing_token: "Missing reset token.",
  invalid_token: "That reset link is invalid or expired.",
  missing_password: "Please enter and confirm your new password.",
  password_mismatch: "Passwords do not match.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = validResetToken(params?.token || "") ? params!.token! : "";
  const errorKey = params?.error || "";
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] : "";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white shadow-md rounded-2xl p-8">
        <h1 className="text-2xl font-semibold mb-2">Reset your password</h1>
        <p className="text-sm text-slate-600 mb-6">
          Choose a new password for your account.
        </p>
        <form action={resetPassword} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <label htmlFor="password" className="text-sm font-medium">New password</label>
            <input
              id="password" autoComplete="new-password" minLength={8}
              name="password"
              type="password"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              required
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</label>
            <input
              id="confirmPassword" autoComplete="new-password" minLength={8}
              name="confirmPassword"
              type="password"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              required
            />
          </div>
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 text-white py-2 font-medium hover:bg-slate-800"
          >
            Reset password
          </button>
        </form>
        <p className="text-sm text-slate-600 mt-6">
          <Link href="/login" className="text-slate-900 font-medium hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
