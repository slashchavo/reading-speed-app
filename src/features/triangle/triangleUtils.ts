import { randomInt, shuffle, type RandomFn } from '../../lib/random';

export const TRIANGLE_COUNT = 99;

export type TriangleColorId = 'red' | 'blue' | 'yellow' | 'green';

/** Четыре игровых цвета (без градиентов) и контрастный цвет числа для каждого. */
export const TRIANGLE_COLORS: Record<TriangleColorId, { name: string; fill: string; text: string }> = {
  red: { name: 'красный', fill: '#e03131', text: '#ffffff' },
  blue: { name: 'синий', fill: '#1c63c9', text: '#ffffff' },
  yellow: { name: 'жёлтый', fill: '#f5c400', text: '#1c2233' },
  green: { name: 'зелёный', fill: '#2b8a3e', text: '#ffffff' },
};
const COLOR_IDS = Object.keys(TRIANGLE_COLORS) as TriangleColorId[];

/**
 * Раскладки поля. Широкая — 4 ряда (25+25+25+24), для компьютера и iPad;
 * узкая — 9 рядов по 11, для телефона в портретной ориентации. В обеих ровно 99 треугольников.
 */
export const LAYOUTS = {
  wide: [25, 25, 25, 24],
  narrow: [11, 11, 11, 11, 11, 11, 11, 11, 11],
} as const;
export type LayoutId = keyof typeof LAYOUTS;

/** Ширина ряда в «основаниях» треугольника: n треугольников вперемешку вверх/вниз занимают (n + 1) / 2 оснований. */
export function layoutWidthInBases(layout: LayoutId): number {
  return Math.max(...LAYOUTS[layout].map((n) => (n + 1) / 2));
}

/** Узкая раскладка, если при широкой треугольники стали бы слишком мелкими. */
export function chooseLayout(availableWidth: number, minBase = 44): LayoutId {
  return availableWidth / layoutWidthInBases('wide') >= minBase ? 'wide' : 'narrow';
}

export type TriangleCell = { index: number; points: string; cx: number; cy: number; up: boolean };

const SQRT3_2 = Math.sqrt(3) / 2;

/**
 * Геометрия: координаты треугольников при длине основания base. Ряды выровнены по левому краю,
 * чтобы треугольники соседних рядов стыковались сторонами без зазоров.
 */
export function buildGeometry(layout: LayoutId, base: number): { cells: TriangleCell[]; width: number; height: number } {
  const rows = LAYOUTS[layout];
  const h = base * SQRT3_2;
  const fullWidth = layoutWidthInBases(layout) * base;
  const cells: TriangleCell[] = [];
  rows.forEach((count, r) => {
    const y = r * h;
    for (let j = 0; j < count; j += 1) {
      const x = (j * base) / 2;
      // Соседние ряды начинаются с треугольников разной ориентации — ряды стыкуются без зазоров.
      const up = (j + r) % 2 === 0;
      const pts = up
        ? [[x, y + h], [x + base / 2, y], [x + base, y + h]]
        : [[x, y], [x + base, y], [x + base / 2, y + h]];
      cells.push({
        index: cells.length,
        points: pts.map(([px, py]) => `${(px ?? 0).toFixed(2)},${(py ?? 0).toFixed(2)}`).join(' '),
        cx: x + base / 2,
        cy: up ? y + (2 * h) / 3 : y + h / 3,
        up,
      });
    }
  });
  return { cells, width: fullWidth, height: rows.length * h };
}

export type TriangleRound = {
  /** numbers[i] — число в треугольнике i. */
  numbers: number[];
  /** colors[n] — цвет числа n (индекс 1–99; 0 не используется). */
  colors: TriangleColorId[];
};

export function roundKey(round: TriangleRound): string {
  return round.numbers.join(',') + '|' + round.colors.join(',');
}

/** Новая раскладка: числа 1–99 в случайных треугольниках и случайный цвет у каждого числа. */
export function createRound(previous: TriangleRound | null = null, random: RandomFn = Math.random): TriangleRound {
  const make = (): TriangleRound => ({
    numbers: shuffle(
      Array.from({ length: TRIANGLE_COUNT }, (_, i) => i + 1),
      random,
    ),
    colors: Array.from({ length: TRIANGLE_COUNT + 1 }, () => COLOR_IDS[randomInt(COLOR_IDS.length, random)] ?? 'red'),
  });
  let round = make();
  // Совпадение полной раскладки практически невозможно, но проверяем явно.
  while (previous && roundKey(round) === roundKey(previous)) round = make();
  return round;
}

export type TriangleProgress = { next: number; mistakes: number };

export type TriangleTap = 'correct' | 'wrong' | 'finished' | 'ignored';

/** Нажатие на число: верное продвигает цель, неверное — ошибка; после 99 игра закончена. */
export function tapNumber(progress: TriangleProgress, value: number): { progress: TriangleProgress; outcome: TriangleTap } {
  if (progress.next > TRIANGLE_COUNT || value < progress.next) return { progress, outcome: 'ignored' };
  if (value !== progress.next) return { progress: { ...progress, mistakes: progress.mistakes + 1 }, outcome: 'wrong' };
  const next = progress.next + 1;
  return { progress: { ...progress, next }, outcome: next > TRIANGLE_COUNT ? 'finished' : 'correct' };
}

/** Найдено чисел = последнее найденное число. */
export function foundCount(progress: TriangleProgress): number {
  return progress.next - 1;
}

export function triangleAccuracy(found: number, mistakes: number): number {
  const total = found + mistakes;
  return total > 0 ? Math.round((found / total) * 100) : 0;
}
