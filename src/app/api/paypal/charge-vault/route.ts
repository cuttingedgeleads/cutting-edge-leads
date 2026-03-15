import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { capturePayPalOrder, createPayPalVaultOrder } from "@/lib/paypal";
import { sendLeadUnlockedEmail } from "@/lib/email";
import { getTestMode } from "@/lib/settings";
import { timingSafeEqual } from "crypto";

function isExpired(date: Date) {
  const expiresAt = new Date(date);
  expiresAt.setHours(expiresAt.getHours() + 48);
  return new Date() > expiresAt;
}

function isTokenMatch(storedToken: string | null, providedToken: string) {
  if (!storedToken) return false;
  if (storedToken.length !== providedToken.length) return false;
  return timingSafeEqual(Buffer.from(storedToken), Buffer.from(providedToken));
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "CONTRACTOR") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const leadId = String(body.leadId || "");
    const verificationToken = String(body.verificationToken || body.code || "").trim();
    const testMode = await getTestMode();

    const contractor = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        name: true,
        isTestAccount: true,
        paypalVaultId: true,
        smsVerifiedToken: true,
        smsVerifiedExpiry: true,
      },
    });

    if (!leadId || !verificationToken) {
      return NextResponse.json({ error: "Missing payment info" }, { status: 400 });
    }

    if (!contractor?.paypalVaultId) {
      return NextResponse.json({ error: "No saved PayPal account" }, { status: 400 });
    }

    if (!contractor.smsVerifiedToken || !contractor.smsVerifiedExpiry) {
      return NextResponse.json({ error: "Verification required" }, { status: 400 });
    }

    if (contractor.smsVerifiedExpiry.getTime() < Date.now()) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { smsVerifiedToken: null, smsVerifiedExpiry: null },
      });
      return NextResponse.json({ error: "Verification token expired" }, { status: 400 });
    }

    if (!isTokenMatch(contractor.smsVerifiedToken, verificationToken)) {
      return NextResponse.json({ error: "Invalid verification token" }, { status: 400 });
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

    const existingUnlock = await prisma.leadUnlockRequest.findUnique({
      where: { leadId_contractorId: { leadId, contractorId: session.user.id } },
    });

    if (existingUnlock?.status === "APPROVED") {
      return NextResponse.json({ error: "Lead already unlocked" }, { status: 400 });
    }

    const price = Number.isFinite(lead.price) && lead.price > 0 ? lead.price : 15;

    const order = await createPayPalVaultOrder({
      leadId,
      amount: price.toFixed(2),
      description: `${lead.jobType} lead unlock`,
      vaultId: contractor.paypalVaultId,
    });

    const capture = await capturePayPalOrder(order.id);
    if (capture?.status !== "COMPLETED") {
      console.error("PayPal vault capture returned non-completed status", {
        orderId: order.id,
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
    const expectedAmount = price.toFixed(2);
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

    await prisma.user.update({
      where: { id: session.user.id },
      data: { smsVerifiedToken: null, smsVerifiedExpiry: null },
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
    console.error("PayPal vault charge failed:", { message, stack, error });
    return NextResponse.json({ error: "Unable to charge saved PayPal" }, { status: 500 });
  }
}
