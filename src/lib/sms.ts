import twilio from "twilio";

const createClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;

  if (!accountSid || !apiKeySid || !apiKeySecret) {
    console.warn("[SMS] Missing Twilio credentials.");
    return null;
  }

  return twilio(apiKeySid, apiKeySecret, { accountSid });
};

const normalizePhone = (value: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
};

export const sendSms = async (to: string, body: string) => {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    console.warn("[SMS] Missing TWILIO_PHONE_NUMBER.");
    return;
  }

  const normalizedTo = normalizePhone(to);
  if (!normalizedTo) {
    console.warn("[SMS] Invalid phone number:", to);
    return;
  }

  const client = createClient();
  if (!client) return;

  try {
    console.log("[SMS] Sending SMS to", normalizedTo);
    await client.messages.create({ to: normalizedTo, from, body });
  } catch (error) {
    console.error("[SMS] Failed to send SMS:", error);
  }
};
