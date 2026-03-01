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
    // v6 - Known city list for New Orleans / Jefferson Parish area
    if (!text.trim()) return;

    // Known cities within 100 miles of Metairie, Louisiana
    const knownCities = new Set([
      // Jefferson Parish
      "kenner", "metairie", "gretna", "harvey", "marrero", "westwego", "terrytown",
      "estelle", "jefferson", "river ridge", "harahan", "elmwood", "bridge city",
      "waggaman", "avondale", "lafitte", "jean lafitte", "barataria", "crown point",
      "grand isle", "timberlane", "woodmere", "lincoln beach", "old metairie",
      "fat city", "bucktown", "nine mile point",
      // Orleans Parish / New Orleans
      "new orleans", "algiers", "gentilly", "lakeview", "mid-city", "midcity",
      "uptown", "downtown", "french quarter", "marigny", "bywater", "treme",
      "central city", "garden district", "irish channel", "carrollton", "hollygrove",
      "broadmoor", "fontainebleau", "lakeshore", "lakewood", "pontchartrain park",
      "east new orleans", "new orleans east", "lower ninth ward", "upper ninth ward",
      "holy cross", "desire", "florida", "st. claude", "saint claude", "st. roch", "saint roch", "seventh ward",
      "milan", "audubon", "black pearl", "freret", "gert town", "leonidas",
      "pigeon town", "dixon", "fillmore", "lake terrace", "lake oaks", "lake vista",
      "navarre", "city park", "fairgrounds", "dillard", "little woods", "read blvd east",
      "viavant", "venetian isles",
      // St. Tammany Parish (North Shore / Covington / Slidell)
      "slidell", "covington", "mandeville", "madisonville", "abita springs", "lacombe",
      "pearl river", "eden isles", "folsom", "bush", "sun", "talisheek",
      "goodbee", "hickory", "lee road", "waldheim", "northshore", "north shore",
      "old mandeville", "fontainebleau", "chinchuba", "lakeshore estates",
      // St. Bernard Parish (Chalmette area)
      "chalmette", "arabi", "meraux", "violet", "poydras", "saint bernard", "st. bernard",
      "delacroix", "yscloskey", "reggio", "alluvial city", "toca", "verret",
      "kenilworth", "promised land",
      // St. Charles Parish
      "luling", "boutte", "destrehan", "st. rose", "saint rose", "norco", "hahnville", "new sarpy",
      "paradis", "ama", "killona", "montz", "taft", "st. charles", "saint charles",
      // St. John the Baptist Parish
      "laplace", "reserve", "garyville", "edgard", "wallace", "mt. airy", "mount airy",
      "pleasure bend", "lions", "st. john", "saint john",
      // St. James Parish
      "gramercy", "lutcher", "paulina", "convent", "vacherie", "st. james", "saint james", "welcome",
      "romeville", "uncle sam",
      // Tangipahoa Parish
      "hammond", "ponchatoula", "amite", "independence", "kentwood", "roseland",
      "tickfaw", "natalbany", "robert", "loranger", "manchac", "akers", "arcola",
      "fluker", "husser", "montpelier",
      // Livingston Parish
      "denham springs", "walker", "livingston", "albany", "springfield", "watson",
      "holden", "killian", "maurepas", "port vincent", "french settlement",
      "head of island", "colyell", "frost",
      // Ascension Parish
      "gonzales", "prairieville", "donaldsonville", "sorrento", "darrow", "burnside",
      "geismar", "st. amant", "saint amant", "galvez", "dutch town", "dutchtown", "pierre part",
      // East Baton Rouge Parish
      "baton rouge", "baker", "zachary", "central", "greenwell springs", "pride",
      "port allen", "scotlandville", "broadmoor", "mid city", "garden district",
      "shenandoah", "jefferson terrace", "southdowns", "bocage", "tara", "inniswold",
      // West Baton Rouge Parish
      "port allen", "addis", "brusly", "erwinville",
      // Iberville Parish
      "plaquemine", "white castle", "maringouin", "grosse tete", "rosedale", "st. gabriel", "saint gabriel",
      // Assumption Parish  
      "napoleonville", "labadieville", "paincourtville", "plattenville", "pierre part",
      // Lafourche Parish
      "thibodaux", "raceland", "lockport", "cut off", "galliano", "golden meadow",
      "larose", "mathews", "des allemands", "kraemer", "lafourche", "chackbay",
      // Terrebonne Parish
      "houma", "gray", "schriever", "bayou cane", "dulac", "cocodrie", "chauvin",
      "montegut", "bourg", "theriot", "dularge", "gibson",
      // Plaquemines Parish
      "belle chasse", "port sulphur", "buras", "venice", "boothville", "empire",
      "pointe a la hache", "braithwaite", "phoenix", "davant", "wood park",
      // Washington Parish
      "bogalusa", "franklinton", "angie", "varnado", "enon", "pine",
      // West Feliciana Parish
      "st. francisville", "saint francisville", "bains",
      // East Feliciana Parish
      "clinton", "jackson", "norwood", "slaughter", "ethel", "wilson",
      // Pointe Coupee Parish
      "new roads", "morganza", "livonia", "fordoche", "innis", "lakeland", "ventress",
    ]);

    // Helper to check if a word sequence is a known city
    const findKnownCity = (text: string): { city: string; match: string } | null => {
      const lowerText = text.toLowerCase();
      // Try 2-word cities first, then 1-word
      for (const city of knownCities) {
        const cityPattern = new RegExp(`\\b${city.replace(/[- ]/g, "[- ]?")}\\b`, "i");
        const match = lowerText.match(cityPattern);
        if (match) {
          // Return properly capitalized city name
          const properCity = city.split(/[\s-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          return { city: properCity, match: match[0] };
        }
      }
      return null;
    };

    const stateNameToAbbr: Record<string, string> = {
      alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
      colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
      hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
      kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
      massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
      montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
      "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
      ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
      "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
      vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
      wyoming: "WY", "district of columbia": "DC",
    };

    const normalizeState = (value: string) => {
      const trimmed = value.trim();
      if (trimmed.length === 2) return trimmed.toUpperCase();
      const key = trimmed.toLowerCase().replace(/\s+/g, " ");
      return stateNameToAbbr[key] || "";
    };

    // Working copy that we'll progressively clean as we extract data
    let workingText = text.trim();

    // 1. FIRST: Extract NAME (first 2 words at the start)
    // Names can be "John Smith", "Mary J", "Jean-Pierre O'Connor"
    const nameMatch = workingText.match(/^([A-Za-z][A-Za-z'-]*)\s+([A-Za-z][A-Za-z'-]*)/);
    if (nameMatch) {
      const fullName = `${nameMatch[1]} ${nameMatch[2]}`;
      const nameInput = document.querySelector('input[name="name"]') as HTMLInputElement;
      if (nameInput) nameInput.value = fullName;
      // Remove name from working text
      workingText = workingText.substring(nameMatch[0].length).trim();
    }

    // 2. Extract EMAIL (has @)
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
    const emailMatch = workingText.match(emailRegex);
    if (emailMatch) {
      const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
      if (emailInput) emailInput.value = emailMatch[1];
      workingText = workingText.replace(emailMatch[0], " ");
    }

    // 3. Extract PHONE (with +1/1 prefix handling)
    const phoneWithPrefixRegex = /(\+1|1)[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
    const phoneBasicRegex = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
    let phoneMatch = workingText.match(phoneWithPrefixRegex);
    if (!phoneMatch) {
      phoneMatch = workingText.match(phoneBasicRegex);
    }
    if (phoneMatch) {
      const phoneInput = document.querySelector('input[name="phone"]') as HTMLInputElement;
      if (phoneInput) {
        let digits = phoneMatch[0].replace(/\D/g, "");
        if (digits.length === 11 && digits.startsWith("1")) {
          digits = digits.slice(1);
        }
        if (digits.length === 10) {
          phoneInput.value = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        }
      }
      workingText = workingText.replace(phoneMatch[0], " ");
    }

    // 4. Extract ADDRESS (number + street name)
    const addressRegexStrict = /\b\d+\s+[A-Za-z0-9\s.,#-]+?(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl|Way|Circle|Cir|Parkway|Pkwy|Trail|Trl)\b/i;
    let addressMatch = workingText.match(addressRegexStrict);
    if (!addressMatch) {
      // Looser: number + words until comma
      const addressRegexLoose = /\b\d+\s+[A-Za-z0-9\s]+(?=,)/;
      addressMatch = workingText.match(addressRegexLoose);
    }
    if (addressMatch) {
      const addressInput = document.querySelector('input[name="address"]') as HTMLInputElement;
      if (addressInput) addressInput.value = addressMatch[0].trim();
      workingText = workingText.replace(addressMatch[0], " ");
    }

    // 5. Extract CITY (match against known cities list)
    const cityResult = findKnownCity(workingText);
    if (cityResult) {
      const cityInput = document.querySelector('input[name="city"]') as HTMLInputElement;
      if (cityInput) cityInput.value = cityResult.city;
      workingText = workingText.replace(new RegExp(cityResult.match, "i"), " ");
    }

    // 6. Extract STATE (2-letter abbr or full name)
    const stateAbbreviations = Object.values(stateNameToAbbr);
    const stateAbbrPattern = stateAbbreviations.join("|");
    const stateNamePattern = Object.keys(stateNameToAbbr)
      .sort((a, b) => b.length - a.length)
      .map((name) => name.replace(/\s+/g, "\\s+"))
      .join("|");
    const stateRegex = new RegExp(`\\b(${stateAbbrPattern}|${stateNamePattern})\\b`, "i");
    const stateMatch = workingText.match(stateRegex);
    if (stateMatch) {
      const normalizedState = normalizeState(stateMatch[1]);
      if (normalizedState) {
        const stateInput = document.querySelector('input[name="state"]') as HTMLInputElement;
        if (stateInput) stateInput.value = normalizedState;
        workingText = workingText.replace(stateMatch[0], " ");
      }
    }

    // 7. Extract ZIP
    const zipMatch = workingText.match(/\b(\d{5})(?:-\d{4})?\b/);
    if (zipMatch) {
      const zipInput = document.querySelector('input[name="zip"]') as HTMLInputElement;
      if (zipInput) zipInput.value = zipMatch[1];
      workingText = workingText.replace(zipMatch[0], " ");
    }

    // 8. LAST: Everything remaining goes to DESCRIPTION
    const remainingText = workingText
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/[,]/g, "") // Remove commas
      .trim()
      .replace(/^[^\w\s]+|[^\w\s]+$/g, ""); // Remove leading/trailing punctuation and special chars

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
