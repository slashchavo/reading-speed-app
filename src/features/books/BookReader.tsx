import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { SaveStatus, type SaveState } from '../../components/SaveStatus';
import { Stat } from '../../components/Stat';
import { formatClock, formatDuration, roundSeconds } from '../../lib/dateUtils';
import { clampFontSize, createId } from '../../lib/storage';
import { useElapsed } from '../../lib/useCountdown';
import type { ReadingSession, Settings } from '../../types/session';
import { FontControls } from '../reader/FontControls';
import { calculateWordsPerMinute, MIN_READING_SECONDS } from '../reader/readerUtils';
import { getBookContent, updateBookMeta, type BookMetaPatch } from './bookDb';
import type { BookContent, BookMeta } from './bookTypes';
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

type Props = {
  book: BookMeta;
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onComplete: (session: ReadingSession) => boolean;
  onBack: () => void;
  onMetaSaved: (id: string, patch: BookMetaPatch) => void;
};

/** Идёт замер: старт с первого слова страницы, время — по временным меткам. */
type Measure = { startIndex: number; startedAt: number; endIndex: number | null; endAt: number | null };

type Result = {
  words: number;
  seconds: number;
  wpm: number | null;
  endWord: string;
  endPage: number;
  startIndex: number;
  endIndex: number;
};

const SWIPE_PX = 60;

