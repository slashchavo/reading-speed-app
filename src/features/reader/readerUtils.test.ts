import { describe, expect, it } from 'vitest';
import { calculateWordsPerMinute, countWords, isTxtFile } from './readerUtils';

describe('countWords', () => {
  it('пустой текст и пробелы — 0 слов', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t  ')).toBe(0);
  });

  it('нормализует пробелы и переносы строк', () => {
    expect(countWords('  Привет,   мир!\n\nКак   дела?\t')).toBe(4);
  });
});

describe('calculateWordsPerMinute', () => {
  it('считает слова в минуту целым числом', () => {
    expect(calculateWordsPerMinute(200, 60)).toBe(200);
    expect(calculateWordsPerMinute(100, 45)).toBe(133);
  });

  it('не возвращает Infinity/NaN для коротких или пустых сессий', () => {
    expect(calculateWordsPerMinute(100, 0)).toBeNull();
    expect(calculateWordsPerMinute(100, 0.5)).toBeNull();
    expect(calculateWordsPerMinute(0, 30)).toBeNull();
    expect(calculateWordsPerMinute(100, Number.NaN)).toBeNull();
  });
});

describe('isTxtFile', () => {
  it('принимает .txt и text/plain', () => {
    expect(isTxtFile({ name: 'book.TXT', type: '' })).toBe(true);
    expect(isTxtFile({ name: 'notes', type: 'text/plain' })).toBe(true);
    expect(isTxtFile({ name: 'book.pdf', type: 'application/pdf' })).toBe(false);
  });
});
