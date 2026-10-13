'use client';

import { useState, useTransition } from 'react';
import { resendClientInvite } from '@/lib/actions';
import { useTranslation } from './i18n/LanguageProvider';

export interface ClientRow {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  productCount: number;
  hasLoggedIn: boolean;
}

export function ClientsTable({ clients }: { clients: ClientRow[] }) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);

  function handleResend(id: string, email: string | null) {
    if (!email) return;
    setBusyId(id);
    setSentId(null);
    startTransition(async () => {
      try {
        await resendClientInvite(email);
        setSentId(id);
      } finally {
        setBusyId(null);
      }
    });
  }

  if (clients.length === 0) {
    return <div className="p-8 text-center text-slate-400 text-sm">{t('clients.none')}</div>;
  }

  const activeCount = clients.filter((c) => c.hasLoggedIn).length;

  return (
    <>
    <div className="px-5 py-3 text-sm text-slate-600 border-b border-slate-100">
      Total: <strong>{clients.length}</strong> · {t('clients.active')}: <strong>{activeCount}</strong> · {t('clients.pending')}: <strong>{clients.length - activeCount}</strong>
    </div>
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-slate-50 border-b-2 border-slate-200">
          <th className="px-3 py-3 text-right text-xs text-slate-400 font-semibold uppercase w-10">#</th>
          <th className="px-5 py-3 text-left text-xs text-slate-400 font-semibold uppercase">{t('clients.company')}</th>
          <th className="px-5 py-3 text-left text-xs text-slate-400 font-semibold uppercase">{t('clients.contact')}</th>
          <th className="px-5 py-3 text-left text-xs text-slate-400 font-semibold uppercase">{t('clients.email')}</th>
          <th className="px-5 py-3 text-left text-xs text-slate-400 font-semibold uppercase">{t('clients.phone')}</th>
          <th className="px-5 py-3 text-center text-xs text-slate-400 font-semibold uppercase">{t('clients.products')}</th>
          <th className="px-5 py-3 text-center text-xs text-slate-400 font-semibold uppercase">{t('clients.status')}</th>
          <th className="px-5 py-3 text-center text-xs text-slate-400 font-semibold uppercase">{t('clients.actions')}</th>
        </tr>
      </thead>
      <tbody>
        {clients.map((c, index) => (
          <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-3 py-3.5 text-sm text-right text-slate-400">{index + 1}</td>
            <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{c.company_name || '—'}</td>
            <td className="px-5 py-3.5 text-sm text-slate-600">{c.contact_name || '—'}</td>
            <td className="px-5 py-3.5 text-sm text-slate-600">{c.email || '—'}</td>
            <td className="px-5 py-3.5 text-sm text-slate-600">{c.phone || '—'}</td>
            <td className="px-5 py-3.5 text-sm text-center text-slate-600">{c.productCount}</td>
            <td className="px-5 py-3.5 text-sm text-center">
              {c.hasLoggedIn ? (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-[11px] font-semibold">
                  {t('clients.active')}
                </span>
              ) : (
                <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-[11px] font-semibold">
                  {t('clients.pending')}
                </span>
              )}
            </td>
            <td className="px-5 py-3.5 text-center">
              {sentId === c.id ? (
                <span className="text-[11px] text-green-700 font-semibold">{t('clients.inviteSent')}</span>
              ) : (
                <button
                  onClick={() => handleResend(c.id, c.email)}
                  disabled={!c.email || (isPending && busyId === c.id)}
                  className="px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded text-[11px] font-semibold disabled:opacity-50"
                >
                  {isPending && busyId === c.id ? t('clients.resending') : t('clients.resendInvite')}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </>
  );
}
