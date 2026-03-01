"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { InstallAppButton } from "@/components/InstallAppButton";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      redirect: true,
      callbackUrl: "/",
    });

    if (result?.error) {
      setError("Invalid email or password.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white shadow-md rounded-2xl p-8">
        <h1 className="text-2xl font-semibold mb-2">Cutting Edge Leads</h1>
        <p className="text-sm text-slate-600 mb-6">
          Sign in to manage leads or request a purchase.
        </p>
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
          <div className="grid gap-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-slate-900 text-white py-2 font-medium hover:bg-slate-800"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
            <InstallAppButton label="Download App" className="w-full" />
          </div>
        </form>
        <div className="mt-6 text-xs text-slate-500">
          <p>Default admin is seeded in the database. See README for details.</p>
        </div>
      </div>
    </div>
  );
}
