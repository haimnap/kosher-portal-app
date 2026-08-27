'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { Lang, LANG_COOKIE } from '@/lib/i18n/config';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (path: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// Wraps the whole app (see app/layout.tsx). `initialLang` comes from the
// cookie already read server-side, so there's no flash of the wrong
// language on first paint.
export function LanguageProvider({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
      // Re-render Server Components (page headings, table labels rendered
      // server-side, etc.) so the whole page — not just client widgets —
      // reflects the new language immediately.
      router.refresh();
    },
    [router]
  );

  const t = useCallback(
    (path: string) => {
      const value = getByPath(dictionaries[lang], path);
      if (typeof value !== 'string') {
        console.warn(`Missing translation: ${path}`);
        return path;
      }
      return value;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return ctx;
}
