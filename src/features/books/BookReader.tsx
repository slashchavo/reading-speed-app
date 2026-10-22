import { useEffect, useMemo, useState } from 'react';
import { clampFontSize } from '../../lib/storage';
import type { ReadingSession, Settings } from '../../types/session';
import { ReadingRun } from '../reader/ReadingRun';
import { countWords } from '../reader/readerUtils';
import { getBookContent, updateBookMeta } from './bookDb';
import type { BookContent, BookMeta, BookPosition } from './bookTypes';
import { chapterFragments, clampPosition, fragmentCounts, progressPercent, stepPosition } from './bookUtils';

type Props = {
  book: BookMeta;
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onComplete: (session: ReadingSession) => boolean;
  onBack: () => void;
  onPositionSaved: (id: string, position: BookPosition, progress: number) => void;
};

export function BookReader({ book, settings, onSettingsChange, onComplete, onBack, onPositionSaved }: Props) {
  const [content, setContent] = useState<BookContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<BookPosition>(book.position);

  useEffect(() => {
    let cancelled = false;
    getBookContent(book.id)
      .then((value) => {
        if (cancelled) return;
        if (value) setContent(value);
        else setError('Текст книги не найден в хранилище. Удалите книгу и загрузите файл снова.');
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Не удалось открыть книгу.');
      });
    return () => {
      cancelled = true;
    };
  }, [book.id]);

  const counts = useMemo(() => (content ? fragmentCounts(content.chapters) : []), [content]);
  const safe = useMemo(() => clampPosition(counts, position), [counts, position]);

  // Сохраняем позицию при каждом переходе — после перезагрузки чтение продолжится с того же места.
  useEffect(() => {
    if (!content) return;
    const progress = progressPercent(counts, safe);
    updateBookMeta(book.id, { position: safe, progress, lastOpenedAt: new Date().toISOString() })
      .then(() => onPositionSaved(book.id, safe, progress))
      .catch(() => undefined);
  }, [book.id, content, counts, safe.chapter, safe.fragment]);

  if (error) {
    return (
      <section className="card">
        <p className="alert alert--error" role="alert">
          {error}
        </p>
        <button type="button" className="button" onClick={onBack}>
          ← К списку книг
        </button>
      </section>
    );
  }

  if (!content) {
    return (
      <section className="card">
        <p className="muted">Открываем книгу…</p>
      </section>
    );
  }

  const chapter = content.chapters[safe.chapter];
  if (!chapter) return null;
  const fragments = chapterFragments(chapter);
  const paragraphs = fragments[safe.fragment] ?? [];
  const text = paragraphs.join('\n\n');
  const next = stepPosition(counts, safe, 1);
  const prev = stepPosition(counts, safe, -1);
  const go = (target: BookPosition | null) => target && setPosition(target);

  return (
    <div className="book-reader">
      <div className="book-reader__head">
        <button type="button" className="button button--small" onClick={onBack}>
          ← К списку книг
        </button>
        <h2 className="book-reader__title">{book.title}</h2>
      </div>
      <div className="book-nav">
        {content.chapters.length > 1 && (
          <label className="field book-nav__chapter">
            <span className="field__label">Глава</span>
            <select
              className="field__select"
              value={safe.chapter}
              onChange={(event) => setPosition({ chapter: Number(event.target.value), fragment: 0 })}
            >
              {content.chapters.map((item, index) => (
                <option key={index} value={index}>
                  {index + 1}. {item.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="book-nav__steps">
          <button type="button" className="button button--small" onClick={() => go(prev)} disabled={!prev}>
            ← Назад
          </button>
          <span className="book-nav__counter">
            Фрагмент {safe.fragment + 1} из {fragments.length} · прочитано {progressPercent(counts, safe)} %
          </span>
          <button type="button" className="button button--small" onClick={() => go(next)} disabled={!next}>
            Дальше →
          </button>
        </div>
      </div>
      <ReadingRun
        key={`${book.id}-${safe.chapter}-${safe.fragment}`}
        text={text}
        source="book"
        bookId={book.id}
        title={`${book.title} — ${chapter.title}`}
        fontSize={settings.readerFontSize}
        onFontSizeChange={(size) => onSettingsChange({ readerFontSize: clampFontSize(size) })}
        onComplete={onComplete}
        readyView={
          <>
            <p className="eyebrow">{chapter.title}</p>
            <p className="muted">
              Фрагмент: {countWords(text)} слов. Нажмите «Начать», дочитайте фрагмент до конца и нажмите «Завершить
              чтение» — так замер будет точнее. Можно и просто листать фрагменты кнопками «Назад» и «Дальше».
            </p>
          </>
        }
        resultNote="Расчёт приблизительный: он верен, только если вы действительно дочитали весь показанный фрагмент."
        resultActions={
          next && (
            <button type="button" className="button button--primary" onClick={() => go(next)}>
              Следующий фрагмент
            </button>
          )
        }
      />
    </div>
  );
}
