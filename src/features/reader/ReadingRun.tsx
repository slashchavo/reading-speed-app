import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SaveStatus, type SaveState } from '../../components/SaveStatus';
import { Stat } from '../../components/Stat';
import { formatDuration, formatStopwatch, roundSeconds } from '../../lib/dateUtils';
import { createId } from '../../lib/storage';
import { useStopwatch } from '../../lib/useStopwatch';
import type { ReadingSession, ReadingSource } from '../../types/session';
import { FontControls } from './FontControls';
import { calculateWordsPerMinute, countWords, MIN_READING_SECONDS } from './readerUtils';

type Phase = 'ready' | 'reading' | 'finished';

type Result = { wordCount: number; durationSeconds: number; wordsPerMinute: number | null };

type Props = {
  text: string;
  source: ReadingSource;
  textId?: string;
  bookId?: string;
  title?: string;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onComplete: (session: ReadingSession) => boolean;
  /** Вызывается при нажатии «Начать» (например, чтобы отметить встроенный текст использованным). */
  onStart?: () => void;
  /** Что показать над кнопкой «Начать»: название текста, редактор и т. п. */
  readyView?: ReactNode;
  /** Почему нельзя начать (например, пустой текст) — показывается вместо старта. */
  blockedReason?: string | null;
  /** Дополнительные кнопки в результате. */
  resultActions?: ReactNode;
  /** Пояснение под результатом. */
  resultNote?: string;
};

/**
 * Замер скорости чтения: «Начать» → текст и секундомер → «Завершить» → слова, время, слова/мин.
 * Результат сохраняется один раз; сессии короче секунды не сохраняются.
 */
export function ReadingRun({
  text,
  source,
  textId,
  bookId,
  title,
  fontSize,
  onFontSizeChange,
  onComplete,
  onStart,
  readyView,
  blockedReason,
  resultActions,
  resultNote,
}: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [result, setResult] = useState<Result | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [showBlocked, setShowBlocked] = useState(false);
  const stopwatch = useStopwatch();
  const savedRef = useRef(false);
  const readingRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (phase === 'reading') readingRef.current?.focus();
    if (phase === 'finished') resultRef.current?.focus();
  }, [phase]);

  useEffect(() => setShowBlocked(false), [blockedReason]);

  const start = () => {
    if (blockedReason || countWords(text) === 0) {
      setShowBlocked(true);
      return;
    }
    onStart?.();
    savedRef.current = false;
    setResult(null);
    setSaveState('idle');
    setPhase('reading');
    stopwatch.start();
  };

  const finish = () => {
    if (phase !== 'reading') return;
    const durationSeconds = roundSeconds(stopwatch.stop());
    const wordCount = countWords(text);
    const wordsPerMinute = calculateWordsPerMinute(wordCount, durationSeconds);
    setResult({ wordCount, durationSeconds, wordsPerMinute });
    setPhase('finished');
    if (wordsPerMinute === null || savedRef.current) return;
    savedRef.current = true;
    const session: ReadingSession = {
      id: createId(),
      type: 'reading',
      completedAt: new Date().toISOString(),
      durationSeconds,
      wordCount,
      wordsPerMinute,
      source,
    };
    if (textId) session.textId = textId;
    if (bookId) session.bookId = bookId;
    if (title) session.title = title;
    setSaveState(onComplete(session) ? 'saved' : 'failed');
  };

  const reset = () => {
    stopwatch.reset();
    savedRef.current = false;
    setResult(null);
    setSaveState('idle');
    setPhase('ready');
  };

  if (phase === 'reading') {
    return (
      <section className="card" aria-label="Чтение текста">
        <div className="reader__bar">
          <span>
            Время: <strong className="mono">{formatStopwatch(stopwatch.elapsedMs)}</strong>
          </span>
          <FontControls fontSize={fontSize} onChange={onFontSizeChange} />
        </div>
        {title && <h2 className="reader__title">{title}</h2>}
        <div className="reader__text" style={{ fontSize }} tabIndex={0} ref={readingRef} aria-label="Текст для чтения">
          {text}
        </div>
        <div className="actions actions--sticky">
          <button type="button" className="button button--primary button--large" onClick={finish}>
            Завершить чтение
          </button>
          <button type="button" className="button" onClick={reset}>
            Сбросить
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'finished' && result) {
    return (
      <section className="card result" aria-labelledby="reader-result-title">
        <h2 id="reader-result-title" className="card__title" tabIndex={-1} ref={resultRef}>
          Результат{title ? `: «${title}»` : ''}
        </h2>
        <dl className="stats">
          <Stat label="Слов" value={String(result.wordCount)} />
          <Stat label="Время" value={formatDuration(result.durationSeconds)} />
          <Stat
            label="Ориентировочная скорость"
            value={result.wordsPerMinute === null ? '—' : `${result.wordsPerMinute} слов/мин`}
          />
        </dl>
        {result.wordsPerMinute === null ? (
          <p className="alert alert--warning" role="alert">
            Сессия была короче {MIN_READING_SECONDS} секунды — скорость не рассчитана, результат не сохранён.
          </p>
        ) : (
          <p className="muted">
            {resultNote ??
              'Это оценка темпа: количество слов, делённое на время чтения. Понимание текста приложение не проверяет.'}
          </p>
        )}
        <SaveStatus state={saveState} />
        <div className="actions">
          {resultActions}
          <button type="button" className="button" onClick={reset}>
            Читать этот текст ещё раз
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      {readyView}
      {showBlocked && (blockedReason || countWords(text) === 0) && (
        <p className="alert alert--error" role="alert">
          {blockedReason ?? 'Текст пустой. Добавьте текст, чтобы начать.'}
        </p>
      )}
      <div className="reader__font">
        <span className="field__label">Размер шрифта при чтении</span>
        <FontControls fontSize={fontSize} onChange={onFontSizeChange} />
      </div>
      <div className="actions">
        <button type="button" className="button button--primary button--large" onClick={start}>
          Начать
        </button>
      </div>
    </section>
  );
}
