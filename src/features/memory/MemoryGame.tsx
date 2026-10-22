import { useCallback, useEffect, useRef, useState } from 'react';
import { SaveStatus, type SaveState } from '../../components/SaveStatus';
import { Segmented } from '../../components/Segmented';
import { Stat } from '../../components/Stat';
import { WordChips } from '../../components/WordChips';
import { checkAnswers, percent, type AnswerCheck } from '../../lib/answers';
import { formatClock, formatDuration, roundSeconds } from '../../lib/dateUtils';
import { clampMemoryWordCount, createId, MEMORY_WORDS_MAX, MEMORY_WORDS_MIN } from '../../lib/storage';
import { useCountdown } from '../../lib/useCountdown';
import type { MemoryWordsSession } from '../../types/session';
import { generateWordSet, loadRecentSets, rememberSet } from './memoryUtils';

type Phase = 'setup' | 'memorize' | 'recall' | 'finished';
type Minutes = 1 | 2 | 3;

type Props = {
  wordCount: number;
  minutes: Minutes;
  onSettingsChange: (patch: { memoryWordCount?: number; memoryMinutes?: Minutes }) => void;
  onComplete: (session: MemoryWordsSession) => boolean;
};

const MINUTE_OPTIONS = [
  { value: 1, label: '1 минута' },
  { value: 2, label: '2 минуты' },
  { value: 3, label: '3 минуты' },
] as const;

