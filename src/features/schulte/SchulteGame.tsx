import { useEffect, useRef, useState } from 'react';
import { SaveStatus, type SaveState } from '../../components/SaveStatus';
import { formatDuration, formatStopwatch } from '../../lib/dateUtils';
import { createId } from '../../lib/storage';
import { useStopwatch } from '../../lib/useStopwatch';
import type { ColorMode, GridSize, SchulteMode, SchulteSession } from '../../types/session';
import { shuffle } from '../../lib/random';
import { assignColors, colorModeLabel, createSequence, gridLabel, modeLabel, orderHint } from './schulteUtils';

type Phase = 'setup' | 'playing' | 'finished';

type SchulteGameProps = {
  gridSize: GridSize;
  mode: SchulteMode;
  colorMode: ColorMode;
  onGridSizeChange: (size: GridSize) => void;
  onModeChange: (mode: SchulteMode) => void;
  onColorModeChange: (colorMode: ColorMode) => void;
  onComplete: (session: SchulteSession) => boolean;
};

type Result = {
  durationSeconds: number;
  mistakes: number;
};

const MODES: { value: SchulteMode; label: string }[] = [
  { value: 'numbers', label: 'Числа' },
  { value: 'letters', label: 'Латиница' },
  { value: 'cyrillic', label: 'Кириллица' },
];

