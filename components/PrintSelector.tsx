'use client';

import { useState } from 'react';
import { CertificationWithStatus } from '@/lib/database.types';
import { StatusBadge } from './StatusBadge';
import { useTranslation } from './i18n/LanguageProvider';
import { formatDate } from '@/lib/i18n/format';

export function PrintSelector({
  certs,
  companyName,
}: {
  certs: CertificationWithStatus[];
  companyName: string;
}) {
  const { t, lang } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set(certs.map((c) => c.id)));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(certs.map((c) => c.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  async function handleDownload() {
    if (selected.size === 0) {
      setError(t('print.selectAtLeastOne'));
      return;
    }
    setError(null);
    setGenerating(true);

    try {
      const res = await fetch('/api/certificates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificationIds: Array.from(selected), lang }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || t('print.genericError'));
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${companyName.replace(/\s+/g, '-')}-Kosher-Certificate.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('print.genericError'));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
      {/* Left: product list */}
      <div>
        <div className="bg-white p-5 rounded-xl mb-5 shadow-sm flex gap-2.5">
          <button onClick={selectAll} className="px-4 py-2.5 bg-brand text-white rounded-lg text-sm font-semibold">
            {t('print.selectAll')} ({certs.length})
          </button>
          <button
            onClick={deselectAll}
            className="px-4 py-2.5 border-2 border-slate-200 bg-white rounded-lg text-sm font-medium"
          >
            {t('print.deselectAll')}
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {certs.map((c) => (
            <label
              key={c.id}
              className={`flex gap-3 items-start px-5 py-4 border-b border-slate-100 cursor-pointer last:border-b-0 ${
                c.status === 'expiring_soon' ? 'bg-amber-50' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
                className="w-[18px] h-[18px] mt-0.5 accent-brand"
              />
              <div className="flex-1">
                <div className="font-semibold text-slate-900 mb-1">{c.product_name}</div>
                <div className="text-[13px] text-slate-400 mb-2">
                  {c.certification_number} • {t('dashboard.expires')}: {formatDate(c.expiration_date, lang)}
                </div>
                <div className="flex gap-3 items-center">
                  <StatusBadge status={c.status} />
                  <span className="text-xs text-slate-400">
                    {t('print.categoryLabel')}: {c.product_category || '—'}
                  </span>
                </div>
              </div>
            </label>
          ))}

          {certs.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm">{t('print.noApproved')}</div>
          )}
        </div>

        <div className="mt-5 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
          <strong>
            {selected.size} {t('print.selectedOf')} {certs.length} {t('print.productsSelected')}
          </strong>
        </div>
      </div>

      {/* Right: summary + actions */}
      <div>
        <div className="bg-white p-6 rounded-xl shadow-sm mb-5">
          <h3 className="text-base font-semibold text-brand mb-5">{t('print.printSummary')}</h3>

          <div className="bg-slate-50 p-4 rounded-lg mb-5 text-[13px] text-slate-600 space-y-2">
            <div className="flex justify-between">
              <span>{t('print.productsToPrint')}</span>
              <strong className="text-brand">{selected.size}</strong>
            </div>
            <div className="flex justify-between">
              <span>{t('print.totalPages')}</span>
              <strong className="text-brand">{selected.size}</strong>
            </div>
          </div>

          {error && <div className="mb-4 p-3 bg-red-50 text-red-800 text-sm rounded-lg">{error}</div>}

          <button
            onClick={handleDownload}
            disabled={generating}
            className="w-full py-3.5 rounded-lg text-white font-semibold mb-2.5 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #1a5f7a 0%, #2a8faa 100%)' }}
          >
            {generating ? t('print.generating') : t('print.downloadPdf')}
          </button>
          <p className="text-xs text-slate-400 text-center">{t('print.printNote')}</p>
        </div>

        <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-xs text-green-800">
          <strong>{t('print.allValidTitle')}</strong>
          <p className="mt-2">{t('print.allValidNote')}</p>
        </div>
      </div>
    </div>
  );
}
