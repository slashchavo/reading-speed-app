import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SaveStatus, type SaveState } from '../../components/SaveStatus';
import { Segmented } from '../../components/Segmented';
import { Stat } from '../../components/Stat';
import { formatClock, formatDuration, roundSeconds } from '../../lib/dateUtils';
import { createId } from '../../lib/storage';
import { useCountdown } from '../../lib/useCountdown';
import type { MnemoGridSession, MnemoLevel } from '../../types/session';
import { MnemoGlyphView } from './MnemoGlyphView';
import {
  cellLabel,
  emptyColors,
  emptyPlacement,
  evaluateRound,
  generateRound,
  GRID_CELLS,
  MNEMO_COLORS,
  MNEMO_LEVELS,
  occupantOf,
  placeElement,
  removeElement,
  type ColorChoice,
  type MnemoElement,
  type MnemoEvaluation,
  type MnemoRound,
  type Placement,
} from './mnemoUtils';
import { shuffle } from '../../lib/random';

type Phase = 'setup' | 'memorize' | 'restore' | 'finished';
type Minutes = 1 | 2 | 3 | 4 | 5;

type Props = {
  level: MnemoLevel;
  minutes: Minutes;
  onSettingsChange: (patch: { mnemoLevel?: MnemoLevel; mnemoMinutes?: Minutes }) => void;
  onComplete: (session: MnemoGridSession) => boolean;
};

const LEVEL_OPTIONS = (Object.keys(MNEMO_LEVELS) as MnemoLevel[]).map((value) => ({
  value,
  label: MNEMO_LEVELS[value].label,
}));
const MINUTE_OPTIONS = ([1, 2, 3, 4, 5] as const).map((value) => ({ value, label: `${value} мин` }));
const CELLS = Array.from({ length: GRID_CELLS }, (_, i) => i);
const COLOR_BY_ID = new Map(MNEMO_COLORS.map((c) => [c.id, c]));

function colorHex(id: string | null | undefined): string | null {
  return id ? (COLOR_BY_ID.get(id)?.hex ?? null) : null;
}

function colorName(id: string | null | undefined): string {
  return id ? (COLOR_BY_ID.get(id)?.name.toLowerCase() ?? 'без цвета') : 'цвет не выбран';
}

/** Сетка 5×5 только для просмотра: исходное поле или ответ пользователя. */
function StaticGrid({
  label,
  elements,
  cellOf,
  colorOf,
}: {
  label: string;
  elements: readonly MnemoElement[];
  cellOf: (element: MnemoElement) => number | null;
  colorOf: (element: MnemoElement) => string | null;
}) {
  return (
    <div className="mnemo-grid" role="img" aria-label={label}>
      {CELLS.map((cell) => {
        const element = elements.find((e) => cellOf(e) === cell);
        return (
          <div key={cell} className="mnemo-cell mnemo-cell--static">
            {element && <MnemoGlyphView glyph={element} color={colorOf(element)} />}
          </div>
        );
      })}
    </div>
  );
}

