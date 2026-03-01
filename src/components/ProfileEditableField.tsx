"use client";

import { useMemo, useState } from "react";

type EditableFieldProps = {
  label: string;
  value?: string | null;
  name: string;
  type?: string;
  action: (formData: FormData) => void;
  placeholder?: string;
  description?: string;
  required?: boolean;
};

export function EditableTextField({
  label,
  value,
  name,
  type = "text",
  action,
  placeholder,
  description,
  required = false,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const displayValue = value?.trim() ? value : "Not set";

  if (!isEditing) {
    return (
      <div className="rounded-xl border px-4 py-3 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="font-medium text-slate-900">{displayValue}</p>
            {description ? <p className="text-xs text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-slate-500 hover:text-slate-700"
            aria-label={`Edit ${label}`}
          >
            ✏️
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border px-4 py-3 bg-white">
      <form action={action} className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-slate-500">{label}</label>
        <input
          name={name}
          type={type}
          defaultValue={value ?? ""}
          className="w-full rounded-lg border px-3 py-2"
          placeholder={placeholder}
          required={required}
        />
        {description ? <p className="text-xs text-slate-500">{description}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium">
            Save
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

type SelectOption = { value: string; label: string };

type EditableSelectFieldProps = {
  label: string;
  value?: string | null;
  name: string;
  options: SelectOption[];
  action: (formData: FormData) => void;
  description?: string;
};

export function EditableSelectField({
  label,
  value,
  name,
  options,
  action,
  description,
}: EditableSelectFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const displayValue = useMemo(() => {
    const match = options.find((option) => option.value === value);
    return match?.label ?? "Not set";
  }, [options, value]);

  if (!isEditing) {
    return (
      <div className="rounded-xl border px-4 py-3 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="font-medium text-slate-900">{displayValue}</p>
            {description ? <p className="text-xs text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-slate-500 hover:text-slate-700"
            aria-label={`Edit ${label}`}
          >
            ✏️
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border px-4 py-3 bg-white">
      <form action={action} className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-slate-500">{label}</label>
        <select
          name={name}
          defaultValue={value ?? options[0]?.value}
          className="w-full rounded-lg border px-3 py-2"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {description ? <p className="text-xs text-slate-500">{description}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium">
            Save
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

type EditableCheckboxFieldProps = {
  label: string;
  value?: boolean | null;
  name: string;
  action: (formData: FormData) => void;
  description?: string;
};

export function EditableCheckboxField({
  label,
  value,
  name,
  action,
  description,
}: EditableCheckboxFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const displayValue = value ? "Enabled" : "Disabled";

  if (!isEditing) {
    return (
      <div className="rounded-xl border px-4 py-3 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="font-medium text-slate-900">{displayValue}</p>
            {description ? <p className="text-xs text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-slate-500 hover:text-slate-700"
            aria-label={`Edit ${label}`}
          >
            ✏️
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border px-4 py-3 bg-white">
      <form action={action} className="space-y-2">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name={name} defaultChecked={Boolean(value)} className="h-4 w-4" />
            {value ? "Enabled" : "Disabled"}
          </label>
          {description ? <p className="text-xs text-slate-500">{description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium">
            Save
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

type EditablePasswordSectionProps = {
  action: (formData: FormData) => void;
};

export function EditablePasswordSection({ action }: EditablePasswordSectionProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (!isEditing) {
    return (
      <div className="rounded-xl border px-4 py-3 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-500">Password</p>
            <p className="font-medium text-slate-900">••••••••</p>
            <p className="text-xs text-slate-500">Use a strong password you don’t use elsewhere.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-slate-500 hover:text-slate-700"
            aria-label="Edit password"
          >
            ✏️
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border px-4 py-3 bg-white">
      <form action={action} className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium">Current password</label>
          <input
            name="currentPassword"
            type="password"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">New password</label>
          <input
            name="newPassword"
            type="password"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">Confirm password</label>
          <input
            name="confirmPassword"
            type="password"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
          />
        </div>
        <div className="sm:col-span-3 flex flex-wrap gap-2">
          <button className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium">
            Save
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
