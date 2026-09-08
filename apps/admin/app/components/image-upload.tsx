"use client";

/**
 * Add a photograph: choose the file, say what it shows, and set the crop
 * before it is uploaded.
 *
 * The crop used to be a text box on the saved image asking for `50% center`,
 * which is a CSS value, not something anyone knows to type. Here it is the
 * picture itself: pick the part that must stay visible when a listing card
 * crops the photograph to a taller or shorter shape.
 */

import { useActionState, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { CropPicker } from "./crop-field";

type Result = { ok: boolean; message: string };

export function ImageUploadField({
  action,
  productId,
  productSlug,
}: {
  action: (formData: FormData) => Promise<Result>;
  productId: string;
  productSlug: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (_previous: Result | null, formData: FormData) => action(formData),
    null,
  );

  const [preview, setPreview] = useState<string | null>(null);
  const [focal, setFocal] = useState("50% center");
  const fileRef = useRef<HTMLInputElement>(null);

  function onPick(file: File | undefined) {
    // Revoked on the next pick rather than on unmount: the preview must outlive
    // this handler, and a handful of object URLs is not a leak worth a effect.
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  return (
    <form action={formAction} className="image-upload">
      <input name="product_id" type="hidden" value={productId} />
      <input name="product_slug" type="hidden" value={productSlug} />
      <input name="focal" type="hidden" value={focal} />

      <label className="field">
        <span className="field-label">
          Photograph
          <small>JPEG, PNG or WebP, up to 10MB</small>
        </span>
        <input
          accept="image/jpeg,image/png,image/webp,image/avif"
          name="file"
          onChange={(event) => onPick(event.target.files?.[0])}
          ref={fileRef}
          required
          type="file"
        />
      </label>

      {preview && <CropPicker onChange={setFocal} src={preview} value={focal} />}

      <label className="field">
        <span className="field-label">
          Describe it
          <small>Read aloud by screen readers</small>
        </span>
        <input
          name="alt"
          placeholder="e.g. Ivory chanderi saree beside a window"
          required
          type="text"
        />
      </label>

      <div className="edit-form-foot">
        <button className="btn-primary" disabled={pending} type="submit">
          <UploadCloud aria-hidden="true" />
          {pending ? "Uploading…" : "Upload photograph"}
        </button>
        {state && (
          <span className={state.ok ? "form-note is-ok" : "form-note is-bad"} role="status">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
