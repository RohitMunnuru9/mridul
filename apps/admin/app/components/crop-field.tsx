"use client";

/**
 * Choosing which part of a picture must stay in view.
 *
 * A listing card, a hero banner and a product page all crop the same file to
 * different shapes. Which part survives that crop used to be typed as a CSS
 * value — `50% center`, or `66% center to favour the right`. Nobody knows to
 * write that, so it is shown instead: the picture in the shape it will be cut
 * to, with nine places to tap.
 */

import { useState } from "react";

/** `object-position` values, laid out the way they appear on the picture. */
export const CROP_SPOTS: { value: string; label: string }[] = [
  { value: "left top", label: "Top left" },
  { value: "50% top", label: "Top" },
  { value: "right top", label: "Top right" },
  { value: "left center", label: "Left" },
  { value: "50% center", label: "Middle" },
  { value: "right center", label: "Right" },
  { value: "left bottom", label: "Bottom left" },
  { value: "50% bottom", label: "Bottom" },
  { value: "right bottom", label: "Bottom right" },
];

export function cropLabel(value: string): string {
  return CROP_SPOTS.find((spot) => spot.value === value)?.label ?? value;
}

/** The picker itself, for a caller that already holds the value. */
export function CropPicker({
  src,
  value,
  onChange,
  legend = "Keep this part in view",
  note = "Where a listing card crops to a different shape",
}: {
  src: string;
  value: string;
  onChange: (next: string) => void;
  legend?: string;
  note?: string;
}) {
  return (
    <div className="crop-picker">
      <span className="field-label">
        {legend}
        <small>{note}</small>
      </span>
      <div className="crop-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" src={src} style={{ objectPosition: value }} />
        <div className="crop-grid">
          {CROP_SPOTS.map((spot) => (
            <button
              aria-label={spot.label}
              aria-pressed={value === spot.value}
              className={value === spot.value ? "is-on" : undefined}
              key={spot.value}
              onClick={() => onChange(spot.value)}
              title={spot.label}
              type="button"
            />
          ))}
        </div>
      </div>
      <small className="crop-chosen">{cropLabel(value)}</small>
    </div>
  );
}

/** The picker as a form field, for a picture that is already uploaded. */
export function CropField({
  src,
  defaultValue,
  name = "focal",
}: {
  src: string;
  defaultValue: string;
  name?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <CropPicker onChange={setValue} src={src} value={value} />
      <input name={name} type="hidden" value={value} />
    </>
  );
}
