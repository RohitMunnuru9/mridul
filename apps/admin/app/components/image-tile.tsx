"use client";

/**
 * A product photograph you change by clicking it.
 *
 * The picture is the control. Choosing a file submits immediately, because an
 * upload button beside a thumbnail is a second step nobody expects: you click
 * the thing you want to replace.
 */

import { useActionState, useRef } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="image-replace" ref={formRef}>
      <input name="product_id" type="hidden" value={productId} />
      <input name="product_slug" type="hidden" value={productSlug} />
      <input name="media_id" type="hidden" value={mediaId} />
      <input
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="image-replace-file"
        name="file"
        onChange={() => formRef.current?.requestSubmit()}
        ref={fileRef}
        type="file"
      />
      <button
        aria-label={`Change ${label}`}
        className="image-replace-trigger"
        disabled={pending}
        onClick={() => fileRef.current?.click()}
        type="button"
      >
        <MediaThumb alt={alt} focal={focal} size={size} url={url} />
        <span className="image-replace-veil">
          {pending ? "Uploading…" : "Click to change"}
        </span>
      </button>
      {state && (
        <span className={state.ok ? "form-note is-ok" : "form-note is-bad"} role="status">
          {state.message}
        </span>
      )}
    </form>
  );
}
