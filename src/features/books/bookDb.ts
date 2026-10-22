import type { BookContent, BookMeta, BookPosition } from './bookTypes';

/**
 * Хранилище книг в IndexedDB: метаданные и извлечённый текст в разных хранилищах.
 * В localStorage книги не попадают — там слишком мало места.
 */
const DB_NAME = 'focus-app-books';
const DB_VERSION = 1;
const META = 'books';
const CONTENT = 'contents';

export class BookStorageError extends Error {
  override name = 'BookStorageError';
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new BookStorageError('Браузер не поддерживает локальное хранилище книг (IndexedDB).'));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      reject(new BookStorageError('Локальное хранилище книг недоступно — возможно, включён приватный режим.'));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(CONTENT)) db.createObjectStore(CONTENT, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new BookStorageError('Не удалось открыть локальное хранилище книг.'));
    request.onblocked = () => reject(new BookStorageError('Хранилище книг занято другой вкладкой. Закройте её и попробуйте снова.'));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new BookStorageError(tx.error?.name === 'QuotaExceededError'
      ? 'Недостаточно места в хранилище браузера. Удалите ненужные книги и попробуйте снова.'
      : 'Не удалось сохранить данные книги.'));
    tx.onabort = () => reject(new BookStorageError('Сохранение книги прервано.'));
  });
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new BookStorageError('Ошибка чтения хранилища книг.'));
  });
}

function isBookMeta(value: unknown): value is BookMeta {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<BookMeta>;
  return typeof v.id === 'string' && typeof v.title === 'string' && typeof v.wordCount === 'number' && typeof v.position === 'object';
}

export async function listBooks(): Promise<BookMeta[]> {
  const db = await openDb();
  const all = await result(db.transaction(META, 'readonly').objectStore(META).getAll());
  return (all as unknown[])
    .filter(isBookMeta)
    .sort((a, b) => (b.lastOpenedAt ?? b.importedAt).localeCompare(a.lastOpenedAt ?? a.importedAt));
}

export async function getBookContent(id: string): Promise<BookContent | null> {
  const db = await openDb();
  const value = (await result(db.transaction(CONTENT, 'readonly').objectStore(CONTENT).get(id))) as BookContent | undefined;
  return value && Array.isArray(value.chapters) ? value : null;
}

export async function saveBook(meta: BookMeta, content: BookContent): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([META, CONTENT], 'readwrite');
  tx.objectStore(CONTENT).put(content);
  tx.objectStore(META).put(meta);
  await done(tx);
}

export type BookMetaPatch = {
  position?: BookPosition;
  progress?: number;
  lastOpenedAt?: string;
  wordIndex?: number;
  lastReadWordIndex?: number;
};

export async function updateBookMeta(id: string, patch: BookMetaPatch): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(META, 'readwrite');
  const store = tx.objectStore(META);
  const current = (await result(store.get(id))) as unknown;
  if (isBookMeta(current)) store.put({ ...current, ...patch });
  await done(tx);
}

export async function deleteBook(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([META, CONTENT], 'readwrite');
  tx.objectStore(META).delete(id);
  tx.objectStore(CONTENT).delete(id);
  await done(tx);
}
