import { countWords } from '../reader/readerUtils';
import type { BookChapter, BookFormat, BookPosition } from './bookTypes';

export const MAX_BOOK_BYTES = 30 * 1024 * 1024;
export const FRAGMENT_WORDS = 350;
const MAX_PARAGRAPH_WORDS = 600;

export type FileKind = BookFormat | 'doc' | 'unsupported';

/** Формат по расширению (тип MIME на iPad часто пустой). */
export function detectFormat(fileName: string): FileKind {
  const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  if (ext === 'epub') return 'epub';
  if (ext === 'docx') return 'docx';
  if (ext === 'txt') return 'txt';
  if (ext === 'doc') return 'doc';
  return 'unsupported';
}

export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
  return base || 'Без названия';
}

/** Нормализует пробелы внутри абзаца. */
export function cleanParagraph(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Делит слишком длинный абзац на части по предложениям, не теряя слов. */
export function splitLongParagraph(paragraph: string, maxWords = MAX_PARAGRAPH_WORDS): string[] {
  if (countWords(paragraph) <= maxWords) return [paragraph];
  const sentences = paragraph.match(/[^.!?…]+[.!?…]*\s*/g) ?? [paragraph];
  const parts: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && countWords(current + sentence) > maxWords) {
      parts.push(current.trim());
      current = '';
    }
    current += sentence;
    // Предложение без точек длиннее лимита режем по словам.
    while (countWords(current) > maxWords) {
      const words = current.trim().split(/\s+/);
      parts.push(words.slice(0, maxWords).join(' '));
      current = words.slice(maxWords).join(' ') + ' ';
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Разбивает абзацы главы на фрагменты примерно по targetWords слов, по границам абзацев.
 * Слова и порядок сохраняются полностью.
 */
export function chunkParagraphs(paragraphs: readonly string[], targetWords = FRAGMENT_WORDS): string[][] {
  const fragments: string[][] = [];
  let current: string[] = [];
  let words = 0;
  for (const paragraph of paragraphs.flatMap((p) => splitLongParagraph(p))) {
    const count = countWords(paragraph);
    if (count === 0) continue;
    current.push(paragraph);
    words += count;
    if (words >= targetWords) {
      fragments.push(current);
      current = [];
      words = 0;
    }
  }
  if (current.length > 0) {
    // Слишком короткий хвост присоединяем к предыдущему фрагменту.
    const last = fragments[fragments.length - 1];
    if (last && words < targetWords / 3) last.push(...current);
    else fragments.push(current);
  }
  return fragments;
}

export function chapterFragments(chapter: BookChapter): string[][] {
  const fragments = chunkParagraphs(chapter.paragraphs);
  return fragments.length > 0 ? fragments : [[]];
}

export function countBookWords(chapters: readonly BookChapter[]): number {
  return chapters.reduce((sum, chapter) => sum + chapter.paragraphs.reduce((s, p) => s + countWords(p), 0), 0);
}

/** Убирает пустые главы и пустые абзацы. */
export function normalizeChapters(chapters: readonly BookChapter[]): BookChapter[] {
  return chapters
    .map((chapter) => ({
      title: cleanParagraph(chapter.title) || 'Без названия',
      paragraphs: chapter.paragraphs.map(cleanParagraph).filter((p) => p !== ''),
    }))
    .filter((chapter) => chapter.paragraphs.length > 0)
    .map((chapter, index) => ({ ...chapter, title: chapter.title === 'Без названия' ? `Раздел ${index + 1}` : chapter.title }));
}

/** Количество фрагментов в каждой главе. */
export function fragmentCounts(chapters: readonly BookChapter[]): number[] {
  return chapters.map((chapter) => chapterFragments(chapter).length);
}

/** Прогресс чтения в процентах: доля фрагментов до текущей позиции. */
export function progressPercent(counts: readonly number[], position: BookPosition): number {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const before = counts.slice(0, position.chapter).reduce((a, b) => a + b, 0) + position.fragment;
  return Math.min(100, Math.round((before / total) * 100));
}

/** Приводит сохранённую позицию к допустимой (на случай повреждения данных). */
export function clampPosition(counts: readonly number[], position: BookPosition): BookPosition {
  if (counts.length === 0) return { chapter: 0, fragment: 0 };
  const chapter = Math.min(Math.max(0, Math.floor(position.chapter) || 0), counts.length - 1);
  const max = (counts[chapter] ?? 1) - 1;
  const fragment = Math.min(Math.max(0, Math.floor(position.fragment) || 0), Math.max(0, max));
  return { chapter, fragment };
}

/** Следующая/предыдущая позиция с переходом между главами; null — дальше некуда. */
export function stepPosition(counts: readonly number[], position: BookPosition, delta: 1 | -1): BookPosition | null {
  const { chapter, fragment } = position;
  if (delta === 1) {
    if (fragment + 1 < (counts[chapter] ?? 0)) return { chapter, fragment: fragment + 1 };
    return chapter + 1 < counts.length ? { chapter: chapter + 1, fragment: 0 } : null;
  }
  if (fragment > 0) return { chapter, fragment: fragment - 1 };
  return chapter > 0 ? { chapter: chapter - 1, fragment: Math.max(0, (counts[chapter - 1] ?? 1) - 1) } : null;
}

/** Быстрый хеш содержимого (FNV-1a, 32 бита) — для поиска дублей вместе с размером файла. */
export function hashBytes(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i] ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Путь внутри ZIP относительно файла-источника: ('OEBPS/content.opf', 'text/ch1.xhtml#a') → 'OEBPS/text/ch1.xhtml'. */
export function resolveZipPath(fromFile: string, href: string): string {
  const clean = href.split('#')[0] ?? '';
  let decoded = clean;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    // Оставляем как есть, если в имени неправильная %-последовательность.
  }
  if (decoded.startsWith('/')) decoded = decoded.slice(1);
  const parts = fromFile.split('/').slice(0, -1);
  for (const segment of decoded.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }
  return parts.join('/');
}

// \b в JavaScript не работает с кириллицей, поэтому граница слова задана явно.
const CHAPTER_LINE = /^(глава|часть|раздел|пролог|эпилог|chapter|part)(?=[\s.:]|$)[^\n]{0,60}$/iu;

/** Текст .txt → главы: абзацы по пустым строкам (или по строкам), главы по строкам «Глава …». */
export function parseTxtText(text: string): BookChapter[] {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const blocks = /\n\s*\n/.test(normalized)
    ? normalized.split(/\n\s*\n/).map((block) => block.replace(/\n/g, ' '))
    : normalized.split('\n');
  const chapters: BookChapter[] = [{ title: 'Начало', paragraphs: [] }];
  for (const raw of blocks) {
    const paragraph = cleanParagraph(raw);
    if (!paragraph) continue;
    if (CHAPTER_LINE.test(paragraph)) {
      chapters.push({ title: paragraph, paragraphs: [] });
      continue;
    }
    chapters[chapters.length - 1]?.paragraphs.push(paragraph);
  }
  const result = normalizeChapters(chapters);
  // Если глав не нашлось, у единственного раздела нет смысла в заголовке «Начало».
  if (result.length === 1 && result[0]) result[0] = { ...result[0], title: 'Весь текст' };
  return result;
}

/** Декодирует .txt: сначала UTF-8, при ошибке — Windows-1251 (частая кодировка русских текстов). */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1251').decode(bytes);
  }
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`;
}
