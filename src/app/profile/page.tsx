import { redirect } from "next/navigation";
import { compare, hash } from "bcryptjs";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { EnableNotificationsButton } from "@/components/EnableNotificationsButton";
import { sanitizeInput } from "@/lib/sanitize";
import { JOB_TYPES } from "@/lib/jobTypes";
import {
  EditableCheckboxField,
  EditablePasswordSection,
  EditableSelectField,
  EditableTextField,
} from "@/components/ProfileEditableField";

async function updateName(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const name = sanitizeInput(String(formData.get("name") || ""));
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

  const email = sanitizeInput(String(formData.get("email") || "")).toLowerCase();
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

async function updateBusinessName(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const businessName = sanitizeInput(String(formData.get("businessName") || ""));
  if (!businessName) {
    redirect("/profile?error=missing_business_name");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { businessName },
  });

  redirect("/profile?success=business_profile");
}

async function updatePhone(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const phone = sanitizeInput(String(formData.get("phone") || ""));

  await prisma.user.update({
    where: { id: session.user.id },
    data: { phone },
  });

  redirect("/profile?success=business_profile");
}

async function updateServiceCities(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const serviceCities = sanitizeInput(String(formData.get("serviceCities") || ""))
    .split(",")
    .map((city) => sanitizeInput(city))
    .filter(Boolean)
    .join(",");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { serviceCities },
  });

  redirect("/profile?success=business_profile");
}

async function updateTimezone(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const timezone = sanitizeInput(String(formData.get("timezone") || "America/Chicago"));

  await prisma.user.update({
    where: { id: session.user.id },
    data: { timezone },
  });

  redirect("/profile?success=business_profile");
}

async function updatePreferredContactMethod(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const preferredContactMethod = sanitizeInput(
    String(formData.get("preferredContactMethod") || "EMAIL")
  );

  await prisma.user.update({
    where: { id: session.user.id },
    data: { preferredContactMethod },
  });

  redirect("/profile?success=business_profile");
}

async function updateNotifyNewLeads(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const notifyNewLeads = formData.get("notifyNewLeads") === "on";

  await prisma.user.update({
    where: { id: session.user.id },
    data: { notifyNewLeads },
  });

  redirect("/profile?success=notifications");
}

async function updateNotifyJobTypes(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const selectedTypes = formData
    .getAll("notifyJobTypes")
    .map((value) => String(value))
    .filter((value) => JOB_TYPES.includes(value as (typeof JOB_TYPES)[number]));

  await prisma.user.update({
    where: { id: session.user.id },
    data: { notifyJobTypes: selectedTypes },
  });

  redirect("/profile?success=notifications");
}

async function updateNotifyUnlockApproved(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const notifyUnlockApproved = formData.get("notifyUnlockApproved") === "on";

  await prisma.user.update({
    where: { id: session.user.id },
    data: { notifyUnlockApproved },
  });

  redirect("/profile?success=notifications");
}

async function updateNotifySms(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const notifySms = formData.get("notifySms") === "on";

  await prisma.user.update({
    where: { id: session.user.id },
    data: { notifySms },
  });

  redirect("/profile?success=notifications");
}

