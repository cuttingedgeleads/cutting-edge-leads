'use client';
import { useEffect, useRef, useState } from 'react';

type Props = {
  id: string;
  version: number;
  onDeleted: () => void;
  onUnavailable: () => void;
  onConflict: () => void;
};

export function DeleteImportButton({ id, version, onDeleted, onUnavailable, onConflict }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(false);
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; inFlight.current?.abort(); };
  }, []);

  async function remove() {
    if (inFlight.current || !active.current) return;
    if (!window.confirm('Are you sure you want to delete this import?\n\nThe original Studio record will not be deleted.')) return;
    const controller = new AbortController();
    inFlight.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/imports/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!active.current) return;
      if ([401, 403, 404].includes(response.status)) { onUnavailable(); return; }
      if (!response.ok) {
        setError(typeof result.error === 'string' ? result.error : 'Unable to delete. Try again.');
        if (response.status === 409) onConflict();
        return;
      }
      if (result.deleted !== true || result.id !== id) throw new Error('Invalid acknowledgement');
      onDeleted();
    } catch {
      if (active.current) setError('Deletion was not confirmed. Try Delete again.');
    } finally {
      clearTimeout(timeout);
      inFlight.current = null;
      if (active.current) setPending(false);
    }
  }

  return <>
    <button type="button" onClick={remove} disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-700 hover:bg-red-100 disabled:opacity-50">
      {pending ? 'Deleting…' : 'Delete'}
    </button>
    {error && <p role="alert" className="basis-full text-sm text-red-700">{error}</p>}
  </>;
}
