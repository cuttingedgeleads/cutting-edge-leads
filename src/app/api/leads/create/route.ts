import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sendNewLeadEmail } from "@/lib/email";
import { sendPushToUserIds } from "@/lib/push";
import { sanitizeInput } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";

const MIN_PRICE = 1;
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const stateNameToAbbr: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC",
};

const normalizeState = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length === 2) return trimmed.toUpperCase();
  const key = trimmed.toLowerCase().replace(/\s+/g, " ");
  return stateNameToAbbr[key] || "";
};

const toTitleCase = (value: string) => {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
};

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    
    const rawName = sanitizeInput(String(formData.get("name") || ""));
    const email = sanitizeInput(String(formData.get("email") || "")).toLowerCase();
    const phone = sanitizeInput(String(formData.get("phone") || ""));
    const jobType = sanitizeInput(String(formData.get("jobType") || ""));
    const rawDescription = sanitizeInput(String(formData.get("description") || ""));
    const rawAddress = sanitizeInput(String(formData.get("address") || ""));
    const rawCity = sanitizeInput(String(formData.get("city") || ""));
    const rawState = sanitizeInput(String(formData.get("state") || ""));
    const zip = sanitizeInput(String(formData.get("zip") || ""));

    const name = rawName ? toTitleCase(rawName) : "";
    const description = rawDescription ? toTitleCase(rawDescription) : "";
    const address = rawAddress ? toTitleCase(rawAddress) : "";
    const city = rawCity ? toTitleCase(rawCity) : "";
    const state = normalizeState(rawState);
    const price = Number(formData.get("price") || 0);
    const photoFiles = formData.getAll("photos").filter((file): file is File => {
      return file instanceof File && file.size > 0;
    });

    const invalidPhoto = photoFiles.find((file) => {
      if (!ALLOWED_PHOTO_TYPES.has(file.type)) return true;
      if (file.size > MAX_PHOTO_SIZE_BYTES) return true;
      return false;
    });

    if (invalidPhoto) {
      return NextResponse.json(
        { error: "Photos must be JPEG, PNG, WEBP, or GIF files up to 5MB." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (
      !name ||
      (email && !emailRegex.test(email)) ||
      !phone ||
      !jobType ||
      !description ||
      !address ||
      !city ||
      !state ||
      !zip ||
      price < MIN_PRICE
    ) {
      return NextResponse.json({ error: "Please fill in all fields correctly" }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    const isVercel = Boolean(process.env.VERCEL);
    
    if (!isVercel) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const photos = await Promise.all(
      photoFiles.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        
        if (!isVercel) {
          try {
            const extension = path.extname(file.name || "");
            const filename = `${randomUUID()}${extension || ".jpg"}`;
            await writeFile(path.join(uploadsDir, filename), buffer);
            return `/uploads/${filename}`;
          } catch (err) {
            console.error("Failed to write photo to disk:", err);
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
        phone,
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

    await logAudit({
      action: "ADMIN_ACTION",
      userId: session.user.id,
      email: session.user.email,
      details: { type: "LEAD_CREATED", leadId: lead.id },
    });

    const matchingContractors = await prisma.user.findMany({
      where: {
        role: "CONTRACTOR",
        notifyNewLeads: true,
      },
      select: {
        email: true,
        notifyJobTypes: true,
      },
    });

    const recipients = matchingContractors
      .filter((contractor) => {
        const preferences = Array.isArray(contractor.notifyJobTypes)
          ? contractor.notifyJobTypes
          : null;
        if (!preferences || preferences.length === 0) return true;
        return preferences.includes(lead.jobType);
      })
      .map((contractor) => contractor.email)
      .filter(Boolean);

    if (recipients.length > 0) {
      await sendNewLeadEmail({
        to: recipients,
        loginUrl: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login`,
        jobType: lead.jobType,
        city: lead.city,
        zip: lead.zip,
        description: lead.description,
        photoUrl: lead.photos[0]?.url?.startsWith("data:") ? null : (lead.photos[0]?.url || null),
      });
    }

    const pushContractors = await prisma.user.findMany({
      where: {
        role: "CONTRACTOR",
        notifyNewLeads: true,
      },
      select: {
        id: true,
        notifyJobTypes: true,
      },
    });

    const pushRecipients = pushContractors
      .filter((contractor) => {
        const preferences = Array.isArray(contractor.notifyJobTypes)
          ? contractor.notifyJobTypes
          : null;
        if (!preferences) return true;
        return preferences.includes(lead.jobType);
      })
      .map((contractor) => contractor.id);

    await sendPushToUserIds(pushRecipients, {
      title: "New lead available",
      body: `${lead.jobType} in ${lead.city}`,
      url: "/leads",
    });

    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (error) {
    console.error("Create lead failed:", error);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
