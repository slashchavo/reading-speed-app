import { describe, expect, it } from 'vitest';
import { calculateWordsPerMinute } from '../reader/readerUtils';
import type { BookChapter } from './bookTypes';
import {
  buildBookIndex,
  legacyPositionToWord,
  pageBlocks,
  pageForWord,
  paginate,
  readingProgress,
  wordAt,
  wordsInRange,
  wordsPerPageFor,
} from './pagination';

const words = (n: number, p: string) => Array.from({ length: n }, (_, i) => `${p}${i}`).join(' ');

const chapters: BookChapter[] = [
  { title: 'Первая', paragraphs: [words(50, 'а'), words(120, 'б'), words(30, 'в')] },
  { title: 'Вторая', paragraphs: [words(500, 'г'), words(10, 'д')] },
];

describe('сквозная нумерация слов', () => {
  it('номера идут подряд по главам и абзацам', () => {
    const index = buildBookIndex(chapters);
    expect(index.totalWords).toBe(710);
    expect(index.chapterStarts).toEqual([0, 200]);
    expect(wordAt(index, 0)).toBe('а0');
    expect(wordAt(index, 50)).toBe('б0');
    expect(wordAt(index, 200)).toBe('г0');
    expect(wordAt(index, 709)).toBe('д9');
    expect(wordAt(index, 710)).toBeNull();
  });
});

describe('страницы', () => {
  const index = buildBookIndex(chapters);

  it.each([80, 150, 260, 400])('по %i слов: все слова ровно по разу, без пересечения глав', (limit) => {
    const pages = paginate(index, limit);
    let expected = 0;
    for (const page of pages) {
      expect(page.start).toBe(expected);
      expect(page.end - page.start).toBeLessThanOrEqual(limit);
      expect(page.end).toBeGreaterThan(page.start);
      const chapterEnd = index.chapterStarts[page.chapter + 1] ?? index.totalWords;
      expect(page.start).toBeGreaterThanOrEqual(index.chapterStarts[page.chapter] ?? 0);
      expect(page.end).toBeLessThanOrEqual(chapterEnd);
      expected = page.end;
    }
    expect(expected).toBe(index.totalWords);
    const rendered = pages.flatMap((page) => pageBlocks(index, page).flatMap((b) => b.words));
    expect(rendered).toHaveLength(index.totalWords);
    expect(rendered[0]).toBe('а0');
    expect(rendered.at(-1)).toBe('д9');
  });

  it('абзац переносится целиком, если помещается на следующую страницу', () => {
    const pages = paginate(index, 150);
    expect(pages[0]).toEqual({ chapter: 0, start: 0, end: 50 });
    expect(pages[1]).toEqual({ chapter: 0, start: 50, end: 200 });
  });

  it('поиск страницы по слову', () => {
    const pages = paginate(index, 150);
    expect(pageForWord(pages, 0)).toBe(0);
    expect(pageForWord(pages, 49)).toBe(0);
    expect(pageForWord(pages, 50)).toBe(1);
    expect(pages[pageForWord(pages, 709)]?.end).toBe(710);
  });

  it('размер страницы зависит от шрифта в разумных пределах', () => {
    expect(wordsPerPageFor(18)).toBe(260);
    expect(wordsPerPageFor(32)).toBeLessThan(wordsPerPageFor(14));
    expect(wordsPerPageFor(Number.NaN)).toBe(260);
  });
});

describe('замер до последнего слова', () => {
  it('слова считаются от стартового до конечного включительно', () => {
    expect(wordsInRange(50, 50)).toBe(1);
    expect(wordsInRange(50, 249)).toBe(200);
    expect(wordsInRange(60, 50)).toBe(0);
    // 200 слов за 60 секунд — 200 слов/мин, в том числе через границу страниц и глав.
    expect(calculateWordsPerMinute(wordsInRange(150, 349), 60)).toBe(200);
  });

  it('прогресс и перевод позиции старого формата', () => {
    const index = buildBookIndex(chapters);
    expect(readingProgress(index, 355)).toBe(50);
    expect(legacyPositionToWord(chapters, index, { chapter: 1, fragment: 0 })).toBe(200);
    expect(legacyPositionToWord(chapters, index, { chapter: 9, fragment: 0 })).toBe(0);
  });
});
