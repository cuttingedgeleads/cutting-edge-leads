"use client";

import { useEffect, useRef, useState } from "react";

type GoogleMaps = typeof google;

export function AddressAutocomplete() {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [enabled] = useState(Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY));

  useEffect(() => {
    if (!enabled || !inputRef.current) return;

    const initAutocomplete = () => {
      if (!inputRef.current || !(window as { google?: GoogleMaps }).google) return;
      
      // Prevent duplicate initialization
      if (autocompleteRef.current) return;
      
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        fields: ["address_components", "formatted_address"],
        types: ["address"],
        componentRestrictions: { country: "us" },
      });
      
      autocompleteRef.current = autocomplete;

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const components = place.address_components || [];

        const find = (type: string) =>
          components.find((component) => component.types.includes(type))?.long_name || "";

        const streetNumber = find("street_number");
        const route = find("route");
        const city = find("locality") || find("sublocality") || find("postal_town");
        const state = find("administrative_area_level_1");
        const zip = find("postal_code");

        const address = [streetNumber, route].filter(Boolean).join(" ").trim();

        if (inputRef.current && address) {
          inputRef.current.value = address;
        }

        const cityInput = document.getElementById("city") as HTMLInputElement | null;
        const stateInput = document.getElementById("state") as HTMLInputElement | null;
        const zipInput = document.getElementById("zip") as HTMLInputElement | null;

        if (cityInput && city) cityInput.value = city;
        if (stateInput && state) stateInput.value = state;
        if (zipInput && zip) zipInput.value = zip;
      });
    };

    const existingScript = document.getElementById("google-places-script") as HTMLScriptElement | null;
    if (existingScript?.dataset.loaded === "true") {
      initAutocomplete();
      return;
    }

    if (existingScript) {
      existingScript.addEventListener("load", initAutocomplete, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "google-places-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      initAutocomplete();
    });
    document.head.appendChild(script);
  }, [enabled]);

  if (!enabled) {
    return (
      <input
        name="address"
        id="address"
        className="mt-1 w-full rounded-lg border px-3 py-2"
        required
      />
    );
  }

  return (
    <input
      ref={inputRef}
      name="address"
      id="address"
      type="text"
      className="mt-1 w-full rounded-lg border px-3 py-2"
      placeholder="Start typing an address"
      autoComplete="off"
      required
    />
  );
}
