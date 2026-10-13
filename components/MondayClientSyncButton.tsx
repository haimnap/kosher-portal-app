'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from './i18n/LanguageProvider';

type Skipped = { company: string | null; reason: string };

function explainReason(reason: string) {
  if (reason === 'missing_email') return 'no email found (no linked contact with an email, and no company email)';
  if (reason === 'missing_name') return 'no company name';
  if (/already|registered|exists/i.test(reason)) return 'email already used by another company';
  return reason;
}

export function MondayClientSyncButton() {
  const router = useRouter();
  const { t } = useTranslation();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<Skipped[]>([]);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    setSkipped([]);
    try {
      const res = await fetch('/api/monday/sync-clients', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setResult(
        `✓ ${data.created} ${t('clients.syncCreated')}, ${data.alreadyExists} ${t('clients.syncExisting')}, ${data.skipped.length} ${t('clients.syncSkipped')} (${data.total} ${t('clients.syncTotal')})`
      );
      setSkipped(data.skipped ?? []);
      router.refresh();
    } catch (err) {
      setResult(err instanceof Error ? `✗ ${err.message}` : '✗ Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="px-5 py-2.5 border-2 border-slate-200 text-slate-700 rounded-lg text-sm font-semibold disabled:opacity-60"
      >
        {syncing ? t('clients.syncing') : t('clients.syncMonday')}
      </button>
      {result && <p className="text-xs text-slate-500 mt-2">{result}</p>}
      {skipped.length > 0 && (
        <ul className="text-xs text-amber-800 bg-amber-50 rounded-lg p-3 mt-2 max-w-md space-y-1">
          {skipped.map((s, i) => (
            <li key={i}>
              <strong>{s.company || '(no name)'}</strong>: {explainReason(s.reason)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
