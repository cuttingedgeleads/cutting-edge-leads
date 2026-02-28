"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { LeadPhotoInput, LeadPhotoInputRef } from "@/components/LeadPhotoInput";

const MIN_PRICE = 20;

export function LeadForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const photoInputRef = useRef<LeadPhotoInputRef>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const form = event.currentTarget;
      
      // Step 1: Create FormData
      let formData: FormData;
      try {
        formData = new FormData(form);
      } catch (e) {
        setError("Error creating form data: " + (e instanceof Error ? e.message : String(e)));
        return;
      }
      
      // Step 2: Add photos
      try {
        const photos = photoInputRef.current?.getFiles() || [];
        photos.forEach((file) => {
          formData.append("photos", file);
        });
      } catch (e) {
        setError("Error adding photos: " + (e instanceof Error ? e.message : String(e)));
        return;
      }

      // Step 3: Send request
      let response: Response;
      try {
        response = await fetch("/api/leads/create", {
          method: "POST",
          body: formData,
        });
      } catch (e) {
        setError("Network error: " + (e instanceof Error ? e.message : String(e)));
        return;
      }

      // Step 4: Parse response
      let result;
      try {
        result = await response.json();
      } catch (e) {
        setError("Error parsing response: " + (e instanceof Error ? e.message : String(e)));
        return;
      }

      if (!response.ok) {
        setError(result.error || "Failed to create lead");
        return;
      }

      // Step 5: Success - refresh
      photoInputRef.current?.clear();
      form.reset();
      router.refresh();
    } catch (err) {
      console.error("Submit error:", err);
      setError("Unexpected error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
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
        <LeadPhotoInput ref={photoInputRef} />
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
