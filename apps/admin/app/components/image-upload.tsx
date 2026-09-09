"use client";

/**
 * Upload a picture: choose the file, crop it, say what it shows.
 *
 * One control for every picture in the admin — a product photograph, a hero
 * banner, a category header — because they are the same job and were three
 * different forms.
 *
 * Choosing a file opens the crop box straight away, and nothing is staged for
 * upload until that crop is confirmed. What gets sent is the cut file, not the
 * original with a note about which part to favour.
 */

import { useActionState, useRef, useState } from "react";
import { ImagePlus, UploadCloud } from "lucide-react";
import { CropBox } from "./crop-box";

type Result = { ok: boolean; message: string };

export function ImageUploadField({
  action,
  fields,
  altDefault = "",
  altPlaceholder = "e.g. Ivory chanderi saree beside a window",
  submitLabel = "Upload picture",
  maxLabel = "JPEG, PNG or WebP, up to 10MB",
  askAlt = true,
}: {
  action: (formData: FormData) => Promise<Result>;
  /** Hidden values the action needs, e.g. which slide or product this is for. */
  fields: Record<string, string>;
  altDefault?: string;
  altPlaceholder?: string;
  submitLabel?: string;
  maxLabel?: string;
  /** Off where the action keeps the description it already has. */
  askAlt?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    async (_previous: Result | null, formData: FormData) => action(formData),
    null,
  );

  /** The picture waiting to be cropped, before it is staged for upload. */
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [croppedName, setCroppedName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    if (fileRef.current) fileRef.current.value = "";
    fileRef.current?.click();
  }

  /** Puts the cut file into the real input, so the form submits that. */
  function stage(cropped: File) {
    const input = fileRef.current;
    if (!input) return;
    const transfer = new DataTransfer();
    transfer.items.add(cropped);
    input.files = transfer.files;

    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(cropped);
    });
    setCroppedName(cropped.name);
    setPickedFile(null);
  }

  function cancelCrop() {
    setPickedFile(null);
    if (!croppedName && fileRef.current) fileRef.current.value = "";
  }

  return (
    <form action={formAction} className="image-upload">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      {/* The crop is cut into the file itself, so nothing is favoured later. */}
      <input name="focal" type="hidden" value="50% center" />

      <div className="field">
        <span className="field-label">
          Picture
          <small>{maxLabel}</small>
        </span>
        {/* The native control still carries the file; the visible control is a
            button that says what it does. */}
        <input
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="image-upload-file"
          name="file"
          onChange={(event) => setPickedFile(event.target.files?.[0] ?? null)}
          ref={fileRef}
          required
          type="file"
        />
        <div className="image-upload-pick">
          <button
            className="btn-secondary"
            disabled={pending}
            onClick={openPicker}
            type="button"
          >
            <ImagePlus aria-hidden="true" />
            {croppedName ? "Choose a different picture" : "Choose a picture"}
          </button>
          {preview ? (
            <span className="image-upload-ready">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" src={preview} />
              Cropped and ready
            </span>
          ) : (
            <span className="image-upload-name">No picture chosen yet</span>
          )}
        </div>
      </div>

      {pickedFile && (
        <CropBox
          file={pickedFile}
          key={`${pickedFile.name}-${pickedFile.size}-${pickedFile.lastModified}`}
          onCancel={cancelCrop}
          onConfirm={stage}
        />
      )}

      {askAlt && (
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
      )}

      <div className="edit-form-foot">
        <button
          className="btn-primary"
          disabled={pending || !croppedName || !!pickedFile}
          type="submit"
        >
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
