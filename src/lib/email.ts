import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

console.log("[Email] Resend initialized:", !!resend, "API key present:", !!process.env.RESEND_API_KEY);

export async function sendNewLeadEmail(options: {
  to: string[];
  loginUrl: string;
  jobType: string;
  city: string;
  zip: string;
  description: string;
  photos?: string[];
}) {
  console.log("[Email] sendNewLeadEmail called with recipients:", options.to);
  
  if (!resend) {
    console.log("[Email] Resend not initialized - RESEND_API_KEY missing");
    return;
  }

  const baseUrl = process.env.NEXTAUTH_URL || "https://www.cuttingedgeleads.net";
  const attachments: Array<{ filename: string; content: string; contentType?: string; contentId?: string }> = [];

  const photoMarkup = options.photos && options.photos.length > 0
    ? options.photos.map((url, i) => {
        if (url.startsWith("data:")) {
          const match = url.match(/^data:(.+?);base64,(.+)$/);
          if (match) {
            const [, contentType, content] = match;
            const cid = `lead-photo-${i + 1}`;
            const extension = contentType.split("/")[1] || "jpg";
            attachments.push({
              filename: `${cid}.${extension}`,
              content,
              contentType,
              contentId: cid,
            });
            return `<img src="cid:${cid}" alt="Lead photo ${i + 1}" style="max-width: 240px; border-radius: 12px; margin: 8px 8px 8px 0;" />`;
          }
        }

        const absoluteUrl = url.startsWith("http")
          ? url
          : `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;

        return `<img src="${absoluteUrl}" alt="Lead photo ${i + 1}" style="max-width: 240px; border-radius: 12px; margin: 8px 8px 8px 0;" />`;
      }).join("")
    : "";

  try {
    // Send individual emails to each contractor
    const results = await Promise.all(
      options.to.map(async (recipient) => {
        try {
          const result = await resend.emails.send({
            from: "Cutting Edge Leads <noreply@cuttingedgeleads.net>",
            to: recipient,
            subject: `New Lead Available: ${options.jobType} in ${options.city}`,
            html: `
              <div style="font-family: Arial, sans-serif; color: #0f172a;">
                <h2>New Lead Available</h2>
                <p><strong>${options.jobType}</strong> - ${options.city}, ${options.zip}</p>
                <p>${options.description}</p>
                ${photoMarkup}
                <p style="margin-top: 16px;">
                  <a href="${options.loginUrl}" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Login to request</a>
                </p>
              </div>
            `,
            ...(attachments.length > 0 ? { attachments } : {}),
          });
          console.log(`[Email] Sent to ${recipient}:`, JSON.stringify(result));
          return { recipient, success: true, result };
        } catch (err) {
          console.error(`[Email] Failed to send to ${recipient}:`, err);
          return { recipient, success: false, error: err };
        }
      })
    );
    console.log("[Email] All sends complete:", results.length);
  } catch (error) {
    console.error("[Email] Failed to send:", error);
  }
}

export async function sendLeadUnlockedEmail(options: {
  to: string;
  contractorName?: string | null;
  leadId: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  jobType: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
}) {
  console.log("[Email] sendLeadUnlockedEmail called for:", options.to, "lead:", options.leadId);

  if (!resend) {
    console.log("[Email] Resend not initialized - RESEND_API_KEY missing");
    return;
  }

  const baseUrl = process.env.NEXTAUTH_URL || "https://www.cuttingedgeleads.net";
  const leadUrl = `${baseUrl}/leads/history`;
  const subjectLeadName = options.leadName?.trim() || options.jobType;
  const greetingName = options.contractorName?.trim() || "there";

  try {
    const result = await resend.emails.send({
      from: "Cutting Edge Leads <noreply@cuttingedgeleads.net>",
      to: options.to,
      subject: `Your New Lead - ${subjectLeadName}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #0f172a;">
          <h2 style="margin-bottom: 4px;">Your lead is unlocked!</h2>
          <p style="margin-top: 0;">Hi ${greetingName},</p>
          <p>Thanks for your purchase. Here are the full contact details for your new lead:</p>

          <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;background:#f8fafc;">
            <p style="margin:0 0 8px 0;"><strong>Lead:</strong> ${options.leadName}</p>
            <p style="margin:0 0 8px 0;"><strong>Phone:</strong> ${options.leadPhone || "Not provided"}</p>
            <p style="margin:0 0 8px 0;"><strong>Email:</strong> ${options.leadEmail || "Not provided"}</p>
            <p style="margin:0 0 8px 0;"><strong>Address:</strong> ${options.address}, ${options.city}, ${options.state} ${options.zip}</p>
            <p style="margin:0 0 8px 0;"><strong>Job:</strong> ${options.jobType}</p>
            <p style="margin:0;"><strong>Details:</strong> ${options.description}</p>
          </div>

          <p style="margin-top: 16px;">Purchase amount: <strong>$${options.price}</strong></p>

          <p style="margin-top: 16px;">
            <a href="${leadUrl}" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">View your purchased leads</a>
          </p>
          <p style="margin-top: 16px; font-size: 12px; color:#64748b;">You can also find this lead in your Purchased Leads tab.</p>
        </div>
      `,
    });
    console.log("[Email] Unlock email sent:", JSON.stringify(result));
  } catch (error) {
    console.error("[Email] Failed to send unlock email:", error);
  }
}

export async function sendPasswordResetEmail(options: {
  to: string;
  name?: string | null;
  resetUrl: string;
}) {
  console.log("[Email] sendPasswordResetEmail called for:", options.to);

  if (!resend) {
    console.log("[Email] Resend not initialized - RESEND_API_KEY missing");
    return;
  }

  const greetingName = options.name?.trim() || "there";

  try {
    const result = await resend.emails.send({
      from: "Cutting Edge Leads <noreply@cuttingedgeleads.net>",
      to: options.to,
      subject: "Reset your Cutting Edge Leads password",
      html: `
        <div style="font-family: Arial, sans-serif; color: #0f172a;">
          <h2 style="margin-bottom: 4px;">Password reset</h2>
          <p style="margin-top: 0;">Hi ${greetingName},</p>
          <p>We received a request to reset your password. Click the button below to set a new password.</p>
          <p style="margin-top: 16px;">
            <a href="${options.resetUrl}" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Reset password</a>
          </p>
          <p style="margin-top: 16px; font-size: 12px; color:#64748b;">If you didn’t request this, you can safely ignore this email.</p>
        </div>
      `,
    });
    console.log("[Email] Password reset email sent:", JSON.stringify(result));
  } catch (error) {
    console.error("[Email] Failed to send password reset email:", error);
  }
}
