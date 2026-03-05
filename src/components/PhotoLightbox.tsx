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
  const [isZoomed, setIsZoomed] = useState(false);
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

  const resetZoom = useCallback(() => {
    transformRef.current?.resetTransform();
    setIsZoomed(false);
  }, []);

  const showNext = useCallback(() => {
    resetZoom();
    setActiveIndex((current) => (current + 1) % orderedPhotos.length);
  }, [orderedPhotos.length, resetZoom]);

  const showPrev = useCallback(() => {
    resetZoom();
    setActiveIndex((current) => (current - 1 + orderedPhotos.length) % orderedPhotos.length);
  }, [orderedPhotos.length, resetZoom]);

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
    resetZoom();
  }, [activeIndex, isOpen, resetZoom]);

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
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 touch-none ${
            isZoomed ? "overflow-visible" : "overflow-hidden"
          }`}
          onClick={() => setIsOpen(false)}
        >
          <div
            className={`relative flex items-center justify-center ${
              isZoomed
                ? "h-screen w-screen max-w-none max-h-none overflow-visible"
                : "w-full max-w-[90vw] max-h-[85vh]"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className={`flex h-full w-full items-center justify-center bg-black/40 ${
                isZoomed
                  ? "overflow-visible rounded-none"
                  : "aspect-[3/4] overflow-hidden rounded-xl"
              }`}
            >
              <div className={`h-full w-full ${isZoomed ? "overflow-visible" : "overflow-hidden"}`}>
                <TransformWrapper
                  ref={transformRef}
                  minScale={1}
                  maxScale={4}
                  doubleClick={{ mode: "zoomIn", step: 0.5 }}
                  pinch={{ step: 5 }}
                  panning={{ disabled: !isZoomed }}
                  wheel={{ disabled: true }}
                  onTransformed={({ state }) => setIsZoomed(state.scale > 1)}
                >
                  <TransformComponent
                    wrapperClass={`h-full w-full ${isZoomed ? "overflow-visible" : "overflow-hidden"}`}
                    contentClass={`h-full w-full ${isZoomed ? "overflow-visible" : "overflow-hidden"}`}
                  >
                    <img
                      src={activePhoto.url}
                      alt={activePhoto.alt || "Lead photo"}
                      className={`h-full w-full object-contain ${isZoomed ? "relative z-50" : ""}`}
                      style={{ touchAction: "none" }}
                    />
                  </TransformComponent>
                </TransformWrapper>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-3 top-3 z-[60] rounded-full bg-black/60 p-2 text-white shadow hover:bg-black/80"
              aria-label="Close"
            >
              ✕
            </button>

            {orderedPhotos.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={showPrev}
                  className="absolute left-2 top-1/2 z-[60] -translate-y-1/2 rounded-full bg-black/60 p-2 text-white shadow hover:bg-black/80"
                  aria-label="Previous photo"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={showNext}
                  className="absolute right-2 top-1/2 z-[60] -translate-y-1/2 rounded-full bg-black/60 p-2 text-white shadow hover:bg-black/80"
                  aria-label="Next photo"
                >
                  ›
                </button>
                <div className="absolute bottom-3 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
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
