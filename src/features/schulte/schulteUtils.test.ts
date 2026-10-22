import { describe, expect, it } from 'vitest';
import { createGrid, createSequence, letterLabel, shuffle } from './schulteUtils';

describe('createSequence', () => {
  it('5×5 числа: 1–25', () => {
    const seq = createSequence(5, 'numbers');
    expect(seq).toHaveLength(25);
    expect(seq[0]).toBe('1');
    expect(seq[24]).toBe('25');
  });

  it('7×7 числа: 1–49', () => {
    const seq = createSequence(7, 'numbers');
    expect(seq).toHaveLength(49);
    expect(seq[48]).toBe('49');
  });

  it('5×5 буквы: A–Y', () => {
    expect(createSequence(5, 'letters').join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXY');
  });

  it('7×7 буквы: A–Z, затем AA–AW', () => {
    const seq = createSequence(7, 'letters');
    expect(seq).toHaveLength(49);
    expect(seq[25]).toBe('Z');
    expect(seq[26]).toBe('AA');
    expect(seq[48]).toBe('AW');
    expect(letterLabel(48)).toBe('AW');
  });
});

describe('createGrid', () => {
  it.each([
    [5, 'numbers'],
    [7, 'numbers'],
    [5, 'letters'],
    [7, 'letters'],
  ] as const)('%i×%i (%s): все элементы уникальны и совпадают с последовательностью', (size, mode) => {
    const grid = createGrid(size, mode);
    expect(grid).toHaveLength(size * size);
    expect(new Set(grid).size).toBe(size * size);
    expect([...grid].sort()).toEqual([...createSequence(size, mode)].sort());
  });

  it('повторный старт обычно даёт новую перестановку', () => {
    const first = createGrid(7, 'numbers').join(',');
    const others = Array.from({ length: 5 }, () => createGrid(7, 'numbers').join(','));
    expect(others.some((grid) => grid !== first)).toBe(true);
  });
});

describe('shuffle', () => {
  it('не меняет исходный массив и детерминирован при заданном random', () => {
    const source = [1, 2, 3, 4, 5];
    const result = shuffle(source, () => 0);
    expect(source).toEqual([1, 2, 3, 4, 5]);
    expect(result).toEqual([2, 3, 4, 5, 1]);
  });
});
