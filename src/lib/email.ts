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

  const baseUrl = process.env.NEXTAUTH_URL || "https://www.cuttingedgeautodetaling.com";
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
            from: "Cutting Edge Leads <noreply@cuttingedgeautodetaling.com>",
            to: recipient,
            subject: `New Lead Available: ${options.jobType} in ${options.city}`,
            html: `
              <div style="font-family: Arial, sans-serif; color: #0f172a;">
                <h2>New Lead available</h2>
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
