import { cookies } from 'next/headers';
import { dictionaries, Dictionary } from './dictionaries';
import { DEFAULT_LANG, isValidLang, LANG_COOKIE, Lang } from './config';

// Server Components read the language straight from the cookie —
// no context needed since they render once per request.
export function getLang(): Lang {
  const raw = cookies().get(LANG_COOKIE)?.value;
  return isValidLang(raw) ? raw : DEFAULT_LANG;
}

export function getDictionary(lang?: Lang): Dictionary {
  return dictionaries[lang ?? getLang()];
}
