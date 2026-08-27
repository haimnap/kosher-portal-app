'use client';

import { useState, useTransition } from 'react';
import { CertificationWithStatus, ComputedStatus } from '@/lib/database.types';
import { StatusBadge } from './StatusBadge';
import { approveCertification, rejectCertification } from '@/lib/actions';
import { useTranslation } from './i18n/LanguageProvider';
import { formatDate } from '@/lib/i18n/format';

type Row = CertificationWithStatus & { companyName: string };
type Filter = 'all' | 'pending' | ComputedStatus;

export function AdminCertificationsTable({
  certs,
  initialFilter,
}: {
  certs: Row[];
  initialFilter?: string;
}) {
  const { t, lang } = useTranslation();
  const [filter, setFilter] = useState<Filter>((initialFilter as Filter) || 'all');
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = certs.filter((c) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'pending' ? c.approval_status === 'pending' : c.status === filter);
    const matchesSearch =
      search === '' ||
      c.product_name.toLowerCase().includes(search.toLowerCase()) ||
      c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      c.certification_number.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

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

  const filterOptions: Filter[] = ['all', 'pending', 'active', 'expiring_soon', 'expired'];
  const filterLabels: Record<Filter, string> = {
    all: t('certifications.filterAll'),
    pending: t('certifications.filterPending'),
    active: t('certifications.filterActive'),
    expiring_soon: t('certifications.filterExpiringSoon'),
    expired: t('certifications.filterExpired'),
    rejected: t('status.rejected'),
  };

  return (
    <div>
      <div className="bg-white p-5 rounded-xl mb-5 shadow-sm flex gap-3 flex-wrap items-center">
        <input
          type="text"
          placeholder={t('certifications.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2.5 border-2 border-slate-200 rounded-lg text-sm"
        />
        <div className="flex gap-2 flex-wrap">
          {filterOptions.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium border-2 ${
                filter === f ? 'bg-brand text-white border-brand' : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-slate-50 border-b-2 border-slate-200">
              <th className="px-4 py-3 text-left text-xs text-slate-400 font-semibold uppercase">
                {t('certifications.company')}
              </th>
              <th className="px-4 py-3 text-left text-xs text-slate-400 font-semibold uppercase">
                {t('certifications.product')}
              </th>
              <th className="px-4 py-3 text-left text-xs text-slate-400 font-semibold uppercase">
                {t('certifications.certNumber')}
              </th>
              <th className="px-4 py-3 text-left text-xs text-slate-400 font-semibold uppercase">
                {t('certifications.expires')}
              </th>
              <th className="px-4 py-3 text-center text-xs text-slate-400 font-semibold uppercase">
                {t('certifications.statusCol')}
              </th>
              <th className="px-4 py-3 text-center text-xs text-slate-400 font-semibold uppercase">
                {t('certifications.actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3.5 text-sm font-medium text-slate-900">{c.companyName}</td>
                <td className="px-4 py-3.5 text-sm text-slate-600">{c.product_name}</td>
                <td className="px-4 py-3.5 text-sm text-slate-400">{c.certification_number}</td>
                <td className="px-4 py-3.5 text-sm text-slate-600">{formatDate(c.expiration_date, lang)}</td>
                <td className="px-4 py-3.5 text-center">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3.5 text-center">
                  {c.approval_status === 'pending' ? (
                    <>
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
                    </>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="p-8 text-center text-slate-400 text-sm">{t('certifications.noMatch')}</div>
        )}
      </div>
    </div>
  );
}
