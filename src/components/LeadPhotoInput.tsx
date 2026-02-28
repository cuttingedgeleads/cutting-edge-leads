"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Preview = {
  url: string;
  name: string;
};

export function LeadPhotoInput() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Preview[]>([]);

  const collectFiles = useCallback(() => {
    const cameraFiles = Array.from(cameraInputRef.current?.files || []);
    const uploadFiles = Array.from(uploadInputRef.current?.files || []);
    return [...cameraFiles, ...uploadFiles];
  }, []);

  const updatePreviews = useCallback(() => {
    const files = collectFiles();
    const nextPreviews = files.map((file) => ({
      url: URL.createObjectURL(file),
      name: file.name || "photo",
    }));
    setPreviews(nextPreviews);
  }, [collectFiles]);

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  const hasPreviews = previews.length > 0;

  return (
    <div className="mt-1 rounded-lg border px-3 py-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Take photo
        </button>
        <button
          type="button"
          onClick={() => uploadInputRef.current?.click()}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Upload from device
        </button>
      </div>

      <input
        ref={cameraInputRef}
        name="photos"
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={updatePreviews}
      />
      <input
        ref={uploadInputRef}
        name="photos"
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={updatePreviews}
      />

      {hasPreviews ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {previews.map((preview, index) => (
            <div
              key={`${preview.url}-${index}`}
              className="relative overflow-hidden rounded-lg border bg-slate-50"
            >
              <img
                src={preview.url}
                alt={preview.name}
                className="h-28 w-full object-cover"
              />
              <div className="px-2 py-1 text-[11px] text-slate-600 truncate">
                {preview.name}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">No photos selected yet.</p>
      )}
    </div>
  );
}
