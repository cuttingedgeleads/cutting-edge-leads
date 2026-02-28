import { redirect } from "next/navigation";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { AdminTabs } from "@/components/AdminTabs";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { LeadCreateForm } from "@/components/LeadCreateForm";
import { sendNewLeadEmail } from "@/lib/email";

const MIN_PRICE = 20;

async function createLead(
  _prevState: { error: string },
  formData: FormData
): Promise<{ error: string }> {
  "use server";

  try {
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (
      !name ||
      !email ||
      !emailRegex.test(email) ||
      !jobType ||
      !description ||
      !address ||
      !city ||
      !state ||
      !zip ||
      price < MIN_PRICE
    ) {
      return { error: "Please complete all fields with a valid email and price." };
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    const shouldWriteToDisk = !process.env.VERCEL;
    if (shouldWriteToDisk) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const photos = await Promise.all(
      photoFiles.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        if (shouldWriteToDisk) {
          try {
            const extension = path.extname(file.name || "");
            const filename = `${randomUUID()}${extension || ".jpg"}`;
            await writeFile(path.join(uploadsDir, filename), buffer);
            return `/uploads/${filename}`;
          } catch (error) {
            console.error(
              "Failed to store lead photo on disk, falling back to inline data.",
              error
            );
          }
        }

        const mimeType = file.type || "image/jpeg";
        return `data:${mimeType};base64,${buffer.toString("base64")}`;
      })
    );

    const lead = await prisma.lead.create({
      data: {
        name,
        email,
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
      const photoUrl = lead.photos[0]?.url || null;
      await sendNewLeadEmail({
        to: recipients,
        loginUrl: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login`,
        jobType: lead.jobType,
        city: lead.city,
        zip: lead.zip,
        description: lead.description,
        photoUrl: photoUrl && photoUrl.startsWith("data:") ? null : photoUrl,
      });
    }

    redirect("/admin/leads");
  } catch (error) {
    console.error("Create lead failed", error);
    return { error: "Something went wrong while publishing the lead. Please try again." };
  }
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
          <LeadCreateForm action={createLead} minPrice={MIN_PRICE} />
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
                      <p className="text-sm text-slate-600">{lead.email}</p>
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
