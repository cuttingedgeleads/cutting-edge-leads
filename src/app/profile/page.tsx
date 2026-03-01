import { redirect } from "next/navigation";
import { compare, hash } from "bcryptjs";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { InstallAppButton } from "@/components/InstallAppButton";

async function updateName(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/profile?error=missing_name");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name },
  });

  redirect("/profile?success=name");
}

async function updateEmail(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) redirect("/profile?error=missing_email");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== session.user.id) {
    redirect("/profile?error=email_taken");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { email },
  });

  redirect("/profile?success=email");
}

async function updatePassword(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect("/profile?error=missing_password");
  }

  if (newPassword.length < 8) {
    redirect("/profile?error=weak_password");
  }

  if (newPassword !== confirmPassword) {
    redirect("/profile?error=password_mismatch");
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const matches = await compare(currentPassword, user.passwordHash);
  if (!matches) redirect("/profile?error=bad_password");

  const passwordHash = await hash(newPassword, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  redirect("/profile?success=password");
}

async function updateBusinessProfile(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const businessName = String(formData.get("businessName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const serviceCities = String(formData.get("serviceCities") || "")
    .split(",")
    .map((city) => city.trim())
    .filter(Boolean)
    .join(",");
  const timezone = String(formData.get("timezone") || "America/Chicago").trim();
  const preferredContactMethod = String(formData.get("preferredContactMethod") || "EMAIL");

  if (!businessName) {
    redirect("/profile?error=missing_business_name");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      businessName,
      phone,
      serviceCities,
      timezone,
      preferredContactMethod,
    },
  });

  redirect("/profile?success=business_profile");
}

async function updateNotifications(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const notifyNewLeads = formData.get("notifyNewLeads") === "on";
  const notifyUnlockApproved = formData.get("notifyUnlockApproved") === "on";
  const notifyMarketing = formData.get("notifyMarketing") === "on";
  const notifySms = formData.get("notifySms") === "on";

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      notifyNewLeads,
      notifyUnlockApproved,
      notifyMarketing,
      notifySms,
    },
  });

  redirect("/profile?success=notifications");
}

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      businessName: true,
      phone: true,
      serviceCities: true,
      timezone: true,
      preferredContactMethod: true,
      notifyNewLeads: true,
      notifyUnlockApproved: true,
      notifyMarketing: true,
      notifySms: true,
    },
  });

  return (
    <div className="min-h-screen">
      <NavBar
        name={user?.name ?? session.user.name}
        role={session.user.role}
        businessName={user?.businessName}
      />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <section className="bg-white rounded-2xl shadow p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Install Cutting Edge Leads</h2>
            <p className="text-sm text-slate-600">
              Add the app to your home screen for faster access to new leads.
            </p>
          </div>
          <InstallAppButton label="Install App" className="w-full sm:w-auto" />
        </section>

        <section className="bg-white rounded-2xl shadow p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Profile</h2>
            <p className="text-sm text-slate-600">Manage your account details and preferences.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Current email</p>
              <p className="font-medium text-slate-900">{user?.email}</p>
              <p className="text-xs text-slate-500">Use your primary account email for alerts.</p>
            </div>
            <form action={updateName} className="rounded-xl border px-4 py-3 bg-white space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-500">Username</label>
              <input
                name="name"
                defaultValue={user?.name || ""}
                className="w-full rounded-lg border px-3 py-2"
                required
              />
              <button className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium">
                Update username
              </button>
            </form>
            <form action={updateEmail} className="rounded-xl border px-4 py-3 bg-white space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-500">Email address</label>
              <input
                name="email"
                type="email"
                defaultValue={user?.email || ""}
                className="w-full rounded-lg border px-3 py-2"
                required
              />
              <button className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium">
                Update email
              </button>
            </form>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Business profile</h3>
            <p className="text-sm text-slate-600">
              Keep your business details current so we can route the right leads.
            </p>
          </div>
          <form action={updateBusinessProfile} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Business name</label>
              <input
                name="businessName"
                defaultValue={user?.businessName || ""}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Phone number</label>
              <input
                name="phone"
                defaultValue={user?.phone || ""}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                placeholder="(555) 555-5555"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Service areas (comma-separated)</label>
              <input
                name="serviceCities"
                defaultValue={user?.serviceCities || ""}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                placeholder="Dallas, Plano, Frisco"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Timezone</label>
              <select
                name="timezone"
                defaultValue={user?.timezone || "America/Chicago"}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              >
                <option value="America/Chicago">Central (America/Chicago)</option>
                <option value="America/New_York">Eastern (America/New_York)</option>
                <option value="America/Denver">Mountain (America/Denver)</option>
                <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Preferred contact method</label>
              <select
                name="preferredContactMethod"
                defaultValue={user?.preferredContactMethod || "EMAIL"}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              >
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="PHONE">Phone call</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <button className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium">
                Save business profile
              </button>
            </div>
          </form>
        </section>

        <section className="bg-white rounded-2xl shadow p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Security</h3>
            <p className="text-sm text-slate-600">Use a strong password you don’t use elsewhere.</p>
          </div>
          <form action={updatePassword} className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Current password</label>
              <input
                name="currentPassword"
                type="password"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">New password</label>
              <input
                name="newPassword"
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
            <div className="sm:col-span-3">
              <button className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium">
                Update password
              </button>
            </div>
          </form>
          <div className="rounded-xl border bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">Two-factor authentication</p>
              <p className="text-sm text-slate-600">Add extra protection to your account.</p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-500 cursor-not-allowed"
              disabled
            >
              Coming soon
            </button>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Notification settings</h3>
            <p className="text-sm text-slate-600">Choose how we keep you updated.</p>
          </div>
          <form action={updateNotifications} className="grid gap-3">
            <label className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
              <div>
                <p className="font-medium">New lead alerts</p>
                <p className="text-sm text-slate-600">Get notified when new leads are posted.</p>
              </div>
              <input
                type="checkbox"
                name="notifyNewLeads"
                defaultChecked={user?.notifyNewLeads}
                className="h-4 w-4"
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
              <div>
                <p className="font-medium">Unlock approvals</p>
                <p className="text-sm text-slate-600">Alerts when your lead unlocks are approved.</p>
              </div>
              <input
                type="checkbox"
                name="notifyUnlockApproved"
                defaultChecked={user?.notifyUnlockApproved}
                className="h-4 w-4"
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
              <div>
                <p className="font-medium">SMS notifications</p>
                <p className="text-sm text-slate-600">Receive text alerts for urgent lead activity.</p>
              </div>
              <input
                type="checkbox"
                name="notifySms"
                defaultChecked={user?.notifySms}
                className="h-4 w-4"
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
              <div>
                <p className="font-medium">Product updates</p>
                <p className="text-sm text-slate-600">Occasional product tips and announcements.</p>
              </div>
              <input
                type="checkbox"
                name="notifyMarketing"
                defaultChecked={user?.notifyMarketing}
                className="h-4 w-4"
              />
            </label>
            <div>
              <button className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium">
                Save notification settings
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
