import { describe, expect, it } from 'vitest';
import type { Session } from '../../types/session';
import { sortNewestFirst, summarize } from './progressUtils';

const sessions: Session[] = [
  { id: 'a', type: 'reading', completedAt: '2026-10-01T10:00:00.000Z', durationSeconds: 60, wordCount: 200, wordsPerMinute: 200 },
  { id: 'b', type: 'schulte', completedAt: '2026-10-03T10:00:00.000Z', durationSeconds: 40, gridSize: 5, mode: 'numbers', mistakes: 1 },
  { id: 'c', type: 'reading', completedAt: '2026-10-02T10:00:00.000Z', durationSeconds: 60, wordCount: 300, wordsPerMinute: 300 },
  { id: 'd', type: 'schulte', completedAt: '2026-10-04T10:00:00.000Z', durationSeconds: 35, gridSize: 5, mode: 'letters', mistakes: 0 },
];

describe('progressUtils', () => {
  it('сортирует от новых к старым', () => {
    expect(sortNewestFirst(sessions).map((s) => s.id)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('считает сводку', () => {
    const summary = summarize(sessions);
    expect(summary.totalSessions).toBe(4);
    expect(summary.bestWordsPerMinute).toBe(300);
    expect(summary.averageWordsPerMinute).toBe(250);
    expect(summary.bestSchulteSeconds).toEqual({ 5: 35, 7: null });
    expect(summary.lastSession?.id).toBe('d');
  });

  it('пустая история — без фиктивных значений', () => {
    const summary = summarize([]);
    expect(summary.totalSessions).toBe(0);
    expect(summary.bestWordsPerMinute).toBeNull();
    expect(summary.lastSession).toBeNull();
  });
});
