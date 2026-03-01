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
  const [quickPasteText, setQuickPasteText] = useState("");

  function parseQuickPaste(text: string) {
    // v3 - Added description auto-fill 2026-02-28 18:43
    if (!text.trim()) return;

    // Working copy that we'll progressively clean as we extract data
    let workingText = text;
    
    // 1. Extract EMAIL first (most reliable, has @)
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
    const emailMatch = workingText.match(emailRegex);
    if (emailMatch) {
      const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
      if (emailInput) emailInput.value = emailMatch[1];
      // Remove email from working text
      workingText = workingText.replace(emailMatch[0], ' ');
    }

    // 2. Extract PHONE next (before address to prevent digit bleeding)
    const phoneRegex = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
    const phoneMatch = workingText.match(phoneRegex);
    let phoneFormatted = '';
    if (phoneMatch) {
      const phoneInput = document.querySelector('input[name="phone"]') as HTMLInputElement;
      if (phoneInput) {
        // Format phone number
        const digits = phoneMatch[0].replace(/\D/g, '');
        phoneFormatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        phoneInput.value = phoneFormatted;
      }
      // Remove phone from working text (critical to prevent address contamination)
      workingText = workingText.replace(phoneMatch[0], ' ');
    }

    // 3. Extract ADDRESS from cleaned text (with word boundary before house number)
    // Now that phone is removed, the address digits won't be contaminated
    const addressRegex = /\b\d+\s+[A-Za-z0-9\s.,#-]+?(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl|Way|Circle|Cir|Parkway|Pkwy|Trail|Trl)\b/i;
    const addressMatch = workingText.match(addressRegex);
    if (addressMatch) {
      const streetAddress = addressMatch[0].trim();
      const addressInput = document.querySelector('input[name="address"]') as HTMLInputElement;
      if (addressInput) addressInput.value = streetAddress;
      // Remove address from working text
      workingText = workingText.replace(addressMatch[0], ' ');
    }

    // 4. Extract CITY (look for word after comma, or remaining capitalized words)
    const cityMatch = workingText.match(/,\s*([A-Za-z\s]+)/);
    if (cityMatch) {
      const cityInput = document.querySelector('input[name="city"]') as HTMLInputElement;
      if (cityInput) cityInput.value = cityMatch[1].trim();
      // Remove city from working text
      workingText = workingText.replace(cityMatch[0], ' ');
    }

    // 5. Extract NAME from remaining text (whatever alphabetic text is left)
    const cleanedText = workingText
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[,]/g, '') // Remove commas
      .trim();
    
    let extractedName = '';
    if (cleanedText) {
      // Look for name-like patterns (letters, spaces, hyphens, apostrophes)
      const nameMatch = cleanedText.match(/^([A-Za-z\s'-]+)/);
      if (nameMatch) {
        const name = nameMatch[1].trim();
        if (name.length >= 2 && name.length < 50) {
          const nameInput = document.querySelector('input[name="name"]') as HTMLInputElement;
          if (nameInput) nameInput.value = name;
          extractedName = name;
          // Remove extracted name from working text
          workingText = workingText.replace(name, ' ');
        }
      }
    }

    // 6. Auto-fill DESCRIPTION with remaining meaningful text
    const remainingText = workingText
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[,]/g, '') // Remove commas
      .trim();
    
    if (remainingText && remainingText.length >= 5) {
      // Only fill description if there's meaningful text left (at least 5 chars)
      const descriptionInput = document.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
      if (descriptionInput) {
        descriptionInput.value = remainingText;
      }
    }

    // Clear the quick paste textarea
    setQuickPasteText("");
  }

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
      {/* Quick Paste Section */}
      <div className="sm:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <label className="text-sm font-medium text-blue-900">
          ⚡ Quick Paste
          <span className="ml-2 text-xs font-normal text-blue-700">
            Paste contact info and we'll auto-fill the form
          </span>
        </label>
        <textarea
          value={quickPasteText}
          onChange={(e) => setQuickPasteText(e.target.value)}
          onPaste={(e) => {
            // Small delay to ensure paste content is in textarea
            setTimeout(() => {
              parseQuickPaste(e.currentTarget.value);
            }, 10);
          }}
          className="mt-2 w-full rounded-lg border border-blue-300 px-3 py-2 text-sm"
          rows={4}
          placeholder="Paste contact info here, e.g.:&#10;Logan Harch&#10;(504) 358-4856&#10;5201 Meadowdale St, Metairie&#10;loganharch@gmail.com"
        />
        <button
          type="button"
          onClick={() => parseQuickPaste(quickPasteText)}
          className="mt-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
        >
          Parse & Fill Form
        </button>
      </div>

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
        <label className="text-sm font-medium">Email (optional)</label>
        <input
          name="email"
          type="email"
          className="mt-1 w-full rounded-lg border px-3 py-2"
          placeholder="customer@email.com"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Phone</label>
        <input
          name="phone"
          type="tel"
          className="mt-1 w-full rounded-lg border px-3 py-2"
          placeholder="(555) 123-4567"
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
