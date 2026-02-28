"use client";

import { useRef, useState, forwardRef, useImperativeHandle } from "react";

export type LeadPhotoInputRef = {
  getFiles: () => File[];
  clear: () => void;
};

export const LeadPhotoInput = forwardRef<LeadPhotoInputRef>(function LeadPhotoInput(_, ref) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  useImperativeHandle(ref, () => ({
    getFiles: () => files,
    clear: () => {
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
  }), [files]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="mt-1 rounded-lg border px-3 py-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">
          Add photos
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleChange}
          />
        </label>
      </div>

      {files.length > 0 ? (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between rounded border bg-slate-50 px-3 py-2"
            >
              <span className="text-sm truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white hover:bg-red-700"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">No photos selected yet.</p>
      )}
    </div>
  );
});
