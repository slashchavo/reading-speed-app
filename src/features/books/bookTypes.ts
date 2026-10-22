export type BookFormat = 'epub' | 'docx' | 'txt';

export type BookChapter = {
  title: string;
  paragraphs: string[];
};

export type BookPosition = { chapter: number; fragment: number };

/** Метаданные книги — небольшая запись в IndexedDB (список книг грузится быстро). */
export type BookMeta = {
  id: string;
  title: string;
  fileName: string;
  format: BookFormat;
  size: number;
  hash: string;
  importedAt: string;
  wordCount: number;
  chapterCount: number;
  fragmentCount: number;
  /** Позиция старого формата (глава + фрагмент) — сохраняется для совместимости. */
  position: BookPosition;
  /** 0–100, доля прочитанного. */
  progress: number;
  /** Номер первого слова текущей страницы (сквозная нумерация). Нет у книг, открытых только в старой версии. */
  wordIndex?: number;
  /** Номер последнего прочитанного слова из последнего замера. */
  lastReadWordIndex?: number;
  lastOpenedAt?: string;
};

/** Извлечённый текст книги — хранится отдельно от метаданных. */
export type BookContent = {
  id: string;
  chapters: BookChapter[];
};

export type ParsedBook = {
  title: string | null;
  chapters: BookChapter[];
};
