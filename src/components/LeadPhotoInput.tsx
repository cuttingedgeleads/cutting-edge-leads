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
  const combinedInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const previewsRef = useRef<Preview[]>([]);

  const syncHiddenInput = useCallback((files: File[]) => {
    if (!combinedInputRef.current) return;
    const dataTransfer = new DataTransfer();
    files.forEach((file) => dataTransfer.items.add(file));
    combinedInputRef.current.files = dataTransfer.files;
  }, []);

  const addFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const next = Array.from(fileList).map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
        url: URL.createObjectURL(file),
        name: file.name || "photo",
        file,
      }));
      setPreviews((prev) => {
        const updated = [...prev, ...next];
        previewsRef.current = updated;
        syncHiddenInput(updated.map((preview) => preview.file));
        return updated;
      });
    },
    [syncHiddenInput]
  );

  useEffect(() => {
    return () => {
      previewsRef.current.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, []);

  const removePreview = useCallback(
    (id: string) => {
      setPreviews((prev) => {
        const target = prev.find((preview) => preview.id === id);
        if (target) URL.revokeObjectURL(target.url);
        const updated = prev.filter((preview) => preview.id !== id);
        previewsRef.current = updated;
        syncHiddenInput(updated.map((preview) => preview.file));
        return updated;
      });
    },
    [syncHiddenInput]
  );

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
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(event) => {
          addFiles(event.currentTarget.files);
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
          addFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={combinedInputRef}
        name="photos"
        type="file"
        multiple
        className="hidden"
        readOnly
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
                aria-label={`Remove ${preview.name}`}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600/80 text-xs font-bold text-white shadow-sm hover:bg-red-600"
              >
                ×
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
