import { formatDuration } from '../../lib/dateUtils';
import type {
  AlphabetSession,
  ColorMatchSession,
  TriangleFieldSession,
  GridSize,
  MemoryWordsSession,
  MnemoGridSession,
  MunsterbergSession,
  ReadingSession,
  SchulteSession,
  Session,
  TrainingType,
} from '../../types/session';
import { MNEMO_LEVELS } from '../mnemo/mnemoUtils';
import { MUNSTERBERG_LEVELS } from '../munsterberg/munsterbergUtils';
import { colorModeLabel, gridLabel, modeLabel, orderLabel } from '../schulte/schulteUtils';

export const TRAINING_LABELS: Record<TrainingType, string> = {
  reading: 'Чтение',
  schulte: 'Таблица Шульте',
  munsterberg: 'Тест Мюнстерберга',
  memory_words: 'Память на слова',
  mnemo_grid: 'Мнемотаблица',
  alphabet_association: 'От А до Я',
  color_match: 'Совпадает ли цвет?',
  triangle_field: 'Треугольное поле',
};

function timeOf(session: Session): number {
  const time = Date.parse(session.completedAt);
  return Number.isNaN(time) ? 0 : time;
}

/** Сессии от новых к старым. Исходный массив не изменяется. */
export function sortNewestFirst(sessions: readonly Session[]): Session[] {
  return [...sessions].sort((a, b) => timeOf(b) - timeOf(a));
}

function ofType<T extends Session['type']>(sessions: readonly Session[], type: T): Extract<Session, { type: T }>[] {
  return sessions.filter((s): s is Extract<Session, { type: T }> => s.type === type);
}

const avg = (values: number[]): number | null =>
  values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
const max = (values: number[]): number | null => (values.length > 0 ? Math.max(...values) : null);
const min = (values: number[]): number | null => (values.length > 0 ? Math.min(...values) : null);
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

export type ProgressSummary = {
  totalSessions: number;
  countByType: Record<TrainingType, number>;
  lastSession: Session | null;
  reading: { best: number | null; average: number | null };
  schulte: {
    /** Лучшее время одной таблицы — только по старым записям (до сессионного режима). */
    best: Record<GridSize, number | null>;
    /** Лучшая сессия по числу пройденных таблиц. */
    bestSession: { tables: number; minutes: number; gridSize: GridSize } | null;
  };
  munsterberg: { bestPercent: number | null; averagePercent: number | null };
  memory: { bestPercent: number | null; averagePercent: number | null };
  mnemo: { averagePosition: number | null; averageColor: number | null };
  alphabet: { letters: number; averageFilled: number | null };
  colorMatch: { bestAccuracy: number | null; averageAccuracy: number | null };
  triangle: { bestCompleteSeconds: number | null; bestFound: number | null };
};

export function summarize(sessions: readonly Session[]): ProgressSummary {
  const reading = ofType(sessions, 'reading');
  const schulte = ofType(sessions, 'schulte');
  const munsterberg = ofType(sessions, 'munsterberg');
  const memory = ofType(sessions, 'memory_words');
  const mnemo = ofType(sessions, 'mnemo_grid');
  const alphabet = ofType(sessions, 'alphabet_association');
  const colorMatch = ofType(sessions, 'color_match');
  const triangle = ofType(sessions, 'triangle_field');
  const legacySchulte = schulte.filter((s) => s.tablesCompleted === undefined);
  const sessionSchulte = schulte.filter((s) => s.tablesCompleted !== undefined);
  const schulteBest = (size: GridSize) => min(legacySchulte.filter((s) => s.gridSize === size).map((s) => s.durationSeconds));
  const bestSession = sessionSchulte.reduce<SchulteSession | null>(
    (best, s) => (best === null || (s.tablesCompleted ?? 0) > (best.tablesCompleted ?? 0) ? s : best),
    null,
  );
  const cmAccuracy = colorMatch.map((s) => pct(s.correct, s.attempts));
  const mbPercents = munsterberg.map((s) => pct(s.found, s.targetCount));
  const memPercents = memory.map((s) => pct(s.correct, s.wordCount));

  return {
    totalSessions: sessions.length,
    countByType: {
      reading: reading.length,
      schulte: schulte.length,
      munsterberg: munsterberg.length,
      memory_words: memory.length,
      mnemo_grid: mnemo.length,
      alphabet_association: alphabet.length,
      color_match: colorMatch.length,
      triangle_field: triangle.length,
    },
    lastSession: sortNewestFirst(sessions)[0] ?? null,
    reading: { best: max(reading.map((s) => s.wordsPerMinute)), average: avg(reading.map((s) => s.wordsPerMinute)) },
    schulte: {
      best: { 5: schulteBest(5), 7: schulteBest(7) },
      bestSession: bestSession
        ? { tables: bestSession.tablesCompleted ?? 0, minutes: bestSession.sessionMinutes ?? 0, gridSize: bestSession.gridSize }
        : null,
    },
    munsterberg: { bestPercent: max(mbPercents), averagePercent: avg(mbPercents) },
    memory: { bestPercent: max(memPercents), averagePercent: avg(memPercents) },
    mnemo: { averagePosition: avg(mnemo.map((s) => s.positionAccuracy)), averageColor: avg(mnemo.map((s) => s.colorAccuracy)) },
    alphabet: { letters: new Set(alphabet.map((s) => s.letter)).size, averageFilled: avg(alphabet.map((s) => s.filled)) },
    colorMatch: { bestAccuracy: max(cmAccuracy), averageAccuracy: avg(cmAccuracy) },
    triangle: {
      bestCompleteSeconds: min(triangle.filter((s) => s.mode === 'complete' && s.completed).map((s) => s.durationSeconds)),
      bestFound: max(triangle.map((s) => s.found)),
    },
  };
}

