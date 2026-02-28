import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sendNewLeadEmail } from "@/lib/email";

const MIN_PRICE = 20;

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const phone = String(formData.get("phone") || "").trim();
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
        photoUrl: lead.photos[0]?.url?.startsWith("data:") ? null : (lead.photos[0]?.url || null),
      });
    }

    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (error) {
    console.error("Create lead failed:", error);
    const message = error instanceof Error ? error.message : "Failed to create lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
