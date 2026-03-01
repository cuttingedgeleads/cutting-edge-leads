"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type EditableLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  jobType: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
};

const emptyError = "";

export function EditLeadButton({ lead }: { lead: EditableLead }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(emptyError);
  const [formValues, setFormValues] = useState({
    name: lead.name || "",
    email: lead.email || "",
    phone: lead.phone || "",
    jobType: lead.jobType || "",
    description: lead.description || "",
    address: lead.address || "",
    city: lead.city || "",
    state: lead.state || "",
    zip: lead.zip || "",
    price: String(lead.price ?? ""),
  });

  const openModal = () => {
    setFormValues({
      name: lead.name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      jobType: lead.jobType || "",
      description: lead.description || "",
      address: lead.address || "",
      city: lead.city || "",
      state: lead.state || "",
      zip: lead.zip || "",
      price: String(lead.price ?? ""),
    });
    setError(emptyError);
    setIsOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsOpen(false);
  };

  const handleChange = (field: keyof typeof formValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(emptyError);

    const payload = {
      ...formValues,
      price: Number(formValues.price),
    };

    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setError(result.error || "Failed to update lead.");
      } else {
        setIsOpen(false);
        router.refresh();
      }
    } catch (err) {
      console.error("Update lead failed:", err);
      setError("Failed to update lead.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
      >
        Edit
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-lg max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit lead</h3>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-slate-600">
                  Job type
                  <input
                    type="text"
                    value={formValues.jobType}
                    onChange={handleChange("jobType")}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    required
                  />
                </label>
                <label className="text-sm text-slate-600">
                  Price
                  <input
                    type="number"
                    min={0}
                    value={formValues.price}
                    onChange={handleChange("price")}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    required
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-slate-600">
                  Name
                  <input
                    type="text"
                    value={formValues.name}
                    onChange={handleChange("name")}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="text-sm text-slate-600">
                  Email
                  <input
                    type="email"
                    value={formValues.email}
                    onChange={handleChange("email")}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-slate-600">
                  Phone
                  <input
                    type="text"
                    value={formValues.phone}
                    onChange={handleChange("phone")}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="text-sm text-slate-600">
                  Address
                  <input
                    type="text"
                    value={formValues.address}
                    onChange={handleChange("address")}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm text-slate-600">
                  City
                  <input
                    type="text"
                    value={formValues.city}
                    onChange={handleChange("city")}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="text-sm text-slate-600">
                  State
                  <input
                    type="text"
                    value={formValues.state}
                    onChange={handleChange("state")}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="text-sm text-slate-600">
                  Zip
                  <input
                    type="text"
                    value={formValues.zip}
                    onChange={handleChange("zip")}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
              </div>
              <label className="text-sm text-slate-600">
                Description
                <textarea
                  rows={4}
                  value={formValues.description}
                  onChange={handleChange("description")}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
