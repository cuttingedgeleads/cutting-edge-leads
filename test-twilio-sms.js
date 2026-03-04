const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const apiKeySid = process.env.TWILIO_API_KEY_SID;
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
const from = process.env.TWILIO_PHONE_NUMBER;
const to = process.env.TWILIO_TO_PHONE;

if (!accountSid || !apiKeySid || !apiKeySecret || !from || !to) {
  console.error("Missing env vars. Required: TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_PHONE_NUMBER, TWILIO_TO_PHONE");
  process.exit(1);
}

const client = twilio(apiKeySid, apiKeySecret, { accountSid });

(async () => {
  try {
    const message = await client.messages.create({ to, from, body: "Twilio test from Cutting Edge Leads." });
    console.log("Message sent:", message.sid);
  } catch (error) {
    console.error("Failed to send test SMS:", error);
    process.exit(1);
  }
})();
