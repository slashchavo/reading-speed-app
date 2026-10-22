import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import {
  emptyColors,
  emptyPlacement,
  evaluateRound,
  generateRound,
  GRID_CELLS,
  MNEMO_LEVELS,
  occupantOf,
  placeElement,
  removeElement,
  type MnemoRound,
} from './mnemoUtils';

describe('generateRound', () => {
  it.each([
    ['easy', 9, 3],
    ['medium', 16, 4],
    ['hard', 25, 6],
    ['expert', 25, 8],
  ] as const)('%s: %i элементов, палитра %i цветов', (level, count, colors) => {
    for (let seed = 1; seed <= 15; seed += 1) {
      const round = generateRound(level, seededRandom(seed));
      expect(round.elements).toHaveLength(count);
      expect(round.palette).toHaveLength(colors);
      expect(new Set(round.elements.map((e) => e.id)).size).toBe(count);
      expect(new Set(round.elements.map((e) => e.cell)).size).toBe(count);
      expect(round.elements.every((e) => e.cell >= 0 && e.cell < GRID_CELLS)).toBe(true);
      const paletteIds = new Set(round.palette.map((c) => c.id));
      expect(round.elements.every((e) => paletteIds.has(e.colorId))).toBe(true);
    }
    expect(MNEMO_LEVELS[level]).toMatchObject({ elements: count, colors });
  });

  it('лёгкий — только фигуры; средний — фигуры и буквы; сложный — плюс символы', () => {
    const kinds = (level: 'easy' | 'medium' | 'hard') =>
      new Set(Array.from({ length: 10 }, (_, s) => generateRound(level, seededRandom(s + 1)).elements.map((e) => e.kind)).flat());
    expect([...kinds('easy')]).toEqual(['shape']);
    expect(kinds('medium')).toEqual(new Set(['shape', 'letter']));
    expect(kinds('hard')).toEqual(new Set(['shape', 'letter', 'symbol']));
  });

  it('новый раунд — новое расположение', () => {
    const a = generateRound('medium', seededRandom(1));
    const b = generateRound('medium', seededRandom(2));
    expect(a.elements.map((e) => `${e.id}@${e.cell}`).join()).not.toBe(b.elements.map((e) => `${e.id}@${e.cell}`).join());
  });
});

describe('раскладка', () => {
  it('ставит в клетку, вытесняет прежнего владельца, убирает', () => {
    let placement = emptyPlacement([{ id: 'a' }, { id: 'b' }]);
    placement = placeElement(placement, 'a', 3);
    expect(occupantOf(placement, 3)).toBe('a');
    placement = placeElement(placement, 'b', 3);
    expect(placement).toEqual({ a: null, b: 3 });
    placement = placeElement(placement, 'b', 7);
    expect(occupantOf(placement, 3)).toBeNull();
    expect(removeElement(placement, 'b')).toEqual({ a: null, b: null });
  });
});

describe('evaluateRound', () => {
  const round: MnemoRound = {
    level: 'easy',
    palette: [],
    elements: [
      { id: 'x', kind: 'shape', glyph: 'circle', name: 'круг', colorId: 'red', cell: 0 },
      { id: 'y', kind: 'shape', glyph: 'star', name: 'звезда', colorId: 'blue', cell: 6 },
    ],
  };

  it('полностью верный ответ — 100 %', () => {
    const result = evaluateRound(round, { x: 0, y: 6 }, { x: 'red', y: 'blue' });
    expect(result).toMatchObject({ positionsCorrect: 2, cellsCorrect: 25, colorsCorrect: 2, overall: 100, errors: [] });
  });

  it('положение и цвет оцениваются раздельно, пустые клетки учитываются', () => {
    // x на своём месте, но с неверным цветом; y стоит в чужой (пустой) клетке, цвет верный.
    const result = evaluateRound(round, { x: 0, y: 7 }, { x: 'green', y: 'blue' });
    expect(result.positionsCorrect).toBe(1);
    expect(result.colorsCorrect).toBe(1);
    // Неверны две клетки: 6 (должна быть y) и 7 (должна быть пустой).
    expect(result.cellsCorrect).toBe(23);
    expect(result.errors).toEqual([
      { elementId: 'x', name: 'круг', wrongPosition: false, wrongColor: true },
      { elementId: 'y', name: 'звезда', wrongPosition: true, wrongColor: false },
    ]);
  });

  it('неразмещённые элементы считаются ошибкой положения', () => {
    const result = evaluateRound(round, emptyPlacement(round.elements), emptyColors(round.elements));
    expect(result.unplaced).toBe(2);
    expect(result.positionsCorrect).toBe(0);
    expect(result.cellsCorrect).toBe(23);
    expect(result.colorAccuracy).toBe(0);
  });
});
