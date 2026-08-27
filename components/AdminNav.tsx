'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslation } from './i18n/LanguageProvider';
import { LanguageSwitcher } from './i18n/LanguageSwitcher';

export function AdminNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t } = useTranslation();

  const links = [
    { href: '/admin', label: t('admin.nav.dashboard') },
    { href: '/admin/certifications', label: t('admin.nav.certifications') },
    { href: '/admin/clients', label: t('admin.nav.clients') },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <div
        className="py-5 text-white shadow-md no-print"
        style={{ background: 'linear-gradient(135deg, #1a5f7a 0%, #2a8faa 100%)' }}
      >
        <div className="max-w-[1400px] mx-auto px-5 flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold mb-1">{t('admin.title')}</h1>
            <p className="text-[13px] opacity-90">{t('admin.subtitle')}</p>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher variant="dark" />
            <div className="text-right text-[13px]">
              <div className="mb-1">
                {t('common.loggedInAs')}: <strong>{userName}</strong>
              </div>
              <button onClick={handleLogout} className="underline opacity-90">
                {t('common.logout')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-slate-200 no-print">
        <div className="max-w-[1400px] mx-auto px-5 flex gap-8">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`py-4 text-sm font-medium border-b-[3px] ${
                  active ? 'border-brand text-brand font-semibold' : 'border-transparent text-slate-400'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
