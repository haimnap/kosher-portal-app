'use client';

import { useState } from 'react';
import { useTranslation } from './i18n/LanguageProvider';

// Lets an admin trigger the same expiration-reminder job that runs
// automatically on a schedule (see app/api/cron/expiration-reminders) —
// handy for testing, or to send reminders on-demand instead of waiting
// for the next scheduled run.
export function SendRemindersButton() {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/send-reminders', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setResult(`✓ ${data.emailsSent} email(s) sent (${data.certsFlagged} certification(s))`);
    } catch (err) {
      setResult(err instanceof Error ? `✗ ${err.message}` : '✗ Failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleSend}
        disabled={sending}
        className="w-full py-3 border-2 border-slate-200 text-slate-700 rounded-lg text-sm font-semibold disabled:opacity-60"
      >
        {sending ? t('admin.sendingReminders') : t('admin.sendReminders')}
      </button>
      {result && <p className="text-xs text-slate-500 mt-2">{result}</p>}
    </div>
  );
}
