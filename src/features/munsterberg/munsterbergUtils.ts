import { normalizeWord } from '../../lib/answers';
import { randomInt, sample, type RandomFn } from '../../lib/random';
import type { MunsterbergLevel } from '../../types/session';
import { COMMON_WORDS, EASY_WORDS } from '../words/dictionary';

export const MUNSTERBERG_LEVELS: Record<MunsterbergLevel, { label: string; rows: number; words: number }> = {
  easy: { label: 'Лёгкий', rows: 30, words: 5 },
  medium: { label: 'Средний', rows: 40, words: 8 },
  hard: { label: 'Сложный', rows: 50, words: 11 },
  expert: { label: 'Эксперт', rows: 60, words: 15 },
};

export const ROW_LENGTH = 28;
const MIN_WORD = 3;
const MAX_WORD = 9;

/** Буквы шума: строчная кириллица без «ъ» (она почти не встречается в словах и бросается в глаза). */
const NOISE_LETTERS = 'абвгдежзийклмнопрстуфхцчшщыьэюя';

export type Placement = { word: string; row: number; col: number };

export type MunsterbergPuzzle = {
  level: MunsterbergLevel;
  rows: string[];
  targets: string[];
  placements: Placement[];
};

/** Словарь, из которого выбираются цели уровня. */
export function wordPool(level: MunsterbergLevel): string[] {
  const source = level === 'easy' ? EASY_WORDS : COMMON_WORDS;
  return source.filter((word) => word.length >= MIN_WORD && word.length <= MAX_WORD);
}

/** Слова, которые нельзя случайно оставить в шуме (все слова словаря в виде «ё → е»). */
const FORBIDDEN = [...new Set([...COMMON_WORDS, ...EASY_WORDS].map((word) => normalizeWord(word)))].filter(
  (word) => word.length >= MIN_WORD,
);

/**
 * Генерирует новую таблицу: строки по 28 букв, цели спрятаны в разных строках внутри сплошного шума.
 * Случайные совпадения шума со словами словаря перегенерируются.
 */
export function generatePuzzle(level: MunsterbergLevel, random: RandomFn = Math.random): MunsterbergPuzzle {
  const { rows: rowCount, words: wordCount } = MUNSTERBERG_LEVELS[level];
  const targets = sample(wordPool(level), wordCount, random);
  const targetRows = sample(
    Array.from({ length: rowCount }, (_, index) => index),
    wordCount,
    random,
  );

  const chars: string[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: ROW_LENGTH }, () => NOISE_LETTERS[randomInt(NOISE_LETTERS.length, random)] ?? 'а'),
  );
  const locked: boolean[][] = Array.from({ length: rowCount }, () => Array<boolean>(ROW_LENGTH).fill(false));

  const placements: Placement[] = targets.map((word, index) => {
    const row = targetRows[index] ?? 0;
    const col = randomInt(ROW_LENGTH - word.length + 1, random);
    const rowChars = chars[row];
    const rowLocks = locked[row];
    if (rowChars && rowLocks) {
      [...word].forEach((letter, offset) => {
        rowChars[col + offset] = letter;
        rowLocks[col + offset] = true;
      });
    }
    return { word, row, col };
  });

  scrubAccidentalWords(chars, locked, random);

  return { level, rows: chars.map((row) => row.join('')), targets, placements };
}

/** Заменяет буквы шума, если они случайно сложились в слово словаря или повторили цель. */
function scrubAccidentalWords(chars: string[][], locked: boolean[][], random: RandomFn): void {
  for (let pass = 0; pass < 500; pass += 1) {
    let changed = false;
    chars.forEach((rowChars, row) => {
      const text = normalizeWord(rowChars.join(''));
      const rowLocks = locked[row] ?? [];
      for (const word of FORBIDDEN) {
        let from = text.indexOf(word);
        while (from !== -1) {
          const span = Array.from({ length: word.length }, (_, offset) => from + offset);
          const free = span.filter((col) => !rowLocks[col]);
          if (free.length > 0) {
            const col = free[randomInt(free.length, random)] ?? from;
            rowChars[col] = NOISE_LETTERS[randomInt(NOISE_LETTERS.length, random)] ?? 'а';
            changed = true;
          }
          from = text.indexOf(word, from + 1);
        }
      }
    });
    if (!changed) return;
  }
}

/** Находит слова словаря в строках, которые не являются заданными целями (для проверки генератора). */
export function findAccidentalWords(puzzle: MunsterbergPuzzle): string[] {
  const found: string[] = [];
  puzzle.rows.forEach((rowText, row) => {
    const text = normalizeWord(rowText);
    for (const word of FORBIDDEN) {
      let from = text.indexOf(word);
      while (from !== -1) {
        const inside = puzzle.placements.some(
          (p) => p.row === row && from >= p.col && from + word.length <= p.col + p.word.length,
        );
        if (!inside) found.push(word);
        from = text.indexOf(word, from + 1);
      }
    }
  });
  return found;
}
