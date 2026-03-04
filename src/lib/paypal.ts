const PAYPAL_API_BASE =
  process.env.PAYPAL_API_BASE ||
  (process.env.NODE_ENV === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com");

function getPayPalCredentials() {
  const clientId = (process.env.PAYPAL_CLIENT_ID || "").trim();
  const secret = (process.env.PAYPAL_SECRET || "").trim();
  if (!clientId || !secret) {
    throw new Error("Missing PayPal credentials");
  }
  return { clientId, secret };
}

export async function getPayPalAccessToken() {
  const { clientId, secret } = getPayPalCredentials();
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal token error: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token as string;
}

export async function createPayPalOrder({
  leadId,
  amount,
  description,
  vault,
}: {
  leadId: string;
  amount: string;
  description: string;
  vault?: boolean;
}) {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      application_context: {
        shipping_preference: "NO_SHIPPING",
      },
      purchase_units: [
        {
          custom_id: leadId,
          description,
          amount: {
            currency_code: "USD",
            value: amount,
          },
        },
      ],
      ...(vault
        ? {
            payment_source: {
              card: {
                attributes: {
                  vault: {
                    store_in_vault: "ON_SUCCESS",
                  },
                },
              },
            },
          }
        : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal create order error: ${errorText}`);
  }

  return response.json();
}

export async function capturePayPalOrder(orderId: string) {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal capture error: ${errorText}`);
  }

  return response.json();
}
