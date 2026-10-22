import { createId } from '../../lib/storage';
import { deleteBook, listBooks, saveBook } from './bookDb';
import type { BookFormat, BookMeta, ParsedBook } from './bookTypes';
import { countBookWords, detectFormat, fragmentCounts, hashBytes, MAX_BOOK_BYTES, titleFromFileName } from './bookUtils';

export type ImportStage = 'reading' | 'parsing' | 'saving';

export type ImportOutcome =
  | { status: 'imported'; book: BookMeta }
  | { status: 'duplicate'; book: BookMeta }
  | { status: 'error'; message: string };

const DOC_MESSAGE = 'Этот формат Word (.doc) не поддерживается. Откройте документ в Word или Pages и сохраните его как DOCX, затем загрузите снова.';

/** Читает файл с отображением прогресса. */
function readFile(file: File, onProgress: (percent: number) => void): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new Error('read'));
    reader.readAsArrayBuffer(file);
  });
}

async function parse(format: BookFormat, bytes: Uint8Array): Promise<ParsedBook> {
  // Парсеры загружаются отдельным файлом только при первом импорте.
  const parsers = await import('./parsers');
  if (format === 'epub') return parsers.parseEpub(bytes);
  if (format === 'docx') return parsers.parseDocx(bytes);
  return parsers.parseTxt(bytes);
}

/** Полный импорт: проверка → чтение → разбор → поиск дубля → сохранение в IndexedDB. Всё локально. */
export async function importBook(
  file: File,
  onStage: (stage: ImportStage, percent?: number) => void,
): Promise<ImportOutcome> {
  const kind = detectFormat(file.name);
  if (kind === 'doc') return { status: 'error', message: DOC_MESSAGE };
  if (kind === 'unsupported') {
    return { status: 'error', message: 'Этот формат не поддерживается. Загрузите книгу в формате EPUB, DOCX или TXT.' };
  }
  if (file.size === 0) return { status: 'error', message: 'Файл пустой.' };
  if (file.size > MAX_BOOK_BYTES) {
    return { status: 'error', message: 'Файл больше 30 МБ. Такие большие файлы браузер на планшете может не осилить — выберите файл поменьше.' };
  }

  let bytes: Uint8Array;
  try {
    onStage('reading', 0);
    bytes = await readFile(file, (percent) => onStage('reading', percent));
  } catch {
    return { status: 'error', message: 'Не удалось прочитать файл. Попробуйте выбрать его ещё раз.' };
  }

  const hash = hashBytes(bytes);
  try {
    const existing = (await listBooks()).find((book) => book.hash === hash && book.size === file.size);
    if (existing) return { status: 'duplicate', book: existing };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'Хранилище книг недоступно.' };
  }

  let parsed: ParsedBook;
  try {
    onStage('parsing');
    parsed = await parse(kind, bytes);
  } catch (error) {
    const known = error instanceof Error && error.name !== 'Error' ? error.message : null;
    return { status: 'error', message: known ?? 'Не удалось извлечь текст из файла. Возможно, он повреждён.' };
  }

  const wordCount = countBookWords(parsed.chapters);
  if (wordCount === 0) {
    return { status: 'error', message: 'В файле не найден текст. Возможно, книга состоит из картинок или документ пустой.' };
  }

  const counts = fragmentCounts(parsed.chapters);
  const book: BookMeta = {
    id: createId(),
    title: parsed.title ?? titleFromFileName(file.name),
    fileName: file.name,
    format: kind,
    size: file.size,
    hash,
    importedAt: new Date().toISOString(),
    wordCount,
    chapterCount: parsed.chapters.length,
    fragmentCount: counts.reduce((a, b) => a + b, 0),
    position: { chapter: 0, fragment: 0 },
    progress: 0,
  };

  try {
    onStage('saving');
    await saveBook(book, { id: book.id, chapters: parsed.chapters });
  } catch (error) {
    await deleteBook(book.id).catch(() => undefined);
    return { status: 'error', message: error instanceof Error ? error.message : 'Не удалось сохранить книгу.' };
  }
  return { status: 'imported', book };
}
