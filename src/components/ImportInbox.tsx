'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePrivateImport } from './ImportState';
export type PrivateImport = {
  id: string;
  status: string;
  version: number;
  originalPayload: string;
  reviewedData: Record<string, string> | null;
  leadId: string | null;
};
export function ImportInbox() {
  const [status, setStatus] = useState('waiting'),
    [offset, setOffset] = useState(0);
  const { data, error, reload } = usePrivateImport<{
    waitingCount: number;
    total: number;
    items: PrivateImport[];
  }>(`/api/admin/imports?status=${status}&offset=${offset}`);
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Import</h1>
      <p>
        Private requests from Studio. Opening an import does not save or publish
        it.
      </p>
      <div className="flex flex-wrap gap-3">
        {[
          ['waiting', 'Waiting'],
          ['saved', 'Saved requests'],
          ['published', 'Published'],
        ].map(([key, label]) => (
          <button
            className="rounded border px-3 py-2"
            aria-pressed={status === key}
            key={key}
            onClick={() => {
              setStatus(key);
              setOffset(0);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert">
          {error} <button onClick={reload}>Retry</button>
        </p>
      ) : !data ? (
        <p role="status">Loading imports…</p>
      ) : (
        <>
          <p>
            {data.total}{' '}
            {status === 'waiting'
              ? 'waiting imports'
              : status === 'saved'
                ? 'saved requests'
                : 'published requests'}
          </p>
          {!data.items.length && <p>No {status} requests.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {data.items.map((r) => {
              const p = JSON.parse(r.originalPayload);
              return (
                <Link
                  prefetch={false}
                  key={r.id}
                  href={`/admin/imports/${r.id}`}
                  className="block rounded-xl border bg-white p-4 space-y-2 break-words"
                >
                  <strong>
                    Customer: {p.customerName || 'Name not provided'}
                  </strong>
                  <p>
                    Address:{' '}
                    {p.formattedAddress || p.address || 'Address not provided'}
                  </p>
                  <p>
                    Contact: {p.customerPhone || 'Phone not provided'} ·{' '}
                    {p.customerEmail || 'Email not provided'}
                  </p>
                  <p className="whitespace-pre-wrap">
                    PRIVATE:{' '}
                    {(
                      [p.inquiryNotes, p.estimatorNotes, p.salesNotes]
                        .filter(Boolean)
                        .join('\n') || 'No job context provided'
                    ).slice(0, 600)}
                  </p>
                </Link>
              );
            })}
          </div>
          <div className="flex gap-4">
            <button
              disabled={!offset}
              onClick={() => setOffset((n) => Math.max(0, n - 25))}
            >
              Previous
            </button>
            <button
              disabled={offset + 25 >= data.total}
              onClick={() => setOffset((n) => n + 25)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
