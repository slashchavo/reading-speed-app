import { isStringArray, readJson, writeJson, type KeyValueStorage } from '../../lib/localStore';
import { sample, type RandomFn } from '../../lib/random';
import { COMMON_WORDS } from '../words/dictionary';

export const MEMORY_RECENT_KEY = 'focus-app:memory-recent:v1';
export const RECENT_LIMIT = 20;

/** Ключ набора слов, не зависящий от порядка, — чтобы распознать повтор точного набора. */
export function setKey(words: readonly string[]): string {
  return [...words].sort((a, b) => a.localeCompare(b, 'ru')).join('|');
}

/**
 * Новый набор уникальных слов. Набор, совпадающий с одним из последних 20, перегенерируется
 * (при 200+ словах в словаре повтор практически исключён).
 */
export function generateWordSet(
  count: number,
  recentKeys: readonly string[] = [],
  random: RandomFn = Math.random,
  dictionary: readonly string[] = COMMON_WORDS,
): string[] {
  const recent = new Set(recentKeys);
  let words = sample(dictionary, count, random);
  for (let attempt = 0; attempt < 50 && recent.has(setKey(words)); attempt += 1) {
    words = sample(dictionary, count, random);
  }
  return words;
}

export function loadRecentSets(storage?: KeyValueStorage | null): string[] {
  const result = readJson(MEMORY_RECENT_KEY, storage);
  return result.status === 'ok' && isStringArray(result.value) ? result.value.slice(-RECENT_LIMIT) : [];
}

/** Добавляет набор в список последних, храня не больше 20 ключей. */
export function rememberSet(words: readonly string[], storage?: KeyValueStorage | null): void {
  const next = [...loadRecentSets(storage), setKey(words)].slice(-RECENT_LIMIT);
  writeJson(MEMORY_RECENT_KEY, next, storage);
}
