import { sample, shuffle, randomInt, type RandomFn } from '../../lib/random';
import type { MnemoLevel } from '../../types/session';

export const GRID_CELLS = 25;

export type ElementKind = 'shape' | 'letter' | 'symbol';

export type MnemoGlyph = {
  /** Уникальный идентификатор знака, например «shape:star» или «letter:Ж». */
  id: string;
  kind: ElementKind;
  /** Для фигуры — имя формы, для буквы/символа — сам знак. */
  glyph: string;
  /** Название для подписи и экранного диктора. */
  name: string;
};

export type MnemoColor = { id: string; name: string; hex: string };

export type MnemoElement = MnemoGlyph & { colorId: string; cell: number };

export type MnemoRound = {
  level: MnemoLevel;
  elements: MnemoElement[];
  palette: MnemoColor[];
};

/** Все цвета; уровень берёт первые N. Названия обязательны: цвет не показывается только кружком. */
export const MNEMO_COLORS: readonly MnemoColor[] = [
  { id: 'red', name: 'Красный', hex: '#e03131' },
  { id: 'blue', name: 'Синий', hex: '#1971c2' },
  { id: 'green', name: 'Зелёный', hex: '#2f9e44' },
  { id: 'yellow', name: 'Жёлтый', hex: '#e8a300' },
  { id: 'purple', name: 'Фиолетовый', hex: '#7048e8' },
  { id: 'brown', name: 'Коричневый', hex: '#8d5a2b' },
  { id: 'pink', name: 'Розовый', hex: '#d6336c' },
  { id: 'teal', name: 'Бирюзовый', hex: '#0c8599' },
];

export const MNEMO_LEVELS: Record<MnemoLevel, { label: string; elements: number; colors: number; description: string }> = {
  easy: { label: 'Лёгкий', elements: 9, colors: 3, description: 'простые разные фигуры' },
  medium: { label: 'Средний', elements: 16, colors: 4, description: 'фигуры и буквы' },
  hard: { label: 'Сложный', elements: 25, colors: 6, description: 'фигуры, буквы и символы' },
  expert: { label: 'Эксперт', elements: 25, colors: 8, description: 'все типы, включая похожие знаки' },
};

const shape = (glyph: string, name: string): MnemoGlyph => ({ id: `shape:${glyph}`, kind: 'shape', glyph, name });
const letter = (glyph: string): MnemoGlyph => ({ id: `letter:${glyph}`, kind: 'letter', glyph, name: `буква ${glyph}` });
const symbol = (glyph: string, name: string): MnemoGlyph => ({ id: `symbol:${glyph}`, kind: 'symbol', glyph, name });

/** Хорошо различимые фигуры. */
export const DISTINCT_SHAPES: readonly MnemoGlyph[] = [
  shape('circle', 'круг'),
  shape('square', 'квадрат'),
  shape('triangle', 'треугольник'),
  shape('diamond', 'ромб'),
  shape('star', 'звезда'),
  shape('plus', 'плюс'),
  shape('hexagon', 'шестиугольник'),
  shape('heart', 'сердце'),
  shape('crescent', 'полумесяц'),
  shape('cross', 'косой крест'),
  shape('drop', 'капля'),
];

/** Фигуры, похожие на основные, — только для уровня «Эксперт». */
export const SIMILAR_SHAPES: readonly MnemoGlyph[] = [
  shape('ring', 'кольцо'),
  shape('triangle-down', 'перевёрнутый треугольник'),
  shape('square-outline', 'контур квадрата'),
  shape('pentagon', 'пятиугольник'),
];

/**
 * Лёгкий уровень: ровно 9 простых фигур, которые нельзя спутать. Нет пар, отличающихся только поворотом
 * (плюс/косой крест, квадрат/ромб), нет букв и символов.
 */
export const EASY_SHAPES: readonly MnemoGlyph[] = ['circle', 'square', 'triangle', 'star', 'plus', 'hexagon', 'heart', 'crescent', 'drop'].map(
  (id) => DISTINCT_SHAPES.find((s) => s.glyph === id) as MnemoGlyph,
);

export const BASIC_LETTERS: readonly MnemoGlyph[] = ['Б', 'Г', 'Д', 'Ж', 'И', 'Л', 'П', 'Ф', 'Ц', 'Ш', 'Ю', 'Я', 'Ы', 'К', 'Р'].map(
  letter,
);

export const SIMILAR_LETTERS: readonly MnemoGlyph[] = ['Й', 'Щ', 'Ё', 'Е', 'З', 'Э', 'Ь', 'Ъ'].map(letter);

export const SYMBOLS: readonly MnemoGlyph[] = [
  symbol('@', 'символ «собака»'),
  symbol('#', 'решётка'),
  symbol('%', 'процент'),
  symbol('&', 'амперсанд'),
  symbol('§', 'параграф'),
  symbol('?', 'вопросительный знак'),
  symbol('!', 'восклицательный знак'),
  symbol('=', 'знак равенства'),
  symbol('∞', 'бесконечность'),
  symbol('$', 'доллар'),
];

/** Пары похожих знаков: на уровне «Эксперт» обе половины пары попадают в раунд. */
const SIMILAR_PAIRS: readonly [string, string][] = [
  ['shape:circle', 'shape:ring'],
  ['shape:triangle', 'shape:triangle-down'],
  ['shape:square', 'shape:square-outline'],
  ['shape:hexagon', 'shape:pentagon'],
  ['letter:И', 'letter:Й'],
  ['letter:Ш', 'letter:Щ'],
  ['letter:Е', 'letter:Ё'],
  ['letter:З', 'letter:Э'],
  ['letter:Ь', 'letter:Ъ'],
];

