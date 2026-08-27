'use client';

import { useTranslation } from './LanguageProvider';
import { LANGUAGES, LANGUAGE_NAMES } from '@/lib/i18n/config';

// Small EN/ES/PT toggle. Drop this into any header. Persists the choice
// in a cookie (see LanguageProvider) so it applies on next visit too.
export function LanguageSwitcher({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { lang, setLang } = useTranslation();

  const isDark = variant === 'dark';

  return (
    <div className="flex gap-1 no-print">
      {LANGUAGES.map((code) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          title={LANGUAGE_NAMES[code]}
          className={`px-2 py-1 rounded text-[11px] font-semibold uppercase transition-colors ${
            lang === code
              ? isDark
                ? 'bg-white text-brand'
                : 'bg-brand text-white'
              : isDark
                ? 'bg-white/15 text-white'
                : 'bg-slate-100 text-slate-500'
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
