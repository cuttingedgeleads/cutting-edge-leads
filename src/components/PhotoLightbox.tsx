"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactZoomPanPinchRef,
  TransformComponent,
  TransformWrapper,
} from "react-zoom-pan-pinch";

export type PhotoLightboxItem = {
  id?: string;
  url: string;
  alt?: string;
};

type PhotoLightboxProps = {
  photos: PhotoLightboxItem[];
  thumbnailClassName?: string;
  className?: string;
};

export function PhotoLightbox({ photos, thumbnailClassName, className }: PhotoLightboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);

  const orderedPhotos = useMemo(() => {
    const getLabel = (url: string) => {
      if (!url.startsWith("data:")) return null;
      const match = url.match(/^data:[^;]+;name=([^;]+);/i);
      return match?.[1] || null;
    };

    const getPriority = (photo: PhotoLightboxItem) => {
      if (!photo.url.startsWith("data:")) return 3;
      const label = getLabel(photo.url);
      switch (label) {
        case "street":
          return 0;
        case "aerial":
          return 1;
        case "map":
        case "location-preview":
          return 2;
        case "manual":
          return 3;
        default:
          return 4;
      }
    };

    return [...(photos || [])].sort((a, b) => {
      const priority = getPriority(a) - getPriority(b);
      if (priority !== 0) return priority;
      return (a.id || a.url).localeCompare(b.id || b.url);
    });
  }, [photos]);
  const previousBodyOverflow = useRef<string | null>(null);

  const showNext = useCallback(() => {
    setActiveIndex((current) => (current + 1) % orderedPhotos.length);
  }, [orderedPhotos.length]);

  const showPrev = useCallback(() => {
    setActiveIndex((current) => (current - 1 + orderedPhotos.length) % orderedPhotos.length);
  }, [orderedPhotos.length]);

  const openAt = useCallback((index: number) => {
    setActiveIndex(index);
    setIsOpen(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    previousBodyOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (previousBodyOverflow.current !== null) {
        document.body.style.overflow = previousBodyOverflow.current;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
      if (event.key === "ArrowRight") showNext();
      if (event.key === "ArrowLeft") showPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showNext, showPrev]);

  useEffect(() => {
    if (!isOpen) return;
    transformRef.current?.resetTransform();
  }, [activeIndex, isOpen]);

  if (!orderedPhotos || orderedPhotos.length === 0) return null;

  const activePhoto = orderedPhotos[activeIndex];

  return (
    <>
      <div className={className || "flex flex-wrap gap-2"}>
        {orderedPhotos.map((photo, index) => (
          <button
            key={photo.id ?? `${photo.url}-${index}`}
            type="button"
            onClick={() => openAt(index)}
            className="focus:outline-none"
            aria-label="Open photo"
          >
            <img
              src={photo.url}
              alt={photo.alt || "Lead photo"}
              className={
                thumbnailClassName ||
                "h-28 w-20 rounded-lg object-cover border transition hover:opacity-90"
              }
            />
          </button>
        ))}
      </div>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 touch-none"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative flex w-full max-w-[90vw] max-h-[85vh] items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-full w-full aspect-[3/4] items-center justify-center overflow-hidden rounded-xl bg-black/40">
              <TransformWrapper
                ref={transformRef}
                minScale={1}
                maxScale={4}
                doubleClick={{ mode: "zoomIn", step: 0.5 }}
                pinch={{ step: 5 }}
                panning={{ disabled: true }}
                wheel={{ disabled: true }}
              >
                <TransformComponent
                  wrapperClass="h-full w-full"
                  contentClass="h-full w-full"
                >
                  <img
                    src={activePhoto.url}
                    alt={activePhoto.alt || "Lead photo"}
                    className="h-full w-full object-contain"
                    style={{ touchAction: "none" }}
                  />
                </TransformComponent>
              </TransformWrapper>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white shadow hover:bg-black/80"
              aria-label="Close"
            >
              ✕
            </button>

            {orderedPhotos.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={showPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white shadow hover:bg-black/80"
                  aria-label="Previous photo"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={showNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white shadow hover:bg-black/80"
                  aria-label="Next photo"
                >
                  ›
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                  {activeIndex + 1} / {orderedPhotos.length}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
