'use client';
import { useState } from 'react';
import { LeadForm } from './LeadForm';
import { importsChanged, usePrivateImport } from './ImportState';
import type { PrivateImport } from './ImportInbox';
import { importFormData } from '../lib/import-form-prefill';

export function ImportRequest({ id }: { id: string }) {
  const { data, error, reload, invalidate, owner } =
    usePrivateImport<PrivateImport>(`/api/admin/imports/${id}`);
  return (
    <section className="space-y-4">
      {error && <p role="alert">{error} <button onClick={reload}>Retry</button></p>}
      {data ? (
        <ImportedLead
          key={`${owner}:${id}`}
          record={data}
          onPublished={reload}
          onUnavailable={invalidate}
        />
      ) : !error && <p role="status">Loading…</p>}
    </section>
  );
}

function ImportedLead({ record, onPublished, onUnavailable }: {
  record: PrivateImport;
  onPublished: () => void;
  onUnavailable: () => void;
}) {
  const p = JSON.parse(record.originalPayload);
  // Freeze both the editing values and their optimistic-lock version.
  const [initial] = useState(() => ({
    version: record.version,
    data: importFormData(p, record.reviewedData),
  }));
  const [published, setPublished] = useState(false);
  return published || record.status === 'published' ? (
    <p role="status">This lead has already been created. It will not be created again.</p>
  ) : (
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
  );
}
