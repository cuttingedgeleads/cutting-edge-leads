import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sanitizeInput } from "@/lib/sanitize";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

async function requestPasswordReset(formData: FormData) {
  "use server";

  const email = sanitizeInput(String(formData.get("email") || "")).toLowerCase();

  if (!email) {
    redirect("/forgot-password?error=missing_email");
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "https://www.cuttingedgeleads.net";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
    });
  }

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
            <label className="text-sm font-medium">Email</label>
            <input
              name="email"
              type="email"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              required
            />
          </div>
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          {sent ? (
            <p className="text-sm text-green-600">Check your email for a reset link.</p>
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
