import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createPayPalOrder } from "@/lib/paypal";

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
    const leadId = String(body.leadId || "");
    const vault = Boolean(body.vault);
    if (!leadId) {
      return NextResponse.json({ error: "Missing lead id" }, { status: 400 });
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

    const existingUnlock = await prisma.leadUnlockRequest.findUnique({
      where: { leadId_contractorId: { leadId, contractorId: session.user.id } },
    });

    if (existingUnlock?.status === "APPROVED") {
      return NextResponse.json({ error: "Lead already unlocked" }, { status: 400 });
    }

    const price = Number.isFinite(lead.price) && lead.price > 0 ? lead.price : 15;
    console.log("Creating PayPal order", {
      leadId,
      contractorId: session.user.id,
      price,
      jobType: lead.jobType,
    });

    const order = await createPayPalOrder({
      leadId,
      amount: price.toFixed(2),
      description: `${lead.jobType} lead unlock`,
      vault,
    });

    console.log("PayPal order created", { orderId: order?.id });
    return NextResponse.json({ orderId: order.id, price });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create PayPal order";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("PayPal create order failed:", { message, stack, error });
    return NextResponse.json({ error: "Unable to create PayPal order" }, { status: 500 });
  }
}
