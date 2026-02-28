"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { LeadPhotoInput, LeadPhotoInputRef } from "@/components/LeadPhotoInput";

const MIN_PRICE = 20;
const MAX_IMAGE_SIZE = 800; // Max width/height in pixels
const IMAGE_QUALITY = 0.7; // JPEG quality (0-1)

// Compress image using canvas
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      
      // Scale down if needed
      if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
        if (width > height) {
          height = (height / width) * MAX_IMAGE_SIZE;
          width = MAX_IMAGE_SIZE;
        } else {
          width = (width / height) * MAX_IMAGE_SIZE;
          height = MAX_IMAGE_SIZE;
        }
      }
      
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file); // Fallback to original if compression fails
          }
        },
        "image/jpeg",
        IMAGE_QUALITY
      );
    };
    img.onerror = () => resolve(file); // Fallback to original on error
    img.src = URL.createObjectURL(file);
  });
}

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
      
      // Step 2: Compress and add photos
      try {
        const photos = photoInputRef.current?.getFiles() || [];
        for (let i = 0; i < photos.length; i++) {
          const file = photos[i];
          // Compress the image
          const compressed = await compressImage(file);
          // Create unique filename
          const uniqueName = `photo-${Date.now()}-${i}.jpg`;
          const renamedFile = new File([compressed], uniqueName, { type: "image/jpeg" });
          formData.append("photos", renamedFile);
        }
      } catch (e) {
        // If compression fails, try without compression
        try {
          const photos = photoInputRef.current?.getFiles() || [];
          photos.forEach((file) => {
            formData.append("photos", file);
          });
        } catch (e2) {
          setError("Error adding photos: " + (e2 instanceof Error ? e2.message : String(e2)));
          return;
        }
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
        const text = await response.text();
        try {
          result = JSON.parse(text);
        } catch {
          // Server returned non-JSON (probably HTML error page)
          setError("Server error: " + (text.length > 200 ? text.substring(0, 200) + "..." : text));
          return;
        }
      } catch (e) {
        setError("Error reading response: " + (e instanceof Error ? e.message : String(e)));
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
