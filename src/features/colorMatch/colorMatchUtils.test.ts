import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { accuracy, COLOR_WORDS, INK_BACKGROUND, isCorrectAnswer, isMatch, nextTrial, RECENT_WINDOW, type Trial } from './colorMatchUtils';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('палитра', () => {
  it('ровно 8 цветов: радуга и розовый, с корректными CSS-значениями', () => {
    expect(COLOR_WORDS.map((c) => c.word)).toEqual(['КРАСНЫЙ', 'ОРАНЖЕВЫЙ', 'ЖЁЛТЫЙ', 'ЗЕЛЁНЫЙ', 'ГОЛУБОЙ', 'СИНИЙ', 'ФИОЛЕТОВЫЙ', 'РОЗОВЫЙ']);
    expect(COLOR_WORDS.every((c) => /^#[0-9a-f]{6}$/.test(c.hex))).toBe(true);
    expect(new Set(COLOR_WORDS.map((c) => c.hex)).size).toBe(8);
  });

  it('все цвета читаются на тёмном фоне карточки (≥ 4.5:1)', () => {
    const bg = luminance(INK_BACKGROUND);
    for (const c of COLOR_WORDS) expect((luminance(c.hex) + 0.05) / (bg + 0.05), c.word).toBeGreaterThanOrEqual(4.5);
  });
});

describe('правило', () => {
  it('сравнивается слово слева с цветом букв справа, а не со словом справа', () => {
    const yes: Trial = { left: 'red', word: 'blue', ink: 'red' };
    const no: Trial = { left: 'red', word: 'red', ink: 'blue' };
    expect(isMatch(yes)).toBe(true);
    expect(isMatch(no)).toBe(false);
    expect(isCorrectAnswer(yes, true)).toBe(true);
    expect(isCorrectAnswer(yes, false)).toBe(false);
    expect(isCorrectAnswer(no, false)).toBe(true);
    expect(isCorrectAnswer(no, true)).toBe(false);
  });

  it('точность без деления на ноль', () => {
    expect(accuracy(0, 0)).toBe(0);
    expect(accuracy(3, 4)).toBe(75);
  });
});

describe('генерация пар', () => {
  it('нет повторов в окне последних пар, ответы «Да»/«Нет» примерно поровну', () => {
    const random = seededRandom(9);
    const trials: Trial[] = [];
    for (let i = 0; i < 400; i += 1) trials.push(nextTrial(trials, random));
    for (let i = 1; i < trials.length; i += 1) {
      const window = trials.slice(Math.max(0, i - RECENT_WINDOW), i).map((t) => `${t.left}${t.word}${t.ink}`);
      const t = trials[i]!;
      expect(window).not.toContain(`${t.left}${t.word}${t.ink}`);
    }
    const yes = trials.filter(isMatch).length;
    expect(yes).toBeGreaterThan(150);
    expect(yes).toBeLessThan(250);
  });
});
