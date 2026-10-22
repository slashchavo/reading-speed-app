import { describe, expect, it } from 'vitest';
import type { Session } from '../../types/session';
import { describeSession, sortNewestFirst, summarize } from './progressUtils';

const sessions: Session[] = [
  { id: 'a', type: 'reading', completedAt: '2026-10-01T10:00:00.000Z', durationSeconds: 60, wordCount: 200, wordsPerMinute: 200 },
  { id: 'b', type: 'schulte', completedAt: '2026-10-03T10:00:00.000Z', durationSeconds: 40, gridSize: 5, mode: 'numbers', mistakes: 1 },
  { id: 'c', type: 'reading', completedAt: '2026-10-02T10:00:00.000Z', durationSeconds: 60, wordCount: 300, wordsPerMinute: 300, source: 'builtin', title: 'Т' },
  { id: 'd', type: 'schulte', completedAt: '2026-10-04T10:00:00.000Z', durationSeconds: 35, gridSize: 5, mode: 'cyrillic', mistakes: 0, colorMode: 'color' },
  { id: 'e', type: 'munsterberg', completedAt: '2026-10-05T10:00:00.000Z', durationSeconds: 90, level: 'easy', rows: 30, targetCount: 5, found: 4, missed: 1, extra: 2 },
  { id: 'f', type: 'memory_words', completedAt: '2026-10-06T10:00:00.000Z', durationSeconds: 100, wordCount: 10, memorizeMinutes: 1, correct: 7, missed: 3, extra: 0 },
  { id: 'g', type: 'mnemo_grid', completedAt: '2026-10-07T10:00:00.000Z', durationSeconds: 80, level: 'easy', elementCount: 9, memorizeMinutes: 1, positionAccuracy: 92, colorAccuracy: 78 },
  {
    id: 'h', type: 'alphabet_association', completedAt: '2026-10-08T10:00:00.000Z', durationSeconds: 300, letter: 'Ё', filled: 3, skipped: 9,
    answers: [{ category: 'Животное', answer: 'ёж', warning: false }],
  },
];

describe('progressUtils', () => {
  it('сортирует от новых к старым', () => {
    expect(sortNewestFirst(sessions).map((s) => s.id)).toEqual(['h', 'g', 'f', 'e', 'd', 'b', 'c', 'a']);
  });

  it('считает метрики по каждому типу отдельно', () => {
    const summary = summarize(sessions);
    expect(summary.totalSessions).toBe(8);
    expect(summary.countByType).toEqual({ reading: 2, schulte: 2, munsterberg: 1, memory_words: 1, mnemo_grid: 1, alphabet_association: 1 });
    expect(summary.reading).toEqual({ best: 300, average: 250 });
    expect(summary.schulte.best).toEqual({ 5: 35, 7: null });
    expect(summary.munsterberg.bestPercent).toBe(80);
    expect(summary.memory.averagePercent).toBe(70);
    expect(summary.mnemo).toEqual({ averagePosition: 92, averageColor: 78 });
    expect(summary.alphabet.letters).toBe(1);
    expect(summary.lastSession?.id).toBe('h');
  });

  it('пустая история — без фиктивных значений', () => {
    const summary = summarize([]);
    expect(summary.totalSessions).toBe(0);
    expect(summary.reading.best).toBeNull();
    expect(summary.lastSession).toBeNull();
  });

  it('описание записей, включая старые записи без новых полей', () => {
    expect(describeSession(sessions[1] as Session)).toBe('5×5, числа, чёрно-белый · ошибок: 1');
    expect(describeSession(sessions[3] as Session)).toBe('5×5, кириллица, цветной · ошибок: 0');
    expect(describeSession(sessions[0] as Session)).toBe('200 слов/мин · 200 слов');
  });
});
