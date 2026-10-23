/**
 * i18n smoke tests: every shipped language must have a value for every key, and
 * formatting must substitute placeholders.
 */

import { describe, expect, test } from 'bun:test';
import { DICTIONARY, LANGUAGES } from './en';

describe('dictionary', () => {
  test('every key exists in every language and is non-empty', () => {
    const keys = Object.keys(DICTIONARY);
    expect(keys.length).toBeGreaterThan(80);
    for (const key of keys) {
      const entry = DICTIONARY[key]!;
      for (const lang of LANGUAGES) {
        expect(typeof entry[lang]).toBe('string');
        expect(entry[lang]!.length).toBeGreaterThan(0);
      }
    }
  });

  test('placeholder sets match across languages', () => {
    const placeholders = (value: string) => (value.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const [key, entry] of Object.entries(DICTIONARY)) {
      const reference = placeholders(entry.en!);
      for (const lang of LANGUAGES) {
        expect(`${key}:${lang}:${placeholders(entry[lang]!)}`).toBe(`${key}:${lang}:${reference}`);
      }
    }
  });
});
