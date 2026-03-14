"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { InstallAppButton } from "@/components/InstallAppButton";

function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const signupSuccess = searchParams?.get("signup") === "success";
  const resetSuccess = searchParams?.get("reset") === "success";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/",
    });

    if (result?.error) {
      if (result.error === "ACCOUNT_LOCKED") {
        setError(
          "This account has been temporarily locked due to too many failed login attempts. Try again in 10 minutes."
        );
      } else {
        setError("Invalid email or password.");
      }
      setLoading(false);
      return;
    }

    if (result?.url) {
      window.location.href = result.url;
    }
    setLoading(false);
  }

  return (
    <div className="w-full max-w-md bg-white shadow-md rounded-2xl p-8">
      <h1 className="text-2xl font-semibold mb-2">Cutting Edge Leads</h1>
      <p className="text-sm text-slate-600 mb-6">
        Sign in to manage leads or request a purchase.
      </p>
      {signupSuccess ? (
        <p className="text-sm text-green-600 mb-4">Account created! Sign in to get started.</p>
      ) : null}
      {resetSuccess ? (
        <p className="text-sm text-green-600 mb-4">Password updated. Please sign in.</p>
      ) : null}
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <label className="text-sm font-medium">Password</label>
          <input
            name="password"
            type="password"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-slate-600 hover:text-slate-900">
            Forgot password?
          </Link>
        </div>
        <div className="grid gap-3">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 text-white py-2 font-medium hover:bg-slate-800"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <Link
            href="/signup"
            className="w-full rounded-lg border border-slate-300 py-2 text-center font-medium text-slate-700 hover:border-slate-400"
          >
            Sign up
          </Link>
          <InstallAppButton label="Download App" className="w-full" />
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Suspense fallback={<div className="w-full max-w-md bg-white shadow-md rounded-2xl p-8 animate-pulse h-96" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
