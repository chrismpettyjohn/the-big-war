/**
 * Translation runtime: `t(key, params?)` against the dictionary in `en.ts`
 * (all four languages live in that one table so a key can never be half-added),
 * plus the language signal and a small localStorage-backed persistence.
 *
 * Missing keys fall back to English, then to the key itself — in game you'll see
 * the raw key rather than an empty button, which is what you want while building.
 */

import { createSignal } from 'solid-js';
import type { Accessor } from 'solid-js';
import {
  DICTIONARY as enDictionary,
  LANGUAGES,
  LANGUAGE_NAMES,
  type Language,
  type TranslationKey,
} from './en';

const DICT: Readonly<Record<string, Readonly<Record<Language, string>>>> = enDictionary;

export { LANGUAGES, LANGUAGE_NAMES };
export type { Language, TranslationKey };

const STORAGE_KEY = 'the-big-war.language';

const detectLanguage = (): Language => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (LANGUAGES as readonly string[]).includes(stored)) return stored as Language;
    const nav = navigator.language.slice(0, 2).toLowerCase();
    const match = LANGUAGES.find(code => code === nav);
    if (match) return match;
  } catch {
    // No storage / no navigator (tests, SSR): fall through to English.
  }
  return 'en';
};

const [language, setLanguageSignal] = createSignal<Language>(detectLanguage());

/** Current language (reactive). */
export const currentLanguage: Accessor<Language> = language;

/** Switch language and persist the choice. */
export function setLanguage(next: Language): void {
  setLanguageSignal(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Persistence is best-effort.
  }
}

/** Fill `{name}` placeholders. */
function format(template: string, params?: Readonly<Record<string, string | number>>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    params[name] === undefined ? whole : String(params[name]),
  );
}

/**
 * Translate a key for the current language. Reading `language()` makes any Solid
 * computation that calls `t()` re-run when the language changes.
 */
export function t(
  key: TranslationKey | string,
  params?: Readonly<Record<string, string | number>>,
): string {
  const entry = DICT[key];
  const lang = language();
  if (!entry) return format(key, params);
  return format(entry[lang] ?? entry.en ?? key, params);
}

/** `t` for data that carries its own name/description per language (research, factions). */
export function localizedName(
  base: Readonly<Record<Language, string>> | undefined,
  fallback: string,
): string {
  if (!base) return fallback;
  return base[language()] ?? base.en ?? fallback;
}
