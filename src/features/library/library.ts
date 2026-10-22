import { isStringArray, readJson, writeJson, type KeyValueStorage } from '../../lib/localStore';
import { randomInt, type RandomFn } from '../../lib/random';
import type { LibraryText } from './libraryTypes';
import { TEXTS_1 } from './texts1';
import { TEXTS_2 } from './texts2';
import { TEXTS_3 } from './texts3';

export type { LibraryText } from './libraryTypes';

export const LIBRARY: readonly LibraryText[] = [...TEXTS_1, ...TEXTS_2, ...TEXTS_3];

/** Список ID встроенных текстов, которые уже использовались в тренировках. */
export const USED_TEXTS_KEY = 'focus-app:used-texts:v1';

const KNOWN_IDS = new Set(LIBRARY.map((text) => text.id));

export function getLibraryText(id: string): LibraryText | undefined {
  return LIBRARY.find((text) => text.id === id);
}

export function loadUsedIds(storage?: KeyValueStorage | null): string[] {
  const result = readJson(USED_TEXTS_KEY, storage);
  if (result.status !== 'ok' || !isStringArray(result.value)) return [];
  return [...new Set(result.value.filter((id) => KNOWN_IDS.has(id)))];
}

export function saveUsedIds(ids: readonly string[], storage?: KeyValueStorage | null): boolean {
  return writeJson(USED_TEXTS_KEY, [...new Set(ids)], storage);
}

/** Тексты, которые ещё не читались. */
export function unusedTexts(usedIds: readonly string[], library: readonly LibraryText[] = LIBRARY): LibraryText[] {
  const used = new Set(usedIds);
  return library.filter((text) => !used.has(text.id));
}

/**
 * Следующий новый текст: случайный из неиспользованных (кроме exceptId, если есть другие варианты).
 * Возвращает null, когда библиотека исчерпана, — старый текст никогда не выдаётся как новый.
 */
export function pickNextText(
  usedIds: readonly string[],
  exceptId: string | null = null,
  random: RandomFn = Math.random,
  library: readonly LibraryText[] = LIBRARY,
): LibraryText | null {
  const available = unusedTexts(usedIds, library);
  if (available.length === 0) return null;
  const pool = available.length > 1 && exceptId ? available.filter((text) => text.id !== exceptId) : available;
  return pool[randomInt(pool.length, random)] ?? null;
}

export function markUsed(usedIds: readonly string[], id: string): string[] {
  return usedIds.includes(id) ? [...usedIds] : [...usedIds, id];
}