export function MnemoGame({ level, minutes, onSettingsChange, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [round, setRound] = useState<MnemoRound | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [trayOrder, setTrayOrder] = useState<string[]>([]);
  const [placement, setPlacement] = useState<Placement>({});
  const [colors, setColors] = useState<ColorChoice>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [evaluation, setEvaluation] = useState<MnemoEvaluation | null>(null);
  const [restoreSeconds, setRestoreSeconds] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const restoreStartRef = useRef(0);
  const savedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const toRestore = useCallback(() => {
    setDeadline(null);
    setPhase((current) => {
      if (current !== 'memorize') return current;
      restoreStartRef.current = Date.now();
      return 'restore';
    });
  }, []);

  const remaining = useCountdown(phase === 'memorize' ? deadline : null, toRestore);

  useEffect(() => {
    if (phase === 'restore' || phase === 'finished') headingRef.current?.focus();
  }, [phase]);

  const elementsById = useMemo(() => new Map((round?.elements ?? []).map((e) => [e.id, e])), [round]);

  const start = () => {
    const next = generateRound(level);
    setRound(next);
    setTrayOrder(shuffle(next.elements.map((e) => e.id)));
    setPlacement(emptyPlacement(next.elements));
    setColors(emptyColors(next.elements));
    setSelected(null);
    setConfirming(false);
    setEvaluation(null);
    setSaveState('idle');
    savedRef.current = false;
    setDeadline(Date.now() + minutes * 60_000);
    setPhase('memorize');
  };

  const backToSetup = () => {
    setDeadline(null);
    setPhase('setup');
  };

  const handleCell = (cell: number) => {
    const occupant = occupantOf(placement, cell);
    if (selected) {
      if (occupant === selected) {
        setSelected(null);
        return;
      }
      setPlacement(placeElement(placement, selected, cell));
      setConfirming(false);
      return;
    }
    if (occupant) setSelected(occupant);
  };

  const chooseColor = (colorId: string) => {
    if (!selected) return;
    setColors({ ...colors, [selected]: colorId });
    setConfirming(false);
  };

  const finish = () => {
    if (!round || phase !== 'restore') return;
    const result = evaluateRound(round, placement, colors);
    const seconds = roundSeconds(Date.now() - restoreStartRef.current);
    setEvaluation(result);
    setRestoreSeconds(seconds);
    setPhase('finished');
    if (savedRef.current) return;
    savedRef.current = true;
    const saved = onComplete({
      id: createId(),
      type: 'mnemo_grid',
      completedAt: new Date().toISOString(),
      durationSeconds: seconds,
      level: round.level,
      elementCount: round.elements.length,
      memorizeMinutes: minutes,
      positionAccuracy: result.positionAccuracy,
      colorAccuracy: result.colorAccuracy,
    });
    setSaveState(saved ? 'saved' : 'failed');
  };

  const requestCheck = () => {
    if (!round) return;
    const unplaced = round.elements.filter((e) => placement[e.id] === null).length;
    const uncolored = round.elements.filter((e) => colors[e.id] === null).length;
    if (unplaced > 0 || uncolored > 0) {
      setConfirming(true);
      return;
    }
    finish();
  };

  if (phase === 'setup') {
    const config = MNEMO_LEVELS[level];
    return (
      <section className="card" aria-labelledby="mnemo-setup">
        <h2 id="mnemo-setup" className="card__title">
          Настройки
        </h2>
        <Segmented
          name="mnemo-level"
          legend="Сложность"
          options={LEVEL_OPTIONS}
          value={level}
          onChange={(mnemoLevel) => onSettingsChange({ mnemoLevel })}
        />
        <Segmented
          name="mnemo-minutes"
          legend="Время на запоминание"
          options={MINUTE_OPTIONS}
          value={minutes}
          onChange={(mnemoMinutes) => onSettingsChange({ mnemoMinutes })}
        />
        <p className="muted">
          Поле 5×5, элементов: {config.elements} ({config.description}), цветов: {config.colors}. Запомните, где стоит
          каждый элемент и какого он цвета. Потом элементы станут чёрно-белыми и перемешаются — расставьте их обратно и
          выберите цвета.
        </p>
        <button type="button" className="button button--primary button--large" onClick={start}>
          Начать
        </button>
      </section>
    );
  }

  if (!round) return null;

  if (phase === 'memorize') {
    return (
      <section className="card" aria-label="Запоминание мнемотаблицы">
        <div className="game-bar">
          <span>
            Осталось: <strong className="mono countdown">{formatClock(remaining)}</strong>
          </span>
          <span>
            {MNEMO_LEVELS[round.level].label} · элементов: {round.elements.length}
          </span>
        </div>
        <StaticGrid
          label="Исходное поле для запоминания"
          elements={round.elements}
          cellOf={(e) => e.cell}
          colorOf={(e) => colorHex(e.colorId)}
        />
        <p className="muted mnemo-legend">
          Цвета этого раунда: {round.palette.map((c) => c.name.toLowerCase()).join(', ')}.
        </p>
        <div className="actions">
          <button type="button" className="button button--primary" onClick={toRestore}>
            Готово — перейти к восстановлению
          </button>
          <button type="button" className="button" onClick={backToSetup}>
            Прервать (не сохранять)
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'restore') {
    const selectedElement = selected ? elementsById.get(selected) : undefined;
    const tray = trayOrder.filter((id) => placement[id] === null);
    const unplaced = tray.length;
    const uncolored = round.elements.filter((e) => colors[e.id] === null).length;
    return (
      <section className="card" aria-labelledby="mnemo-restore">
        <h2 id="mnemo-restore" className="card__title" tabIndex={-1} ref={headingRef}>
          Восстановите поле
        </h2>
        <p className="muted">
          Коснитесь элемента, затем клетки, куда его поставить, и выберите цвет. Элемент на поле можно выбрать снова,
          чтобы переставить, сменить цвет или убрать.
        </p>
        <div className="mnemo-grid" role="group" aria-label="Поле 5×5 для восстановления">
          {CELLS.map((cell) => {
            const occupantId = occupantOf(placement, cell);
            const occupant = occupantId ? elementsById.get(occupantId) : undefined;
            const isSelected = occupantId !== null && occupantId === selected;
            const label = occupant
              ? `${cellLabel(cell)}: ${occupant.name}, ${colorName(colors[occupant.id])}`
              : `${cellLabel(cell)}: пусто`;
            return (
              <button
                key={cell}
                type="button"
                className={`mnemo-cell${isSelected ? ' mnemo-cell--selected' : ''}${selected && !occupant ? ' mnemo-cell--target' : ''}`}
                onClick={() => handleCell(cell)}
                aria-label={label}
                aria-pressed={isSelected}
              >
                {occupant && <MnemoGlyphView glyph={occupant} color={colorHex(colors[occupant.id])} />}
                {occupant && colors[occupant.id] === null && (
                  <span className="mnemo-cell__badge" aria-hidden="true">
                    ?
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mnemo-controls">
          <h3 className="mnemo-controls__title">
            {selectedElement ? `Выбран: ${selectedElement.name}` : 'Элемент не выбран'}
          </h3>
          <div className="mnemo-palette" role="group" aria-label="Цвет выбранного элемента">
            {round.palette.map((color) => (
              <button
                key={color.id}
                type="button"
                className="mnemo-swatch"
                onClick={() => chooseColor(color.id)}
                disabled={!selectedElement}
                aria-pressed={selectedElement ? colors[selectedElement.id] === color.id : false}
              >
                <span className="mnemo-swatch__dot" style={{ background: color.hex }} aria-hidden="true" />
                {color.name}
              </button>
            ))}
          </div>
          {selectedElement && placement[selectedElement.id] !== null && (
            <button
              type="button"
              className="button button--small"
              onClick={() => {
                setPlacement(removeElement(placement, selectedElement.id));
                setSelected(null);
              }}
            >
              Убрать с поля
            </button>
          )}
        </div>

        <h3 className="mnemo-controls__title">Набор элементов: {unplaced}</h3>
        {unplaced === 0 ? (
          <p className="muted">Все элементы на поле.</p>
        ) : (
          <div className="mnemo-tray" role="group" aria-label="Элементы для расстановки">
            {tray.map((id) => {
              const element = elementsById.get(id);
              if (!element) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className={`mnemo-cell mnemo-cell--tray${selected === id ? ' mnemo-cell--selected' : ''}`}
                  onClick={() => setSelected(selected === id ? null : id)}
                  aria-pressed={selected === id}
                  aria-label={`${element.name}, ${colorName(colors[id])}`}
                >
                  <MnemoGlyphView glyph={element} color={colorHex(colors[id])} />
                </button>
              );
            })}
          </div>
        )}

        {confirming && (
          <div className="alert alert--warning" role="alert">
            <p>
              {unplaced > 0 && `Не размещено элементов: ${unplaced}. `}
              {uncolored > 0 && `Без выбранного цвета: ${uncolored}. `}
              Они будут засчитаны как ошибки. Проверить ответ так?
            </p>
            <div className="actions actions--compact">
              <button type="button" className="button button--primary" onClick={finish}>
                Да, проверить
              </button>
              <button type="button" className="button" onClick={() => setConfirming(false)}>
                Продолжить расстановку
              </button>
            </div>
          </div>
        )}
        <div className="actions">
          <button type="button" className="button button--primary button--large" onClick={requestCheck}>
            Проверить
          </button>
          <button type="button" className="button" onClick={backToSetup}>
            Прервать (не сохранять)
          </button>
        </div>
      </section>
    );
  }

  if (!evaluation) return null;
  return (
    <section className="card result" aria-labelledby="mnemo-result">
      <h2 id="mnemo-result" className="card__title" tabIndex={-1} ref={headingRef}>
        Результат
      </h2>
      <dl className="stats">
        <Stat label="Элементы на своих местах" value={`${evaluation.positionsCorrect} из ${round.elements.length}`} />
        <Stat label="Точность положения (25 клеток)" value={`${evaluation.positionAccuracy} %`} />
        <Stat label="Верные цвета" value={`${evaluation.colorsCorrect} из ${round.elements.length} · ${evaluation.colorAccuracy} %`} />
        <Stat label="Общий результат" value={`${evaluation.overall} %`} />
        <Stat label="Восстановление заняло" value={formatDuration(restoreSeconds)} />
      </dl>
      <SaveStatus state={saveState} />
      <div className="mnemo-compare">
        <figure>
          <figcaption>Исходное поле</figcaption>
          <StaticGrid label="Исходное поле" elements={round.elements} cellOf={(e) => e.cell} colorOf={(e) => colorHex(e.colorId)} />
        </figure>
        <figure>
          <figcaption>Ваш ответ</figcaption>
          <StaticGrid
            label="Ваш ответ"
            elements={round.elements}
            cellOf={(e) => placement[e.id] ?? null}
            colorOf={(e) => colorHex(colors[e.id]) ?? null}
          />
        </figure>
      </div>
      <h3 className="chips-block__title">Ошибки: {evaluation.errors.length}</h3>
      {evaluation.errors.length === 0 ? (
        <p className="muted">Ошибок нет — поле восстановлено полностью.</p>
      ) : (
        <ul className="mnemo-errors">
          {evaluation.errors.map((error) => {
            const element = elementsById.get(error.elementId);
            if (!element) return null;
            const placed = placement[element.id] ?? null;
            const parts: string[] = [];
            if (error.wrongPosition) {
              parts.push(
                placed === null
                  ? `не размещён (был: ${cellLabel(element.cell)})`
                  : `место: ${cellLabel(placed)}, а был: ${cellLabel(element.cell)}`,
              );
            }
            if (error.wrongColor) parts.push(`цвет: ${colorName(colors[element.id])}, а был: ${colorName(element.colorId)}`);
            return (
              <li key={error.elementId}>
                <span className="mnemo-errors__glyph">
                  <MnemoGlyphView glyph={element} color={colorHex(element.colorId)} />
                </span>
                <span>
                  <strong>{element.name}</strong> — {parts.join('; ')}
                </span>
              </li>
            );
          })}
        </ul>
      )}
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
