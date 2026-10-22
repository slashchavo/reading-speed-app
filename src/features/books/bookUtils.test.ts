import { describe, expect, it } from 'vitest';
import { countWords } from '../reader/readerUtils';
import {
  chunkParagraphs,
  clampPosition,
  decodeText,
  detectFormat,
  hashBytes,
  parseTxtText,
  progressPercent,
  resolveZipPath,
  splitLongParagraph,
  stepPosition,
} from './bookUtils';

const words = (n: number, prefix = 'слово') => Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(' ');

describe('detectFormat', () => {
  it('распознаёт форматы по расширению, .doc отдельно', () => {
    expect(detectFormat('Книга.EPUB')).toBe('epub');
    expect(detectFormat('отчёт.docx')).toBe('docx');
    expect(detectFormat('notes.txt')).toBe('txt');
    expect(detectFormat('старый.doc')).toBe('doc');
    expect(detectFormat('book.pdf')).toBe('unsupported');
  });
});

describe('chunkParagraphs', () => {
  it('сохраняет все слова и порядок', () => {
    const paragraphs = Array.from({ length: 40 }, (_, i) => words(37, `п${i}_`));
    const fragments = chunkParagraphs(paragraphs, 350);
    expect(fragments.length).toBeGreaterThan(1);
    expect(fragments.flat()).toEqual(paragraphs);
    const total = fragments.flat().reduce((s, p) => s + countWords(p), 0);
    expect(total).toBe(40 * 37);
  });

  it('очень длинный абзац делится без потери слов', () => {
    const long = words(1500);
    const parts = splitLongParagraph(long, 600);
    expect(parts.length).toBe(3);
    expect(parts.join(' ')).toBe(long);
  });

  it('короткий хвост присоединяется к последнему фрагменту', () => {
    const fragments = chunkParagraphs([words(350), words(20)], 350);
    expect(fragments).toHaveLength(1);
  });
});

describe('позиция чтения', () => {
  const counts = [2, 3];
  it('переходы между фрагментами и главами', () => {
    expect(stepPosition(counts, { chapter: 0, fragment: 1 }, 1)).toEqual({ chapter: 1, fragment: 0 });
    expect(stepPosition(counts, { chapter: 1, fragment: 0 }, -1)).toEqual({ chapter: 0, fragment: 1 });
    expect(stepPosition(counts, { chapter: 1, fragment: 2 }, 1)).toBeNull();
    expect(stepPosition(counts, { chapter: 0, fragment: 0 }, -1)).toBeNull();
  });

  it('прогресс и исправление повреждённой позиции', () => {
    expect(progressPercent(counts, { chapter: 1, fragment: 0 })).toBe(40);
    expect(clampPosition(counts, { chapter: 9, fragment: 9 })).toEqual({ chapter: 1, fragment: 2 });
    expect(clampPosition(counts, { chapter: -1, fragment: Number.NaN })).toEqual({ chapter: 0, fragment: 0 });
  });
});

describe('hashBytes', () => {
  it('одинаковое содержимое — одинаковый хеш, разное — разный', () => {
    const a = new TextEncoder().encode('книга');
    expect(hashBytes(a)).toBe(hashBytes(new TextEncoder().encode('книга')));
    expect(hashBytes(a)).not.toBe(hashBytes(new TextEncoder().encode('книги')));
  });
});

describe('resolveZipPath', () => {
  it('относительные пути, якоря и %-кодирование', () => {
    expect(resolveZipPath('OEBPS/content.opf', 'Text/ch%201.xhtml#p1')).toBe('OEBPS/Text/ch 1.xhtml');
    expect(resolveZipPath('OEBPS/Text/nav.xhtml', '../Text/ch2.xhtml')).toBe('OEBPS/Text/ch2.xhtml');
    expect(resolveZipPath('content.opf', 'ch3.html')).toBe('ch3.html');
  });
});

describe('TXT', () => {
  it('абзацы по пустым строкам и главы по заголовкам', () => {
    const chapters = parseTxtText('Вступление первой\nстроки.\n\nГлава 1\n\nТекст главы.\n\nГлава 2\n\nЕщё текст.');
    expect(chapters.map((c) => c.title)).toEqual(['Начало', 'Глава 1', 'Глава 2']);
    expect(chapters[0]?.paragraphs).toEqual(['Вступление первой строки.']);
  });

  it('без глав — один раздел; пустой текст — пусто', () => {
    expect(parseTxtText('Одна строка\nДругая строка')).toEqual([
      { title: 'Весь текст', paragraphs: ['Одна строка', 'Другая строка'] },
    ]);
    expect(parseTxtText('  \n\n ')).toEqual([]);
  });

  it('UTF-8 и Windows-1251', () => {
    expect(decodeText(new TextEncoder().encode('Привет'))).toBe('Привет');
    // «Привет» в Windows-1251.
    expect(decodeText(new Uint8Array([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]))).toBe('Привет');
  });
});
