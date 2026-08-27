'use client';

import { useState, useTransition } from 'react';
import { CertificationWithStatus } from '@/lib/database.types';
import { approveCertification, rejectCertification } from '@/lib/actions';
import { useTranslation } from './i18n/LanguageProvider';

type Row = CertificationWithStatus & { companyName: string };

export function PendingApprovalsTable({ certs }: { certs: Row[] }) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function handleApprove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      await approveCertification(id);
      setBusyId(null);
    });
  }

  function handleReject(id: string) {
    const reason = window.prompt(t('admin.rejectPrompt')) || undefined;
    setBusyId(id);
    startTransition(async () => {
      await rejectCertification(id, reason);
      setBusyId(null);
    });
  }

  if (certs.length === 0) {
    return <div className="p-8 text-center text-slate-400 text-sm">{t('admin.allCaughtUp')}</div>;
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b-2 border-slate-200">
          <th className="px-5 py-3 text-left text-xs text-slate-400 font-semibold uppercase">{t('admin.company')}</th>
          <th className="px-5 py-3 text-left text-xs text-slate-400 font-semibold uppercase">{t('admin.product')}</th>
          <th className="px-5 py-3 text-left text-xs text-slate-400 font-semibold uppercase">
            {t('admin.submitted')}
          </th>
          <th className="px-5 py-3 text-center text-xs text-slate-400 font-semibold uppercase">
            {t('admin.actions')}
          </th>
        </tr>
      </thead>
      <tbody>
        {certs.map((c) => (
          <tr key={c.id} className="border-b border-slate-100">
            <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{c.companyName}</td>
            <td className="px-5 py-3.5 text-sm text-slate-600">{c.product_name}</td>
            <td className="px-5 py-3.5 text-sm text-slate-400">{timeAgo(c.created_at, t)}</td>
            <td className="px-5 py-3.5 text-center">
              <button
                onClick={() => handleApprove(c.id)}
                disabled={isPending && busyId === c.id}
                className="px-2.5 py-1.5 mr-1 bg-green-100 text-green-800 rounded text-[11px] font-semibold disabled:opacity-50"
              >
                {t('admin.approve')}
              </button>
              <button
                onClick={() => handleReject(c.id)}
                disabled={isPending && busyId === c.id}
                className="px-2.5 py-1.5 bg-red-100 text-red-800 rounded text-[11px] font-semibold disabled:opacity-50"
              >
                {t('admin.reject')}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function timeAgo(dateStr: string, t: (path: string) => string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return t('admin.justNow');
  if (hours < 24) return `${hours} ${hours === 1 ? t('admin.hourAgo') : t('admin.hoursAgo')}`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? t('admin.dayAgo') : t('admin.daysAgo')}`;
}
