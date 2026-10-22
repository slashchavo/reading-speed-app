import { describe, expect, it } from 'vitest';
import { checkAnswers } from '../../lib/answers';
import type { KeyValueStorage } from '../../lib/localStore';
import { seededRandom } from '../../lib/random';
import { generateWordSet, loadRecentSets, RECENT_LIMIT, rememberSet, setKey } from './memoryUtils';

function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('generateWordSet', () => {
  it.each([5, 20, 50])('%i уникальных слов', (count) => {
    const words = generateWordSet(count, [], seededRandom(count));
    expect(words).toHaveLength(count);
    expect(new Set(words).size).toBe(count);
  });

  it('новые раунды дают разные наборы', () => {
    const a = generateWordSet(10, [], seededRandom(1));
    const b = generateWordSet(10, [], seededRandom(2));
    expect(setKey(a)).not.toBe(setKey(b));
  });

  it('не повторяет набор из недавних, если есть другие варианты', () => {
    const dictionary = ['а', 'б', 'в', 'г'];
    const recent = [setKey(['а', 'б'])];
    for (let seed = 1; seed < 30; seed += 1) {
      expect(setKey(generateWordSet(2, recent, seededRandom(seed), dictionary))).not.toBe(recent[0]);
    }
  });
});

describe('последние наборы', () => {
  it('хранит не больше 20 ключей', () => {
    const storage = memoryStorage();
    for (let i = 0; i < 25; i += 1) rememberSet([`слово${i}`], storage);
    const recent = loadRecentSets(storage);
    expect(recent).toHaveLength(RECENT_LIMIT);
    expect(recent.at(-1)).toBe('слово24');
  });
});

describe('проверка вспомненных слов', () => {
  it('верные, забытые и лишние', () => {
    const result = checkAnswers(['ёж', 'кот', 'дом'], 'Еж\nКОТ, кит');
    expect(result).toEqual({ found: ['ёж', 'кот'], missed: ['дом'], extra: ['кит'] });
  });
});