export function BookReader({ book, settings, onSettingsChange, onComplete, onBack, onMetaSaved }: Props) {
  const [content, setContent] = useState<BookContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Текущая позиция — номер первого слова страницы; при смене шрифта страница пересчитывается вокруг него. */
  const [anchorWord, setAnchorWord] = useState<number | null>(book.wordIndex ?? null);
  const [lastRead, setLastRead] = useState<number | null>(book.lastReadWordIndex ?? null);
  const [measure, setMeasure] = useState<Measure | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const elapsed = useElapsed(measure && measure.endIndex === null ? measure.startedAt : null);

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

  const index = useMemo(() => (content ? buildBookIndex(content.chapters) : null), [content]);
  const pages = useMemo(() => (index ? paginate(index, wordsPerPageFor(settings.readerFontSize)) : []), [index, settings.readerFontSize]);

  // Книги, открытые в прошлой версии, хранили позицию как «глава + фрагмент» — переводим в номер слова.
  const startWord = useMemo(() => {
    if (!content || !index) return 0;
    if (anchorWord !== null) return Math.min(Math.max(0, anchorWord), Math.max(0, index.totalWords - 1));
    return legacyPositionToWord(content.chapters, index, book.position);
  }, [anchorWord, book.position, content, index]);

  const pageIndex = pageForWord(pages, startWord);
  const page = pages[pageIndex];

  const save = useCallback(
    (patch: BookMetaPatch) => {
      updateBookMeta(book.id, patch)
        .then(() => onMetaSaved(book.id, patch))
        .catch(() => undefined);
    },
    [book.id, onMetaSaved],
  );

  // Сохраняем страницу при каждом перелистывании — после перезагрузки чтение продолжится с того же места.
  useEffect(() => {
    if (!index || !page) return;
    save({ wordIndex: page.start, progress: readingProgress(index, page.start), lastOpenedAt: new Date().toISOString() });
  }, [index, page?.start, save]);

  const goToPage = (target: number) => {
    const next = pages[target];
    if (!next) return;
    setAnchorWord(next.start);
    setHint(null);
    topRef.current?.scrollIntoView({ block: 'start' });
  };

  // Стрелки клавиатуры листают страницы.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (event.key === 'ArrowRight') goToPage(pageIndex + 1);
      if (event.key === 'ArrowLeft') goToPage(pageIndex - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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

  if (!content || !index || !page) {
    return (
      <section className="card">
        <p className="muted">Открываем книгу…</p>
      </section>
    );
  }

  const chapter = content.chapters[page.chapter];
  const blocks = pageBlocks(index, page);

  const startMeasure = () => {
    setMeasure({ startIndex: page.start, startedAt: Date.now(), endIndex: null, endAt: null });
    setResult(null);
    setSaveState('idle');
    setHint('Читайте в обычном темпе, листайте страницы. Закончив, коснитесь последнего прочитанного слова.');
  };

  /** Касание слова во время замера отмечает конечное слово; время фиксируется в момент касания. */
  const handleWordTap = (event: MouseEvent<HTMLDivElement>) => {
    if (!measure) return;
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-w]');
    if (!target) return;
    const wordIndex = Number(target.dataset.w);
    if (wordIndex < measure.startIndex) {
      setHint('Это слово стоит раньше начала замера. Выберите слово, на котором вы закончили.');
      return;
    }
    setMeasure({ ...measure, endIndex: wordIndex, endAt: measure.endAt !== null && measure.endIndex === wordIndex ? measure.endAt : Date.now() });
    setHint(null);
  };

  const confirmMeasure = () => {
    if (!measure || measure.endIndex === null || measure.endAt === null) return;
    const words = wordsInRange(measure.startIndex, measure.endIndex);
    const seconds = roundSeconds(measure.endAt - measure.startedAt);
    const wpm = calculateWordsPerMinute(words, seconds);
    const endPage = pageForWord(pages, measure.endIndex);
    setResult({
      words,
      seconds,
      wpm,
      endWord: wordAt(index, measure.endIndex) ?? '',
      endPage: endPage + 1,
      startIndex: measure.startIndex,
      endIndex: measure.endIndex,
    });
    setMeasure(null);
    setLastRead(measure.endIndex);
    save({ lastReadWordIndex: measure.endIndex });
    if (wpm === null) {
      setSaveState('idle');
      return;
    }
    const saved = onComplete({
      id: createId(),
      type: 'reading',
      completedAt: new Date().toISOString(),
      durationSeconds: seconds,
      wordCount: words,
      wordsPerMinute: wpm,
      source: 'book',
      bookId: book.id,
      title: book.title,
      startWordIndex: measure.startIndex,
      endWordIndex: measure.endIndex,
    });
    setSaveState(saved ? 'saved' : 'failed');
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    swipeRef.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const startPoint = swipeRef.current;
    swipeRef.current = null;
    if (!startPoint) return;
    const dx = event.clientX - startPoint.x;
    const dy = event.clientY - startPoint.y;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) goToPage(pageIndex + (dx < 0 ? 1 : -1));
  };

  const pager = (
    <div className="book-pager">
      <button type="button" className="button" onClick={() => goToPage(pageIndex - 1)} disabled={pageIndex === 0}>
        ← Предыдущая
      </button>
      <span className="book-pager__counter">
        Стр. {pageIndex + 1} из {pages.length}
      </span>
      <button type="button" className="button" onClick={() => goToPage(pageIndex + 1)} disabled={pageIndex >= pages.length - 1}>
        Следующая →
      </button>
    </div>
  );

  const endWordText = measure?.endIndex != null ? wordAt(index, measure.endIndex) : null;

  return (
    <div className="book-reader" ref={topRef}>
      <div className="book-reader__head">
        <button type="button" className="button button--small" onClick={onBack}>
          ← К списку книг
        </button>
        <h2 className="book-reader__title">{book.title}</h2>
      </div>
      <div className="book-toolbar">
        {content.chapters.length > 1 && (
          <label className="field book-nav__chapter">
            <span className="field__label">Глава</span>
            <select
              className="field__select"
              value={page.chapter}
              onChange={(event) => setAnchorWord(index.chapterStarts[Number(event.target.value)] ?? 0)}
            >
              {content.chapters.map((item, chapterIndex) => (
                <option key={chapterIndex} value={chapterIndex}>
                  {chapterIndex + 1}. {item.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="book-toolbar__row">
          <FontControls fontSize={settings.readerFontSize} onChange={(size) => onSettingsChange({ readerFontSize: clampFontSize(size) })} />
          <span className="muted">прочитано {readingProgress(index, page.start)} %</span>
        </div>
      </div>

      {result && (
        <section className="card result book-result" aria-live="polite">
          <h3 className="card__title">Замер завершён</h3>
          <dl className="stats">
            <Stat label="Прочитано слов" value={String(result.words)} />
            <Stat label="Время" value={formatDuration(result.seconds)} />
            <Stat label="Скорость" value={result.wpm === null ? '—' : `${result.wpm} слов/мин`} />
          </dl>
          <p className="muted">
            Последнее слово: «{result.endWord}», страница {result.endPage}. Слова считались от первого слова страницы, с которой
            начат замер, до отмеченного слова включительно. Время — от «Начать замер» до касания последнего слова.
          </p>
          {result.wpm === null ? (
            <p className="alert alert--warning">Замер короче {MIN_READING_SECONDS} секунды — скорость не рассчитана и не сохранена.</p>
          ) : (
            <SaveStatus state={saveState} />
          )}
          <button type="button" className="button button--small" onClick={() => setResult(null)}>
            Скрыть
          </button>
        </section>
      )}

      <div className="book-measure" aria-live="polite">
        {!measure ? (
          <button type="button" className="button button--primary" onClick={startMeasure}>
            Начать замер
          </button>
        ) : (
          <div className="book-measure__active">
            <span>
              Замер: <strong className="mono">{formatClock(measure.endIndex === null ? elapsed : (measure.endAt ?? 0) - measure.startedAt)}</strong>
            </span>
            {endWordText !== null && measure.endIndex !== null ? (
              <>
                <span>
                  Последнее слово: <strong>«{endWordText}»</strong> · слов: {wordsInRange(measure.startIndex, measure.endIndex)}
                </span>
                <button type="button" className="button button--primary" onClick={confirmMeasure}>
                  Завершить замер до этого слова
                </button>
              </>
            ) : (
              <span className="muted">Коснитесь слова, на котором закончили чтение.</span>
            )}
            <button type="button" className="button button--small" onClick={() => setMeasure(null)}>
              Отменить замер
            </button>
          </div>
        )}
        {hint && <p className="note book-hint">{hint}</p>}
      </div>

      {pager}
      <article
        className={`book-page${measure ? ' book-page--measuring' : ''}`}
        style={{ fontSize: settings.readerFontSize }}
        onClick={handleWordTap}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        aria-label={`${chapter?.title ?? ''}, страница ${pageIndex + 1}`}
      >
        {page.start === index.chapterStarts[page.chapter] && chapter && <h3 className="book-page__chapter">{chapter.title}</h3>}
        {blocks.map((block) => (
          <p key={block.start}>
            {block.words.map((word, i) => {
              const w = block.start + i;
              const classes = [
                'bk-word',
                measure && w === measure.startIndex ? 'bk-word--start' : '',
                measure?.endIndex === w ? 'bk-word--end' : '',
                !measure && lastRead === w ? 'bk-word--last' : '',
              ]
                .join(' ')
                .trim();
              return (
                <span key={w}>
                  <span className={classes} data-w={w}>
                    {word}
                  </span>{' '}
                </span>
              );
            })}
          </p>
        ))}
      </article>
      {pager}
      {lastRead !== null && !measure && (
        <p className="muted book-lastread">
          Отмечено последнее прочитанное слово: «{wordAt(index, lastRead)}» (стр. {pageForWord(pages, lastRead) + 1}).{' '}
          <button type="button" className="link-button" onClick={() => setAnchorWord(pages[pageForWord(pages, lastRead)]?.start ?? 0)}>
            Перейти
          </button>
        </p>
      )}
    </div>
  );
}
