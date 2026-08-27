'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslation } from './i18n/LanguageProvider';
import { LanguageSwitcher } from './i18n/LanguageSwitcher';

export function PortalHeader({
  title,
  subtitle,
  userName,
}: {
  title: string;
  subtitle: string;
  userName: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useTranslation();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="bg-white border-b border-slate-200 py-5 shadow-sm no-print">
      <div className="max-w-6xl mx-auto px-5 flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-brand mb-1">{title}</h1>
          <p className="text-[13px] text-slate-400">{subtitle}</p>
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <div className="text-right">
            <div className="text-[13px] text-slate-600 mb-1">
              {t('common.loggedInAs')}: <strong>{userName}</strong>
            </div>
            <button onClick={handleLogout} className="text-xs text-brand hover:underline">
              {t('common.logout')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
