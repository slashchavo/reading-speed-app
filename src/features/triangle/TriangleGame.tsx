import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { GameStage } from '../../components/GameStage';
import { SaveStatus, type SaveState } from '../../components/SaveStatus';
import { Segmented } from '../../components/Segmented';
import { Stat } from '../../components/Stat';
import { formatClock, formatDuration, roundSeconds } from '../../lib/dateUtils';
import { createId } from '../../lib/storage';
import { useCountdown, useElapsed } from '../../lib/useCountdown';
import { useElementWidth } from '../../lib/useElementWidth';
import type { TriangleFieldSession, TriangleMode } from '../../types/session';
import {
  buildGeometry,
  chooseLayout,
  createRound,
  foundCount,
  layoutWidthInBases,
  tapNumber,
  TRIANGLE_COLORS,
  TRIANGLE_COUNT,
  triangleAccuracy,
  type LayoutId,
  type TriangleProgress,
  type TriangleRound,
} from './triangleUtils';

type Phase = 'setup' | 'playing' | 'finished';
type Minutes = 1 | 2 | 3 | 4 | 5;

type Props = {
  mode: TriangleMode;
  minutes: Minutes;
  onSettingsChange: (patch: { triangleMode?: TriangleMode; triangleMinutes?: Minutes }) => void;
  onComplete: (session: TriangleFieldSession) => boolean;
};

const MODE_OPTIONS = [
  { value: 'timed', label: 'На время' },
  { value: 'complete', label: 'До конца' },
] as const;
const MINUTE_OPTIONS = ([1, 2, 3, 4, 5] as const).map((value) => ({ value, label: `${value} мин` }));
/** Минимальное основание треугольника: меньше — числа трудно читать и нажимать. */
const MIN_BASE = 44;

type Field = { round: TriangleRound; layout: LayoutId };

