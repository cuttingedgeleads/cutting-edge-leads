"use client";

import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useRouter } from "next/navigation";

interface UnlockButtonProps {
  leadId: string;
  jobType: string;
  city: string;
  price: number;
  paypalClientId: string;
  hasSavedPaypal: boolean;
}

type CheckoutStatus =
  | "idle"
  | "creating"
  | "sending-code"
  | "verifying-code"
  | "charging"
  | "processing"
  | "success"
  | "error";

const CODE_LENGTH = 6;

export function UnlockButton({
  leadId,
  jobType,
  city,
  price,
  paypalClientId,
  hasSavedPaypal,
}: UnlockButtonProps) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [codeDigits, setCodeDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [codeSent, setCodeSent] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const router = useRouter();

  const codeValue = useMemo(() => codeDigits.join(""), [codeDigits]);

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

  const handleSendCode = async () => {
    setStatus("sending-code");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/sms/send-code", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        const message = data?.error || "Unable to send verification code.";
        setStatus("error");
        setErrorMessage(message);
        return;
      }

      setCodeSent(true);
      setStatus("idle");
      setCodeDigits(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send verification code.";
      setStatus("error");
      setErrorMessage(message);
    }
  };

  const handleVerifyAndCharge = async () => {
    const trimmedCode = codeValue.trim();
    if (trimmedCode.length !== CODE_LENGTH) {
      setStatus("error");
      setErrorMessage("Enter the 6-digit verification code.");
      return;
    }

    setStatus("verifying-code");
    setErrorMessage(null);

    try {
      const verifyResponse = await fetch("/api/sms/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmedCode }),
      });
      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok) {
        const message = verifyData?.error || "Verification failed.";
        setStatus("error");
        setErrorMessage(message);
        return;
      }

      // Get the verification token from the response
      const verificationToken = verifyData.token;
      if (!verificationToken) {
        setStatus("error");
        setErrorMessage("Verification failed. Please try again.");
        return;
      }

      setStatus("charging");
      const chargeResponse = await fetch("/api/paypal/charge-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, verificationToken }),
      });
      const chargeData = await chargeResponse.json();
      if (!chargeResponse.ok) {
        const message = chargeData?.error || "Unable to complete payment.";
        setStatus("error");
        setErrorMessage(message);
        return;
      }

      setStatus("success");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to complete payment.";
      setStatus("error");
      setErrorMessage(message);
    }
  };

  const updateDigit = (index: number, value: string) => {
    const sanitized = value.replace(/\D/g, "");
    if (!sanitized) {
      const nextDigits = [...codeDigits];
      nextDigits[index] = "";
      setCodeDigits(nextDigits);
      return;
    }

    const nextDigits = [...codeDigits];
    const chars = sanitized.split("");
    chars.slice(0, CODE_LENGTH - index).forEach((char, offset) => {
      nextDigits[index + offset] = char;
    });
    setCodeDigits(nextDigits);

    const nextIndex = Math.min(index + chars.length, CODE_LENGTH - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const resetModal = () => {
    setStatus("idle");
    setErrorMessage(null);
    setShowCheckout(false);
    setCodeSent(false);
    setCodeDigits(Array(CODE_LENGTH).fill(""));
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
              <p className="text-xs text-slate-500">Pay with PayPal.</p>
            </div>

            {hasSavedPaypal ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Pay with saved PayPal. We&apos;ll text a verification code to confirm.
                </div>
                {!codeSent ? (
                  <button
                    onClick={handleSendCode}
                    className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    disabled={status === "sending-code"}
                  >
                    {status === "sending-code" ? "Sending code..." : `Unlock lead ($${price})`}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">
                      Enter the 6-digit code we texted you.
                    </p>
                    <div className="flex justify-center gap-2">
                      {codeDigits.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => {
                            inputRefs.current[index] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={CODE_LENGTH}
                          className="h-11 w-11 rounded-md border border-slate-300 text-center text-lg"
                          value={digit}
                          onChange={(event) => updateDigit(index, event.target.value)}
                          onKeyDown={(event) => handleKeyDown(index, event)}
                        />
                      ))}
                    </div>
                    <button
                      onClick={handleVerifyAndCharge}
                      className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                      disabled={status === "verifying-code" || status === "charging"}
                    >
                      {status === "verifying-code"
                        ? "Verifying..."
                        : status === "charging"
                          ? "Processing payment..."
                          : `Verify & Pay $${price}`}
                    </button>
                    <button
                      onClick={handleSendCode}
                      className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      disabled={status === "sending-code"}
                    >
                      Resend code
                    </button>
                  </div>
                )}
              </div>
            ) : paypalClientId ? (
              <PayPalScriptProvider
                options={{
                  clientId: paypalClientId,
                  currency: "USD",
                  intent: "capture",
                  components: "buttons,funding-eligibility",
                  "disable-funding": "card,credit,paylater",
                }}
              >
                <div className="space-y-2">
                  <PayPalButtons
                    style={{ layout: "vertical", label: "paypal" }}
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
                      setErrorMessage(errMsg || "Checkout failed. Please try again.");
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
