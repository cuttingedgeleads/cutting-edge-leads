"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { LeadPhotoInput } from "@/components/LeadPhotoInput";

const initialState = { error: "" };

type LeadCreateFormProps = {
  action: (prevState: typeof initialState, formData: FormData) => Promise<typeof initialState>;
  minPrice: number;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="w-full rounded-lg bg-slate-900 text-white py-2 font-medium disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "Publishing…" : "Publish lead"}
    </button>
  );
}

export function LeadCreateForm({ action, minPrice }: LeadCreateFormProps) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="grid gap-4 sm:grid-cols-2"
    >
      <div>
        <label className="text-sm font-medium">Name</label>
        <input
          name="name"
          className="mt-1 w-full rounded-lg border px-3 py-2"
          placeholder="Customer name"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Email</label>
        <input
          name="email"
          type="email"
          className="mt-1 w-full rounded-lg border px-3 py-2"
          placeholder="customer@email.com"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Job type</label>
        <select name="jobType" className="mt-1 w-full rounded-lg border px-3 py-2" required>
          <option value="">Select a job type</option>
          <option value="Grass Cutting">Grass Cutting</option>
          <option value="Landscaping">Landscaping</option>
          <option value="Grass and Landscaping Maintenance">
            Grass and Landscaping Maintenance
          </option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Price (min ${minPrice})</label>
        <input
          name="price"
          type="number"
          min={minPrice}
          className="mt-1 w-full rounded-lg border px-3 py-2"
          required
        />
      </div>
      <div className="sm:col-span-2">
        <label className="text-sm font-medium">Description</label>
        <textarea
          name="description"
          rows={4}
          className="mt-1 w-full rounded-lg border px-3 py-2"
          required
        />
      </div>
      <div className="sm:col-span-2">
        <label className="text-sm font-medium">Street address</label>
        <AddressAutocomplete />
      </div>
      <div>
        <label className="text-sm font-medium">City</label>
        <input name="city" id="city" className="mt-1 w-full rounded-lg border px-3 py-2" required />
      </div>
      <div>
        <label className="text-sm font-medium">State</label>
        <input name="state" id="state" className="mt-1 w-full rounded-lg border px-3 py-2" required />
      </div>
      <div>
        <label className="text-sm font-medium">Zip</label>
        <input name="zip" id="zip" className="mt-1 w-full rounded-lg border px-3 py-2" required />
      </div>
      <div className="sm:col-span-2">
        <label className="text-sm font-medium">Photos</label>
        <LeadPhotoInput />
      </div>
      {state.error ? (
        <div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <SubmitButton />
      </div>
    </form>
  );
}
