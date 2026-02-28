"use client";

import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";

type Preview = {
  id: string;
  url: string;
  name: string;
  file: File;
};

export type LeadPhotoInputRef = {
  getFiles: () => File[];
  clear: () => void;
};

export const LeadPhotoInput = forwardRef<LeadPhotoInputRef>(function LeadPhotoInput(_, ref) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Preview[]>([]);

  useImperativeHandle(ref, () => ({
    getFiles: () => previews.map((p) => p.file),
    clear: () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
      setPreviews([]);
    },
  }), [previews]);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const newPreviews = Array.from(fileList).map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      url: URL.createObjectURL(file),
      name: file.name || "photo",
      file,
    }));
    setPreviews((prev) => [...prev, ...newPreviews]);
  }, []);

  const removePreview = useCallback((id: string) => {
    setPreviews((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

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
        className="hidden"
        onChange={(e) => {
          addFiles(e.currentTarget.files);
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.currentTarget.files);
          e.currentTarget.value = "";
        }}
      />

      {previews.length > 0 ? (
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
});
