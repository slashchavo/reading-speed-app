import { describe, expect, it } from 'vitest';
import { RUSSIAN_ALPHABET } from '../../lib/alphabet';
import { seededRandom } from '../../lib/random';
import {
  assignColors,
  createBoard,
  createSequence,
  cyrillicSequence,
  letterLabel,
  orderTargets,
  SCHULTE_PALETTE,
  shuffle,
  symbolFontPx,
  tapTarget,
  type SessionProgress,
} from './schulteUtils';

describe('последовательности', () => {
  it('числа 1–25 и 1–49 без пропусков', () => {
    expect(createSequence(5, 'numbers')).toEqual(Array.from({ length: 25 }, (_, i) => String(i + 1)));
    expect(createSequence(7, 'numbers')).toEqual(Array.from({ length: 49 }, (_, i) => String(i + 1)));
  });

  it('латиница: A–Y; для 7×7 A–Z, затем AA–AW', () => {
    expect(createSequence(5, 'letters').join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXY');
    const seq = createSequence(7, 'letters');
    expect(seq).toHaveLength(49);
    expect(new Set(seq).size).toBe(49);
    expect(seq[25]).toBe('Z');
    expect(seq[26]).toBe('AA');
    expect(letterLabel(48)).toBe('AW');
  });

  it('кириллица 5×5: 25 букв подряд от случайной стартовой, с переходом Я → А', () => {
    const starts = new Set<string>();
    for (let seed = 1; seed <= 60; seed += 1) {
      const seq = cyrillicSequence(5, seededRandom(seed));
      expect(seq).toHaveLength(25);
      expect(new Set(seq).size).toBe(25);
      starts.add(seq[0] ?? '');
      // Каждая следующая буква — следующая по алфавиту (по кругу).
      for (let i = 1; i < seq.length; i += 1) {
        const prev = RUSSIAN_ALPHABET.indexOf(seq[i - 1] ?? '');
        expect(RUSSIAN_ALPHABET.indexOf(seq[i] ?? '')).toBe((prev + 1) % 33);
      }
    }
    expect(starts.size).toBeGreaterThan(10);
    const wrapped = Array.from({ length: 60 }, (_, s) => cyrillicSequence(5, seededRandom(s + 1))).some(
      (seq) => seq.includes('Я') && seq.includes('А') && seq.indexOf('Я') < seq.indexOf('А'),
    );
    expect(wrapped).toBe(true);
  });

  it('кириллица 7×7: 33 буквы с Ё ровно по разу и 16 пустых неактивных клеток', () => {
    const seq = cyrillicSequence(7);
    expect(seq).toEqual(RUSSIAN_ALPHABET);
    const board = createBoard(seq, 7, seededRandom(4));
    expect(board).toHaveLength(49);
    expect(board.filter((cell) => cell === null)).toHaveLength(16);
    expect(board.filter((cell) => cell !== null).sort()).toEqual([...RUSSIAN_ALPHABET].sort());
  });

  it('обратный порядок начинается с последнего элемента', () => {
    expect(orderTargets(['1', '2', '3'], 'reverse')).toEqual(['3', '2', '1']);
    expect(orderTargets(['1', '2', '3'], 'forward')).toEqual(['1', '2', '3']);
  });

  it('новая таблица — новое расположение', () => {
    const seq = createSequence(7, 'numbers');
    const a = createBoard(seq, 7, seededRandom(1)).join();
    const b = createBoard(seq, 7, seededRandom(2)).join();
    expect(a).not.toBe(b);
  });
});

describe('сессия', () => {
  const start: SessionProgress = { targets: ['1', '2', '3'], index: 0, correct: 0, wrong: 0, tablesCompleted: 0 };

  it('неверное нажатие — ошибка без продвижения; найденные и пустые клетки игнорируются', () => {
    let step = tapTarget(start, '2');
    expect(step.outcome).toBe('wrong');
    expect(step.progress).toMatchObject({ index: 0, wrong: 1 });
    step = tapTarget(step.progress, '1');
    expect(step.outcome).toBe('correct');
    expect(tapTarget(step.progress, '1').outcome).toBe('ignored');
    expect(tapTarget(step.progress, null).outcome).toBe('ignored');
  });

  it('таблица засчитывается только после последней цели', () => {
    let progress = start;
    for (const value of ['1', '2']) progress = tapTarget(progress, value).progress;
    expect(progress.tablesCompleted).toBe(0);
    const last = tapTarget(progress, '3');
    expect(last.outcome).toBe('table-complete');
    expect(last.progress).toMatchObject({ tablesCompleted: 1, correct: 3 });
  });
});

/** Тон (0–360) и относительная яркость цвета #rrggbb. */
function hueOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('палитра', () => {
  it('цвета явно разные по тону (≥ 25°) и контрастны на белом (≥ 4.5:1)', () => {
    const hexes = SCHULTE_PALETTE.map((c) => c.hex);
    for (let i = 0; i < hexes.length; i += 1) {
      const contrast = 1.05 / (luminance(hexes[i] ?? '') + 0.05);
      expect(contrast, hexes[i]).toBeGreaterThanOrEqual(4.5);
      for (let j = i + 1; j < hexes.length; j += 1) {
        const diff = Math.abs(hueOf(hexes[i] ?? '') - hueOf(hexes[j] ?? ''));
        expect(Math.min(diff, 360 - diff), `${hexes[i]} ${hexes[j]}`).toBeGreaterThanOrEqual(25);
      }
    }
  });

  it('чёрно-белый режим и пустые клетки — без цвета', () => {
    expect(assignColors(['1', null], 'mono')).toEqual([null, null]);
    const colored = assignColors(['1', null, '2'], 'color', seededRandom(3));
    expect(colored[1]).toBeNull();
    expect(typeof colored[0]).toBe('string');
  });
});

describe('размер символа', () => {
  it('растёт со ступенью; двузначные числа того же размера, что и однозначные', () => {
    expect(symbolFontPx(60, 5, '8')).toBeGreaterThan(symbolFontPx(60, 1, '8'));
    expect(symbolFontPx(60, 5, '25')).toBe(symbolFontPx(60, 5, '8'));
    expect(symbolFontPx(0, 3, '1')).toBe(0);
  });

  it('широкие пары уменьшаются только если иначе не помещаются в ячейку', () => {
    expect(symbolFontPx(60, 1, 'AW')).toBe(symbolFontPx(60, 1, 'A'));
    const xl = symbolFontPx(60, 5, 'AW');
    expect(xl).toBeLessThan(symbolFontPx(60, 5, 'A'));
    expect(xl * 0.78 * 2).toBeLessThanOrEqual(60 * 0.82 + 1);
  });
});

describe('shuffle', () => {
  it('не меняет исходный массив и детерминирован при заданном random', () => {
    const source = [1, 2, 3, 4, 5];
    expect(shuffle(source, () => 0)).toEqual([2, 3, 4, 5, 1]);
    expect(source).toEqual([1, 2, 3, 4, 5]);
  });
});
