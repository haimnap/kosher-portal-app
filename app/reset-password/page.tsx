'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslation } from '@/components/i18n/LanguageProvider';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t('resetPassword.tooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('resetPassword.mismatch'));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push('/');
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5"
      style={{ background: 'linear-gradient(135deg, #1a5f7a 0%, #2a8faa 100%)' }}
    >
      <div className="w-full max-w-[420px] bg-white rounded-xl p-10 shadow-2xl">
        <h2 className="text-xl font-semibold text-brand mb-6">{t('resetPassword.title')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-sm text-slate-700 mb-2 font-medium">{t('resetPassword.newPassword')}</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand"
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm text-slate-700 mb-2 font-medium">
              {t('resetPassword.confirmPassword')}
            </label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand"
            />
          </div>
          {error && <div className="mb-4 p-3 bg-red-50 text-red-800 text-sm rounded-lg">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-lg text-white font-semibold disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #1a5f7a 0%, #2a8faa 100%)' }}
          >
            {loading ? t('resetPassword.saving') : t('resetPassword.update')}
          </button>
        </form>
      </div>
    </div>
  );
}
