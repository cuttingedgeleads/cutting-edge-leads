import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { capturePayPalOrder } from "@/lib/paypal";
import { sendLeadUnlockedEmail } from "@/lib/email";
import { getTestMode } from "@/lib/settings";

function isExpired(date: Date) {
  const expiresAt = new Date(date);
  expiresAt.setHours(expiresAt.getHours() + 48);
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
    const testMode = await getTestMode();

    const contractor = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true, isTestAccount: true },
    });
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

    const contractorIsTest = contractor?.isTestAccount ?? false;
    if (testMode && lead.isTestLead !== contractorIsTest) {
      return NextResponse.json({ error: "Lead not available" }, { status: 403 });
    }
    if (!testMode && lead.isTestLead) {
      return NextResponse.json({ error: "Lead not available" }, { status: 403 });
    }

    if (isExpired(lead.createdAt)) {
      return NextResponse.json({ error: "Lead expired" }, { status: 400 });
    }

    const unlockLimit = lead.unlockLimit ?? 1;
    if (lead.unlocks.length >= unlockLimit) {
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

    if (contractor?.email) {
      await sendLeadUnlockedEmail({
        to: contractor.email,
        contractorName: contractor.name,
        leadId: lead.id,
        leadName: lead.name,
        leadEmail: lead.email,
        leadPhone: lead.phone,
        jobType: lead.jobType,
        description: lead.description,
        address: lead.address,
        city: lead.city,
        state: lead.state,
        zip: lead.zip,
        price: Number.isFinite(lead.price) ? lead.price : 0,
      });
    }

    return NextResponse.json({ success: true, unlockId: unlock.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("PayPal capture failed:", { message, stack, error });
    return NextResponse.json(
      { error: "Unable to capture PayPal order" },
      { status: 500 }
    );
  }
}
