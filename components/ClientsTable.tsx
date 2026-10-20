'use client';

import { useState, useTransition } from 'react';
import { resendClientInvite } from '@/lib/actions';
import { useTranslation } from './i18n/LanguageProvider';

export interface ClientPerson {
  id: string;
  name: string | null;
  email: string | null;
  hasLoggedIn: boolean;
  isMain: boolean;
}

// One row per company. `people` = everyone with a login for it (the
// company's main account first, then its team members).
export interface ClientRow {
  id: string;
  company_name: string | null;
  phone: string | null;
  productCount: number;
  people: ClientPerson[];
}

export function ClientsTable({ clients }: { clients: ClientRow[] }) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  function handleResend(id: string, email: string | null) {
    if (!email) return;
    setBusyId(id);
    startTransition(async () => {
      try {
        await resendClientInvite(email);
        setSentIds((prev) => new Set(prev).add(id));
      } finally {
        setBusyId(null);
      }
    });
  }

  if (clients.length === 0) {
    return <div className="p-8 text-center text-slate-400 text-sm">{t('clients.none')}</div>;
  }

  const peopleCount = clients.reduce((n, c) => n + c.people.length, 0);
  const loggedInCount = clients.reduce((n, c) => n + c.people.filter((p) => p.hasLoggedIn).length, 0);

  return (
    <>
      <div className="px-5 py-3 text-sm text-slate-600 border-b border-slate-100">
        {t('clients.companiesLabel')}: <strong>{clients.length}</strong> · {t('clients.peopleLabel')}:{' '}
        <strong>{peopleCount}</strong> · {t('clients.loggedInLabel')}: <strong>{loggedInCount}</strong>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b-2 border-slate-200">
            <th className="px-3 py-3 text-right text-xs text-slate-400 font-semibold uppercase w-10">#</th>
            <th className="px-5 py-3 text-left text-xs text-slate-400 font-semibold uppercase">{t('clients.company')}</th>
            <th className="px-5 py-3 text-left text-xs text-slate-400 font-semibold uppercase">{t('clients.people')}</th>
            <th className="px-5 py-3 text-left text-xs text-slate-400 font-semibold uppercase">{t('clients.phone')}</th>
            <th className="px-5 py-3 text-center text-xs text-slate-400 font-semibold uppercase">{t('clients.products')}</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c, index) => (
            <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 align-top">
              <td className="px-3 py-3.5 text-sm text-right text-slate-400">{index + 1}</td>
              <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{c.company_name || '—'}</td>
              <td className="px-5 py-2.5 text-sm text-slate-600">
                <ul className="space-y-1.5">
                  {c.people.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0">
                        {p.name && <span className="text-slate-800">{p.name} · </span>}
                        <span>{p.email || '—'}</span>
                      </span>
                      {p.hasLoggedIn ? (
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-800 rounded text-[10px] font-semibold">
                          {t('clients.active')}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-semibold">
                          {t('clients.pending')}
                        </span>
                      )}
                      {sentIds.has(p.id) ? (
                        <span className="text-[10px] text-green-700 font-semibold">{t('clients.inviteSent')}</span>
                      ) : (
                        <button
                          onClick={() => handleResend(p.id, p.email)}
                          disabled={!p.email || (isPending && busyId === p.id)}
                          className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold disabled:opacity-50"
                        >
                          {isPending && busyId === p.id ? t('clients.resending') : t('clients.resendInvite')}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </td>
              <td className="px-5 py-3.5 text-sm text-slate-600">{c.phone || '—'}</td>
              <td className="px-5 py-3.5 text-sm text-center text-slate-600">{c.productCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
