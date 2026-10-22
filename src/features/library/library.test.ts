import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from '../../lib/localStore';
import { seededRandom } from '../../lib/random';
import { countWords } from '../reader/readerUtils';
import { LIBRARY, loadUsedIds, markUsed, pickNextText, saveUsedIds, USED_TEXTS_KEY } from './library';

describe('библиотека текстов', () => {
  it('не меньше 30 текстов с уникальными ID и названиями', () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(30);
    expect(new Set(LIBRARY.map((t) => t.id)).size).toBe(LIBRARY.length);
    expect(new Set(LIBRARY.map((t) => t.title)).size).toBe(LIBRARY.length);
  });

  it('каждый текст — от 300 до 700 слов', () => {
    for (const text of LIBRARY) {
      const words = countWords(text.text);
      expect(words, text.title).toBeGreaterThanOrEqual(300);
      expect(words, text.title).toBeLessThanOrEqual(700);
    }
  });

  it('темы разнообразны', () => {
    expect(new Set(LIBRARY.map((t) => t.topic)).size).toBeGreaterThanOrEqual(6);
  });
});

describe('выбор нового текста', () => {
  it('не повторяет тексты до исчерпания, затем возвращает null', () => {
    const random = seededRandom(42);
    let used: string[] = [];
    for (let i = 0; i < LIBRARY.length; i += 1) {
      const next = pickNextText(used, null, random);
      expect(next).not.toBeNull();
      expect(used).not.toContain(next?.id);
      used = markUsed(used, next?.id ?? '');
    }
    expect(new Set(used).size).toBe(LIBRARY.length);
    expect(pickNextText(used, null, random)).toBeNull();
  });

  it('«другой текст» не выдаёт текущий, если есть альтернатива', () => {
    const current = LIBRARY[0]?.id ?? '';
    for (let seed = 1; seed < 20; seed += 1) {
      expect(pickNextText([], current, seededRandom(seed))?.id).not.toBe(current);
    }
  });

  it('использованные ID сохраняются между открытиями, мусор отбрасывается', () => {
    const data = new Map<string, string>();
    const storage: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
    saveUsedIds(['lib-01', 'lib-02', 'lib-01'], storage);
    expect(loadUsedIds(storage)).toEqual(['lib-01', 'lib-02']);
    data.set(USED_TEXTS_KEY, JSON.stringify(['lib-03', 'неизвестный', 5]));
    expect(loadUsedIds(storage)).toEqual([]);
    data.set(USED_TEXTS_KEY, JSON.stringify(['lib-03', 'неизвестный']));
    expect(loadUsedIds(storage)).toEqual(['lib-03']);
  });
});
