import nodemailer from "nodemailer";

const enabled = process.env.EMAIL_ENABLED === "true";

export async function sendNewLeadEmail(options: {
  to: string[];
  loginUrl: string;
  jobType: string;
  city: string;
  zip: string;
  description: string;
  photoUrl?: string | null;
}) {
  if (!enabled) return;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const photoMarkup = options.photoUrl
    ? `<img src="${options.photoUrl}" alt="Lead photo" style="max-width: 240px; border-radius: 12px;" />`
    : "";

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "cuttingedgechatbot@gmail.com",
    to: options.to,
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
}
