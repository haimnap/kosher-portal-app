export const LANGUAGES = ['es', 'en', 'pt'] as const;
export type Lang = (typeof LANGUAGES)[number];

export const DEFAULT_LANG: Lang = 'es';

export const LANG_COOKIE = 'lak_lang';

export const LANGUAGE_NAMES: Record<Lang, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
};

export function isValidLang(value: string | undefined | null): value is Lang {
  return !!value && (LANGUAGES as readonly string[]).includes(value);
}
