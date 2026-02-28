"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { LeadPhotoInput } from "@/components/LeadPhotoInput";

const MIN_PRICE = 20;

export function LeadForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);

      const response = await fetch("/api/leads/create", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to create lead");
        return;
      }

      // Success - refresh the page to show the new lead
      router.refresh();
      form.reset();
    } catch (err) {
      console.error("Submit error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="text-sm font-medium">Name</label>
        <input
          name="name"
          className="mt-1 w-full rounded-lg border px-3 py-2"
          placeholder="Customer name"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Email</label>
        <input
          name="email"
          type="email"
          className="mt-1 w-full rounded-lg border px-3 py-2"
          placeholder="customer@email.com"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Job type</label>
        <select name="jobType" className="mt-1 w-full rounded-lg border px-3 py-2" required>
          <option value="">Select a job type</option>
          <option value="Grass Cutting">Grass Cutting</option>
          <option value="Landscaping">Landscaping</option>
          <option value="Grass and Landscaping Maintenance">
            Grass and Landscaping Maintenance
          </option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Price (min ${MIN_PRICE})</label>
        <input
          name="price"
          type="number"
          min={MIN_PRICE}
          className="mt-1 w-full rounded-lg border px-3 py-2"
          required
        />
      </div>
      <div className="sm:col-span-2">
        <label className="text-sm font-medium">Description</label>
        <textarea
          name="description"
          rows={4}
          className="mt-1 w-full rounded-lg border px-3 py-2"
          required
        />
      </div>
      <div className="sm:col-span-2">
        <label className="text-sm font-medium">Street address</label>
        <AddressAutocomplete />
      </div>
      <div>
        <label className="text-sm font-medium">City</label>
        <input
          name="city"
          id="city"
          className="mt-1 w-full rounded-lg border px-3 py-2"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">State</label>
        <input
          name="state"
          id="state"
          className="mt-1 w-full rounded-lg border px-3 py-2"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Zip</label>
        <input
          name="zip"
          id="zip"
          className="mt-1 w-full rounded-lg border px-3 py-2"
          required
        />
      </div>
      <div className="sm:col-span-2">
        <label className="text-sm font-medium">Photos</label>
        <LeadPhotoInput />
      </div>
      
      {error && (
        <div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-slate-900 text-white py-2 font-medium disabled:opacity-50"
        >
          {isSubmitting ? "Publishing..." : "Publish lead"}
        </button>
      </div>
    </form>
  );
}
