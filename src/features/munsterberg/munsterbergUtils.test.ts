import { describe, expect, it } from 'vitest';
import { checkAnswers, normalizeWord } from '../../lib/answers';
import { seededRandom } from '../../lib/random';
import { COMMON_WORDS } from '../words/dictionary';
import {
  evaluateSelection,
  findAccidentalWords,
  generatePuzzle,
  MAX_ROW_LENGTH,
  MIN_ROW_LENGTH,
  MIN_WORD,
  MUNSTERBERG_LEVELS,
  rowLengthForWidth,
  rowSegments,
  toggleWord,
  wordAt,
  wordPool,
} from './munsterbergUtils';

const LEVELS = Object.keys(MUNSTERBERG_LEVELS) as (keyof typeof MUNSTERBERG_LEVELS)[];

describe('словарь', () => {
  it('не меньше 200 уникальных слов, только кириллица', () => {
    expect(new Set(COMMON_WORDS).size).toBe(COMMON_WORDS.length);
    expect(COMMON_WORDS.length).toBeGreaterThanOrEqual(200);
    expect(COMMON_WORDS.every((word) => /^[а-яё]+$/.test(word))).toBe(true);
  });

  it.each(LEVELS)('уровень %s: в пуле нет слов короче 5 букв и хватает слов', (level) => {
    const pool = wordPool(level);
    expect(pool.every((word) => word.length >= MIN_WORD)).toBe(true);
    expect(pool.length).toBeGreaterThanOrEqual(MUNSTERBERG_LEVELS[level].words * 3);
  });
});

describe('длина строки', () => {
  it('широкий экран — 45–56 букв, узкий — не меньше минимума', () => {
    expect(rowLengthForWidth(700)).toBeGreaterThanOrEqual(45);
    expect(rowLengthForWidth(900)).toBeLessThanOrEqual(MAX_ROW_LENGTH);
    expect(rowLengthForWidth(320)).toBe(MIN_ROW_LENGTH);
    expect(rowLengthForWidth(Number.NaN)).toBe(MIN_ROW_LENGTH);
  });
});

describe('generatePuzzle', () => {
  it.each(LEVELS)('уровень %s: строки, длина строк и число целей по таблице; слова от 5 букв', (level) => {
    const config = MUNSTERBERG_LEVELS[level];
    for (const length of [MIN_ROW_LENGTH, 48, MAX_ROW_LENGTH]) {
      for (let seed = 1; seed <= 10; seed += 1) {
        const puzzle = generatePuzzle(level, length, seededRandom(seed));
        expect(puzzle.rows).toHaveLength(config.rows);
        expect(puzzle.rowLength).toBe(length);
        expect(puzzle.targets).toHaveLength(config.words);
        expect(new Set(puzzle.targets).size).toBe(config.words);
        expect(puzzle.targets.every((word) => word.length >= MIN_WORD)).toBe(true);
        expect(puzzle.rows.every((row) => row.length === length && /^[а-яё]+$/.test(row))).toBe(true);
      }
    }
  });

  it('уровни точно соответствуют 30/5, 40/8, 50/11, 60/15', () => {
    expect(MUNSTERBERG_LEVELS.easy).toMatchObject({ rows: 30, words: 5 });
    expect(MUNSTERBERG_LEVELS.medium).toMatchObject({ rows: 40, words: 8 });
    expect(MUNSTERBERG_LEVELS.hard).toMatchObject({ rows: 50, words: 11 });
    expect(MUNSTERBERG_LEVELS.expert).toMatchObject({ rows: 60, words: 15 });
  });

  it('каждая цель целиком стоит в своей строке, без разделителей', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const puzzle = generatePuzzle('expert', 50, seededRandom(seed));
      for (const placement of puzzle.placements) {
        const row = puzzle.rows[placement.row] ?? '';
        expect(row.slice(placement.col, placement.col + placement.word.length)).toBe(placement.word);
      }
      expect(new Set(puzzle.placements.map((p) => p.row)).size).toBe(puzzle.placements.length);
    }
  });

  it('в шуме нет случайных слов словаря', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      expect(findAccidentalWords(generatePuzzle('expert', MAX_ROW_LENGTH, seededRandom(seed)))).toEqual([]);
    }
  });

  it('каждый запуск даёт новый шум и новый набор слов', () => {
    const a = generatePuzzle('medium', 48, seededRandom(1));
    const b = generatePuzzle('medium', 48, seededRandom(2));
    expect(a.rows.join('')).not.toBe(b.rows.join(''));
    expect(a.targets.join()).not.toBe(b.targets.join());
  });
});

describe('отметка касанием', () => {
  const puzzle = generatePuzzle('easy', 40, seededRandom(5));

  it('касание любой буквы слова отмечает именно это слово; буквы шума — ничего', () => {
    puzzle.placements.forEach((p, index) => {
      for (let col = p.col; col < p.col + p.word.length; col += 1) expect(wordAt(puzzle, p.row, col)).toBe(index);
      if (p.col > 0) expect(wordAt(puzzle, p.row, p.col - 1)).toBeNull();
      if (p.col + p.word.length < puzzle.rowLength) expect(wordAt(puzzle, p.row, p.col + p.word.length)).toBeNull();
    });
  });

  it('повторное касание снимает отметку; счёт по уникальным словам', () => {
    let selected = toggleWord(new Set(), 0);
    selected = toggleWord(selected, 2);
    expect(evaluateSelection(puzzle, selected).found).toHaveLength(2);
    selected = toggleWord(selected, 2);
    const result = evaluateSelection(puzzle, selected);
    expect(result.found).toEqual([puzzle.targets[0]]);
    expect(result.missed).toHaveLength(puzzle.targets.length - 1);
  });

  it('сегменты строки складываются в исходную строку без разделителей', () => {
    puzzle.rows.forEach((row, index) => {
      const segments = rowSegments(puzzle, index);
      expect(segments.map((s) => s.text).join('')).toBe(row);
    });
    const withWord = puzzle.placements[0];
    const segments = rowSegments(puzzle, withWord?.row ?? 0);
    expect(segments.find((s) => s.wordIndex === 0)?.text).toBe(withWord?.word);
  });
});

describe('нормализация ответов (для игры на память)', () => {
  it('регистр, краевая пунктуация, ё = е', () => {
    expect(normalizeWord('  «Ёж!» ')).toBe('еж');
    expect(normalizeWord('МЁД', false)).toBe('мёд');
    expect(checkAnswers(['дом', 'мёд'], 'Дом, дом; МЕД\nслон')).toEqual({ found: ['дом', 'мёд'], missed: [], extra: ['слон'] });
  });
});
