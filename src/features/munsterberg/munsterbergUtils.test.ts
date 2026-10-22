import { describe, expect, it } from 'vitest';
import { checkAnswers, normalizeWord } from '../../lib/answers';
import { seededRandom } from '../../lib/random';
import { COMMON_WORDS } from '../words/dictionary';
import { findAccidentalWords, generatePuzzle, MUNSTERBERG_LEVELS, ROW_LENGTH } from './munsterbergUtils';

describe('словарь', () => {
  it('не меньше 200 уникальных слов, только кириллица', () => {
    expect(new Set(COMMON_WORDS).size).toBe(COMMON_WORDS.length);
    expect(COMMON_WORDS.length).toBeGreaterThanOrEqual(200);
    expect(COMMON_WORDS.every((word) => /^[а-яё]+$/.test(word))).toBe(true);
  });
});

describe('generatePuzzle', () => {
  it.each(Object.entries(MUNSTERBERG_LEVELS))('уровень %s: строки и число целей по таблице', (level, config) => {
    const puzzle = generatePuzzle(level as keyof typeof MUNSTERBERG_LEVELS, seededRandom(7));
    expect(puzzle.rows).toHaveLength(config.rows);
    expect(puzzle.targets).toHaveLength(config.words);
    expect(new Set(puzzle.targets).size).toBe(config.words);
    expect(puzzle.rows.every((row) => row.length === ROW_LENGTH && /^[а-яё]+$/.test(row))).toBe(true);
  });

  it('уровни точно соответствуют 30/5, 40/8, 50/11, 60/15', () => {
    expect(MUNSTERBERG_LEVELS.easy).toMatchObject({ rows: 30, words: 5 });
    expect(MUNSTERBERG_LEVELS.medium).toMatchObject({ rows: 40, words: 8 });
    expect(MUNSTERBERG_LEVELS.hard).toMatchObject({ rows: 50, words: 11 });
    expect(MUNSTERBERG_LEVELS.expert).toMatchObject({ rows: 60, words: 15 });
  });

  it('каждая цель целиком стоит в своей строке, без пробелов и разделителей', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const puzzle = generatePuzzle('expert', seededRandom(seed));
      for (const placement of puzzle.placements) {
        const row = puzzle.rows[placement.row] ?? '';
        expect(row.slice(placement.col, placement.col + placement.word.length)).toBe(placement.word);
      }
      expect(new Set(puzzle.placements.map((p) => p.row)).size).toBe(puzzle.placements.length);
    }
  });

  it('в шуме нет случайных слов словаря', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      expect(findAccidentalWords(generatePuzzle('expert', seededRandom(seed)))).toEqual([]);
    }
  });

  it('каждый запуск даёт новый шум и новый набор слов', () => {
    const a = generatePuzzle('medium', seededRandom(1));
    const b = generatePuzzle('medium', seededRandom(2));
    expect(a.rows.join('')).not.toBe(b.rows.join(''));
    expect(a.targets.join()).not.toBe(b.targets.join());
  });
});

describe('проверка ответов', () => {
  it('нормализация: регистр, краевая пунктуация, ё = е', () => {
    expect(normalizeWord('  «Ёж!» ')).toBe('еж');
    expect(normalizeWord('МЁД', false)).toBe('мёд');
  });

  it('верные засчитываются один раз, лишние и пропуски считаются отдельно', () => {
    const result = checkAnswers(['дом', 'мёд', 'кот'], 'Дом, дом; МЕД\nслон  ,, кот. слон');
    expect(result.found).toEqual(['дом', 'мёд', 'кот']);
    expect(result.missed).toEqual([]);
    expect(result.extra).toEqual(['слон']);
  });

  it('пустой ввод — все пропущены', () => {
    expect(checkAnswers(['дом', 'кот'], ' ,; ')).toEqual({ found: [], missed: ['дом', 'кот'], extra: [] });
  });
});