function TriangleField({
  field,
  progress,
  wrong,
  onTap,
}: {
  field: Field;
  progress: TriangleProgress;
  wrong: number | null;
  onTap: (value: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useElementWidth(ref);
  // Раскладка зафиксирована на весь раунд; при повороте экрана меняется только масштаб.
  const base = Math.max(MIN_BASE, (width || 600) / layoutWidthInBases(field.layout));
  const geometry = buildGeometry(field.layout, base);
  const fontSize = Math.max(13, Math.round(base * 0.26));

  return (
    <div ref={ref} className="tri-field">
      <svg
        className="tri-svg"
        width={geometry.width}
        height={geometry.height}
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        role="group"
        aria-label="Треугольное поле с числами от 1 до 99"
      >
        {geometry.cells.map((cell) => {
          const value = field.round.numbers[cell.index] ?? 0;
          const color = TRIANGLE_COLORS[field.round.colors[value] ?? 'red'];
          const done = value < progress.next;
          const isWrong = wrong === value;
          const handleKey = (event: KeyboardEvent<SVGGElement>) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onTap(value);
            }
          };
          return (
            <g
              key={cell.index}
              className={`tri-cell${done ? ' tri-cell--done' : ''}${isWrong ? ' tri-cell--wrong' : ''}`}
              onClick={() => onTap(value)}
              onKeyDown={handleKey}
              role="button"
              tabIndex={0}
              aria-label={done ? `${value}, найдено` : `${value}, ${color.name}`}
            >
              <polygon points={cell.points} fill={done ? '#e9ecef' : color.fill} />
              <text
                x={cell.cx}
                y={cell.cy}
                fontSize={fontSize}
                fill={done ? '#868e96' : color.text}
                textAnchor="middle"
                dominantBaseline="central"
                textDecoration={done ? 'line-through' : undefined}
              >
                {value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function TriangleGame({ mode, minutes, onSettingsChange, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [field, setField] = useState<Field | null>(null);
  const [progress, setProgress] = useState<TriangleProgress>({ next: 1, mistakes: 0 });
  const [wrong, setWrong] = useState<number | null>(null);
  const [roundMode, setRoundMode] = useState<TriangleMode>(mode);
  const [roundMinutes, setRoundMinutes] = useState<Minutes>(minutes);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const savedRef = useRef(false);
  const previousRound = useRef<TriangleRound | null>(null);
  const wrongTimer = useRef<number | null>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => {
    if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
  }, []);
  useEffect(() => {
    if (phase === 'finished') resultRef.current?.focus();
  }, [phase]);

  const finish = useCallback(
    (final: TriangleProgress) => {
      setDeadline(null);
      if (phaseRef.current !== 'playing') return;
      phaseRef.current = 'finished';
      const seconds = roundSeconds(Date.now() - (startedAt ?? Date.now()));
      setElapsed(seconds);
      setPhase('finished');
      if (savedRef.current) return;
      savedRef.current = true;
      const found = foundCount(final);
      const saved = onComplete({
        id: createId(),
        type: 'triangle_field',
        completedAt: new Date().toISOString(),
        durationSeconds: seconds,
        mode: roundMode,
        ...(roundMode === 'timed' ? { timeLimitMinutes: roundMinutes } : {}),
        found,
        mistakes: final.mistakes,
        completed: found === TRIANGLE_COUNT,
      });
      setSaveState(saved ? 'saved' : 'failed');
    },
    [onComplete, roundMinutes, roundMode, startedAt],
  );

  const remaining = useCountdown(phase === 'playing' && roundMode === 'timed' ? deadline : null, () =>
    finish(progressRef.current),
  );
  const stopwatch = useElapsed(phase === 'playing' && roundMode === 'complete' ? startedAt : null);

  const start = () => {
    const round = createRound(previousRound.current);
    previousRound.current = round;
    // Раскладку выбираем по ширине экрана в момент старта.
    const available = Math.min(window.innerWidth, 1200) - 32;
    setField({ round, layout: chooseLayout(available, MIN_BASE) });
    setProgress({ next: 1, mistakes: 0 });
    setWrong(null);
    setRoundMode(mode);
    setRoundMinutes(minutes);
    setSaveState('idle');
    savedRef.current = false;
    const now = Date.now();
    setStartedAt(now);
    setDeadline(mode === 'timed' ? now + minutes * 60_000 : null);
    setPhase('playing');
  };

  const handleTap = (value: number) => {
    if (phaseRef.current !== 'playing') return;
    if (roundMode === 'timed' && deadline !== null && Date.now() >= deadline) return;
    const step = tapNumber(progress, value);
    if (step.outcome === 'ignored') return;
    setProgress(step.progress);
    if (step.outcome === 'wrong') {
      setWrong(value);
      if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
      wrongTimer.current = window.setTimeout(() => setWrong(null), 500);
    }
    if (step.outcome === 'finished') finish(step.progress);
  };

  if (phase === 'setup') {
    return (
      <section className="card" aria-labelledby="tri-setup">
        <h2 id="tri-setup" className="card__title">
          Настройки
        </h2>
        <p>
          На поле 99 треугольников с числами от 1 до 99. Находите и нажимайте числа <strong>по порядку</strong>: 1, 2, 3 …
          99. Цвет треугольника только помогает искать — на порядок он не влияет.
        </p>
        <Segmented
          name="tri-mode"
          legend="Режим"
          options={MODE_OPTIONS}
          value={mode}
          onChange={(triangleMode) => onSettingsChange({ triangleMode })}
        />
        {mode === 'timed' ? (
          <Segmented
            name="tri-minutes"
            legend="Время"
            options={MINUTE_OPTIONS}
            value={minutes}
            onChange={(triangleMinutes) => onSettingsChange({ triangleMinutes })}
          />
        ) : (
          <p className="muted">Секундомер идёт от 00:00 до последнего числа 99.</p>
        )}
        <button type="button" className="button button--primary button--large" onClick={start}>
          Начать
        </button>
      </section>
    );
  }

  if (phase === 'finished') {
    const found = foundCount(progress);
    return (
      <section className="card result" aria-labelledby="tri-result">
        <h2 id="tri-result" className="card__title" tabIndex={-1} ref={resultRef}>
          {found === TRIANGLE_COUNT ? 'Поле пройдено!' : 'Время вышло'}
        </h2>
        <dl className="stats">
          <Stat label="Режим" value={roundMode === 'timed' ? `На время, ${roundMinutes} мин` : 'До конца'} />
          <Stat label="Найдено чисел" value={`${found} из ${TRIANGLE_COUNT}`} />
          <Stat label="Ошибок" value={String(progress.mistakes)} />
          <Stat label="Точность" value={`${triangleAccuracy(found, progress.mistakes)} %`} />
          <Stat label={roundMode === 'complete' ? 'Полное время' : 'Длительность'} value={formatDuration(elapsed)} />
        </dl>
        <SaveStatus state={saveState} />
        <div className="actions">
          <button type="button" className="button button--primary" onClick={start}>
            Новое поле
          </button>
          <button type="button" className="button" onClick={() => setPhase('setup')}>
            Изменить режим
          </button>
        </div>
      </section>
    );
  }

  if (!field) return null;
  return (
    <GameStage label="Треугольное поле">
      <div className="stage-bar">
        <div className="schulte__target">
          <span className="muted">Найди:</span>{' '}
          <strong className="schulte__target-value" aria-live="polite">
            {progress.next}
          </strong>
        </div>
        <div className="stage-bar__stats">
          <strong className="mono countdown">{formatClock(roundMode === 'timed' ? remaining : stopwatch)}</strong>
          <span>
            Найдено: <strong>{foundCount(progress)}</strong>
          </span>
          <span>
            Ошибок: <strong>{progress.mistakes}</strong>
          </span>
        </div>
      </div>
      <p className="visually-hidden" aria-live="assertive">
        {wrong ? `Ошибка: ${wrong}. Нужно найти ${progress.next}.` : ''}
      </p>
      <TriangleField field={field} progress={progress} wrong={wrong} onTap={handleTap} />
      <div className="stage-actions">
        <button type="button" className="button" onClick={() => setPhase('setup')}>
          Прервать (не сохранять)
        </button>
      </div>
    </GameStage>
  );
}
