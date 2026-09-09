"use client";

/**
 * Upload a picture: choose the file, set the crop, say what it shows.
 *
 * One control for every picture in the admin — a product photograph, a hero
 * banner, a category header — because they are the same job and were three
 * different forms.
 *
 * Two things it fixes. The file field was a bare `<input type="file">`, which
 * on Windows renders as a small grey "No file chosen" that is easy to walk
 * past; pressing the save button without noticing it returned "Choose an
 * image." and looked like a broken upload. And the crop was a text box on the
 * saved image asking for `50% center` — a CSS value, typed after the picture
 * was already live. Now the file is chosen through a real labelled button, and
 * the crop is picked on the picture before it is uploaded.
 */

import { useActionState, useRef, useState } from "react";
import { ImagePlus, UploadCloud } from "lucide-react";
import { CropPicker } from "./crop-field";

type Result = { ok: boolean; message: string };

export function ImageUploadField({
  action,
  fields,
  altDefault = "",
  altPlaceholder = "e.g. Ivory chanderi saree beside a window",
  submitLabel = "Upload picture",
  maxLabel = "JPEG, PNG or WebP, up to 10MB",
}: {
  action: (formData: FormData) => Promise<Result>;
  /** Hidden values the action needs, e.g. which slide or product this is for. */
  fields: Record<string, string>;
  altDefault?: string;
  altPlaceholder?: string;
  submitLabel?: string;
  maxLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (_previous: Result | null, formData: FormData) => action(formData),
    null,
  );

  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [focal, setFocal] = useState("50% center");
  const fileRef = useRef<HTMLInputElement>(null);

  function onPick(file: File | undefined) {
    setFileName(file?.name ?? null);
    // Revoked on the next pick rather than on unmount: the preview has to
    // outlive this handler, and a couple of object URLs is not a leak worth
    // an effect.
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  return (
    <form action={formAction} className="image-upload">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      <input name="focal" type="hidden" value={focal} />

      <div className="field">
        <span className="field-label">
          Picture
          <small>{maxLabel}</small>
        </span>
        {/* The native control is kept for the file itself but taken out of
            sight, so the visible control is a button that says what it does. */}
        <input
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="image-upload-file"
          name="file"
          onChange={(event) => onPick(event.target.files?.[0])}
          ref={fileRef}
          required
          type="file"
        />
        <div className="image-upload-pick">
          <button
            className="btn-secondary"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
            type="button"
          >
            <ImagePlus aria-hidden="true" />
            {fileName ? "Choose a different picture" : "Choose a picture"}
          </button>
          <span className="image-upload-name">{fileName ?? "No picture chosen yet"}</span>
        </div>
      </div>

      {preview && <CropPicker onChange={setFocal} src={preview} value={focal} />}

      <label className="field">
        <span className="field-label">
          Describe it
          <abbr className="required-mark" title="Must be filled in">
            *
          </abbr>
          <small>Read aloud by screen readers</small>
        </span>
        <input
          defaultValue={altDefault}
          name="alt"
          placeholder={altPlaceholder}
          required
          type="text"
        />
      </label>

      <div className="edit-form-foot">
        <button className="btn-primary" disabled={pending || !fileName} type="submit">
          <UploadCloud aria-hidden="true" />
          {pending ? "Uploading…" : submitLabel}
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
