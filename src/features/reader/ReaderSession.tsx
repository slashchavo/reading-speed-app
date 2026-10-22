import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { SaveStatus, type SaveState } from '../../components/SaveStatus';
import { formatDuration, formatStopwatch } from '../../lib/dateUtils';
import { createId, FONT_SIZE_MAX, FONT_SIZE_MIN } from '../../lib/storage';
import { useStopwatch } from '../../lib/useStopwatch';
import type { ReadingSession } from '../../types/session';
import { DEMO_TEXT } from './demoText';
import {
  calculateWordsPerMinute,
  countWords,
  isTxtFile,
  MAX_FILE_BYTES,
  MIN_READING_SECONDS,
  SHORT_TEXT_WORDS,
} from './readerUtils';

type Phase = 'idle' | 'reading' | 'finished';

type Result = {
  wordCount: number;
  durationSeconds: number;
  /** null — сессия слишком короткая для расчёта. */
  wordsPerMinute: number | null;
};

type ReaderSessionProps = {
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onComplete: (session: ReadingSession) => boolean;
};

const FONT_STEP = 2;

export function ReaderSession({ fontSize, onFontSizeChange, onComplete }: ReaderSessionProps) {
  const [text, setText] = useState(DEMO_TEXT);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<Result | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [fileMessage, setFileMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [emptyHint, setEmptyHint] = useState(false);
  const stopwatch = useStopwatch();
  // Защита от повторного сохранения одной и той же сессии.
  const savedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const readingRef = useRef<HTMLDivElement>(null);

  const wordCount = useMemo(() => countWords(text), [text]);

  useEffect(() => {
    if (phase === 'finished') resultRef.current?.focus();
    if (phase === 'reading') readingRef.current?.focus();
  }, [phase]);

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    setEmptyHint(false);
    setFileMessage(null);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = ''; // позволяет повторно выбрать тот же файл
    if (!file) return;

    if (!isTxtFile(file)) {
      setFileMessage({ kind: 'error', text: 'Поддерживаются только файлы .txt. PDF, DOCX и EPUB пока не поддерживаются.' });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileMessage({ kind: 'error', text: 'Файл слишком большой. Выберите .txt файл размером до 1 МБ.' });
      return;
    }
    try {
      const content = await file.text();
      if (countWords(content) === 0) {
        setFileMessage({ kind: 'error', text: `В файле «${file.name}» нет текста.` });
        return;
      }
      setText(content);
      setEmptyHint(false);
      setFileMessage({ kind: 'info', text: `Загружен файл «${file.name}».` });
    } catch {
      setFileMessage({ kind: 'error', text: 'Не удалось прочитать файл. Попробуйте другой .txt файл.' });
    }
  };

  const start = () => {
    if (wordCount === 0) {
      setEmptyHint(true);
      return;
    }
    savedRef.current = false;
    setResult(null);
    setSaveState('idle');
    setPhase('reading');
    stopwatch.start();
  };

  const finish = () => {
    if (phase !== 'reading') return;
    const durationSeconds = Math.round(stopwatch.stop() / 100) / 10;
    const wordsPerMinute = calculateWordsPerMinute(wordCount, durationSeconds);
    setResult({ wordCount, durationSeconds, wordsPerMinute });
    setPhase('finished');

    if (wordsPerMinute === null || savedRef.current) return;
    savedRef.current = true;
    const saved = onComplete({
      id: createId(),
      type: 'reading',
      completedAt: new Date().toISOString(),
      durationSeconds,
      wordCount,
      wordsPerMinute,
    });
    setSaveState(saved ? 'saved' : 'failed');
  };

  const reset = () => {
    stopwatch.reset();
    savedRef.current = false;
    setResult(null);
    setSaveState('idle');
    setPhase('idle');
  };

  const fontControls = (
    <div className="font-controls" role="group" aria-label="Размер шрифта">
      <button
        type="button"
        className="button button--small"
        onClick={() => onFontSizeChange(fontSize - FONT_STEP)}
        disabled={fontSize <= FONT_SIZE_MIN}
        aria-label="Уменьшить шрифт"
      >
        A−
      </button>
      <span className="font-controls__value" aria-live="polite">
        {fontSize} px
      </span>
      <button
        type="button"
        className="button button--small"
        onClick={() => onFontSizeChange(fontSize + FONT_STEP)}
        disabled={fontSize >= FONT_SIZE_MAX}
        aria-label="Увеличить шрифт"
      >
        A+
      </button>
    </div>
  );

  if (phase === 'reading') {
    return (
      <section className="card" aria-label="Чтение текста">
        <div className="reader__bar">
          <span>
            Время: <strong className="mono">{formatStopwatch(stopwatch.elapsedMs)}</strong>
          </span>
          {fontControls}
        </div>
        <div className="reader__text" style={{ fontSize }} tabIndex={0} ref={readingRef} aria-label="Текст для чтения">
          {text}
        </div>
        <div className="actions actions--sticky">
          <button type="button" className="button button--primary button--large" onClick={finish}>
            Завершить
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
          Результат
        </h2>
        <dl className="stats">
          <div className="stat">
            <dt className="stat__label">Слов</dt>
            <dd className="stat__value">{result.wordCount}</dd>
          </div>
          <div className="stat">
            <dt className="stat__label">Время</dt>
            <dd className="stat__value">{formatDuration(result.durationSeconds)}</dd>
          </div>
          <div className="stat">
            <dt className="stat__label">Ориентировочная скорость</dt>
            <dd className="stat__value">
              {result.wordsPerMinute === null ? '—' : `${result.wordsPerMinute} слов/мин`}
            </dd>
          </div>
        </dl>
        {result.wordsPerMinute === null ? (
          <p className="alert alert--warning" role="alert">
            Сессия была короче {MIN_READING_SECONDS} секунды — скорость не рассчитана, результат не сохранён.
            Попробуйте ещё раз и нажмите «Завершить», когда дочитаете текст.
          </p>
        ) : (
          <p className="muted">
            Это оценка темпа: количество слов, делённое на время чтения. Понимание текста приложение не проверяет.
          </p>
        )}
        <SaveStatus state={saveState} />
        <div className="actions">
          <button type="button" className="button button--primary" onClick={start}>
            Читать ещё раз
          </button>
          <button type="button" className="button" onClick={reset}>
            Сбросить
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card" aria-labelledby="reader-source-title">
      <h2 id="reader-source-title" className="card__title">
        Текст
      </h2>
      <p className="muted">
        Можно читать демонстрационный текст, вставить свой или загрузить файл .txt. Нажмите «Начать», прочитайте
        текст в привычном темпе и нажмите «Завершить».
      </p>
      <label className="field">
        <span className="field__label">Текст для чтения</span>
        <textarea
          className="field__textarea"
          value={text}
          onChange={handleTextChange}
          rows={10}
          aria-describedby="reader-word-count"
        />
      </label>
      <div className="reader__tools">
        <span id="reader-word-count" className="muted">
          Слов: <strong>{wordCount}</strong>
        </span>
        <div className="actions actions--compact">
          <button type="button" className="button button--small" onClick={() => fileInputRef.current?.click()}>
            Загрузить .txt
          </button>
          <button
            type="button"
            className="button button--small"
            onClick={() => {
              setText(DEMO_TEXT);
              setEmptyHint(false);
              setFileMessage(null);
            }}
          >
            Демо-текст
          </button>
          <button
            type="button"
            className="button button--small"
            onClick={() => {
              setText('');
              setFileMessage(null);
            }}
            disabled={text === ''}
          >
            Очистить
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,text/plain"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleFile}
        />
      </div>
      {fileMessage && (
        <p className={fileMessage.kind === 'error' ? 'alert alert--error' : 'note'} role="status">
          {fileMessage.text}
        </p>
      )}
      {emptyHint && wordCount === 0 && (
        <p className="alert alert--error" role="alert">
          Текст пустой. Вставьте текст, загрузите файл .txt или нажмите «Демо-текст».
        </p>
      )}
      {wordCount > 0 && wordCount < SHORT_TEXT_WORDS && (
        <p className="note">Текст очень короткий — результат будет неточным. Лучше взять текст от 100 слов.</p>
      )}
      <div className="reader__font">
        <span className="field__label">Размер шрифта при чтении</span>
        {fontControls}
      </div>
      <div className="actions">
        <button type="button" className="button button--primary button--large" onClick={start}>
          Начать
        </button>
      </div>
    </section>
  );
}
