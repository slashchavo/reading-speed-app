import { useCallback, useEffect, useState } from 'react';
import { deleteBook, listBooks } from '../features/books/bookDb';
import { BookImport } from '../features/books/BookImport';
import { BookReader } from '../features/books/BookReader';
import type { BookMetaPatch } from '../features/books/bookDb';
import type { BookMeta } from '../features/books/bookTypes';
import { formatFileSize } from '../features/books/bookUtils';
import { formatDateTime } from '../lib/dateUtils';
import type { ReadingSession, Settings } from '../types/session';

type Props = {
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onComplete: (session: ReadingSession) => boolean;
};

const FORMAT_LABEL = { epub: 'EPUB', docx: 'DOCX', txt: 'TXT' } as const;

export function BooksPage({ settings, onSettingsChange, onComplete }: Props) {
  const [books, setBooks] = useState<BookMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listBooks()
      .then((list) => {
        setBooks(list);
        setError(null);
      })
      .catch((reason: unknown) => {
        setBooks([]);
        setError(reason instanceof Error ? reason.message : 'Хранилище книг недоступно.');
      });
  }, []);

  useEffect(refresh, [refresh]);

  const open = (book: BookMeta) => {
    setBooks((current) => (current?.some((b) => b.id === book.id) ? current : [book, ...(current ?? [])]));
    setOpenId(book.id);
    window.scrollTo(0, 0);
  };

  const remove = async (id: string) => {
    try {
      await deleteBook(id);
      setConfirmDelete(null);
      refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось удалить книгу.');
    }
  };

  const onMetaSaved = useCallback((id: string, patch: BookMetaPatch) => {
    setBooks((current) => current?.map((b) => (b.id === id ? { ...b, ...patch } : b)) ?? current);
  }, []);

  const openBook = books?.find((b) => b.id === openId);

  return (
    <div className="page">
      <header className="page__header">
        <h1>Мои книги</h1>
        <p className="lead">Загрузите свою книгу, листайте страницы и замеряйте скорость до последнего прочитанного слова.</p>
      </header>

      {openBook ? (
        <BookReader
          book={openBook}
          settings={settings}
          onSettingsChange={onSettingsChange}
          onComplete={onComplete}
          onBack={() => {
            setOpenId(null);
            refresh();
          }}
          onMetaSaved={onMetaSaved}
        />
      ) : (
        <>
          <BookImport onImported={refresh} onOpen={open} />
          <section className="section" aria-labelledby="books-list">
            <h2 id="books-list" className="section__title">
              Библиотека
            </h2>
            {error && (
              <p className="alert alert--warning" role="alert">
                {error}
              </p>
            )}
            {books === null && <p className="muted">Загрузка списка…</p>}
            {books?.length === 0 && !error && (
              <p className="note">Книг пока нет. Добавьте файл EPUB, DOCX или TXT — он появится здесь.</p>
            )}
            {books && books.length > 0 && (
              <ul className="book-list">
                {books.map((book) => (
                  <li key={book.id} className="book-item">
                    <div className="book-item__info">
                      <strong className="book-item__title">{book.title}</strong>
                      <span className="muted">
                        {FORMAT_LABEL[book.format]} · {formatFileSize(book.size)} · {book.wordCount.toLocaleString('ru-RU')}{' '}
                        слов · добавлена {formatDateTime(book.importedAt)}
                      </span>
                      <span className="book-item__progress">
                        <progress max={100} value={book.progress} aria-label="Прогресс чтения" /> {book.progress} %
                      </span>
                    </div>
                    <div className="actions actions--compact">
                      <button type="button" className="button button--primary button--small" onClick={() => open(book)}>
                        {book.progress > 0 ? 'Продолжить' : 'Читать'}
                      </button>
                      {confirmDelete === book.id ? (
                        <>
                          <button type="button" className="button button--small button--danger" onClick={() => remove(book.id)}>
                            Да, удалить
                          </button>
                          <button type="button" className="button button--small" onClick={() => setConfirmDelete(null)}>
                            Отмена
                          </button>
                        </>
                      ) : (
                        <button type="button" className="button button--small" onClick={() => setConfirmDelete(book.id)}>
                          Удалить
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted">
              Книги хранятся только в этом браузере на этом устройстве. Очистка данных сайта удалит их — исходные файлы
              останутся у вас.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
