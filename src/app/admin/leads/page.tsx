import { redirect } from "next/navigation";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { AdminTabs } from "@/components/AdminTabs";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { sendNewLeadEmail } from "@/lib/email";

const MIN_PRICE = 20;

async function createLead(formData: FormData) {
  "use server";

  const name = String(formData.get("name") || "").trim();
  const jobType = String(formData.get("jobType") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const state = String(formData.get("state") || "").trim();
  const zip = String(formData.get("zip") || "").trim();
  const price = Number(formData.get("price") || 0);
  const photoFiles = formData.getAll("photos").filter((file): file is File => {
    return file instanceof File && file.size > 0;
  });

  if (!name || !jobType || !description || !address || !city || !state || !zip || price < MIN_PRICE) {
    return;
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const photos = await Promise.all(
    photoFiles.map(async (file) => {
      const extension = path.extname(file.name || "");
      const filename = `${randomUUID()}${extension || ".jpg"}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(uploadsDir, filename), buffer);
      return `/uploads/${filename}`;
    })
  );

  const lead = await prisma.lead.create({
    data: {
      name,
      jobType,
      description,
      address,
      city,
      state,
      zip,
      price,
      createdAt: new Date(),
      photos: {
        create: photos.map((url) => ({ url })),
      },
    },
    include: { photos: true },
  });

  const normalizedCity = city.toLowerCase();
  const matchingContractors = await prisma.user.findMany({
    where: {
      role: "CONTRACTOR",
      serviceCities: {
        contains: normalizedCity,
      },
    },
  });

  const recipients = matchingContractors
    .filter((contractor) =>
      contractor.serviceCities
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .includes(normalizedCity)
    )
    .map((contractor) => contractor.email);

  if (recipients.length > 0) {
    await sendNewLeadEmail({
      to: recipients,
      loginUrl: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login`,
      jobType: lead.jobType,
      city: lead.city,
      zip: lead.zip,
      description: lead.description,
      photoUrl: lead.photos[0]?.url || null,
    });
  }

  redirect("/admin/leads");
}

function isExpired(date: Date) {
  const expiresAt = new Date(date);
  expiresAt.setHours(expiresAt.getHours() + 24);
  return new Date() > expiresAt;
}

export default async function AdminLeadsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const leads = await prisma.lead.findMany({
    include: {
      photos: true,
      unlocks: { where: { status: "APPROVED" }, include: { contractor: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const activeLeads = leads.filter((lead) => lead.unlocks.length < 2);

  return (
    <div className="min-h-screen">
      <NavBar name={session.user.name} role={session.user.role} />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <AdminTabs />
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Create a lead</h2>
          <form action={createLead} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input
                name="name"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                placeholder="Customer name"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Job type</label>
              <select name="jobType" className="mt-1 w-full rounded-lg border px-3 py-2" required>
                <option value="">Select a job type</option>
                <option value="Grass Cutting">Grass Cutting</option>
                <option value="Landscaping">Landscaping</option>
                <option value="Grass and Landscaping Maintenance">
                  Grass and Landscaping Maintenance
                </option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Price (min ${MIN_PRICE})</label>
              <input
                name="price"
                type="number"
                min={MIN_PRICE}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                name="description"
                rows={4}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Street address</label>
              <AddressAutocomplete />
            </div>
            <div>
              <label className="text-sm font-medium">City</label>
              <input
                name="city"
                id="city"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">State</label>
              <input
                name="state"
                id="state"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Zip</label>
              <input
                name="zip"
                id="zip"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Photos</label>
              <input
                name="photos"
                type="file"
                accept="image/*"
                multiple
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 text-white py-2 font-medium"
              >
                Publish lead
              </button>
            </div>
          </form>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-3">Leads</h3>
          <div className="grid gap-4">
            {activeLeads.map((lead) => {
              const approvedCount = lead.unlocks.length;
              const expired = isExpired(lead.createdAt);
              const soldOut = approvedCount >= 2;
              return (
                <div key={lead.id} className="bg-white rounded-xl border p-4 space-y-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-semibold">{lead.jobType}</p>
                      <p className="text-sm text-slate-700">{lead.name}</p>
                      <p className="text-sm text-slate-600">
                        {lead.address}, {lead.city}, {lead.state} {lead.zip}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${lead.price}</p>
                      <p className="text-xs text-slate-500">{approvedCount}/2 unlocks</p>
                      <p className="text-xs text-slate-500">
                        Posted {lead.createdAt.toLocaleString()}
                      </p>
                      {lead.unlocks.length > 0 ? (
                        <ul className="mt-1 space-y-1 text-xs text-slate-500">
                          {lead.unlocks.map((unlock) => (
                            <li key={unlock.id}>
                              {unlock.contractor.name}{" • "}
                              {unlock.approvedAt?.toLocaleString() || "Approved"}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1">No purchasers yet.</p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-700">{lead.description}</p>
                  <PhotoLightbox photos={lead.photos} />
                  <div className="text-xs">
                    {expired ? (
                      <span className="text-red-600 font-semibold">Hidden (expired after 24h)</span>
                    ) : soldOut ? (
                      <span className="text-amber-600 font-semibold">Sold out (2 unlocks)</span>
                    ) : (
                      <span className="text-green-600 font-semibold">Active</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
