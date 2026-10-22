import type { GridSize, ReadingSession, SchulteSession, Session } from '../../types/session';

export type ProgressSummary = {
  totalSessions: number;
  readingCount: number;
  schulteCount: number;
  bestWordsPerMinute: number | null;
  averageWordsPerMinute: number | null;
  bestSchulteSeconds: Record<GridSize, number | null>;
  lastSession: Session | null;
};

function timeOf(session: Session): number {
  const time = Date.parse(session.completedAt);
  return Number.isNaN(time) ? 0 : time;
}

/** Сессии от новых к старым. Исходный массив не изменяется. */
export function sortNewestFirst(sessions: readonly Session[]): Session[] {
  return [...sessions].sort((a, b) => timeOf(b) - timeOf(a));
}

export function summarize(sessions: readonly Session[]): ProgressSummary {
  const reading = sessions.filter((s): s is ReadingSession => s.type === 'reading');
  const schulte = sessions.filter((s): s is SchulteSession => s.type === 'schulte');

  const bestFor = (size: GridSize): number | null => {
    const times = schulte.filter((s) => s.gridSize === size).map((s) => s.durationSeconds);
    return times.length > 0 ? Math.min(...times) : null;
  };

  const speeds = reading.map((s) => s.wordsPerMinute);

  return {
    totalSessions: sessions.length,
    readingCount: reading.length,
    schulteCount: schulte.length,
    bestWordsPerMinute: speeds.length > 0 ? Math.max(...speeds) : null,
    averageWordsPerMinute:
      speeds.length > 0 ? Math.round(speeds.reduce((sum, value) => sum + value, 0) / speeds.length) : null,
    bestSchulteSeconds: { 5: bestFor(5), 7: bestFor(7) },
    lastSession: sortNewestFirst(sessions)[0] ?? null,
  };
}

export function sessionTypeLabel(session: Session): string {
  return session.type === 'reading' ? 'Чтение' : 'Таблица Шульте';
}
