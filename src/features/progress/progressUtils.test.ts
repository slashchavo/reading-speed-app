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

const stage3: Session[] = [
  {
    id: 's1', type: 'schulte', completedAt: '2026-10-09T10:00:00.000Z', durationSeconds: 120, gridSize: 7, mode: 'cyrillic', mistakes: 4,
    colorMode: 'color', sessionMinutes: 2, tablesCompleted: 3, correctTaps: 99, order: 'reverse', symbolSize: 3,
  },
  { id: 'c1', type: 'color_match', completedAt: '2026-10-10T10:00:00.000Z', durationSeconds: 60, durationMinutes: 1, attempts: 40, correct: 30, wrong: 10 },
  { id: 'c2', type: 'color_match', completedAt: '2026-10-10T11:00:00.000Z', durationSeconds: 60, durationMinutes: 1, attempts: 20, correct: 18, wrong: 2 },
  { id: 't1', type: 'triangle_field', completedAt: '2026-10-11T10:00:00.000Z', durationSeconds: 300, mode: 'complete', found: 99, mistakes: 5, completed: true },
  { id: 't2', type: 'triangle_field', completedAt: '2026-10-11T11:00:00.000Z', durationSeconds: 60, mode: 'timed', timeLimitMinutes: 1, found: 31, mistakes: 2, completed: false },
];

describe('progressUtils', () => {
  it('сортирует от новых к старым', () => {
    expect(sortNewestFirst(sessions).map((s) => s.id)).toEqual(['h', 'g', 'f', 'e', 'd', 'b', 'c', 'a']);
  });

  it('считает метрики по каждому типу отдельно', () => {
    const summary = summarize(sessions);
    expect(summary.totalSessions).toBe(8);
    expect(summary.countByType).toEqual({
      reading: 2, schulte: 2, munsterberg: 1, memory_words: 1, mnemo_grid: 1, alphabet_association: 1, color_match: 0, triangle_field: 0,
    });
    expect(summary.reading).toEqual({ best: 300, average: 250 });
    expect(summary.schulte.best).toEqual({ 5: 35, 7: null });
    expect(summary.munsterberg.bestPercent).toBe(80);
    expect(summary.memory.averagePercent).toBe(70);
    expect(summary.mnemo).toEqual({ averagePosition: 92, averageColor: 78 });
    expect(summary.alphabet.letters).toBe(1);
    expect(summary.lastSession?.id).toBe('h');
  });

  it('новые типы и сессии Шульте не смешиваются со старыми метриками', () => {
    const summary = summarize([...sessions, ...stage3]);
    expect(summary.schulte.best).toEqual({ 5: 35, 7: null });
    expect(summary.schulte.bestSession).toEqual({ tables: 3, minutes: 2, gridSize: 7 });
    expect(summary.colorMatch).toEqual({ bestAccuracy: 90, averageAccuracy: 83 });
    expect(summary.triangle).toEqual({ bestCompleteSeconds: 300, bestFound: 99 });
    expect(describeSession(stage3[0] as Session)).toBe('7×7, кириллица, цветной, обратный порядок · таблиц: 3 за 2 мин · ошибок: 4');
    expect(describeSession(stage3[1] as Session)).toBe('верно 30 из 40 (75 %) · ошибок: 10 · 1 мин');
    expect(describeSession(stage3[4] as Session)).toBe('на время, 1 мин · найдено 31 из 99 · ошибок: 2');
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
