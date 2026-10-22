import { useEffect, useMemo, useRef, useState } from 'react';
import { SaveStatus, type SaveState } from '../../components/SaveStatus';
import { Segmented } from '../../components/Segmented';
import { Stat } from '../../components/Stat';
import { WordChips } from '../../components/WordChips';
import { checkAnswers, percent, type AnswerCheck } from '../../lib/answers';
import { formatDuration, formatStopwatch, roundSeconds } from '../../lib/dateUtils';
import { createId } from '../../lib/storage';
import { useStopwatch } from '../../lib/useStopwatch';
import type { MunsterbergLevel, MunsterbergSession } from '../../types/session';
import { generatePuzzle, MUNSTERBERG_LEVELS, type MunsterbergPuzzle } from './munsterbergUtils';

type Phase = 'setup' | 'playing' | 'finished';

type Props = {
  level: MunsterbergLevel;
  onLevelChange: (level: MunsterbergLevel) => void;
  onComplete: (session: MunsterbergSession) => boolean;
};

const LEVEL_OPTIONS = (Object.keys(MUNSTERBERG_LEVELS) as MunsterbergLevel[]).map((value) => ({
  value,
  label: MUNSTERBERG_LEVELS[value].label,
}));

export function MunsterbergGame({ level, onLevelChange, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [puzzle, setPuzzle] = useState<MunsterbergPuzzle | null>(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<{ check: AnswerCheck; durationSeconds: number } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const stopwatch = useStopwatch();
  const savedRef = useRef(false);
  const resultRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (phase === 'finished') resultRef.current?.focus();
  }, [phase]);

  const start = () => {
    setPuzzle(generatePuzzle(level));
    setAnswer('');
    setResult(null);
    setSaveState('idle');
    savedRef.current = false;
    setPhase('playing');
    stopwatch.start();
  };

  const finish = () => {
    if (!puzzle || phase !== 'playing') return;
    const durationSeconds = roundSeconds(stopwatch.stop());
    const check = checkAnswers(puzzle.targets, answer);
    setResult({ check, durationSeconds });
    setPhase('finished');
    if (savedRef.current) return;
    savedRef.current = true;
    const config = MUNSTERBERG_LEVELS[puzzle.level];
    const saved = onComplete({
      id: createId(),
      type: 'munsterberg',
      completedAt: new Date().toISOString(),
      durationSeconds,
      level: puzzle.level,
      rows: config.rows,
      targetCount: puzzle.targets.length,
      found: check.found.length,
      missed: check.missed.length,
      extra: check.extra.length,
    });
    setSaveState(saved ? 'saved' : 'failed');
  };

  const abort = () => {
    stopwatch.reset();
    setPhase('setup');
    setPuzzle(null);
  };

  // Подсветка целей в таблице — только после проверки.
  const highlighted = useMemo(() => {
    if (!puzzle || phase !== 'finished') return null;
    return puzzle.rows.map((row, index) => {
      const placement = puzzle.placements.find((p) => p.row === index);
      if (!placement) return { before: row, word: '', after: '' };
      return {
        before: row.slice(0, placement.col),
        word: row.slice(placement.col, placement.col + placement.word.length),
        after: row.slice(placement.col + placement.word.length),
      };
    });
  }, [puzzle, phase]);

  if (phase === 'setup') {
    const config = MUNSTERBERG_LEVELS[level];
    return (
      <section className="card" aria-labelledby="mb-setup">
        <h2 id="mb-setup" className="card__title">
          Настройки
        </h2>
        <Segmented name="mb-level" legend="Сложность" options={LEVEL_OPTIONS} value={level} onChange={onLevelChange} />
        <p className="muted">
          {config.rows} строк по 28 букв, спрятано слов: {config.words}. Слова не выделены и стоят внутри сплошного
          ряда букв. Найдите их и впишите в поле ответа через пробел, запятую или с новой строки.
        </p>
        <button type="button" className="button button--primary button--large" onClick={start}>
          Начать
        </button>
      </section>
    );
  }

  if (!puzzle) return null;

  if (phase === 'finished' && result && highlighted) {
    const { check } = result;
    return (
      <section className="card result" aria-labelledby="mb-result">
        <h2 id="mb-result" className="card__title" tabIndex={-1} ref={resultRef}>
          Результат
        </h2>
        <dl className="stats">
          <Stat label="Сложность" value={MUNSTERBERG_LEVELS[puzzle.level].label} />
          <Stat label="Время" value={formatDuration(result.durationSeconds)} />
          <Stat label="Найдено" value={`${check.found.length} из ${puzzle.targets.length}`} />
          <Stat label="Выполнено" value={`${percent(check.found.length, puzzle.targets.length)} %`} />
        </dl>
        <SaveStatus state={saveState} />
        <div className="chips-grid">
          <WordChips title="Найдены" words={check.found} tone="ok" empty="Пока ни одного — получится в следующий раз." />
          <WordChips title="Пропущены" words={check.missed} tone="missed" empty="Пропусков нет." />
          <WordChips title="Лишние ответы" words={check.extra} tone="extra" empty="Лишних ответов нет." />
        </div>
        <details className="details">
          <summary>Показать, где были спрятаны слова</summary>
          <div className="mb-rows" aria-label="Таблица с выделенными словами">
            {highlighted.map((row, index) => (
              <div key={index} className="mb-row">
                {row.before}
                {row.word && <mark className="mb-hit">{row.word}</mark>}
                {row.after}
              </div>
            ))}
          </div>
        </details>
        <div className="actions">
          <button type="button" className="button button--primary" onClick={start}>
            Новый тест
          </button>
          <button type="button" className="button" onClick={abort}>
            Изменить сложность
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card" aria-label="Тест Мюнстерберга">
      <div className="game-bar">
        <span>
          Время: <strong className="mono">{formatStopwatch(stopwatch.elapsedMs)}</strong>
        </span>
        <span>
          {MUNSTERBERG_LEVELS[puzzle.level].label} · слов: {puzzle.targets.length}
        </span>
      </div>
      <div className="mb-rows" aria-label={`Таблица букв: ${puzzle.rows.length} строк`}>
        {puzzle.rows.map((row, index) => (
          <div key={index} className="mb-row">
            {row}
          </div>
        ))}
      </div>
      <label className="field">
        <span className="field__label">Найденные слова</span>
        <textarea
          className="field__textarea field__textarea--short"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          rows={3}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Например: дом, сад, мяч"
        />
      </label>
      <div className="actions actions--sticky">
        <button type="button" className="button button--primary button--large" onClick={finish}>
          Проверить результат
        </button>
        <button type="button" className="button" onClick={abort}>
          Прервать (не сохранять)
        </button>
      </div>
    </section>
  );
}
