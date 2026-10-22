import { RUSSIAN_ALPHABET } from '../../lib/alphabet';
import { sample, shuffle, type RandomFn } from '../../lib/random';
import type { ColorMode, GridSize, SchulteMode } from '../../types/session';

export { shuffle } from '../../lib/random';

const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Латинская метка по порядковому номеру: 0 → A, 25 → Z, 26 → AA, 48 → AW. */
export function letterLabel(index: number): string {
  if (index < LATIN.length) return LATIN[index] ?? '';
  return `A${LATIN[index - LATIN.length] ?? ''}`;
}

/**
 * Кириллическая последовательность.
 * 5×5: 25 случайных разных букв из 33 (с Ё), порядок — алфавитный.
 * 7×7: все 33 буквы, затем 16 двухбуквенных меток «АА», «АБ» … «АО» — итого 49 уникальных целей.
 */
export function cyrillicSequence(size: GridSize, random: RandomFn = Math.random): string[] {
  if (size === 5) {
    const chosen = new Set(sample(RUSSIAN_ALPHABET, 25, random));
    return RUSSIAN_ALPHABET.filter((letter) => chosen.has(letter));
  }
  const pairs = RUSSIAN_ALPHABET.slice(0, 49 - RUSSIAN_ALPHABET.length).map((letter) => `А${letter}`);
  return [...RUSSIAN_ALPHABET, ...pairs];
}

/** Элементы в правильном порядке прохождения. */
export function createSequence(size: GridSize, mode: SchulteMode, random: RandomFn = Math.random): string[] {
  if (mode === 'cyrillic') return cyrillicSequence(size, random);
  const count = size * size;
  return Array.from({ length: count }, (_, index) => (mode === 'numbers' ? String(index + 1) : letterLabel(index)));
}

/** Перемешанная сетка для последовательности. */
export function createGrid(size: GridSize, mode: SchulteMode, random: RandomFn = Math.random): string[] {
  return shuffle(createSequence(size, mode, random), random);
}

/** Палитра цветного режима: тёмные насыщенные цвета, контрастные на белом фоне (≥ 4.5:1). */
export const SCHULTE_PALETTE: readonly string[] = [
  '#c92a2a', '#1864ab', '#2b8a3e', '#862e9c', '#d9480f', '#0b7285', '#5f3dc4', '#a61e4d',
];

/** Цвет каждой ячейки: null в чёрно-белом режиме, иначе цвет палитры (соседние цвета не обязаны отличаться). */
export function assignColors(count: number, colorMode: ColorMode, random: RandomFn = Math.random): (string | null)[] {
  return Array.from({ length: count }, () =>
    colorMode === 'mono' ? null : (SCHULTE_PALETTE[Math.floor(random() * SCHULTE_PALETTE.length)] ?? null),
  );
}

export function modeLabel(mode: SchulteMode): string {
  if (mode === 'numbers') return 'числа';
  return mode === 'letters' ? 'латиница' : 'кириллица';
}

export function colorModeLabel(colorMode: ColorMode | undefined): string {
  return colorMode === 'color' ? 'цветной' : 'чёрно-белый';
}

export function gridLabel(size: GridSize): string {
  return `${size}×${size}`;
}

/** Подсказка о порядке поиска для экрана настроек. */
export function orderHint(size: GridSize, mode: SchulteMode): string {
  if (mode === 'numbers') return `Нажимайте числа по порядку: от 1 до ${size * size}.`;
  if (mode === 'letters') return `Нажимайте латинские буквы по порядку: ${size === 5 ? 'A … Y' : 'A … Z, затем AA … AW'}.`;
  return size === 5
    ? 'Нажимайте русские буквы по алфавиту (25 случайных из 33, включая Ё).'
    : 'Нажимайте все 33 русские буквы по алфавиту (А … Я, включая Ё), затем пары АА, АБ … АО.';
}
