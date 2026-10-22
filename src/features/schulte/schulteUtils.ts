import { RUSSIAN_ALPHABET } from '../../lib/alphabet';
import { randomInt, shuffle, type RandomFn } from '../../lib/random';
import type { ColorMode, GridSize, SchulteMode, SchulteOrder, SymbolSize } from '../../types/session';

export { shuffle } from '../../lib/random';

const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Латинская метка по порядковому номеру: 0 → A, 25 → Z, 26 → AA, 48 → AW. */
export function letterLabel(index: number): string {
  if (index < LATIN.length) return LATIN[index] ?? '';
  return `A${LATIN[index - LATIN.length] ?? ''}`;
}

/**
 * Кириллица.
 * 5×5: 25 букв подряд по алфавиту (с Ё) от случайной стартовой, с переходом от Я к А.
 * 7×7: все 33 буквы ровно по одному разу; остальные 16 клеток поля пустые и неактивные.
 */
export function cyrillicSequence(size: GridSize, random: RandomFn = Math.random): string[] {
  if (size === 7) return [...RUSSIAN_ALPHABET];
  const start = randomInt(RUSSIAN_ALPHABET.length, random);
  return Array.from({ length: 25 }, (_, i) => RUSSIAN_ALPHABET[(start + i) % RUSSIAN_ALPHABET.length] ?? '');
}

/** Цели в прямом логическом порядке, без пропусков. */
export function createSequence(size: GridSize, mode: SchulteMode, random: RandomFn = Math.random): string[] {
  if (mode === 'cyrillic') return cyrillicSequence(size, random);
  const count = size * size;
  return Array.from({ length: count }, (_, index) => (mode === 'numbers' ? String(index + 1) : letterLabel(index)));
}

/** Порядок поиска: прямой — с первого элемента, обратный — с последнего. */
export function orderTargets(sequence: readonly string[], order: SchulteOrder): string[] {
  return order === 'reverse' ? [...sequence].reverse() : [...sequence];
}

/** Клетки поля: цели в случайных местах, null — пустая неактивная клетка (кириллица 7×7). */
export function createBoard(sequence: readonly string[], size: GridSize, random: RandomFn = Math.random): (string | null)[] {
  const cells: (string | null)[] = [...sequence];
  while (cells.length < size * size) cells.push(null);
  return shuffle(cells, random);
}

/** Перемешанная сетка (только цели) — сохранено для совместимости. */
export function createGrid(size: GridSize, mode: SchulteMode, random: RandomFn = Math.random): string[] {
  return shuffle(createSequence(size, mode, random), random);
}

/**
 * Палитра цветного режима: пять дискретных, явно разных тонов (без градиентов и соседних оттенков),
 * контрастных на белом фоне ячейки.
 */
export const SCHULTE_PALETTE: readonly { name: string; hex: string }[] = [
  { name: 'красный', hex: '#d00000' },
  { name: 'оранжевый', hex: '#b35300' },
  { name: 'зелёный', hex: '#1b7f2a' },
  { name: 'синий', hex: '#1a4fd6' },
  { name: 'фиолетовый', hex: '#7b1fa2' },
];

/** Цвет каждой клетки: null в чёрно-белом режиме и для пустых клеток. */
export function assignColors(
  cells: readonly (string | null)[] | number,
  colorMode: ColorMode,
  random: RandomFn = Math.random,
): (string | null)[] {
  const list = typeof cells === 'number' ? Array.from({ length: cells }, () => '') : cells;
  return list.map((cell) =>
    colorMode === 'mono' || cell === null ? null : (SCHULTE_PALETTE[randomInt(SCHULTE_PALETTE.length, random)]?.hex ?? null),
  );
}

/** Размер символа как доля стороны ячейки. */
export const SYMBOL_SIZES: Record<SymbolSize, { label: string; scale: number }> = {
  1: { label: 'Компактный', scale: 0.3 },
  2: { label: 'Небольшой', scale: 0.37 },
  3: { label: 'Средний', scale: 0.44 },
  4: { label: 'Крупный', scale: 0.52 },
  5: { label: 'Очень крупный', scale: 0.6 },
};