export function MemoryGame({ wordCount, minutes, onSettingsChange, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [countInput, setCountInput] = useState(String(wordCount));
  const [words, setWords] = useState<string[]>([]);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<{ check: AnswerCheck; durationSeconds: number } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const startedAtRef = useRef(0);
  const savedRef = useRef(false);
  const recallRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  const parsedCount = Number(countInput);
  const countValid = Number.isInteger(parsedCount) && parsedCount >= MEMORY_WORDS_MIN && parsedCount <= MEMORY_WORDS_MAX;

  const goToRecall = useCallback(() => {
    // Список слов исчезает сразу, отсчёт останавливается.
    setDeadline(null);
    setPhase((current) => (current === 'memorize' ? 'recall' : current));
  }, []);

  const remaining = useCountdown(phase === 'memorize' ? deadline : null, goToRecall);

  useEffect(() => {
    if (phase === 'recall') recallRef.current?.focus();
    if (phase === 'finished') resultRef.current?.focus();
  }, [phase]);

  const changeCount = (value: number) => {
    const next = clampMemoryWordCount(value);
    setCountInput(String(next));
    onSettingsChange({ memoryWordCount: next });
  };

  const start = () => {
    if (!countValid) return;
    const nextWords = generateWordSet(parsedCount, loadRecentSets());
    rememberSet(nextWords);
    onSettingsChange({ memoryWordCount: parsedCount });
    setWords(nextWords);
    setAnswer('');
    setResult(null);
    setSaveState('idle');
    savedRef.current = false;
    startedAtRef.current = Date.now();
    setDeadline(Date.now() + minutes * 60_000);
    setPhase('memorize');
  };

  const check = () => {
    if (phase !== 'recall') return;
    const durationSeconds = roundSeconds(Date.now() - startedAtRef.current);
    const checkResult = checkAnswers(words, answer);
    setResult({ check: checkResult, durationSeconds });
    setPhase('finished');
    if (savedRef.current) return;
    savedRef.current = true;
    const saved = onComplete({
      id: createId(),
      type: 'memory_words',
      completedAt: new Date().toISOString(),
      durationSeconds,
      wordCount: words.length,
      memorizeMinutes: minutes,
      correct: checkResult.found.length,
      missed: checkResult.missed.length,
      extra: checkResult.extra.length,
    });
    setSaveState(saved ? 'saved' : 'failed');
  };

  const backToSetup = () => {
    setDeadline(null);
    setPhase('setup');
  };

  if (phase === 'setup') {
    return (
      <section className="card" aria-labelledby="mem-setup">
        <h2 id="mem-setup" className="card__title">
          Настройки
        </h2>
        <div className="choice">
          <label className="choice__legend" htmlFor="mem-count">
            Количество слов (от {MEMORY_WORDS_MIN} до {MEMORY_WORDS_MAX})
          </label>
          <div className="stepper">
            <button
              type="button"
              className="button"
              aria-label="Меньше слов"
              onClick={() => changeCount((countValid ? parsedCount : wordCount) - 1)}
              disabled={countValid && parsedCount <= MEMORY_WORDS_MIN}
            >
              −
            </button>
            <input
              id="mem-count"
              className="stepper__input"
              type="number"
              inputMode="numeric"
              min={MEMORY_WORDS_MIN}
              max={MEMORY_WORDS_MAX}
              value={countInput}
              onChange={(event) => setCountInput(event.target.value)}
              onBlur={() => countValid && onSettingsChange({ memoryWordCount: parsedCount })}
              aria-invalid={!countValid}
              aria-describedby="mem-count-hint"
            />
            <button
              type="button"
              className="button"
              aria-label="Больше слов"
              onClick={() => changeCount((countValid ? parsedCount : wordCount) + 1)}
              disabled={countValid && parsedCount >= MEMORY_WORDS_MAX}
            >
              +
            </button>
          </div>
          {!countValid && (
            <p id="mem-count-hint" className="alert alert--error" role="alert">
              Введите целое число от {MEMORY_WORDS_MIN} до {MEMORY_WORDS_MAX}.
            </p>
          )}
        </div>
        <Segmented
          name="mem-minutes"
          legend="Время на запоминание"
          options={MINUTE_OPTIONS}
          value={minutes}
          onChange={(memoryMinutes) => onSettingsChange({ memoryMinutes })}
        />
        <p className="muted">
          {countValid ? `${parsedCount} слов, ${minutes} мин. ` : ''}Слова появятся столбцом. Когда время выйдет, они
          исчезнут, и нужно будет записать все слова, которые вы запомнили.
        </p>
        <button
          type="button"
          className="button button--primary button--large"
          onClick={start}
          disabled={!countValid}
        >
          Начать
        </button>
      </section>
    );
  }

  if (phase === 'memorize') {
    return (
      <section className="card" aria-label="Запоминание слов">
        <div className="game-bar">
          <span>
            Осталось: <strong className="mono countdown">{formatClock(remaining)}</strong>
          </span>
          <span>Слов: {words.length}</span>
        </div>
        <ol className="word-column">
          {words.map((word) => (
            <li key={word}>{word}</li>
          ))}
        </ol>
        <div className="actions actions--sticky">
          <button type="button" className="button button--primary" onClick={goToRecall}>
            Запомнил(а) — перейти к ответу
          </button>
          <button type="button" className="button" onClick={backToSetup}>
            Прервать (не сохранять)
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'recall') {
    return (
      <section className="card" aria-labelledby="mem-recall">
        <h2 id="mem-recall" className="card__title">
          Время вышло — запишите слова
        </h2>
        <p className="muted">Порядок не важен. Разделяйте слова пробелом, запятой или новой строкой.</p>
        <label className="field">
          <span className="field__label">Вспомненные слова</span>
          <textarea
            ref={recallRef}
            className="field__textarea"
            rows={8}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <div className="actions">
          <button type="button" className="button button--primary button--large" onClick={check}>
            Проверить
          </button>
          <button type="button" className="button" onClick={backToSetup}>
            Прервать (не сохранять)
          </button>
        </div>
      </section>
    );
  }

  if (!result) return null;
  const { check: checked } = result;
  return (
    <section className="card result" aria-labelledby="mem-result">
      <h2 id="mem-result" className="card__title" tabIndex={-1} ref={resultRef}>
        Результат
      </h2>
      <dl className="stats">
        <Stat label="Вспомнено верно" value={`${checked.found.length} из ${words.length}`} />
        <Stat label="Точность" value={`${percent(checked.found.length, words.length)} %`} />
        <Stat label="Время на запоминание" value={`${minutes} мин`} />
        <Stat label="Длительность" value={formatDuration(result.durationSeconds)} />
      </dl>
      <SaveStatus state={saveState} />
      <div className="chips-grid">
        <WordChips title="Вспомнены" words={checked.found} tone="ok" empty="Пока ни одного." />
        <WordChips title="Забыты" words={checked.missed} tone="missed" empty="Ничего не забыто!" />
        <WordChips title="Лишние или неверные" words={checked.extra} tone="extra" empty="Лишних слов нет." />
      </div>
      <div className="actions">
        <button type="button" className="button button--primary" onClick={start}>
          Новый раунд
        </button>
        <button type="button" className="button" onClick={backToSetup}>
          Изменить настройки
        </button>
      </div>
    </section>
  );
}
