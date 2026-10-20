'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from './i18n/LanguageProvider';

interface SyncResult {
  companies: number;
  peopleCreated: number;
  peopleLinked: number;
  peopleUnchanged: number;
  total: number;
  skipped: { company: string | null; reason: string }[];
  review: { company: string | null; email: string; reason: string }[];
}

// The last result is kept in this browser tab so it stays visible after
// the client list below refreshes.
const STORAGE_KEY = 'lak-monday-client-sync-result';

export function MondayClientSyncButton() {
  const router = useRouter();
  const { t } = useTranslation();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setResult(JSON.parse(saved));
    } catch {
      // storage unavailable — just don't restore
    }
  }, []);

  function reasonText(reason: string) {
    const text = t(`clients.reasons.${reason}`);
    return text === `clients.reasons.${reason}` ? reason : text;
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/monday/sync-clients', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setResult(data);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // ignore
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  function dismiss() {
    setResult(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  return (
    <div className="max-w-xl">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="px-5 py-2.5 border-2 border-slate-200 text-slate-700 rounded-lg text-sm font-semibold disabled:opacity-60"
      >
        {syncing ? t('clients.syncing') : t('clients.syncMonday')}
      </button>

      {error && <p className="text-xs text-red-600 mt-2">✗ {error}</p>}

      {result && (
        <div className="mt-2 text-xs space-y-2">
          <div className="flex items-start justify-between gap-3">
            <p className="text-slate-600">
              ✓ {result.companies} {t('clients.syncCompanies')} · {result.peopleCreated} {t('clients.syncPeopleNew')} ·{' '}
              {result.peopleLinked} {t('clients.syncPeopleLinked')} · {result.peopleUnchanged}{' '}
              {t('clients.syncPeopleUnchanged')} ({result.total} {t('clients.syncTotal')})
            </p>
            <button onClick={dismiss} className="text-slate-400 hover:text-slate-600" aria-label="Close">
              ✕
            </button>
          </div>

          {result.skipped.length > 0 && (
            <div className="bg-amber-50 text-amber-900 rounded-lg p-3">
              <p className="font-semibold mb-1">
                {t('clients.syncSkippedTitle')} ({result.skipped.length})
              </p>
              <ul className="space-y-1">
                {result.skipped.map((s, i) => (
                  <li key={i}>
                    <strong>{s.company || '—'}</strong>: {reasonText(s.reason)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.review.length > 0 && (
            <div className="bg-sky-50 text-sky-900 rounded-lg p-3">
              <p className="font-semibold mb-1">
                {t('clients.syncReviewTitle')} ({result.review.length})
              </p>
              <ul className="space-y-1">
                {result.review.map((r, i) => (
                  <li key={i}>
                    <strong>{r.company || '—'}</strong> — {r.email}: {reasonText(r.reason)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
