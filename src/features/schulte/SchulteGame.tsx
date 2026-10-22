import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameStage } from '../../components/GameStage';
import { SaveStatus, type SaveState } from '../../components/SaveStatus';
import { Segmented } from '../../components/Segmented';
import { Stat } from '../../components/Stat';
import { formatClock, formatDuration, roundSeconds } from '../../lib/dateUtils';
import { createId } from '../../lib/storage';
import { useCountdown } from '../../lib/useCountdown';
import type { ColorMode, GridSize, SchulteMode, SchulteOrder, SchulteSession, Settings, SymbolSize } from '../../types/session';
import { SchulteBoard } from './SchulteBoard';
import {
  assignColors,
  colorModeLabel,
  createBoard,
  createSequence,
  gridLabel,
  modeLabel,
  orderHint,
  orderLabel,
  orderTargets,
  SCHULTE_PALETTE,
  SYMBOL_SIZES,
  tapTarget,
  type SessionProgress,
} from './schulteUtils';

type Phase = 'setup' | 'playing' | 'finished';
type Minutes = 1 | 2 | 3 | 4 | 5;

/** Параметры, зафиксированные в момент старта: изменение настроек не влияет на идущую сессию. */
type RoundConfig = {
  size: GridSize;
  mode: SchulteMode;
  order: SchulteOrder;
  colorMode: ColorMode;
  symbolSize: SymbolSize;
  minutes: Minutes;
};

type Table = { cells: (string | null)[]; colors: (string | null)[] };

type Props = {
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onComplete: (session: SchulteSession) => boolean;
};

const SIZE_OPTIONS = [
  { value: 5, label: '5×5' },
  { value: 7, label: '7×7' },
] as const;
const MODE_OPTIONS = [
  { value: 'numbers', label: 'Числа' },
  { value: 'letters', label: 'Латиница' },
  { value: 'cyrillic', label: 'Кириллица' },
] as const;
const ORDER_OPTIONS = [
  { value: 'forward', label: 'Прямой' },
  { value: 'reverse', label: 'Обратный' },
] as const;
const COLOR_OPTIONS = [
  { value: 'mono', label: 'Чёрно-белый' },
  { value: 'color', label: 'Цветной' },
] as const;
const SYMBOL_OPTIONS = ([1, 2, 3, 4, 5] as const).map((value) => ({ value, label: SYMBOL_SIZES[value].label }));
const MINUTE_OPTIONS = ([1, 2, 3, 4, 5] as const).map((value) => ({ value, label: `${value} мин` }));

function newTable(config: RoundConfig): { table: Table; targets: string[] } {
  const sequence = createSequence(config.size, config.mode);
  const cells = createBoard(sequence, config.size);
  return { table: { cells, colors: assignColors(cells, config.colorMode) }, targets: orderTargets(sequence, config.order) };
}

