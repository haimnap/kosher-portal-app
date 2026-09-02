'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from './i18n/LanguageProvider';

export function MondayClientSyncButton() {
  const router = useRouter();
  const { t } = useTranslation();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch('/api/monday/sync-clients', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setResult(
        `✓ ${data.created} ${t('clients.syncCreated')}, ${data.alreadyExists} ${t('clients.syncExisting')}, ${data.skipped.length} ${t('clients.syncSkipped')} (${data.total} ${t('clients.syncTotal')})`
      );
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
    </div>
  );
}
