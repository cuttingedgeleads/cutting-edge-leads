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
  photoUrl?: string | null;
}) {
  console.log("[Email] sendNewLeadEmail called with recipients:", options.to);
  
  if (!resend) {
    console.log("[Email] Resend not initialized - RESEND_API_KEY missing");
    return;
  }

  const photoMarkup = options.photoUrl
    ? `<img src="${options.photoUrl}" alt="Lead photo" style="max-width: 240px; border-radius: 12px;" />`
    : "";

  try {
    const result = await resend.emails.send({
      from: "Cutting Edge Leads <noreply@cuttingedgeautodetaling.com>",
      to: "noreply@cuttingedgeautodetaling.com",
      bcc: options.to,
      subject: `New Lead: ${options.jobType} in ${options.city}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #0f172a;">
          <h2>New lead available</h2>
          <p><strong>${options.jobType}</strong> - ${options.city}, ${options.zip}</p>
          <p>${options.description}</p>
          ${photoMarkup}
          <p style="margin-top: 16px;">
            <a href="${options.loginUrl}" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Login to request</a>
          </p>
        </div>
      `,
    });
    console.log("[Email] Send result:", JSON.stringify(result));
  } catch (error) {
    console.error("[Email] Failed to send:", error);
  }
}