/**
 * Фактический размер шрифта в пикселях. Выбранная ступень — предпочтение: если символ (например, «AW»)
 * при этом размере не поместится в ячейку, шрифт уменьшается ровно настолько, чтобы не обрезаться.
 */
export function symbolFontPx(cellPx: number, size: SymbolSize, text: string | number = 1): number {
  if (!Number.isFinite(cellPx) || cellPx <= 0) return 0;
  const sample = typeof text === 'number' ? 'W'.repeat(text) : text;
  // Примерная ширина символа жирного шрифта относительно его размера.
  const width = [...sample].reduce((sum, ch) => sum + (/[0-9]/.test(ch) ? 0.6 : 0.78), 0);
  const fitting = (cellPx * 0.82) / Math.max(width, 0.6);
  return Math.max(8, Math.round(Math.min(cellPx * SYMBOL_SIZES[size].scale, fitting)));
}

/** Состояние сессии: текущая таблица и общий счёт. */
export type SessionProgress = {
  /** Цели текущей таблицы в порядке поиска. */
  targets: string[];
  index: number;
  correct: number;
  wrong: number;
  tablesCompleted: number;
};

export type TapOutcome = 'correct' | 'wrong' | 'table-complete' | 'ignored';

/**
 * Обработка нажатия. Неверное — ошибка без продвижения; верное — следующая цель;
 * верное последнее — таблица засчитана (частично пройденные таблицы не засчитываются).
 */
export function tapTarget(progress: SessionProgress, value: string | null): { progress: SessionProgress; outcome: TapOutcome } {
  if (value === null) return { progress, outcome: 'ignored' };
  const doneBefore = progress.targets.slice(0, progress.index);
  if (doneBefore.includes(value)) return { progress, outcome: 'ignored' };
  if (value !== progress.targets[progress.index]) {
    return { progress: { ...progress, wrong: progress.wrong + 1 }, outcome: 'wrong' };
  }
  const index = progress.index + 1;
  if (index >= progress.targets.length) {
    return {
      progress: { ...progress, index, correct: progress.correct + 1, tablesCompleted: progress.tablesCompleted + 1 },
      outcome: 'table-complete',
    };
  }
  return { progress: { ...progress, index, correct: progress.correct + 1 }, outcome: 'correct' };
}

export function modeLabel(mode: SchulteMode): string {
  if (mode === 'numbers') return 'числа';
  return mode === 'letters' ? 'латиница' : 'кириллица';
}

export function colorModeLabel(colorMode: ColorMode | undefined): string {
  return colorMode === 'color' ? 'цветной' : 'чёрно-белый';
}

export function orderLabel(order: SchulteOrder | undefined): string {
  return order === 'reverse' ? 'обратный порядок' : 'прямой порядок';
}

export function gridLabel(size: GridSize): string {
  return `${size}×${size}`;
}

/** Подсказка о порядке поиска для экрана настроек. */
export function orderHint(size: GridSize, mode: SchulteMode, order: SchulteOrder = 'forward'): string {
  const reverse = order === 'reverse';
  if (mode === 'numbers') {
    const last = size * size;
    return reverse ? `Нажимайте числа по убыванию: от ${last} до 1.` : `Нажимайте числа по порядку: от 1 до ${last}.`;
  }
  if (mode === 'letters') {
    const range = size === 5 ? 'A … Y' : 'A … Z, затем AA … AW';
    return reverse ? `Латинские буквы в обратном порядке (${range}, с конца).` : `Латинские буквы по порядку: ${range}.`;
  }
  const what =
    size === 5
      ? '25 русских букв подряд по алфавиту от случайной буквы (после Я идёт А, Ё не пропускается)'
      : 'все 33 русские буквы от А до Я, включая Ё; 16 клеток останутся пустыми';
  return `${reverse ? 'В обратном порядке: ' : 'По порядку: '}${what}.`;
}
