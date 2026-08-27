'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCertification } from '@/lib/actions';
import { useTranslation } from './i18n/LanguageProvider';

export function NewCertificationForm({
  clients,
}: {
  clients: { id: string; company_name: string | null }[];
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    clientId: '',
    productName: '',
    productCategory: '',
    certificationNumber: '',
    dateIssued: '',
    expirationDate: '',
    mashguiachNotes: '',
    autoApprove: false,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.clientId || !form.productName || !form.certificationNumber || !form.expirationDate) {
      setError(t('certifications.new.requiredError'));
      return;
    }

    setSaving(true);
    try {
      await createCertification({
        clientId: form.clientId,
        productName: form.productName,
        productCategory: form.productCategory || undefined,
        certificationNumber: form.certificationNumber,
        dateIssued: form.dateIssued || undefined,
        expirationDate: form.expirationDate,
        mashguiachNotes: form.mashguiachNotes || undefined,
        autoApprove: form.autoApprove,
      });
      router.push('/admin/certifications');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('certifications.new.genericError'));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm space-y-5">
      <Field label={t('certifications.new.clientLabel')}>
        <select
          required
          value={form.clientId}
          onChange={(e) => update('clientId', e.target.value)}
          className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg text-sm"
        >
          <option value="">{t('certifications.new.selectClient')}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name || c.id}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t('certifications.new.productNameLabel')}>
          <input
            required
            value={form.productName}
            onChange={(e) => update('productName', e.target.value)}
            className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg text-sm"
          />
        </Field>
        <Field label={t('certifications.new.categoryLabel')}>
          <input
            value={form.productCategory}
            onChange={(e) => update('productCategory', e.target.value)}
            placeholder={t('certifications.new.categoryPlaceholder')}
            className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg text-sm"
          />
        </Field>
      </div>

      <Field label={t('certifications.new.certNumberLabel')}>
        <input
          required
          value={form.certificationNumber}
          onChange={(e) => update('certificationNumber', e.target.value)}
          placeholder={t('certifications.new.certNumberPlaceholder')}
          className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg text-sm"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t('certifications.new.dateIssuedLabel')}>
          <input
            type="date"
            value={form.dateIssued}
            onChange={(e) => update('dateIssued', e.target.value)}
            className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg text-sm"
          />
        </Field>
        <Field label={t('certifications.new.expirationLabel')}>
          <input
            type="date"
            required
            value={form.expirationDate}
            onChange={(e) => update('expirationDate', e.target.value)}
            className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg text-sm"
          />
        </Field>
      </div>

      <Field label={t('certifications.new.notesLabel')}>
        <textarea
          value={form.mashguiachNotes}
          onChange={(e) => update('mashguiachNotes', e.target.value)}
          rows={3}
          className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg text-sm"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.autoApprove}
          onChange={(e) => update('autoApprove', e.target.checked)}
          className="accent-brand w-4 h-4"
        />
        {t('certifications.new.autoApprove')}
      </label>

      {error && <div className="p-3 bg-red-50 text-red-800 text-sm rounded-lg">{error}</div>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-brand text-white rounded-lg text-sm font-semibold disabled:opacity-60"
        >
          {saving ? t('certifications.new.saving') : t('certifications.new.create')}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-slate-700 mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  );
}
