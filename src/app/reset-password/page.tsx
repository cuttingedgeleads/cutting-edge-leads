import Link from "next/link";
import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

async function resetPassword(formData: FormData) {
  "use server";

  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!token) {
    redirect("/reset-password?error=missing_token");
  }

  if (!password || !confirmPassword) {
    redirect(`/reset-password?token=${token}&error=missing_password`);
  }

  if (password !== confirmPassword) {
    redirect(`/reset-password?token=${token}&error=password_mismatch`);
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    redirect("/reset-password?error=invalid_token");
  }

  const passwordHash = await hash(password, 10);
  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
  });

  await prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } });

  redirect("/login?reset=success");
}

const ERROR_MESSAGES: Record<string, string> = {
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
  const token = params?.token || "";
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
            <label className="text-sm font-medium">New password</label>
            <input
              name="password"
              type="password"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Confirm password</label>
            <input
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
