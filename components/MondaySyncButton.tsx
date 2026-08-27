'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from './i18n/LanguageProvider';

export function MondaySyncButton() {
  const router = useRouter();
  const { t } = useTranslation();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch('/api/monday/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setResult(
        `✓ ${data.created} new, ${data.updated} updated, ${data.skipped} skipped (of ${data.total})`
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
        className="w-full py-3 border-2 border-slate-200 text-slate-700 rounded-lg text-sm font-semibold disabled:opacity-60"
      >
        {syncing ? t('admin.syncing') : t('admin.syncMonday')}
      </button>
      {result && <p className="text-xs text-slate-500 mt-2">{result}</p>}
    </div>
  );
}
