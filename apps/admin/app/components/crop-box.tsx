"use client";

/**
 * A real crop box: drag a rectangle over the picture, confirm, and the pixels
 * outside it are gone before anything is uploaded.
 *
 * The previous control only recorded which part to favour when a card cropped
 * the picture later — the file itself was untouched. This cuts the file. What
 * is confirmed here is exactly what the storefront receives, so a badly framed
 * photograph is fixed once rather than fought with on every page that shows it.
 *
 * The crop is held in the coordinates of the picture as displayed, and scaled
 * up to the natural size only at the moment of cutting, so the result keeps the
 * full resolution of the original.
 */

import { useEffect, useRef, useState } from "react";
import { Check, Maximize2, X } from "lucide-react";

type Rect = { x: number; y: number; w: number; h: number };
type Corner = "nw" | "ne" | "sw" | "se";
type Drag =
  | { kind: "move"; startX: number; startY: number; from: Rect }
  | { kind: "resize"; corner: Corner; startX: number; startY: number; from: Rect }
  | null;

const MIN = 32;

export function CropBox({
  file,
  onConfirm,
  onCancel,
  confirmLabel = "Use this crop",
  busy = false,
}: {
  file: File;
  /** Receives the cut file, ready to upload. */
  onConfirm: (cropped: File) => void;
  onCancel: () => void;
  confirmLabel?: string;
  busy?: boolean;
}) {
  const [src] = useState(() => URL.createObjectURL(file));
  const [rect, setRect] = useState<Rect | null>(null);
  const [cutting, setCutting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<Drag>(null);

  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  /** Start on the whole picture: the common case is a small trim, not a hunt. */
  function onLoad() {
    const img = imgRef.current;
    if (!img) return;
    setRect({ x: 0, y: 0, w: img.clientWidth, h: img.clientHeight });
  }

  useEffect(() => {
    if (!dragging) return undefined;

    function onMove(event: PointerEvent) {
      const drag = dragRef.current;
      const img = imgRef.current;
      if (!drag || !img) return;

      const maxW = img.clientWidth;
      const maxH = img.clientHeight;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const from = drag.from;

      if (drag.kind === "move") {
        setRect({
          ...from,
          x: Math.min(Math.max(0, from.x + dx), maxW - from.w),
          y: Math.min(Math.max(0, from.y + dy), maxH - from.h),
        });
        return;
      }

      // Resizing moves the dragged corner and leaves the opposite one pinned.
      let { x, y, w, h } = from;
      if (drag.corner === "se") {
        w = Math.min(Math.max(MIN, from.w + dx), maxW - from.x);
        h = Math.min(Math.max(MIN, from.h + dy), maxH - from.y);
      } else if (drag.corner === "sw") {
        const right = from.x + from.w;
        x = Math.min(Math.max(0, from.x + dx), right - MIN);
        w = right - x;
        h = Math.min(Math.max(MIN, from.h + dy), maxH - from.y);
      } else if (drag.corner === "ne") {
        const bottom = from.y + from.h;
        y = Math.min(Math.max(0, from.y + dy), bottom - MIN);
        h = bottom - y;
        w = Math.min(Math.max(MIN, from.w + dx), maxW - from.x);
      } else {
        const right = from.x + from.w;
        const bottom = from.y + from.h;
        x = Math.min(Math.max(0, from.x + dx), right - MIN);
        y = Math.min(Math.max(0, from.y + dy), bottom - MIN);
        w = right - x;
        h = bottom - y;
      }
      setRect({ x, y, w, h });
    }

    function onUp() {
      dragRef.current = null;
      setDragging(false);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  function beginDrag(drag: NonNullable<Drag>) {
    dragRef.current = drag;
    setDragging(true);
  }

  /** Nudge the box with the keyboard, so this is not mouse-only. */
  function onKeyDown(event: React.KeyboardEvent) {
    if (!rect || !imgRef.current) return;
    const step = event.shiftKey ? 20 : 4;
    const maxW = imgRef.current.clientWidth;
    const maxH = imgRef.current.clientHeight;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setRect({
      ...rect,
      x: Math.min(Math.max(0, rect.x + move[0]), maxW - rect.w),
      y: Math.min(Math.max(0, rect.y + move[1]), maxH - rect.h),
    });
  }

  function useWhole() {
    const img = imgRef.current;
    if (img) setRect({ x: 0, y: 0, w: img.clientWidth, h: img.clientHeight });
  }

  async function confirm() {
    const img = imgRef.current;
    if (!img || !rect) return;
    setCutting(true);

    // Displayed pixels up to real pixels, so nothing is thrown away.
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(rect.w * scaleX));
    canvas.height = Math.max(1, Math.round(rect.h * scaleY));

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCutting(false);
      return;
    }
    ctx.drawImage(
      img,
      rect.x * scaleX,
      rect.y * scaleY,
      rect.w * scaleX,
      rect.h * scaleY,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    // PNG and WebP keep their format so transparency survives; anything else
    // becomes a JPEG, which is what a photograph should be.
    const type =
      file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, 0.92),
    );
    setCutting(false);
    if (!blob) return;

    const stem = file.name.replace(/\.[^.]+$/, "");
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    onConfirm(new File([blob], `${stem}.${ext}`, { type }));
  }

  const working = busy || cutting;

  return (
    <div className="crop-box">
      <div className="crop-box-head">
        <span className="field-label">
          Crop the picture
          <small>Drag the box, or pull a corner. Only what is inside is kept.</small>
        </span>
      </div>

      <div className="crop-box-stage">
        {src && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img alt="" onLoad={onLoad} ref={imgRef} src={src} />
        )}
        {rect && (
          <div
            aria-label="Crop area. Arrow keys move it."
            className="crop-box-rect"
            onKeyDown={onKeyDown}
            onPointerDown={(event) => {
              event.preventDefault();
              beginDrag({
                kind: "move",
                startX: event.clientX,
                startY: event.clientY,
                from: rect,
              });
            }}
            role="button"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
            tabIndex={0}
          >
            {(["nw", "ne", "sw", "se"] as Corner[]).map((corner) => (
              <span
                className={`crop-handle is-${corner}`}
                key={corner}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  beginDrag({
                    kind: "resize",
                    corner,
                    startX: event.clientX,
                    startY: event.clientY,
                    from: rect,
                  });
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="crop-box-foot">
        <button className="btn-primary" disabled={working || !rect} onClick={confirm} type="button">
          <Check aria-hidden="true" />
          {working ? "Working…" : confirmLabel}
        </button>
        <button className="btn-secondary" disabled={working} onClick={useWhole} type="button">
          <Maximize2 aria-hidden="true" />
          Whole picture
        </button>
        <button className="btn-secondary" disabled={working} onClick={onCancel} type="button">
          <X aria-hidden="true" />
          Cancel
        </button>
      </div>
    </div>
  );
}
