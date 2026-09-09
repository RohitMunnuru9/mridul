"use client";

/**
 * A product photograph you change by clicking it.
 *
 * The picture is the control. Clicking it asks for a file, then opens the crop
 * box over the page — the replacement is cut before it is sent, the same as a
 * new upload, so a photograph is never swapped for a badly framed one that has
 * to be fixed later.
 */

import { useActionState, useRef, useState } from "react";
import { CropBox } from "./crop-box";
import { MediaThumb } from "./ui";

type Result = { ok: boolean; message: string };

export function ReplaceableImage({
  action,
  productId,
  productSlug,
  mediaId,
  url,
  alt,
  focal,
  label,
  size = 140,
}: {
  action: (formData: FormData) => Promise<Result>;
  productId: string;
  productSlug: string;
  mediaId: string;
  url: string;
  alt: string;
  focal: string;
  /** Named in the button's accessible label, e.g. "Thumbnail". */
  label: string;
  size?: number;
}) {
  const [state, formAction, pending] = useActionState(
    async (_previous: Result | null, formData: FormData) => action(formData),
    null,
  );
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    if (fileRef.current) fileRef.current.value = "";
    fileRef.current?.click();
  }

  /** Confirming the crop swaps the picture — no second button to press. */
  function replaceWith(cropped: File) {
    const input = fileRef.current;
    if (!input) return;
    const transfer = new DataTransfer();
    transfer.items.add(cropped);
    input.files = transfer.files;
    setPickedFile(null);
    formRef.current?.requestSubmit();
  }

  function cancelCrop() {
    setPickedFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <form action={formAction} className="image-replace" ref={formRef}>
      <input name="product_id" type="hidden" value={productId} />
      <input name="product_slug" type="hidden" value={productSlug} />
      <input name="media_id" type="hidden" value={mediaId} />
      <input
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="image-replace-file"
        name="file"
        onChange={(event) => setPickedFile(event.target.files?.[0] ?? null)}
        ref={fileRef}
        type="file"
      />
      <button
        aria-label={`Change ${label}`}
        className="image-replace-trigger"
        disabled={pending}
        onClick={openPicker}
        type="button"
      >
        <MediaThumb alt={alt} focal={focal} size={size} url={url} />
        <span className="image-replace-veil">
          {pending ? "Uploading…" : "Click to change"}
        </span>
      </button>

      {pickedFile && (
        <div className="crop-overlay" role="dialog" aria-label="Crop the replacement picture">
          <div className="crop-overlay-panel">
            <CropBox
              busy={pending}
              confirmLabel="Use this crop and replace"
              file={pickedFile}
              key={`${pickedFile.name}-${pickedFile.size}-${pickedFile.lastModified}`}
              onCancel={cancelCrop}
              onConfirm={replaceWith}
            />
          </div>
        </div>
      )}

      {state && (
        <span className={state.ok ? "form-note is-ok" : "form-note is-bad"} role="status">
          {state.message}
        </span>
      )}
    </form>
  );
}
