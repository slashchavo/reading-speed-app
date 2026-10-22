import type { GridSize, SchulteMode } from '../../types/session';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Буквенная метка по порядковому номеру: 0 → A, 25 → Z, 26 → AA, 48 → AW. */
export function letterLabel(index: number): string {
  if (index < ALPHABET.length) return ALPHABET[index] ?? '';
  const second = index - ALPHABET.length;
  return `A${ALPHABET[second] ?? ''}`;
}

/** Элементы в правильном порядке прохождения. */
export function createSequence(size: GridSize, mode: SchulteMode): string[] {
  const count = size * size;
  return Array.from({ length: count }, (_, index) =>
    mode === 'numbers' ? String(index + 1) : letterLabel(index),
  );
}

/**
 * Случайная перестановка (алгоритм Фишера — Йетса). Исходный массив не изменяется.
 * random можно подменить в тестах.
 */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const current = result[i] as T;
    result[i] = result[j] as T;
    result[j] = current;
  }
  return result;
}

/** Перемешанная сетка для новой тренировки. */
export function createGrid(size: GridSize, mode: SchulteMode, random: () => number = Math.random): string[] {
  return shuffle(createSequence(size, mode), random);
}

export function modeLabel(mode: SchulteMode): string {
  return mode === 'numbers' ? 'числа' : 'буквы';
}

export function gridLabel(size: GridSize): string {
  return `${size}×${size}`;
}
