"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Preview = {
  id: string;
  url: string;
  name: string;
  file: File;
};

export function LeadPhotoInput() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const submitInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Preview[]>([]);

  const syncSubmitFiles = useCallback((files: File[]) => {
    const dataTransfer = new DataTransfer();
    files.forEach((file) => dataTransfer.items.add(file));
    if (submitInputRef.current) {
      submitInputRef.current.files = dataTransfer.files;
    }
  }, []);

  const addFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setPreviews((current) => {
      const next = [...current];
      files.forEach((file) => {
        next.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
          url: URL.createObjectURL(file),
          name: file.name || "photo",
          file,
        });
      });
      syncSubmitFiles(next.map((preview) => preview.file));
      return next;
    });
  }, [syncSubmitFiles]);

  const removePreview = useCallback((id: string) => {
    setPreviews((current) => {
      const preview = current.find((item) => item.id === id);
      if (preview) {
        URL.revokeObjectURL(preview.url);
      }
      const next = current.filter((item) => item.id !== id);
      syncSubmitFiles(next.map((item) => item.file));
      return next;
    });
  }, [syncSubmitFiles]);

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
        ref={submitInputRef}
        name="photos"
        type="file"
        multiple
        className="hidden"
        aria-hidden
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(event) => {
          addFiles(Array.from(event.currentTarget.files || []));
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          addFiles(Array.from(event.currentTarget.files || []));
          event.currentTarget.value = "";
        }}
      />

      {hasPreviews ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {previews.map((preview) => (
            <div
              key={preview.id}
              className="relative overflow-hidden rounded-lg border bg-slate-50"
            >
              <button
                type="button"
                onClick={() => removePreview(preview.id)}
                className="absolute right-1 top-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-700 shadow"
              >
                Remove
              </button>
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
