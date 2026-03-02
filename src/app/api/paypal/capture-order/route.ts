import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { capturePayPalOrder } from "@/lib/paypal";

function isExpired(date: Date) {
  const expiresAt = new Date(date);
  expiresAt.setHours(expiresAt.getHours() + 24);
  return new Date() > expiresAt;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "CONTRACTOR") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const orderId = String(body.orderId || "");
    const leadId = String(body.leadId || "");
    if (!orderId || !leadId) {
      return NextResponse.json({ error: "Missing order info" }, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { unlocks: { where: { status: "APPROVED" } } },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (isExpired(lead.createdAt)) {
      return NextResponse.json({ error: "Lead expired" }, { status: 400 });
    }

    if (lead.unlocks.length >= 2) {
      return NextResponse.json({ error: "Lead sold out" }, { status: 400 });
    }

    const capture = await capturePayPalOrder(orderId);
    if (capture?.status !== "COMPLETED") {
      console.error("PayPal capture returned non-completed status", {
        orderId,
        status: capture?.status,
        details: capture?.details,
      });
      const statusDetail = capture?.status ? ` (${capture.status})` : "";
      return NextResponse.json(
        { error: `Payment not completed${statusDetail}` },
        { status: 400 }
      );
    }

    const purchaseUnit = capture.purchase_units?.[0];
    const customId = purchaseUnit?.custom_id;
    if (customId && customId !== leadId) {
      return NextResponse.json({ error: "Payment lead mismatch" }, { status: 400 });
    }

    const capturedAmount =
      purchaseUnit?.payments?.captures?.[0]?.amount?.value || purchaseUnit?.amount?.value;
    const expectedAmount = (Number.isFinite(lead.price) && lead.price > 0 ? lead.price : 15).toFixed(2);
    if (capturedAmount && capturedAmount !== expectedAmount) {
      return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 });
    }

    const unlock = await prisma.leadUnlockRequest.upsert({
      where: { leadId_contractorId: { leadId, contractorId: session.user.id } },
      update: { status: "APPROVED", approvedAt: new Date() },
      create: {
        leadId,
        contractorId: session.user.id,
        status: "APPROVED",
        approvedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, unlockId: unlock.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("PayPal capture failed:", { message, stack, error });
    return NextResponse.json(
      { error: message || "Unable to capture PayPal order" },
      { status: 500 }
    );
  }
}
