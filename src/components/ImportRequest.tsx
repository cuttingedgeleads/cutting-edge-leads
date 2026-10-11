'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LeadForm } from './LeadForm';
import { importsChanged, usePrivateImport } from './ImportState';
import type { PrivateImport } from './ImportInbox';

export function ImportRequest({ id }: { id: string }) {
  const { data, error, reload, invalidate, owner } =
    usePrivateImport<PrivateImport>(`/api/admin/imports/${id}`);
  return (
    <section className="space-y-4">
      <Link href="/admin/imports" prefetch={false}>
        Back to Import / Saved requests
      </Link>
      {error && (
        <p role="alert">
          {error} <button onClick={reload}>Retry</button>
        </p>
      )}
      {data ? (
        <RequestEditor
          key={`${owner}:${id}`}
          record={data}
          onSaved={reload}
          onUnavailable={invalidate}
        />
      ) : (
        !error && <p role="status">Loading private request…</p>
      )}
    </section>
  );
}

const fieldLabels: Record<string, string> = {
  name: 'Customer name',
  email: 'Email',
  phone: 'Phone',
  address: 'Street address',
  city: 'City',
  state: 'State',
  zip: 'ZIP code',
  description: 'Public description (leave blank until reviewed)',
  jobType: 'Job type',
  price: 'Lead sale price',
  unlockLimit: 'Contractor unlock limit',
  inquiryNotes: 'Inquiry notes',
  estimatorNotes: 'Estimator notes',
  salesNotes: 'Sales notes',
};

function RequestEditor({
  record,
  onSaved,
  onUnavailable,
}: {
  record: PrivateImport;
  onSaved: () => void;
  onUnavailable: () => void;
}) {
  const p = JSON.parse(record.originalPayload);
  const initial = record.reviewedData || {
    name: p.customerName,
    email: p.customerEmail,
    phone: p.customerPhone,
    address: p.formattedAddress || p.address,
    city: p.city,
    state: p.state,
    zip: p.postalCode,
    description: '',
    jobType: '',
    price: '',
    unlockLimit: '',
  };
  const [data, setData] = useState<Record<string, string>>(initial);
  const [version, setVersion] = useState(record.version);
  const [saved, setSaved] = useState(record.status !== 'waiting');
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function save() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/imports/${record.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, data }),
      });
      if ([401, 403, 404].includes(response.status)) {
        if (alive.current) onUnavailable();
        return;
      }
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Save failed. Retry.');
      if (alive.current) {
        setVersion(result.version);
        setSaved(true);
        importsChanged();
        onSaved();
      }
    } catch (error) {
      if (alive.current) setError((error as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function edit(key: string, value: string) {
    setData((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
  }
  return (
    <>
      <h1 className="text-xl font-semibold">Private imported request</h1>
      <aside className="rounded border bg-slate-100 p-4 break-words">
        <h2 className="font-bold">
          PRIVATE Studio context — never published automatically
        </h2>
        <p>Original address: {p.address || 'Not provided'}</p>
        <p>Full address: {p.formattedAddress || 'Not provided'}</p>
        {['inquiryNotes', 'estimatorNotes', 'salesNotes'].map((key) => (
          <p className="whitespace-pre-wrap" key={key}>
            {fieldLabels[key]}: {p[key] || 'Not provided'}
          </p>
        ))}
        <p>{p.sourcePhotoCount} photos remain in Studio.</p>
      </aside>
      {record.status === 'published' ? (
        <p>This request is published.</p>
      ) : publish ? (
        <>
          <p>
            Publish lead creates a live marketplace listing and sends normal
            contractor notifications. Only the description you enter below is
            public; private Studio notes are not copied.
          </p>
          <button onClick={() => setPublish(false)}>
            Back to saved request
          </button>
          <LeadForm
            importRequest={{
              id: record.id,
              version,
              data,
              onUnavailable,
              onPublished: () => {
                importsChanged();
                onSaved();
              },
            }}
          />
        </>
      ) : (
        <>
          <p>
            Save request keeps this unpublished. No contractor notifications are
            sent.
          </p>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            {Object.keys(initial).map((key) => (
              <label
                key={key}
                className={key === 'description' ? 'sm:col-span-2' : ''}
              >
                {fieldLabels[key]}
                <span className="block">
                  {key === 'description' ? (
                    <textarea
                      disabled={busy}
                      name={key}
                      className="w-full border rounded p-2"
                      value={data[key]}
                      onChange={(event) => edit(key, event.target.value)}
                    />
                  ) : (
                    <input
                      disabled={busy}
                      name={key}
                      className="w-full border rounded p-2"
                      value={data[key]}
                      onChange={(event) => edit(key, event.target.value)}
                    />
                  )}
                </span>
              </label>
            ))}
            <button
              disabled={busy}
              className="rounded bg-slate-900 text-white p-3"
              type="submit"
            >
              {busy ? 'Saving…' : 'Save request'}
            </button>
          </form>
          {error && (
            <p role="alert">
              {error}{' '}
              <button
                onClick={() => {
                  if (
                    confirm('Reload this request and discard unsaved changes?')
                  )
                    location.reload();
                }}
              >
                Reload request
              </button>
            </p>
          )}
          {saved && (
            <>
              <p role="status">Saved privately. Available in Saved requests.</p>
              <button
                className="rounded border p-3"
                onClick={() => setPublish(true)}
              >
                Review &amp; publish
              </button>
            </>
          )}
        </>
      )}
    </>
  );
}