const ALL_GLYPHS: readonly MnemoGlyph[] = [...DISTINCT_SHAPES, ...SIMILAR_SHAPES, ...BASIC_LETTERS, ...SIMILAR_LETTERS, ...SYMBOLS];
const BY_ID = new Map(ALL_GLYPHS.map((g) => [g.id, g]));

/** Набор уникальных знаков для уровня. */
export function pickGlyphs(level: MnemoLevel, random: RandomFn = Math.random): MnemoGlyph[] {
  const count = MNEMO_LEVELS[level].elements;
  if (level === 'easy') return sample(EASY_SHAPES, count, random);
  if (level === 'medium') return sample([...DISTINCT_SHAPES, ...BASIC_LETTERS], count, random);
  if (level === 'hard') return sample([...DISTINCT_SHAPES, ...BASIC_LETTERS, ...SYMBOLS], count, random);

  // Эксперт: 4 пары похожих знаков + остальные из всех типов.
  const chosen = new Map<string, MnemoGlyph>();
  for (const [a, b] of sample(SIMILAR_PAIRS, 4, random)) {
    for (const id of [a, b]) {
      const glyph = BY_ID.get(id);
      if (glyph) chosen.set(id, glyph);
    }
  }
  for (const glyph of shuffle(ALL_GLYPHS, random)) {
    if (chosen.size >= count) break;
    if (!chosen.has(glyph.id)) chosen.set(glyph.id, glyph);
  }
  return shuffle([...chosen.values()], random);
}

export function paletteFor(level: MnemoLevel): MnemoColor[] {
  return MNEMO_COLORS.slice(0, MNEMO_LEVELS[level].colors);
}

/** Новый раунд: уникальные знаки, случайные клетки 5×5 и случайные цвета палитры уровня. */
export function generateRound(level: MnemoLevel, random: RandomFn = Math.random): MnemoRound {
  const palette = paletteFor(level);
  const glyphs = pickGlyphs(level, random);
  const cells = sample(
    Array.from({ length: GRID_CELLS }, (_, i) => i),
    glyphs.length,
    random,
  );
  const elements = glyphs.map((glyph, index) => ({
    ...glyph,
    cell: cells[index] ?? index,
    colorId: palette[randomInt(palette.length, random)]?.id ?? 'red',
  }));
  return { level, elements, palette };
}

/** Ответ пользователя: клетка (или null — элемент в наборе) и выбранный цвет каждого элемента. */
export type Placement = Record<string, number | null>;
export type ColorChoice = Record<string, string | null>;

export function emptyPlacement(elements: readonly { id: string }[]): Placement {
  return Object.fromEntries(elements.map((e) => [e.id, null]));
}

export function emptyColors(elements: readonly { id: string }[]): ColorChoice {
  return Object.fromEntries(elements.map((e) => [e.id, null]));
}

/** Кто стоит в клетке. */
export function occupantOf(placement: Placement, cell: number): string | null {
  for (const [id, value] of Object.entries(placement)) if (value === cell) return id;
  return null;
}

/** Ставит элемент в клетку; прежний владелец клетки возвращается в набор. */
export function placeElement(placement: Placement, elementId: string, cell: number): Placement {
  const next: Placement = { ...placement };
  const occupant = occupantOf(placement, cell);
  if (occupant && occupant !== elementId) next[occupant] = null;
  next[elementId] = cell;
  return next;
}

export function removeElement(placement: Placement, elementId: string): Placement {
  return { ...placement, [elementId]: null };
}

export type MnemoError = { elementId: string; name: string; wrongPosition: boolean; wrongColor: boolean };

export type MnemoEvaluation = {
  /** Элементы на своих местах. */
  positionsCorrect: number;
  /** Клетки 5×5, совпавшие с исходным полем (включая пустые). */
  cellsCorrect: number;
  colorsCorrect: number;
  positionAccuracy: number;
  colorAccuracy: number;
  overall: number;
  unplaced: number;
  errors: MnemoError[];
};

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** Оценка: положение и цвет проверяются независимо; пустые клетки тоже учитываются. */
export function evaluateRound(round: MnemoRound, placement: Placement, colors: ColorChoice): MnemoEvaluation {
  let cellsCorrect = 0;
  for (let cell = 0; cell < GRID_CELLS; cell += 1) {
    const original = round.elements.find((e) => e.cell === cell)?.id ?? null;
    if (occupantOf(placement, cell) === original) cellsCorrect += 1;
  }
  let positionsCorrect = 0;
  let colorsCorrect = 0;
  let unplaced = 0;
  const errors: MnemoError[] = [];
  for (const element of round.elements) {
    const placedCell = placement[element.id] ?? null;
    if (placedCell === null) unplaced += 1;
    const wrongPosition = placedCell !== element.cell;
    const wrongColor = colors[element.id] !== element.colorId;
    if (!wrongPosition) positionsCorrect += 1;
    if (!wrongColor) colorsCorrect += 1;
    if (wrongPosition || wrongColor) errors.push({ elementId: element.id, name: element.name, wrongPosition, wrongColor });
  }
  const n = round.elements.length;
  return {
    positionsCorrect,
    cellsCorrect,
    colorsCorrect,
    positionAccuracy: pct(cellsCorrect, GRID_CELLS),
    colorAccuracy: pct(colorsCorrect, n),
    overall: pct(cellsCorrect + colorsCorrect, GRID_CELLS + n),
    unplaced,
    errors,
  };
}

export function cellLabel(cell: number): string {
  return `ряд ${Math.floor(cell / 5) + 1}, столбец ${(cell % 5) + 1}`;
}
