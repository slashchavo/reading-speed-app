import type { BookChapter, BookPosition } from './bookTypes';
import { chapterFragments } from './bookUtils';

/**
 * Сквозная нумерация слов книги и виртуальные страницы.
 * Номер слова стабилен: он зависит только от извлечённого текста, а не от размера шрифта или страницы.
 */

export type IndexedParagraph = {
  chapter: number;
  /** Номер первого слова абзаца в книге. */
  start: number;
  words: string[];
};

export type BookIndex = {
  paragraphs: IndexedParagraph[];
  /** Номер первого слова каждой главы. */
  chapterStarts: number[];
  totalWords: number;
};

export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter((word) => word !== '');
}

export function buildBookIndex(chapters: readonly BookChapter[]): BookIndex {
  const paragraphs: IndexedParagraph[] = [];
  const chapterStarts: number[] = [];
  let cursor = 0;
  chapters.forEach((chapter, chapterIndex) => {
    chapterStarts.push(cursor);
    for (const text of chapter.paragraphs) {
      const words = tokenize(text);
      if (words.length === 0) continue;
      paragraphs.push({ chapter: chapterIndex, start: cursor, words });
      cursor += words.length;
    }
  });
  return { paragraphs, chapterStarts, totalWords: cursor };
}

/** Страница — непрерывный диапазон слов [start, end) внутри одной главы. */
export type Page = { chapter: number; start: number; end: number };

/** Слов на странице: при крупном шрифте меньше, чтобы страница оставалась удобной. */
export function wordsPerPageFor(fontSize: number): number {
  const size = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 18;
  return Math.min(400, Math.max(80, Math.round(260 * (18 / size) ** 2)));
}

/**
 * Делит книгу на страницы по границам абзацев (длинный абзац режется по словам).
 * Страницы не пересекают главы, не теряют и не дублируют слова.
 */
export function paginate(index: BookIndex, wordsPerPage: number): Page[] {
  const limit = Math.max(1, Math.floor(wordsPerPage));
  const pages: Page[] = [];
  let current: Page | null = null;
  const close = () => {
    if (current && current.end > current.start) pages.push(current);
    current = null;
  };
  for (const paragraph of index.paragraphs) {
    if (current && (current as Page).chapter !== paragraph.chapter) close();
    let offset = 0;
    while (offset < paragraph.words.length) {
      const start = paragraph.start + offset;
      const remaining = paragraph.words.length - offset;
      if (!current) current = { chapter: paragraph.chapter, start, end: start };
      const room = limit - ((current as Page).end - (current as Page).start);
      if (room <= 0 || (room < remaining && (current as Page).end > (current as Page).start && remaining <= limit)) {
        // Абзац целиком не помещается, но поместится на следующей странице — переносим его.
        close();
        continue;
      }
      const take = Math.min(room, remaining);
      (current as Page).end += take;
      offset += take;
    }
  }
  close();
  return pages;
}

/** Страница, на которой находится слово. */
export function pageForWord(pages: readonly Page[], wordIndex: number): number {
  if (pages.length === 0) return 0;
  let lo = 0;
  let hi = pages.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if ((pages[mid]?.start ?? 0) <= wordIndex) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export type PageBlock = { start: number; words: string[] };

/** Абзацы (или их части), попадающие на страницу, — для отрисовки. */
export function pageBlocks(index: BookIndex, page: Page): PageBlock[] {
  const blocks: PageBlock[] = [];
  for (const paragraph of index.paragraphs) {
    const pEnd = paragraph.start + paragraph.words.length;
    if (pEnd <= page.start) continue;
    if (paragraph.start >= page.end) break;
    const from = Math.max(page.start, paragraph.start);
    const to = Math.min(page.end, pEnd);
    blocks.push({ start: from, words: paragraph.words.slice(from - paragraph.start, to - paragraph.start) });
  }
  return blocks;
}

export function wordAt(index: BookIndex, wordIndex: number): string | null {
  const paragraph = index.paragraphs.find((p) => wordIndex >= p.start && wordIndex < p.start + p.words.length);
  return paragraph ? (paragraph.words[wordIndex - paragraph.start] ?? null) : null;
}

/** Слов прочитано от стартового до конечного включительно; 0, если конец раньше начала. */
export function wordsInRange(start: number, end: number): number {
  return Number.isInteger(start) && Number.isInteger(end) && end >= start ? end - start + 1 : 0;
}

/** Перевод позиции старого формата (глава + фрагмент) в номер слова. */
export function legacyPositionToWord(chapters: readonly BookChapter[], index: BookIndex, position: BookPosition): number {
  const chapter = chapters[position.chapter];
  if (!chapter) return 0;
  const fragments = chapterFragments(chapter);
  const before = fragments.slice(0, Math.max(0, position.fragment)).flat();
  const words = before.reduce((sum, paragraph) => sum + tokenize(paragraph).length, 0);
  return Math.min(Math.max(0, index.totalWords - 1), (index.chapterStarts[position.chapter] ?? 0) + words);
}

export function readingProgress(index: BookIndex, wordIndex: number): number {
  if (index.totalWords === 0) return 0;
  return Math.min(100, Math.max(0, Math.round((wordIndex / index.totalWords) * 100)));
}
