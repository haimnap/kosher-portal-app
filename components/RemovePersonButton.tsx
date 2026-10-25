'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeClientPerson } from '@/lib/actions';
import { useTranslation } from './i18n/LanguageProvider';

// Small "Remove" button that deletes one person's portal login (after a
// confirmation). The company and its products are never deleted.
export function RemovePersonButton({
  userId,
  email,
  onRemoved,
}: {
  userId: string;
  email: string | null;
  onRemoved?: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (removed) {
    return <span className="text-[10px] text-slate-500 font-semibold">{t('clients.removed')}</span>;
  }

  function handleClick() {
    const question = t('clients.removeConfirm').replace('{email}', email ?? '');
    if (!window.confirm(question)) return;
    setError(null);
    startTransition(async () => {
      const result = await removeClientPerson(userId);
      if (result.ok) {
        setRemoved(true);
        onRemoved?.();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-[10px] font-semibold disabled:opacity-50"
      >
        {isPending ? t('clients.removing') : t('clients.remove')}
      </button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </span>
  );
}
