import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import {
  buildGeometry,
  chooseLayout,
  createRound,
  foundCount,
  LAYOUTS,
  roundKey,
  tapNumber,
  TRIANGLE_COLORS,
  TRIANGLE_COUNT,
  triangleAccuracy,
} from './triangleUtils';

describe('поле', () => {
  it.each(['wide', 'narrow'] as const)('раскладка %s: ровно 99 треугольников без наложений', (layout) => {
    expect(LAYOUTS[layout].reduce((a, b) => a + b, 0)).toBe(99);
    const { cells, width, height } = buildGeometry(layout, 60);
    expect(cells).toHaveLength(99);
    expect(new Set(cells.map((c) => `${c.cx.toFixed(1)}:${c.cy.toFixed(1)}`)).size).toBe(99);
    for (const c of cells) {
      expect(c.cx).toBeGreaterThan(0);
      expect(c.cx).toBeLessThan(width);
      expect(c.cy).toBeGreaterThan(0);
      expect(c.cy).toBeLessThan(height);
    }
  });

  it('широкое поле горизонтальное; на узком экране — узкая раскладка', () => {
    const wide = buildGeometry('wide', 60);
    expect(wide.width / wide.height).toBeGreaterThan(2.5);
    expect(chooseLayout(1100)).toBe('wide');
    expect(chooseLayout(360)).toBe('narrow');
  });
});

describe('раунд', () => {
  it('числа 1–99 по одному разу, у каждого один из 4 цветов', () => {
    const round = createRound(null, seededRandom(1));
    expect([...round.numbers].sort((a, b) => a - b)).toEqual(Array.from({ length: 99 }, (_, i) => i + 1));
    const ids = Object.keys(TRIANGLE_COLORS);
    for (let n = 1; n <= 99; n += 1) expect(ids).toContain(round.colors[n]);
  });

  it('каждый новый раунд — новые позиции и цвета', () => {
    const a = createRound(null, seededRandom(1));
    const b = createRound(a, seededRandom(2));
    expect(a.numbers.join()).not.toBe(b.numbers.join());
    expect(a.colors.join()).not.toBe(b.colors.join());
    expect(roundKey(a)).not.toBe(roundKey(b));
  });
});

describe('порядок поиска', () => {
  it('верное продвигает, неверное — ошибка без продвижения, после 99 — конец', () => {
    let progress = { next: 1, mistakes: 0 };
    let step = tapNumber(progress, 5);
    expect(step.outcome).toBe('wrong');
    expect(step.progress).toEqual({ next: 1, mistakes: 1 });
    step = tapNumber(step.progress, 1);
    expect(step.outcome).toBe('correct');
    expect(tapNumber(step.progress, 1).outcome).toBe('ignored');
    progress = step.progress;
    for (let n = 2; n < TRIANGLE_COUNT; n += 1) progress = tapNumber(progress, n).progress;
    const last = tapNumber(progress, 99);
    expect(last.outcome).toBe('finished');
    expect(foundCount(last.progress)).toBe(99);
    expect(tapNumber(last.progress, 1).outcome).toBe('ignored');
  });

  it('точность', () => {
    expect(triangleAccuracy(0, 0)).toBe(0);
    expect(triangleAccuracy(30, 10)).toBe(75);
  });
});
