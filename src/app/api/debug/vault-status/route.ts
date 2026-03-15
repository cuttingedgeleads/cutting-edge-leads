import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "CONTRACTOR") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contractor = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        paypalVaultId: true,
        smsVerifiedToken: true,
        smsVerifiedExpiry: true,
        smsFailedAttempts: true,
      },
    });

    return NextResponse.json({
      contractorId: contractor?.id,
      email: contractor?.email,
      phone: contractor?.phone ? "***" + contractor.phone.slice(-4) : null,
      hasVaultId: !!contractor?.paypalVaultId,
      vaultIdPreview: contractor?.paypalVaultId 
        ? contractor.paypalVaultId.slice(0, 12) + "..." 
        : null,
      vaultIdLength: contractor?.paypalVaultId?.length || 0,
      hasSmsToken: !!contractor?.smsVerifiedToken,
      smsTokenExpiry: contractor?.smsVerifiedExpiry,
      smsFailedAttempts: contractor?.smsFailedAttempts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