async function updateNotifyMarketing(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const notifyMarketing = formData.get("notifyMarketing") === "on";

  await prisma.user.update({
    where: { id: session.user.id },
    data: { notifyMarketing },
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
      notifyJobTypes: true,
      notifyUnlockApproved: true,
      notifyMarketing: true,
      notifySms: true,
    },
  });

  const storedJobTypes = Array.isArray(user?.notifyJobTypes)
    ? user?.notifyJobTypes.filter((value) =>
        JOB_TYPES.includes(value as (typeof JOB_TYPES)[number])
      )
    : null;
  const selectedJobTypes = storedJobTypes ?? [...JOB_TYPES];

  const allowedCities = (user?.serviceCities || "")
    .split(",")
    .map((city) => city.trim().toLowerCase())
    .filter(Boolean);

  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 48);

  const availableLeads = await prisma.lead.findMany({
    where: { createdAt: { gte: cutoff } },
    select: { city: true, unlockLimit: true, unlocks: { select: { status: true } } },
  });

  const availableLeadCount = availableLeads.filter((lead) => {
    const cityMatch =
      allowedCities.length === 0 || allowedCities.includes(lead.city.toLowerCase());
    if (!cityMatch) return false;
    const approvedCount = lead.unlocks.filter((unlock) => unlock.status === "APPROVED").length;
    const unlockLimit = lead.unlockLimit ?? 1;
    return approvedCount < unlockLimit;
  }).length;

  return (
    <div className="min-h-screen">
      <NavBar
        name={user?.name ?? session.user.name}
        role={session.user.role}
        businessName={user?.businessName}
        availableLeadCount={availableLeadCount}
      />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <section className="bg-white rounded-2xl shadow p-6 space-y-5">
          <div>
            <h2 className="text-xl font-semibold">Enable notifications</h2>
            <p className="text-sm text-slate-600">
              Turn on push alerts so you never miss a new lead or approval update.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <EnableNotificationsButton />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">iOS setup</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>Open Cutting Edge Leads in Safari and tap Share</li>
              <li>
                Scroll down until you see the option &quot;Add to Home Screen&quot; and select
              </li>
              <li>Launch the app from your home screen, then tap Enable Notifications</li>
            </ol>
            <p className="mt-2 text-xs text-slate-500">Requires iOS 16.4 or newer.</p>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Profile</h2>
            <p className="text-sm text-slate-600">Manage your account details and preferences.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <EditableTextField
              label="Username"
              name="name"
              value={user?.name}
              action={updateName}
              required
            />
            <EditableTextField
              label="Email address"
              name="email"
              type="email"
              value={user?.email}
              action={updateEmail}
              description="Use your primary account email for alerts."
              required
            />
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Business profile</h3>
            <p className="text-sm text-slate-600">
              Keep your business details current so we can route the right leads.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <EditableTextField
              label="Business name"
              name="businessName"
              value={user?.businessName}
              action={updateBusinessName}
              required
            />
            <EditableTextField
              label="Phone number"
              name="phone"
              value={user?.phone}
              action={updatePhone}
              placeholder="(555) 555-5555"
            />
            <div className="sm:col-span-2">
              <EditableTextField
                label="Service areas (comma-separated)"
                name="serviceCities"
                value={user?.serviceCities}
                action={updateServiceCities}
                placeholder="Dallas, Plano, Frisco"
              />
            </div>
            <EditableSelectField
              label="Timezone"
              name="timezone"
              value={user?.timezone || "America/Chicago"}
              action={updateTimezone}
              options={[
                { value: "America/Chicago", label: "Central (America/Chicago)" },
                { value: "America/New_York", label: "Eastern (America/New_York)" },
                { value: "America/Denver", label: "Mountain (America/Denver)" },
                { value: "America/Los_Angeles", label: "Pacific (America/Los_Angeles)" },
              ]}
            />
            <EditableSelectField
              label="Preferred contact method"
              name="preferredContactMethod"
              value={user?.preferredContactMethod || "EMAIL"}
              action={updatePreferredContactMethod}
              options={[
                { value: "EMAIL", label: "Email" },
                { value: "SMS", label: "SMS" },
                { value: "PHONE", label: "Phone call" },
              ]}
            />
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Security</h3>
            <p className="text-sm text-slate-600">Use a strong password you don’t use elsewhere.</p>
          </div>
          <EditablePasswordSection action={updatePassword} />
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
          <div className="grid gap-3">
            <EditableCheckboxField
              label="New lead alerts"
              name="notifyNewLeads"
              value={user?.notifyNewLeads}
              action={updateNotifyNewLeads}
              description="Get notified when new leads are posted."
            />
            <EditableCheckboxField
              label="Unlock approvals"
              name="notifyUnlockApproved"
              value={user?.notifyUnlockApproved}
              action={updateNotifyUnlockApproved}
              description="Alerts when your lead unlocks are approved."
            />
            <EditableCheckboxField
              label="SMS notifications"
              name="notifySms"
              value={user?.notifySms}
              action={updateNotifySms}
              description="Receive text alerts for urgent lead activity."
            />
            <EditableCheckboxField
              label="Product updates"
              name="notifyMarketing"
              value={user?.notifyMarketing}
              action={updateNotifyMarketing}
              description="Occasional product tips and announcements."
            />
          </div>
          <form action={updateNotifyJobTypes} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Lead job type alerts</p>
              <p className="text-xs text-slate-500">
                Pick which job types you want to receive push notifications for.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {JOB_TYPES.map((jobType) => (
                <label key={jobType} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="notifyJobTypes"
                    value={jobType}
                    defaultChecked={selectedJobTypes.includes(jobType)}
                    className="h-4 w-4"
                  />
                  <span>{jobType}</span>
                </label>
              ))}
            </div>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Save job type preferences
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
