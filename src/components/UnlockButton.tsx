"use client";

import { useState } from "react";
import { FUNDING, PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useRouter } from "next/navigation";

interface UnlockButtonProps {
  leadId: string;
  jobType: string;
  city: string;
  price: number;
  paypalClientId: string;
}

type CheckoutStatus = "idle" | "creating" | "processing" | "success" | "error";

export function UnlockButton({ leadId, jobType, city, price, paypalClientId }: UnlockButtonProps) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const createOrder = async () => {
    setStatus("creating");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });

      const data = await response.json();
      if (!response.ok) {
        const message = data?.error || "Unable to start checkout.";
        console.error("PayPal create order failed", { status: response.status, data });
        setStatus("error");
        setErrorMessage(message);
        throw new Error(message);
      }

      setStatus("idle");
      return data.orderId as string;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start checkout.";
      console.error("PayPal create order exception", error);
      setStatus("error");
      setErrorMessage(message);
      throw error;
    }
  };

  const handleApprove = async (orderId: string) => {
    setStatus("processing");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/paypal/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, leadId }),
      });

      const data = await response.json();
      if (!response.ok) {
        const message = data?.error || "Unable to confirm payment.";
        console.error("PayPal capture failed", { status: response.status, data });
        setStatus("error");
        setErrorMessage(message);
        return;
      }

      setStatus("success");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to confirm payment.";
      console.error("PayPal capture exception", error);
      setStatus("error");
      setErrorMessage(message);
    }
  };

  const resetModal = () => {
    setStatus("idle");
    setErrorMessage(null);
    setShowCheckout(false);
  };

  return (
    <>
      <button
        onClick={() => setShowCheckout(true)}
        className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800 transition-colors"
      >
        Unlock lead
      </button>

      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto overscroll-contain touch-pan-y">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain touch-pan-y">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Unlock this lead</h3>
              <p className="text-sm text-slate-600">
                Pay securely to unlock the full customer details.
              </p>
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                <p>
                  <span className="font-medium">Job:</span> {jobType}
                </p>
                <p>
                  <span className="font-medium">Location:</span> {city}
                </p>
                <p>
                  <span className="font-medium">Price:</span> ${price}
                </p>
              </div>
              {/* Vaulting disabled: no save-card checkbox. */}
              <p className="text-xs text-slate-500">
                Pay with PayPal, Venmo, or Apple Pay (where available).
              </p>
            </div>

            {paypalClientId ? (
              <PayPalScriptProvider
                options={{
                  clientId: paypalClientId,
                  currency: "USD",
                  intent: "capture",
                  enableFunding: ["venmo", "applepay"],
                  disableFunding: ["paylater", "credit"],
                  components: "buttons,funding-eligibility",
                }}
              >
                <div className="space-y-3">
                  <PayPalButtons
                    style={{ layout: "vertical" }}
                    createOrder={createOrder}
                    onApprove={(data) => handleApprove(data.orderID)}
                    onCancel={() => {
                      setStatus("idle");
                      setErrorMessage(null);
                    }}
                    onError={(err) => {
                      console.error("PayPal checkout error", err);
                      const errMsg = err instanceof Error ? err.message : String(err);
                      setStatus("error");
                      setErrorMessage(errMsg || "PayPal checkout failed. Please try again.");
                    }}
                    disabled={status === "creating" || status === "processing"}
                  />
                  <PayPalButtons
                    fundingSource={FUNDING.VENMO}
                    style={{ layout: "vertical", color: "blue" }}
                    createOrder={createOrder}
                    onApprove={(data) => handleApprove(data.orderID)}
                    onCancel={() => {
                      setStatus("idle");
                      setErrorMessage(null);
                    }}
                    onError={(err) => {
                      console.error("Venmo checkout error", err);
                      const errMsg = err instanceof Error ? err.message : String(err);
                      setStatus("error");
                      setErrorMessage(errMsg || "Venmo checkout failed. Please try again.");
                    }}
                    disabled={status === "creating" || status === "processing"}
                  />
                </div>
              </PayPalScriptProvider>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                PayPal is not configured yet. Please contact support.
              </div>
            )}

            {status === "processing" ? (
              <p className="text-sm text-slate-600">Confirming payment...</p>
            ) : null}
            {status === "success" ? (
              <p className="text-sm text-green-600 font-semibold">
                Payment confirmed. Lead unlocked!
              </p>
            ) : null}
            {status === "error" ? (
              <p className="text-sm text-red-600">{errorMessage || "Payment failed."}</p>
            ) : null}

            <div className="flex gap-3 justify-end">
              <button
                onClick={resetModal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
              >
                {status === "success" ? "Close" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
