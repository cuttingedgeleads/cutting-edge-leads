'use client';
import { useState } from 'react';
import Link from 'next/link';
import { LeadForm } from './LeadForm';
import { importsChanged, usePrivateImport } from './ImportState';
import type { PrivateImport } from './ImportInbox';

export function ImportRequest({ id }: { id: string }) {
  const { data, error, reload, invalidate, owner } =
    usePrivateImport<PrivateImport>(`/api/admin/imports/${id}`);
  return (
    <section className="space-y-4">
      <Link href="/admin/imports" prefetch={false}>Back to Import</Link>
      {error && <p role="alert">{error} <button onClick={reload}>Retry</button></p>}
      {data ? (
        <ImportedLead
          key={`${owner}:${id}`}
          record={data}
          onPublished={reload}
          onUnavailable={invalidate}
        />
      ) : !error && <p role="status">Loading import…</p>}
    </section>
  );
}

function ImportedLead({ record, onPublished, onUnavailable }: {
  record: PrivateImport;
  onPublished: () => void;
  onUnavailable: () => void;
}) {
  const p = JSON.parse(record.originalPayload);
  // Freeze the editing base with the form. A background read must neither
  // overwrite human edits nor silently advance their optimistic-lock version.
  const [initial] = useState(() => ({
    version: record.version,
    data: record.reviewedData || {
      name: p.customerName, email: p.customerEmail, phone: p.customerPhone,
      address: p.formattedAddress || p.address, city: p.city, state: p.state,
      zip: p.postalCode, description: '', jobType: '', price: '', unlockLimit: '',
    },
  }));
  const [published, setPublished] = useState(false);
  return (
    <>
      <aside className="rounded border bg-slate-100 p-4 break-words">
        <h3 className="font-bold">Private Studio information</h3>
        <p>Original address: {p.address || 'Not provided'}</p>
        <p>Full address: {p.formattedAddress || 'Not provided'}</p>
        {[
          ['inquiryNotes', 'Inquiry notes'],
          ['estimatorNotes', 'Estimator notes'],
          ['salesNotes', 'Sales notes'],
        ].map(([key, label]) => (
          <p className="whitespace-pre-wrap" key={key}>{label}: {p[key] || 'Not provided'}</p>
        ))}
        <p>{p.sourcePhotoCount} photos remain in Studio.</p>
      </aside>
      {published || record.status === 'published' ? (
        <p role="status">This lead has already been created. It will not be created again.</p>
      ) : (
        <>
          <p>Review the imported details below. Nothing is published until you choose Publish lead. Private Studio notes are not included in the public description.</p>
          <LeadForm importRequest={{
            id: record.id,
            version: initial.version,
            data: initial.data,
            onUnavailable,
            onPublished: () => {
              setPublished(true);
              importsChanged();
              onPublished();
            },
          }} />
        </>
      )}
    </>
  );
}
