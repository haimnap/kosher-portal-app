'use client';

import { useState } from 'react';
import { CertificationWithStatus } from '@/lib/database.types';
import { StatusBadge } from './StatusBadge';
import { useTranslation } from './i18n/LanguageProvider';
import { formatDate } from '@/lib/i18n/format';

type FilterOption = 'all' | 'active' | 'expiring_soon';

export function ProductTable({ certs }: { certs: CertificationWithStatus[] }) {
  const [filter, setFilter] = useState<FilterOption>('all');
  const { t, lang } = useTranslation();

  const filtered = certs.filter((c) => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  return (
    <div>
      <div className="bg-white p-5 rounded-xl mb-6 shadow-sm flex gap-2.5 flex-wrap">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
          {t('dashboard.allProducts')}
        </FilterButton>
        <FilterButton active={filter === 'active'} onClick={() => setFilter('active')}>
          {t('dashboard.active')}
        </FilterButton>
        <FilterButton active={filter === 'expiring_soon'} onClick={() => setFilter('expiring_soon')}>
          {t('dashboard.expiringSoonFilter')}
        </FilterButton>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 border-b-2 border-slate-200">
              <Th>{t('dashboard.productName')}</Th>
              <Th>{t('dashboard.category')}</Th>
              <Th>{t('dashboard.certNumber')}</Th>
              <Th>{t('dashboard.issued')}</Th>
              <Th>{t('dashboard.expires')}</Th>
              <Th center>{t('dashboard.statusCol')}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                <Td strong>{c.product_name}</Td>
                <Td>{c.product_category || '—'}</Td>
                <Td>{c.certification_number}</Td>
                <Td>{c.date_issued ? formatDate(c.date_issued, lang) : '—'}</Td>
                <Td highlight={c.status === 'expiring_soon'}>{formatDate(c.expiration_date, lang)}</Td>
                <td className="px-5 py-4 text-center">
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-[13px] font-medium border-2 transition-colors ${
        active ? 'bg-brand text-white border-brand' : 'bg-white text-slate-700 border-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function Th({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <th className={`px-5 py-4 text-xs text-slate-500 font-semibold uppercase ${center ? 'text-center' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  strong,
  highlight,
}: {
  children: React.ReactNode;
  strong?: boolean;
  highlight?: boolean;
}) {
  return (
    <td
      className={`px-5 py-4 text-sm ${strong ? 'font-medium text-slate-900' : 'text-slate-600'} ${
        highlight ? 'text-orange-600 font-semibold' : ''
      }`}
    >
      {children}
    </td>
  );
}
