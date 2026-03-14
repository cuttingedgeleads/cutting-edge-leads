import { redirect } from "next/navigation";
import Link from "next/link";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sanitizeInput } from "@/lib/sanitize";

async function createSignup(formData: FormData) {
  "use server";

  const name = sanitizeInput(String(formData.get("name") || ""));
  const email = sanitizeInput(String(formData.get("email") || "")).toLowerCase();
  const phone = sanitizeInput(String(formData.get("phone") || ""));
  const companyName = sanitizeInput(String(formData.get("companyName") || ""));
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!name || !email || !companyName || !password || !confirmPassword) {
    redirect("/signup?error=missing_fields");
  }

  if (password !== confirmPassword) {
    redirect("/signup?error=password_mismatch");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect("/signup?error=email_taken");
  }

  const passwordHash = await hash(password, 10);
  await prisma.user.create({
    data: {
      name,
      email,
      phone,
      businessName: companyName,
      passwordHash,
      role: "CONTRACTOR",
    },
  });

  redirect("/login?signup=success");
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Please complete all required fields.",
  password_mismatch: "Passwords do not match.",
  email_taken: "An account with that email already exists.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorKey = params?.error || "";
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] : "";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white shadow-md rounded-2xl p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Create your contractor account</h1>
          <p className="text-sm text-slate-600">Start requesting leads in minutes.</p>
        </div>
        <form action={createSignup} className="grid gap-4">
          <div>
            <label className="text-sm font-medium">Full name</label>
            <input name="name" className="mt-1 w-full rounded-lg border px-3 py-2" required />
          </div>
          <div>
            <label className="text-sm font-medium">Company name</label>
            <input
              name="companyName"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="ABC Lawn Services"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              name="email"
              type="email"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Phone</label>
            <input
              name="phone"
              type="tel"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="(555) 555-5555"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
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
            Sign up
          </button>
        </form>
        <p className="text-sm text-slate-600 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-slate-900 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
