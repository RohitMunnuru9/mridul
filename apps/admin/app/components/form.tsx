'use client';

/**
 * Form primitives shared by every editable panel.
 *
 * `EditForm` wraps a server action and shows what happened — the single most
 * important thing an editing UI can do. A save that looks identical to a
 * failure is worse than no save button at all.
 */

import { useActionState } from 'react';
import type { ReactNode } from 'react';

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
