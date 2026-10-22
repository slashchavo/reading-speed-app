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
  position: BookPosition;
  /** 0–100, доля фрагментов до текущей позиции. */
  progress: number;
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
