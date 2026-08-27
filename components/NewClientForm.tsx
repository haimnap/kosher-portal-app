'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientAccount } from '@/lib/actions';
import { useTranslation } from './i18n/LanguageProvider';
import { LANGUAGES, LANGUAGE_NAMES } from '@/lib/i18n/config';

export function NewClientForm() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    email: '',
    companyName: '',
    contactName: '',
    phone: '',
    preferredLanguage: lang,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.email || !form.companyName) {
      setError(t('clients.new.requiredError'));
      return;
    }

    setSaving(true);
    try {
      await createClientAccount(form);
      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/clients');
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('clients.new.genericError'));
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm text-center">
        <div className="text-4xl mb-3">✓</div>
        <p className="text-slate-700">
          {t('clients.new.successPrefix')} <strong>{form.email}</strong>. {t('clients.new.successSuffix')}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm space-y-5">
      <Field label={t('clients.new.companyNameLabel')}>
        <input
          required
          value={form.companyName}
          onChange={(e) => update('companyName', e.target.value)}
          className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg text-sm"
        />
      </Field>

      <Field label={t('clients.new.contactPersonLabel')}>
        <input
          value={form.contactName}
          onChange={(e) => update('contactName', e.target.value)}
          className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg text-sm"
        />
      </Field>

      <Field label={t('clients.new.emailLabel')}>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          placeholder={t('clients.new.emailPlaceholder')}
          className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg text-sm"
        />
      </Field>

      <Field label={t('clients.new.phoneLabel')}>
        <input
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
          className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg text-sm"
        />
      </Field>

      <Field label={t('clients.new.languageLabel')}>
        <select
          value={form.preferredLanguage}
          onChange={(e) => update('preferredLanguage', e.target.value as typeof form.preferredLanguage)}
          className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg text-sm"
        >
          {LANGUAGES.map((code) => (
            <option key={code} value={code}>
              {LANGUAGE_NAMES[code]}
            </option>
          ))}
        </select>
      </Field>

      {error && <div className="p-3 bg-red-50 text-red-800 text-sm rounded-lg">{error}</div>}

      <p className="text-xs text-slate-400">{t('clients.new.inviteNote')}</p>

      <button
        type="submit"
        disabled={saving}
        className="px-6 py-3 bg-brand text-white rounded-lg text-sm font-semibold disabled:opacity-60"
      >
        {saving ? t('clients.new.sending') : t('clients.new.createAndInvite')}
      </button>
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
