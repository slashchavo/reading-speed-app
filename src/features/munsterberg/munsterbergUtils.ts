import { normalizeWord } from '../../lib/answers';
import { randomInt, sample, type RandomFn } from '../../lib/random';
import type { MunsterbergLevel } from '../../types/session';
import { COMMON_WORDS, EASY_LONG_WORDS, EASY_WORDS } from '../words/dictionary';

export const MUNSTERBERG_LEVELS: Record<MunsterbergLevel, { label: string; rows: number; words: number }> = {
  easy: { label: 'Лёгкий', rows: 30, words: 5 },
  medium: { label: 'Средний', rows: 40, words: 8 },
  hard: { label: 'Сложный', rows: 50, words: 11 },
  expert: { label: 'Эксперт', rows: 60, words: 15 },
};

/** Длина строки в старых записях истории (до перехода на длинные строки). */
export const LEGACY_ROW_LENGTH = 28;
export const MIN_ROW_LENGTH = 26;
export const MAX_ROW_LENGTH = 56;
/** Ориентир ширины одной буквы, чтобы по ней было удобно попасть пальцем. */
const TARGET_CHAR_PX = 15;

export const MIN_WORD = 5;
const MAX_WORD = 10;

/** Буквы шума: строчная кириллица без «ъ» (она почти не встречается в словах и бросается в глаза). */
const NOISE_LETTERS = 'абвгдежзийклмнопрстуфхцчшщыьэюя';

export type Placement = { word: string; row: number; col: number };

export type MunsterbergPuzzle = {
  level: MunsterbergLevel;
  rowLength: number;
  rows: string[];
  targets: string[];
  placements: Placement[];
};

/**
 * Длина строки под доступную ширину: на широком экране 45–56 букв, на телефоне меньше,
 * чтобы буквы не становились слишком мелкими для касания. Шрифт затем подгоняется точно по ширине.
 */
export function rowLengthForWidth(widthPx: number): number {
  if (!Number.isFinite(widthPx) || widthPx <= 0) return MIN_ROW_LENGTH;
  return Math.min(MAX_ROW_LENGTH, Math.max(MIN_ROW_LENGTH, Math.round(widthPx / TARGET_CHAR_PX)));
}

/** Слова-цели уровня: не короче 5 букв. */
export function wordPool(level: MunsterbergLevel, rowLength = MAX_ROW_LENGTH): string[] {
  const source = level === 'easy' ? EASY_LONG_WORDS : COMMON_WORDS;
  const max = Math.min(MAX_WORD, rowLength);
  return [...new Set(source)].filter((word) => word.length >= MIN_WORD && word.length <= max);
}

/** Слова, которые нельзя случайно оставить в шуме (все слова словаря в виде «ё → е»). */
const FORBIDDEN = [...new Set([...COMMON_WORDS, ...EASY_WORDS, ...EASY_LONG_WORDS].map((word) => normalizeWord(word)))].filter(
  (word) => word.length >= 3,
);

/**
 * Генерирует новую таблицу: строки заданной длины, цели спрятаны в разных строках внутри сплошного шума.
 * Случайные совпадения шума со словами словаря перегенерируются.
 */
export function generatePuzzle(
  level: MunsterbergLevel,
  rowLength: number = MAX_ROW_LENGTH,
  random: RandomFn = Math.random,
): MunsterbergPuzzle {
  const length = Math.min(MAX_ROW_LENGTH, Math.max(MIN_ROW_LENGTH, Math.round(rowLength)));
  const { rows: rowCount, words: wordCount } = MUNSTERBERG_LEVELS[level];
  const targets = sample(wordPool(level, length), wordCount, random);
  const targetRows = sample(
    Array.from({ length: rowCount }, (_, index) => index),
    wordCount,
    random,
  );

  const chars: string[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length }, () => NOISE_LETTERS[randomInt(NOISE_LETTERS.length, random)] ?? 'а'),
  );
  const locked: boolean[][] = Array.from({ length: rowCount }, () => Array<boolean>(length).fill(false));

  const placements: Placement[] = targets.map((word, index) => {
    const row = targetRows[index] ?? 0;
    const col = randomInt(length - word.length + 1, random);
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

  return { level, rowLength: length, rows: chars.map((row) => row.join('')), targets, placements };
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

/** Номер цели, в которую попадает буква (row, col), или null — буква шума. */
export function wordAt(puzzle: MunsterbergPuzzle, row: number, col: number): number | null {
  const index = puzzle.placements.findIndex((p) => p.row === row && col >= p.col && col < p.col + p.word.length);
  return index === -1 ? null : index;
}

/** Касание слова: отмечает его или снимает отметку. Исходное множество не меняется. */
export function toggleWord(selected: ReadonlySet<number>, wordIndex: number): Set<number> {
  const next = new Set(selected);
  if (next.has(wordIndex)) next.delete(wordIndex);
  else next.add(wordIndex);
  return next;
}

export type RowSegment = { text: string; wordIndex: number | null };

/** Строка, разбитая на участки шума и скрытые слова — для отрисовки без видимых разделителей. */
export function rowSegments(puzzle: MunsterbergPuzzle, row: number): RowSegment[] {
  const text = puzzle.rows[row] ?? '';
  const words = puzzle.placements
    .map((placement, index) => ({ ...placement, index }))
    .filter((p) => p.row === row)
    .sort((a, b) => a.col - b.col);
  const segments: RowSegment[] = [];
  let cursor = 0;
  for (const word of words) {
    if (word.col > cursor) segments.push({ text: text.slice(cursor, word.col), wordIndex: null });
    segments.push({ text: text.slice(word.col, word.col + word.word.length), wordIndex: word.index });
    cursor = word.col + word.word.length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), wordIndex: null });
  return segments;
}

export type TapResult = { found: string[]; missed: string[] };

/** Итог по уникальным словам-целям (а не по числу касаний). */
export function evaluateSelection(puzzle: MunsterbergPuzzle, selected: ReadonlySet<number>): TapResult {
  const found: string[] = [];
  const missed: string[] = [];
  puzzle.targets.forEach((word, index) => (selected.has(index) ? found : missed).push(word));
  return { found, missed };
}
