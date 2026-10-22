import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { SaveStatus, type SaveState } from '../../components/SaveStatus';
import { Segmented } from '../../components/Segmented';
import { Stat } from '../../components/Stat';
import { WordChips } from '../../components/WordChips';
import { percent } from '../../lib/answers';
import { formatDuration, formatStopwatch, roundSeconds } from '../../lib/dateUtils';
import { createId } from '../../lib/storage';
import { useElementWidth } from '../../lib/useElementWidth';
import { useStopwatch } from '../../lib/useStopwatch';
import type { MunsterbergLevel, MunsterbergSession } from '../../types/session';
import {
  evaluateSelection,
  generatePuzzle,
  MUNSTERBERG_LEVELS,
  rowLengthForWidth,
  rowSegments,
  toggleWord,
  type MunsterbergPuzzle,
  type TapResult,
} from './munsterbergUtils';

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

/** Ширина буквы моноширинного шрифта относительно его размера (с небольшим запасом). */
const CHAR_RATIO = 0.62;
const MAX_FONT = 26;

export function MunsterbergGame({ level, onLevelChange, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [puzzle, setPuzzle] = useState<MunsterbergPuzzle | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [wrongTaps, setWrongTaps] = useState(0);
  const [result, setResult] = useState<{ tap: TapResult; durationSeconds: number } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const stopwatch = useStopwatch();
  const savedRef = useRef(false);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const areaWidth = useElementWidth(areaRef);

  useEffect(() => {
    if (phase === 'finished') resultRef.current?.focus();
  }, [phase]);

  const start = () => {
    // Длина строки выбирается один раз при старте под текущую ширину и не меняется до конца теста.
    const width = areaRef.current?.clientWidth ?? areaWidth;
    setPuzzle(generatePuzzle(level, rowLengthForWidth(width)));
    setSelected(new Set());
    setWrongTaps(0);
    setResult(null);
    setSaveState('idle');
    savedRef.current = false;
    setPhase('playing');
    stopwatch.start();
  };

  const finish = () => {
    if (!puzzle || phase !== 'playing') return;
    const durationSeconds = roundSeconds(stopwatch.stop());
    const tap = evaluateSelection(puzzle, selected);
    setResult({ tap, durationSeconds });
    setPhase('finished');
    if (savedRef.current) return;
    savedRef.current = true;
    const saved = onComplete({
      id: createId(),
      type: 'munsterberg',
      completedAt: new Date().toISOString(),
      durationSeconds,
      level: puzzle.level,
      rows: puzzle.rows.length,
      targetCount: puzzle.targets.length,
      found: tap.found.length,
      missed: tap.missed.length,
      extra: 0,
      wrongTaps,
      rowLength: puzzle.rowLength,
    });
    setSaveState(saved ? 'saved' : 'failed');
  };

  const abort = () => {
    stopwatch.reset();
    setPhase('setup');
    setPuzzle(null);
  };

  /** Касания обрабатываются на всём блоке: скрытые слова не являются отдельными кнопками и ничем не выделяются. */
  const handleTap = (event: MouseEvent<HTMLDivElement>) => {
    if (phase !== 'playing') return;
    const target = event.target as HTMLElement;
    const word = target.closest<HTMLElement>('[data-word]');
    if (word) {
      setSelected((current) => toggleWord(current, Number(word.dataset.word)));
      return;
    }
    if (target.closest('.mb-row')) setWrongTaps((count) => count + 1);
  };

  const fontSize = puzzle && areaWidth > 0 ? Math.min(MAX_FONT, areaWidth / (puzzle.rowLength * CHAR_RATIO)) : undefined;

  const renderRows = (current: MunsterbergPuzzle, reveal: boolean) =>
    current.rows.map((_, rowIndex) => (
      <div key={rowIndex} className="mb-row">
        {rowSegments(current, rowIndex).map((segment, segmentIndex) => {
          if (segment.wordIndex === null) return <span key={segmentIndex}>{segment.text}</span>;
          const isSelected = selected.has(segment.wordIndex);
          const className = reveal
            ? isSelected
              ? 'mb-word mb-word--found'
              : 'mb-word mb-word--missed'
            : isSelected
              ? 'mb-word mb-word--selected'
              : 'mb-word';
          return (
            <span key={segmentIndex} className={className} data-word={reveal ? undefined : segment.wordIndex}>
              {segment.text}
            </span>
          );
        })}
      </div>
    ));

  const config = MUNSTERBERG_LEVELS[level];

  return (
    <>
      {phase === 'setup' && (
        <section className="card" aria-labelledby="mb-setup">
          <h2 id="mb-setup" className="card__title">
            Настройки
          </h2>
          <Segmented name="mb-level" legend="Сложность" options={LEVEL_OPTIONS} value={level} onChange={onLevelChange} />
          <p className="muted">
            {config.rows} строк, спрятано слов: {config.words} (каждое не короче 5 букв). Слова ничем не выделены и стоят
            внутри сплошного ряда букв. Найдите слово и коснитесь любой его буквы — оно отметится. Повторное касание
            снимает отметку. Когда закончите, нажмите «Завершить тест».
          </p>
          <button type="button" className="button button--primary button--large" onClick={start}>
            Начать
          </button>
        </section>
      )}

      {phase === 'finished' && puzzle && result && (
        <section className="card result" aria-labelledby="mb-result">
          <h2 id="mb-result" className="card__title" tabIndex={-1} ref={resultRef}>
            Результат
          </h2>
          <dl className="stats">
            <Stat label="Сложность" value={MUNSTERBERG_LEVELS[puzzle.level].label} />
            <Stat label="Время" value={formatDuration(result.durationSeconds)} />
            <Stat label="Найдено" value={`${result.tap.found.length} из ${puzzle.targets.length}`} />
            <Stat label="Выполнено" value={`${percent(result.tap.found.length, puzzle.targets.length)} %`} />
            <Stat label="Касаний мимо слов" value={String(wrongTaps)} />
          </dl>
          <SaveStatus state={saveState} />
          <div className="chips-grid">
            <WordChips title="Найдены" words={result.tap.found} tone="ok" empty="Пока ни одного — получится в следующий раз." />
            <WordChips title="Пропущены" words={result.tap.missed} tone="missed" empty="Пропусков нет!" />
          </div>
          <div className="actions">
            <button type="button" className="button button--primary" onClick={start}>
              Новый тест
            </button>
            <button type="button" className="button" onClick={abort}>
              Изменить сложность
            </button>
          </div>
          <h3 className="chips-block__title">Где были слова</h3>
          <p className="muted">Найденные подчёркнуты сплошной линией, пропущенные — пунктиром.</p>
        </section>
      )}

      {phase === 'playing' && puzzle && (
        <div className="game-bar mb-bar">
          <span>
            Время: <strong className="mono">{formatStopwatch(stopwatch.elapsedMs)}</strong>
          </span>
          <span>
            {MUNSTERBERG_LEVELS[puzzle.level].label} · отмечено: <strong>{selected.size}</strong> из {puzzle.targets.length}
          </span>
        </div>
      )}

      {/* Блок всегда в разметке, чтобы до старта измерить доступную ширину. */}
      <div ref={areaRef} className="mb-area">
        {puzzle && phase !== 'setup' && (
          <div
            className={`mb-rows${phase === 'playing' ? ' mb-rows--active' : ''}`}
            style={{ fontSize }}
            onClick={handleTap}
            aria-label={`Таблица букв: ${puzzle.rows.length} строк по ${puzzle.rowLength} букв`}
          >
            {renderRows(puzzle, phase === 'finished')}
          </div>
        )}
      </div>

      {phase === 'playing' && (
        <div className="actions actions--sticky mb-actions">
          <button type="button" className="button button--primary button--large" onClick={finish}>
            Завершить тест
          </button>
          <button type="button" className="button" onClick={abort}>
            Прервать (не сохранять)
          </button>
        </div>
      )}
    </>
  );
}
