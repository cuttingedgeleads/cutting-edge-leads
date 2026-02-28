"use client";

import { useState } from "react";

interface UnlockButtonProps {
  leadId: string;
  contractorId: string;
  jobType: string;
  city: string;
  price: number;
  onSubmit: (formData: FormData) => Promise<void>;
}

export function UnlockButton({ leadId, contractorId, jobType, city, price, onSubmit }: UnlockButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("leadId", leadId);
    formData.append("contractorId", contractorId);
    await onSubmit(formData);
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800 transition-colors"
      >
        Request unlock
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold">Confirm Unlock Request</h3>
            <div className="space-y-2 text-sm text-slate-700">
              <p>Are you sure you want to request this lead?</p>
              <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                <p><span className="font-medium">Job:</span> {jobType}</p>
                <p><span className="font-medium">Location:</span> {city}</p>
                <p><span className="font-medium">Price:</span> ${price}</p>
              </div>
              <p className="text-xs text-slate-500">
                An admin will review your request. Payment is handled offline.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Confirm Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
