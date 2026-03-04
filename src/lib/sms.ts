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

export const sendSms = async (to: string, body: string) => {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    console.warn("[SMS] Missing TWILIO_PHONE_NUMBER.");
    return;
  }

  const client = createClient();
  if (!client) return;

  try {
    await client.messages.create({ to, from, body });
  } catch (error) {
    console.error("[SMS] Failed to send SMS:", error);
  }
};
