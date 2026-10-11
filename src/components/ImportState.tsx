'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

export function importsChanged() {
  window.dispatchEvent(new Event('imports-changed'));
}

export function usePrivateImport<T>(url: string) {
  const { data: session, status } = useSession();
  const owner =
    status === 'authenticated' && session.user.role === 'ADMIN'
      ? session.user.id
      : null;
  const [state, setState] = useState<{
    owner: string | null;
    url: string;
    data?: T;
    error?: string;
  }>({ owner: null, url });
  const [nonce, setNonce] = useState(0);
  const serial = useRef(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const invalidate = useCallback(() => {
    ++serial.current; // Ignore any GET which predates an authorization failure on save/publish.
    setState({ owner, url, error: 'Import unavailable for this account.' });
  }, [owner, url]);

  useEffect(() => {
    // Never resurrect data from a previous owner/route, including logout then same-owner login.
    setState((previous) =>
      previous.owner === owner && previous.url === url
        ? previous
        : { owner, url },
    );
    let abort: AbortController | undefined;
    let live = true;
    const run = async () => {
      if (document.hidden || !owner) return;
      abort?.abort();
      abort = new AbortController();
      const n = ++serial.current;
      try {
        const response = await fetch(url, {
          cache: 'no-store',
          signal: abort.signal,
        });
        if (!response.ok) {
          if ([401, 403, 404].includes(response.status)) {
            if (live && n === serial.current)
              setState({
                owner,
                url,
                error: 'Import unavailable for this account.',
              });
            return;
          }
          throw Error('Unable to load imports. Retry.');
        }
        const data = await response.json();
        if (live && n === serial.current) setState({ owner, url, data });
      } catch (error) {
        if (
          live &&
          n === serial.current &&
          (error as Error).name !== 'AbortError'
        ) {
          // Transient failures must not unmount the editor or overwrite local dirty fields.
          setState((previous) => ({
            owner,
            url,
            data:
              previous.owner === owner && previous.url === url
                ? previous.data
                : undefined,
            error: (error as Error).message,
          }));
        }
      }
    };
    void run();
    const resume = () => {
      void run();
    };
    const message = (event: MessageEvent) => {
      if (event.data?.type === 'push-notification') resume();
    };
    window.addEventListener('focus', resume);
    window.addEventListener('imports-changed', resume);
    document.addEventListener('visibilitychange', resume);
    navigator.serviceWorker?.addEventListener('message', message);
    return () => {
      live = false;
      ++serial.current;
      abort?.abort();
      window.removeEventListener('focus', resume);
      window.removeEventListener('imports-changed', resume);
      document.removeEventListener('visibilitychange', resume);
      navigator.serviceWorker?.removeEventListener('message', message);
    };
  }, [owner, url, nonce]);

  // Render-time scope gate, not only an asynchronous effect cleanup.
  const current =
    owner && state.owner === owner && state.url === url ? state : null;
  return {
    data: current?.data,
    error: current?.error,
    reload,
    invalidate,
    owner,
  };
}

export function ImportBadge() {
  const { data, error, reload } = usePrivateImport<{ waitingCount: number; pendingCount: number }>(
    '/api/admin/imports/count',
  );
  return (
    <span
      data-testid="import-count"
      className="ml-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1.5 text-xs font-semibold text-white"
      title={error || 'Imports ready to create'}
      onClick={
        error
          ? (event) => {
              event.preventDefault();
              reload();
            }
          : undefined
      }
      aria-label={
        error
          ? 'Import count unavailable; retry'
          : `${data?.pendingCount ?? 'Loading'} imports ready to create`
      }
    >
      {' '}
      {error ? '!' : (data?.pendingCount ?? '…')}
    </span>
  );
}
