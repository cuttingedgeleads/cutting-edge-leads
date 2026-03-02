import { prisma } from "@/lib/prisma";

export type AuditAction = "LOGIN_SUCCESS" | "LOGIN_FAILED" | "ADMIN_ACTION";

type AuditDetails = Record<string, unknown>;

type AuditLogInput = {
  action: AuditAction;
  userId?: string | null;
  email?: string | null;
  ip?: string | null;
  details?: AuditDetails;
};

export async function logAudit({
  action,
  userId,
  email,
  ip,
  details,
}: AuditLogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId: userId || null,
        email: email || null,
        ip: ip || null,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (error) {
    console.error("Audit log failed", { action, userId, email, ip, details, error });
  }
}
