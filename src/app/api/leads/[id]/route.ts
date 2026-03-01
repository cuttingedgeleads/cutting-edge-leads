import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { unlink } from "fs/promises";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const leadParams = await params;
    const leadId = leadParams.id;
    if (!leadId) {
      return NextResponse.json({ error: "Missing lead id" }, { status: 400 });
    }

    const body = await request.json();
    const price = Number(body.price);
    if (!Number.isFinite(price)) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        name: String(body.name || ""),
        email: String(body.email || ""),
        phone: String(body.phone || ""),
        jobType: String(body.jobType || ""),
        description: String(body.description || ""),
        address: String(body.address || ""),
        city: String(body.city || ""),
        state: String(body.state || ""),
        zip: String(body.zip || ""),
        price,
      },
    });

    return NextResponse.json({ success: true, lead: updatedLead });
  } catch (error) {
    console.error("Update lead failed:", error);
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const leadParams = await params;
    const leadId = leadParams.id;
    if (!leadId) {
      return NextResponse.json({ error: "Missing lead id" }, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { photos: true },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const uploadsRoot = path.join(process.cwd(), "public");

    await Promise.all(
      lead.photos.map(async (photo) => {
        if (!photo.url.startsWith("/uploads/")) return;
        const relativePath = photo.url.replace(/^\/+/, "");
        const filePath = path.join(uploadsRoot, relativePath);
        try {
          await unlink(filePath);
        } catch (error) {
          console.warn("Failed to delete photo file:", filePath, error);
        }
      })
    );

    await prisma.$transaction([
      prisma.leadUnlockRequest.deleteMany({ where: { leadId } }),
      prisma.leadPhoto.deleteMany({ where: { leadId } }),
      prisma.lead.delete({ where: { id: leadId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete lead failed:", error);
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }
}