export function SchulteGame({ settings, onSettingsChange, onComplete }: Props) {
  const config: RoundConfig = {
    size: settings.schulteGridSize,
    mode: settings.schulteMode,
    order: settings.schulteOrder,
    colorMode: settings.schulteColorMode,
    symbolSize: settings.schulteSymbolSize,
    minutes: settings.schulteMinutes,
  };
  const [phase, setPhase] = useState<Phase>('setup');
  const [round, setRound] = useState<RoundConfig>(config);
  const [table, setTable] = useState<Table>({ cells: [], colors: [] });
  const [progress, setProgress] = useState<SessionProgress>({ targets: [], index: 0, correct: 0, wrong: 0, tablesCompleted: 0 });
  const [deadline, setDeadline] = useState<number | null>(null);
  const [wrongCell, setWrongCell] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [previewPx, setPreviewPx] = useState(0);
  const startedAtRef = useRef(0);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const savedRef = useRef(false);
  const timers = useRef<number[]>([]);
  const resultRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
  useEffect(() => {
    if (phase === 'finished') resultRef.current?.focus();
  }, [phase]);

  // Предпросмотр с реальной сеткой, палитрой и размером символа. Обновляется при изменении настроек.
  const preview = useMemo(
    () => newTable(config).table,
    [config.size, config.mode, config.colorMode, config.order],
  );

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  /** Конец сессии по таймеру: результат сохраняется ровно один раз. */
  const finishSession = useCallback(() => {
    setDeadline(null);
    if (phaseRef.current !== 'playing') return;
    phaseRef.current = 'finished';
    const seconds = roundSeconds(Date.now() - startedAtRef.current);
    setElapsedSeconds(seconds);
    setPhase('finished');
    if (savedRef.current) return;
    savedRef.current = true;
    const final = progressRef.current;
    const saved = onComplete({
      id: createId(),
      type: 'schulte',
      completedAt: new Date().toISOString(),
      durationSeconds: seconds,
      gridSize: round.size,
      mode: round.mode,
      mistakes: final.wrong,
      colorMode: round.colorMode,
      sessionMinutes: round.minutes,
      tablesCompleted: final.tablesCompleted,
      correctTaps: final.correct,
      order: round.order,
      symbolSize: round.symbolSize,
    });
    setSaveState(saved ? 'saved' : 'failed');
  }, [onComplete, round]);

  const remaining = useCountdown(phase === 'playing' ? deadline : null, finishSession);

  const start = () => {
    const fixed = { ...config };
    const first = newTable(fixed);
    setRound(fixed);
    setTable(first.table);
    setProgress({ targets: first.targets, index: 0, correct: 0, wrong: 0, tablesCompleted: 0 });
    setWrongCell(null);
    setFlash(null);
    setSaveState('idle');
    savedRef.current = false;
    startedAtRef.current = Date.now();
    setDeadline(Date.now() + fixed.minutes * 60_000);
    setPhase('playing');
  };

  const abort = () => {
    setDeadline(null);
    setPhase('setup');
  };

  const handleTap = (value: string | null) => {
    if (phase !== 'playing' || Date.now() >= (deadline ?? 0)) return;
    const step = tapTarget(progress, value);
    if (step.outcome === 'ignored') return;
    if (step.outcome === 'wrong') {
      setProgress(step.progress);
      setWrongCell(value);
      later(() => setWrongCell((current) => (current === value ? null : current)), 500);
      return;
    }
    if (step.outcome === 'table-complete') {
      // Сразу новая таблица с теми же параметрами, поиск снова с начала последовательности.
      const next = newTable(round);
      setTable(next.table);
      setProgress({ ...step.progress, targets: next.targets, index: 0 });
      setFlash(`Таблица ${step.progress.tablesCompleted} пройдена!`);
      later(() => setFlash(null), 1200);
      return;
    }
    setProgress(step.progress);
  };

  if (phase === 'setup') {
    return (
      <section className="card" aria-labelledby="schulte-setup-title">
        <h2 id="schulte-setup-title" className="card__title">
          Настройки
        </h2>
        <div className="schulte-setup">
          <div>
            <Segmented name="sh-size" legend="Размер таблицы" options={SIZE_OPTIONS} value={config.size} onChange={(schulteGridSize) => onSettingsChange({ schulteGridSize })} />
            <Segmented name="sh-mode" legend="Содержимое" options={MODE_OPTIONS} value={config.mode} onChange={(schulteMode) => onSettingsChange({ schulteMode })} />
            <Segmented name="sh-order" legend="Порядок поиска" options={ORDER_OPTIONS} value={config.order} onChange={(schulteOrder) => onSettingsChange({ schulteOrder })} />
            <Segmented name="sh-color" legend="Цвет символов" options={COLOR_OPTIONS} value={config.colorMode} onChange={(schulteColorMode) => onSettingsChange({ schulteColorMode })} />
            <Segmented name="sh-symbol" legend="Размер символа" options={SYMBOL_OPTIONS} value={config.symbolSize} onChange={(schulteSymbolSize) => onSettingsChange({ schulteSymbolSize })} />
            <Segmented name="sh-minutes" legend="Длительность сессии" options={MINUTE_OPTIONS} value={config.minutes} onChange={(schulteMinutes) => onSettingsChange({ schulteMinutes })} />
          </div>
          <div className="schulte-preview">
            <p className="field__label">Предпросмотр</p>
            <SchulteBoard
              size={config.size}
              cells={preview.cells}
              colors={preview.colors}
              symbolSize={config.symbolSize}
              onFontPx={setPreviewPx}
              label="Предпросмотр таблицы"
            />
            <p className="muted schulte-preview__note">
              Размер символа: {SYMBOL_SIZES[config.symbolSize].label.toLowerCase()}
              {previewPx > 0 ? ` (сейчас ${previewPx} px)` : ''}.
              {config.colorMode === 'color' && ` Цвета: ${SCHULTE_PALETTE.map((c) => c.name).join(', ')}.`}
            </p>
          </div>
        </div>
        <p className="muted">
          {orderHint(config.size, config.mode, config.order)} За {config.minutes} мин пройдите как можно больше таблиц:
          после последней цели сразу появится новая. Засчитываются только полностью пройденные таблицы.
        </p>
        <button type="button" className="button button--primary button--large" onClick={start}>
          Начать тренировку
        </button>
      </section>
    );
  }

  if (phase === 'finished') {
    return (
      <section className="card result" aria-labelledby="schulte-result-title">
        <h2 id="schulte-result-title" className="card__title" tabIndex={-1} ref={resultRef}>
          Сессия завершена
        </h2>
        <dl className="stats">
          <Stat label="Пройдено таблиц" value={String(progress.tablesCompleted)} />
          <Stat label="Верных нажатий" value={String(progress.correct)} />
          <Stat label="Ошибок" value={String(progress.wrong)} />
          <Stat label="Время сессии" value={formatDuration(elapsedSeconds)} />
        </dl>
        <p className="muted">
          {gridLabel(round.size)}, {modeLabel(round.mode)}, {orderLabel(round.order)}, {colorModeLabel(round.colorMode)},
          сессия {round.minutes} мин.
        </p>
        <SaveStatus state={saveState} />
        <div className="actions">
          <button type="button" className="button button--primary" onClick={start}>
            Новая сессия
          </button>
          <button type="button" className="button" onClick={abort}>
            Изменить настройки
          </button>
        </div>
      </section>
    );
  }

  const target = progress.targets[progress.index] ?? '';
  const found = new Set(progress.targets.slice(0, progress.index));

  return (
    <GameStage label="Тренировка Шульте">
      <div className="stage-bar">
        <div className="schulte__target">
          <span className="muted">Найдите:</span>{' '}
          <strong className="schulte__target-value" aria-live="polite">
            {target}
          </strong>
        </div>
        <div className="stage-bar__stats">
          <span>
            <strong className="mono countdown">{formatClock(remaining)}</strong>
          </span>
          <span>
            Таблиц: <strong>{progress.tablesCompleted}</strong>
          </span>
          <span>
            Ошибок: <strong>{progress.wrong}</strong>
          </span>
        </div>
      </div>
      <p className="stage-flash" aria-live="polite">
        {flash ?? ' '}
      </p>
      <p className="visually-hidden" aria-live="assertive">
        {wrongCell ? `Ошибка: ${wrongCell}. Нужно найти ${target}.` : ''}
      </p>
      <div className="stage-board">
        <SchulteBoard
          size={round.size}
          cells={table.cells}
          colors={table.colors}
          symbolSize={round.symbolSize}
          found={found}
          wrongCell={wrongCell}
          onTap={handleTap}
          label="Таблица"
        />
      </div>
      <div className="stage-actions">
        <button type="button" className="button" onClick={abort}>
          Прервать (не сохранять)
        </button>
      </div>
    </GameStage>
  );
}