export function SchulteGame({
  gridSize,
  mode,
  colorMode,
  onGridSizeChange,
  onModeChange,
  onColorModeChange,
  onComplete,
}: SchulteGameProps) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [grid, setGrid] = useState<string[]>([]);
  const [colors, setColors] = useState<(string | null)[]>([]);
  const [sequence, setSequence] = useState<string[]>([]);
  const [nextIndex, setNextIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [wrongCell, setWrongCell] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const stopwatch = useStopwatch();
  const wrongTimeout = useRef<number | null>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  // Очищаем таймер подсветки ошибки при размонтировании.
  useEffect(
    () => () => {
      if (wrongTimeout.current !== null) window.clearTimeout(wrongTimeout.current);
    },
    [],
  );

  useEffect(() => {
    if (phase === 'finished') resultRef.current?.focus();
  }, [phase]);

  const start = () => {
    const nextSequence = createSequence(gridSize, mode);
    setSequence(nextSequence);
    setGrid(shuffle(nextSequence));
    setColors(assignColors(nextSequence.length, colorMode));
    setNextIndex(0);
    setMistakes(0);
    setWrongCell(null);
    setResult(null);
    setSaveState('idle');
    setPhase('playing');
    stopwatch.start();
  };

  const backToSetup = () => {
    stopwatch.reset();
    setPhase('setup');
    setResult(null);
  };

  const flashWrong = (value: string) => {
    setWrongCell(value);
    if (wrongTimeout.current !== null) window.clearTimeout(wrongTimeout.current);
    wrongTimeout.current = window.setTimeout(() => setWrongCell(null), 600);
  };

  const handleCellClick = (value: string) => {
    if (phase !== 'playing') return;
    const foundIndex = sequence.indexOf(value);
    // Уже найденные элементы игнорируем: это не ошибка, а повторное нажатие.
    if (foundIndex !== -1 && foundIndex < nextIndex) return;

    if (value !== sequence[nextIndex]) {
      setMistakes((count) => count + 1);
      flashWrong(value);
      return;
    }

    const newIndex = nextIndex + 1;
    setNextIndex(newIndex);
    if (newIndex < sequence.length) return;

    // Последний элемент найден — останавливаем секундомер и сохраняем результат один раз.
    const durationSeconds = Math.round(stopwatch.stop() / 100) / 10;
    const finalResult: Result = { durationSeconds, mistakes };
    setResult(finalResult);
    setPhase('finished');
    const saved = onComplete({
      id: createId(),
      type: 'schulte',
      completedAt: new Date().toISOString(),
      durationSeconds,
      gridSize,
      mode,
      mistakes,
      colorMode,
    });
    setSaveState(saved ? 'saved' : 'failed');
  };

  if (phase === 'setup') {
    return (
      <section className="card" aria-labelledby="schulte-setup-title">
        <h2 id="schulte-setup-title" className="card__title">
          Настройки
        </h2>
        <fieldset className="choice">
          <legend className="choice__legend">Размер сетки</legend>
          <div className="segmented">
            {([5, 7] as const).map((size) => (
              <label key={size} className="segmented__option">
                <input
                  type="radio"
                  name="grid-size"
                  value={size}
                  checked={gridSize === size}
                  onChange={() => onGridSizeChange(size)}
                />
                <span>{gridLabel(size)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="choice">
          <legend className="choice__legend">Содержимое</legend>
          <div className="segmented">
            {MODES.map((item) => (
              <label key={item.value} className="segmented__option">
                <input
                  type="radio"
                  name="grid-mode"
                  value={item.value}
                  checked={mode === item.value}
                  onChange={() => onModeChange(item.value)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="choice">
          <legend className="choice__legend">Цвет символов</legend>
          <div className="segmented">
            {(['mono', 'color'] as const).map((value) => (
              <label key={value} className="segmented__option">
                <input
                  type="radio"
                  name="grid-color"
                  value={value}
                  checked={colorMode === value}
                  onChange={() => onColorModeChange(value)}
                />
                <span>{value === 'mono' ? 'Чёрно-белый' : 'Цветной'}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="muted">
          {orderHint(gridSize, mode)}{' '}
          Старайтесь смотреть в центр таблицы и находить элементы периферическим зрением.
        </p>
        <button type="button" className="button button--primary button--large" onClick={start}>
          Начать тренировку
        </button>
      </section>
    );
  }

  if (phase === 'finished' && result) {
    return (
      <section className="card result" aria-labelledby="schulte-result-title">
        <h2 id="schulte-result-title" className="card__title" tabIndex={-1} ref={resultRef}>
          Готово!
        </h2>
        <dl className="stats">
          <div className="stat">
            <dt className="stat__label">Время</dt>
            <dd className="stat__value">{formatDuration(result.durationSeconds)}</dd>
          </div>
          <div className="stat">
            <dt className="stat__label">Ошибки</dt>
            <dd className="stat__value">{result.mistakes}</dd>
          </div>
          <div className="stat">
            <dt className="stat__label">Таблица</dt>
            <dd className="stat__value">
              {gridLabel(gridSize)}, {modeLabel(mode)}, {colorModeLabel(colorMode)}
            </dd>
          </div>
        </dl>
        <SaveStatus state={saveState} />
        <div className="actions">
          <button type="button" className="button button--primary" onClick={start}>
            Повторить
          </button>
          <button type="button" className="button" onClick={backToSetup}>
            Изменить настройки
          </button>
        </div>
      </section>
    );
  }

  const target = sequence[nextIndex] ?? '';

  return (
    <section className="schulte" aria-label="Тренировка Шульте">
      <div className="schulte__status">
        <div className="schulte__target">
          <span className="muted">Найдите:</span>{' '}
          <strong className="schulte__target-value" aria-live="polite">
            {target}
          </strong>
        </div>
        <div className="schulte__meta">
          <span>
            Время: <strong className="mono">{formatStopwatch(stopwatch.elapsedMs)}</strong>
          </span>
          <span>
            Ошибки: <strong>{mistakes}</strong>
          </span>
          <span>
            Найдено: <strong>{nextIndex}</strong> из {sequence.length}
          </span>
        </div>
      </div>
      <p className="visually-hidden" aria-live="assertive">
        {wrongCell ? `Ошибка: ${wrongCell}. Нужно найти ${target}.` : ''}
      </p>
      <div className={`schulte__grid schulte__grid--${gridSize}`} role="group" aria-label="Таблица">
        {grid.map((value, position) => {
          const color = colors[position] ?? null;
          const index = sequence.indexOf(value);
          const found = index < nextIndex;
          const wrong = wrongCell === value;
          const className = ['cell', found ? 'cell--found' : '', wrong ? 'cell--wrong' : '', value.length > 1 ? 'cell--pair' : '']
            .join(' ')
            .trim();
          return (
            <button
              key={value}
              type="button"
              className={className}
              onClick={() => handleCellClick(value)}
              aria-label={found ? `${value}, найдено` : value}
              aria-disabled={found || undefined}
              style={color && !found && !wrong ? { color } : undefined}
            >
              {value}
              {wrong && (
                <span className="cell__mark" aria-hidden="true">
                  ✕
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="actions">
        <button type="button" className="button" onClick={backToSetup}>
          Прервать (не сохранять)
        </button>
      </div>
    </section>
  );
}
