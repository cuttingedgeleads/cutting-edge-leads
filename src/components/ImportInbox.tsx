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
  const [offset, setOffset] = useState(0);
  const { data, error, reload } = usePrivateImport<{
    waitingCount: number;
    total: number;
    items: PrivateImport[];
  }>(`/api/admin/imports?status=pending&offset=${offset}`);
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Import</h1>
      <p>Choose Create lead to load an import into the Create Lead tab.</p>
      {error ? (
        <p role="alert">
          {error} <button onClick={reload}>Retry</button>
        </p>
      ) : !data ? (
        <p role="status">Loading imports…</p>
      ) : (
        <>
          <p>{data.total} imports</p>
          {!data.items.length && <p>No imports to create.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {data.items.map((r) => {
              const p = JSON.parse(r.originalPayload);
              return (
                <article
                  key={r.id}
                  className="rounded-xl border bg-white p-4 space-y-2 break-words"
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
                  <Link
                    prefetch={false}
                    href={`/admin/leads?importId=${encodeURIComponent(r.id)}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-900 px-4 py-2 font-medium text-white"
                  >Create lead</Link>
                </article>
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
