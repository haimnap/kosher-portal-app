import { Lang } from './config';

const LOCALE_MAP: Record<Lang, string> = {
  es: 'es-ES',
  en: 'en-US',
  pt: 'pt-BR',
};

export function formatDate(dateStr: string, lang: Lang) {
  return new Date(dateStr).toLocaleDateString(LOCALE_MAP[lang], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateLong(dateStr: string, lang: Lang) {
  return new Date(dateStr).toLocaleDateString(LOCALE_MAP[lang], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
