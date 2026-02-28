"use client";

import { useRef, useState, forwardRef, useImperativeHandle, useEffect } from "react";

type PhotoItem = {
  id: string;
  file: File;
  previewUrl: string;
};

export type LeadPhotoInputRef = {
  getFiles: () => File[];
  clear: () => void;
};

export const LeadPhotoInput = forwardRef<LeadPhotoInputRef>(function LeadPhotoInput(_, ref) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  useImperativeHandle(ref, () => ({
    getFiles: () => photos.map((p) => p.file),
    clear: () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPhotos([]);
    },
  }), [photos]);

  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    
    const newPhotos: PhotoItem[] = Array.from(fileList).map((file) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      return {
        id,
        file, // Keep original file, don't rename
        previewUrl: URL.createObjectURL(file),
      };
    });
    
    setPhotos((prev) => [...prev, ...newPhotos]);
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

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

      {photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative overflow-hidden rounded-lg border bg-slate-50"
            >
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                aria-label="Remove photo"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600/80 text-xs font-bold text-white shadow-sm hover:bg-red-600 z-10"
              >
                ×
              </button>
              <img
                src={photo.previewUrl}
                alt="Photo preview"
                className="h-28 w-full object-cover"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">No photos selected yet.</p>
      )}
    </div>
  );
});
