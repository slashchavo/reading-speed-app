import { describe, expect, it } from 'vitest';
import { RUSSIAN_ALPHABET } from '../../lib/alphabet';
import { seededRandom } from '../../lib/random';
import { assignColors, createGrid, createSequence, cyrillicSequence, letterLabel, shuffle } from './schulteUtils';

describe('createSequence', () => {
  it('5×5 числа: 1–25', () => {
    const seq = createSequence(5, 'numbers');
    expect(seq).toHaveLength(25);
    expect(seq[0]).toBe('1');
    expect(seq[24]).toBe('25');
  });

  it('7×7 числа: 1–49', () => {
    expect(createSequence(7, 'numbers')[48]).toBe('49');
  });

  it('5×5 латиница: A–Y', () => {
    expect(createSequence(5, 'letters').join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXY');
  });

  it('7×7 латиница: A–Z, затем AA–AW', () => {
    const seq = createSequence(7, 'letters');
    expect(seq[25]).toBe('Z');
    expect(seq[26]).toBe('AA');
    expect(seq[48]).toBe('AW');
    expect(letterLabel(48)).toBe('AW');
  });
});

describe('кириллица', () => {
  it('алфавит из 33 букв включает Ё, Ъ, Ы, Ь', () => {
    expect(RUSSIAN_ALPHABET).toHaveLength(33);
    for (const letter of ['Ё', 'Ъ', 'Ы', 'Ь']) expect(RUSSIAN_ALPHABET).toContain(letter);
  });

  it('5×5: 25 уникальных букв в алфавитном порядке', () => {
    for (let seed = 1; seed < 30; seed += 1) {
      const seq = cyrillicSequence(5, seededRandom(seed));
      expect(seq).toHaveLength(25);
      expect(new Set(seq).size).toBe(25);
      const indexes = seq.map((letter) => RUSSIAN_ALPHABET.indexOf(letter));
      expect(indexes.every((value, i) => i === 0 || value > (indexes[i - 1] ?? -1))).toBe(true);
    }
  });

  it('5×5: Ё может попасть в набор', () => {
    const withYo = Array.from({ length: 50 }, (_, seed) => cyrillicSequence(5, seededRandom(seed + 1))).some((seq) =>
      seq.includes('Ё'),
    );
    expect(withYo).toBe(true);
  });

  it('7×7: все 33 буквы плюс 16 двухбуквенных — 49 уникальных целей', () => {
    const seq = cyrillicSequence(7);
    expect(seq).toHaveLength(49);
    expect(new Set(seq).size).toBe(49);
    expect(seq.slice(0, 33)).toEqual(RUSSIAN_ALPHABET);
    expect(seq.slice(33).every((token) => token.length === 2)).toBe(true);
  });
});

describe('createGrid', () => {
  it.each([
    [5, 'numbers'],
    [7, 'numbers'],
    [5, 'letters'],
    [7, 'letters'],
    [5, 'cyrillic'],
    [7, 'cyrillic'],
  ] as const)('%i×%i (%s): все элементы уникальны', (size, mode) => {
    const grid = createGrid(size, mode);
    expect(grid).toHaveLength(size * size);
    expect(new Set(grid).size).toBe(size * size);
  });

  it('повторный старт обычно даёт новую перестановку', () => {
    const first = createGrid(7, 'numbers').join(',');
    const others = Array.from({ length: 5 }, () => createGrid(7, 'numbers').join(','));
    expect(others.some((grid) => grid !== first)).toBe(true);
  });
});

describe('цвета', () => {
  it('чёрно-белый режим — без цветов, цветной — цвета палитры', () => {
    expect(assignColors(25, 'mono').every((color) => color === null)).toBe(true);
    const colored = assignColors(25, 'color', seededRandom(3));
    expect(colored.every((color) => typeof color === 'string')).toBe(true);
  });
});

describe('shuffle', () => {
  it('не меняет исходный массив и детерминирован при заданном random', () => {
    const source = [1, 2, 3, 4, 5];
    expect(shuffle(source, () => 0)).toEqual([2, 3, 4, 5, 1]);
    expect(source).toEqual([1, 2, 3, 4, 5]);
  });
});