export function sessionTypeLabel(session: Session): string {
  return TRAINING_LABELS[session.type];
}

const READING_SOURCE = { builtin: 'текст библиотеки', custom: 'свой текст', book: 'книга' } as const;

/** Краткое описание результата для списка истории. */
export function describeSession(session: Session): string {
  switch (session.type) {
    case 'reading':
      return describeReading(session);
    case 'schulte':
      return describeSchulte(session);
    case 'munsterberg':
      return describeMunsterberg(session);
    case 'memory_words':
      return describeMemory(session);
    case 'mnemo_grid':
      return describeMnemo(session);
    case 'alphabet_association':
      return describeAlphabet(session);
    case 'color_match':
      return describeColorMatch(session);
    case 'triangle_field':
      return describeTriangle(session);
  }
}

function describeReading(s: ReadingSession): string {
  const source = s.source ? ` · ${READING_SOURCE[s.source]}` : '';
  const title = s.title ? ` «${s.title}»` : '';
  return `${s.wordsPerMinute} слов/мин · ${s.wordCount} слов${source}${title}`;
}

function describeSchulte(s: SchulteSession): string {
  const base = `${gridLabel(s.gridSize)}, ${modeLabel(s.mode)}, ${colorModeLabel(s.colorMode)}`;
  if (s.tablesCompleted === undefined) return `${base} · ошибок: ${s.mistakes}`;
  return `${base}, ${orderLabel(s.order)} · таблиц: ${s.tablesCompleted} за ${s.sessionMinutes ?? '?'} мин · ошибок: ${s.mistakes}`;
}

function describeMunsterberg(s: MunsterbergSession): string {
  const head = `${MUNSTERBERG_LEVELS[s.level].label}: найдено ${s.found} из ${s.targetCount} (${pct(s.found, s.targetCount)} %)`;
  // Старые записи — ручной ввод с лишними словами; новые — отметка касанием.
  return s.wrongTaps === undefined ? `${head} · лишних: ${s.extra}` : `${head} · касаний мимо: ${s.wrongTaps}`;
}

function describeMemory(s: MemoryWordsSession): string {
  return `${s.correct} из ${s.wordCount} слов (${pct(s.correct, s.wordCount)} %) · ${s.memorizeMinutes} мин · лишних: ${s.extra}`;
}

function describeMnemo(s: MnemoGridSession): string {
  return `${MNEMO_LEVELS[s.level].label}, ${s.elementCount} эл. · положение ${s.positionAccuracy} % · цвет ${s.colorAccuracy} %`;
}

function describeColorMatch(s: ColorMatchSession): string {
  return `верно ${s.correct} из ${s.attempts} (${pct(s.correct, s.attempts)} %) · ошибок: ${s.wrong} · ${s.durationMinutes} мин`;
}

function describeTriangle(s: TriangleFieldSession): string {
  const mode = s.mode === 'timed' ? `на время, ${s.timeLimitMinutes ?? '?'} мин` : 'до конца';
  return `${mode} · найдено ${s.found} из 99${s.completed ? ' (всё поле)' : ''} · ошибок: ${s.mistakes}`;
}

function describeAlphabet(s: AlphabetSession): string {
  return `Буква «${s.letter}» · заполнено ${s.filled} из ${s.filled + s.skipped}, пропущено ${s.skipped}`;
}

export function durationText(session: Session): string {
  return formatDuration(session.durationSeconds);
}
