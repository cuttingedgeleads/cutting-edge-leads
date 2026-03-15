import twilio from "twilio";

const normalizePhone = (value: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
};

const createClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials are missing.");
  }

  return twilio(accountSid, authToken);
};

export async function sendVerificationCode(to: string, code: string) {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    throw new Error("Twilio phone number is missing.");
  }

  const normalizedTo = normalizePhone(to);
  if (!normalizedTo) {
    throw new Error("Invalid phone number on file.");
  }

  const client = createClient();

  await client.messages.create({
    to: normalizedTo,
    from,
    body: `Your Cutting Edge Leads verification code is ${code}. It expires in 5 minutes.`,
  });
}
