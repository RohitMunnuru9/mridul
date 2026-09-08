'use client';

/**
 * Form primitives shared by every editable panel.
 *
 * `EditForm` wraps a server action and shows what happened — the single most
 * important thing an editing UI can do. A save that looks identical to a
 * failure is worse than no save button at all.
 */

import { useActionState, useState } from 'react';
import type { ReactNode } from 'react';
import { COLOUR_GROUPS, COLOURS } from '@mridul/utils';

type Result = { ok: boolean; message: string };

export function EditForm({
  action,
  children,
  submitLabel = 'Save',
  compact = false,
  danger = false,
}: {
  action: (formData: FormData) => Promise<Result>;
  children: ReactNode;
  submitLabel?: string;
  compact?: boolean;
  /** Destructive actions get a quieter, warning-coloured button. */
  danger?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    async (_previous: Result | null, formData: FormData) => action(formData),
    null,
  );

  return (
    <form action={formAction} className={`edit-form${compact ? ' is-compact' : ''}`}>
      {children}
      <div className="edit-form-foot">
        <button
          className={danger ? 'btn-danger' : 'btn-primary'}
          disabled={pending}
          type="submit"
        >
          {pending ? 'Saving…' : submitLabel}
        </button>
        {state && (
          <span
            className={state.ok ? 'form-note is-ok' : 'form-note is-bad'}
            role="status"
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

export function Field({
  label,
  name,
  defaultValue = '',
  type = 'text',
  hint,
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input
        defaultValue={defaultValue ?? ''}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}

export function TextArea({
  label,
  name,
  defaultValue = '',
  rows = 4,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <textarea defaultValue={defaultValue ?? ''} name={name} rows={rows} />
    </label>
  );
}

export function Select({
  label,
  name,
  options,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <select defaultValue={defaultValue ?? ''} name={name}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Toggle({
  label,
  name,
  defaultChecked = false,
  hint,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  return (
    <label className="toggle">
      <input defaultChecked={defaultChecked} name={name} type="checkbox" />
      <span className="toggle-track" aria-hidden="true">
        <i />
      </span>
      <span className="field-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export function FileField({
  label,
  name,
  hint,
}: {
  label: string;
  name: string;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input accept="image/jpeg,image/png,image/webp,image/avif" name={name} type="file" />
    </label>
  );
}

/** A row of fields that should sit side by side when there is room. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="field-row">{children}</div>;
}

/**
 * The product's colour, chosen by name.
 *
 * Hex codes are how the storefront draws a swatch, not how anyone describes a
 * saree, so the list reads "Deep Teal" and the code travels with it in a hidden
 * field. A product whose colour is no longer on the list keeps its own entry at
 * the top, so editing an old product never silently recolours it.
 */
export function ColourSelect({
  label,
  name,
  hexName,
  defaultHex,
  defaultName,
  hint,
}: {
  label: string;
  /** Field carrying the colour name. */
  name: string;
  /** Field carrying the hex code. */
  hexName: string;
  defaultHex: string;
  defaultName: string;
  hint?: string;
}) {
  const known = COLOURS.some((colour) => colour.hex.toLowerCase() === defaultHex.toLowerCase());
  const [hex, setHex] = useState(defaultHex);

  const nameFor = (value: string) =>
    COLOURS.find((colour) => colour.hex.toLowerCase() === value.toLowerCase())?.name ?? defaultName;

  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <span className="colour-field">
        <span aria-hidden="true" className="colour-chip" style={{ background: hex }} />
        <select
          defaultValue={defaultHex}
          name={hexName}
          onChange={(event) => setHex(event.target.value)}
        >
          {!known && <option value={defaultHex}>{defaultName} (current)</option>}
          {COLOUR_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.colours.map((colour) => (
                <option key={colour.hex} value={colour.hex}>
                  {colour.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </span>
      {/* The name is derived from the chosen code so the two can never disagree. */}
      <input name={name} type="hidden" value={nameFor(hex)} />
    </label>
  );
}

/**
 * The other colours a piece comes in, ticked from the same list.
 *
 * Checkboxes rather than a multi-select: the swatches are the point, and you
 * can see all of them at once.
 */
export function SwatchPicker({
  label,
  name,
  defaultValues,
  hint,
}: {
  label: string;
  name: string;
  defaultValues: string[];
  hint?: string;
}) {
  const chosen = defaultValues.map((value) => value.toLowerCase());

  return (
    <fieldset className="field swatch-picker">
      <legend className="field-label">
        {label}
        {hint && <small>{hint}</small>}
      </legend>
      <div className="swatch-picker-grid">
        {COLOURS.map((colour) => (
          <label className="swatch-option" key={colour.hex} title={colour.name}>
            <input
              defaultChecked={chosen.includes(colour.hex.toLowerCase())}
              name={name}
              type="checkbox"
              value={colour.hex}
            />
            <span aria-hidden="true" style={{ background: colour.hex }} />
            <small>{colour.name}</small>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
