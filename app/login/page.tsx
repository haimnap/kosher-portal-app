'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslation } from '@/components/i18n/LanguageProvider';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message === 'Invalid login credentials' ? t('login.invalidCredentials') : error.message);
      setLoading(false);
      return;
    }

    router.refresh();
    router.push('/');
  }

  async function handleForgotPassword() {
    if (!email) {
      setError(t('login.forgotNeedsEmail'));
      return;
    }
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError(error.message);
    } else {
      setResetSent(true);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5"
      style={{ background: 'linear-gradient(135deg, #1a5f7a 0%, #2a8faa 100%)' }}
    >
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center mb-4">
          <LanguageSwitcher variant="dark" />
        </div>

        <div className="text-center mb-10 text-white">
          <div className="text-5xl mb-2">🕎</div>
          <h1 className="text-2xl font-semibold mb-2">
            {process.env.NEXT_PUBLIC_COMPANY_NAME || 'Latin America Kosher'}
          </h1>
          <p className="text-sm opacity-90">{t('login.subtitle')}</p>
        </div>

        <div className="bg-white rounded-xl p-10 shadow-2xl">
          <h2 className="text-xl font-semibold text-brand mb-6">{t('login.heading')}</h2>

          <form onSubmit={handleLogin}>
            <div className="mb-5">
              <label className="block text-sm text-slate-700 mb-2 font-medium">{t('login.emailLabel')}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.emailPlaceholder')}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-slate-700 mb-2 font-medium">{t('login.passwordLabel')}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand"
              />
            </div>

            <div className="text-right mb-6">
              <button type="button" onClick={handleForgotPassword} className="text-xs text-brand hover:underline">
                {t('login.forgotPassword')}
              </button>
            </div>

            {resetSent && (
              <div className="mb-4 p-3 bg-green-50 text-green-800 text-sm rounded-lg">{t('login.resetSent')}</div>
            )}

            {error && <div className="mb-4 p-3 bg-red-50 text-red-800 text-sm rounded-lg">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-lg text-white font-semibold text-base disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #1a5f7a 0%, #2a8faa 100%)' }}
            >
              {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>

          <div className="text-center mt-6 text-xs text-slate-500">
            {t('login.newToPortal')}{' '}
            <a href="mailto:support@latinamericakosher.org" className="text-brand">
              support@latinamericakosher.org
            </a>{' '}
            {t('login.forAccess')}
          </div>
        </div>

        <div className="text-center mt-6 text-white text-xs opacity-80">{t('login.secureNotice')}</div>
      </div>
    </div>
  );
}
