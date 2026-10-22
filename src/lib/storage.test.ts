import { describe, expect, it } from 'vitest';
import type { Session } from '../types/session';
import { mergeSessions, parseBackup } from './backup';
import {
  DEFAULT_SETTINGS,
  loadSessions,
  loadSettings,
  saveSessions,
  SESSIONS_KEY,
  SETTINGS_KEY,
  type KeyValueStorage,
} from './storage';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const valid: Session = {
  id: '1',
  type: 'reading',
  completedAt: '2026-10-01T10:00:00.000Z',
  durationSeconds: 60,
  wordCount: 200,
  wordsPerMinute: 200,
};

const newTypes: Session[] = [
  { id: 'm', type: 'munsterberg', completedAt: '2026-10-02T10:00:00.000Z', durationSeconds: 50, level: 'hard', rows: 50, targetCount: 11, found: 9, missed: 2, extra: 1 },
  { id: 'w', type: 'memory_words', completedAt: '2026-10-02T10:00:00.000Z', durationSeconds: 90, wordCount: 20, memorizeMinutes: 2, correct: 12, missed: 8, extra: 3 },
  { id: 'g', type: 'mnemo_grid', completedAt: '2026-10-02T10:00:00.000Z', durationSeconds: 70, level: 'expert', elementCount: 25, memorizeMinutes: 5, positionAccuracy: 64, colorAccuracy: 40 },
  {
    id: 'a', type: 'alphabet_association', completedAt: '2026-10-02T10:00:00.000Z', durationSeconds: 200, letter: 'Ъ', filled: 0, skipped: 12,
    answers: [{ category: 'Животное', answer: null, warning: false }],
  },
  { id: 's', type: 'schulte', completedAt: '2026-10-02T10:00:00.000Z', durationSeconds: 30, gridSize: 7, mode: 'cyrillic', mistakes: 2, colorMode: 'color' },
  { id: 'r', type: 'reading', completedAt: '2026-10-02T10:00:00.000Z', durationSeconds: 60, wordCount: 320, wordsPerMinute: 320, source: 'builtin', textId: 'lib-01', title: 'Облака' },
];

describe('loadSessions', () => {
  it('пустое хранилище — пустая история без ошибки', () => {
    expect(loadSessions(memoryStorage())).toEqual({ sessions: [], issue: 'none' });
  });

  it('история первого этапа читается без миграции', () => {
    const legacy = [
      valid,
      { id: '2', type: 'schulte', completedAt: '2026-10-01T11:00:00.000Z', durationSeconds: 40, gridSize: 5, mode: 'letters', mistakes: 1 },
    ];
    const result = loadSessions(memoryStorage({ [SESSIONS_KEY]: JSON.stringify(legacy) }));
    expect(result.issue).toBe('none');
    expect(result.sessions).toEqual(legacy);
  });

  it('все новые типы сохраняются и читаются обратно', () => {
    const storage = memoryStorage();
    expect(saveSessions([valid, ...newTypes], storage)).toBe(true);
    expect(loadSessions(storage)).toEqual({ sessions: [valid, ...newTypes], issue: 'none' });
  });

  it('повреждённый JSON не роняет приложение', () => {
    expect(loadSessions(memoryStorage({ [SESSIONS_KEY]: '{не json' }))).toEqual({ sessions: [], issue: 'corrupted' });
    expect(loadSessions(memoryStorage({ [SESSIONS_KEY]: '{"a":1}' }))).toEqual({ sessions: [], issue: 'corrupted' });
  });

  it('некорректные записи пропускаются, корректные остаются', () => {
    const raw = JSON.stringify([
      valid,
      { id: 'x', type: 'reading' },
      null,
      { ...valid, id: '2', wordsPerMinute: 'быстро' },
      { ...newTypes[2], positionAccuracy: 150 },
      { ...newTypes[0], level: 'super' },
      { id: 'z', type: 'unknown', completedAt: valid.completedAt, durationSeconds: 1 },
    ]);
    expect(loadSessions(memoryStorage({ [SESSIONS_KEY]: raw }))).toEqual({ sessions: [valid], issue: 'corrupted' });
  });

  it('недоступное хранилище', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(loadSessions(broken).issue).toBe('unavailable');
    expect(saveSessions([valid], broken)).toBe(false);
    expect(loadSessions(null).issue).toBe('unavailable');
  });
});

describe('loadSettings', () => {
  it('значения по умолчанию и исправление неверных', () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS);
    const raw = JSON.stringify({ readerFontSize: 999, schulteGridSize: 6, schulteMode: 'letters', memoryWordCount: 500, mnemoMinutes: 9 });
    expect(loadSettings(memoryStorage({ [SETTINGS_KEY]: raw }))).toEqual({
      ...DEFAULT_SETTINGS,
      readerFontSize: 32,
      schulteMode: 'letters',
      memoryWordCount: 50,
    });
  });

  it('настройки первого этапа дополняются значениями по умолчанию', () => {
    const raw = JSON.stringify({ readerFontSize: 20, schulteGridSize: 7, schulteMode: 'numbers' });
    expect(loadSettings(memoryStorage({ [SETTINGS_KEY]: raw }))).toEqual({
      ...DEFAULT_SETTINGS,
      readerFontSize: 20,
      schulteGridSize: 7,
    });
  });
});

describe('резервная копия', () => {
  it('проверяет формат и версию', () => {
    expect(parseBackup({ app: 'другое' })).toMatch(/не файл резервной копии/);
    expect(parseBackup({ app: 'focus-app', version: 99, sessions: [] })).toMatch(/версия/);
    expect(parseBackup({ app: 'focus-app', version: 1 })).toMatch(/нет списка/);
    const ok = parseBackup({ app: 'focus-app', version: 1, sessions: [valid, { bad: true }], settings: {} });
    expect(typeof ok).toBe('object');
    if (typeof ok === 'object') {
      expect(ok.sessions).toEqual([valid]);
      expect(ok.skipped).toBe(1);
      expect(ok.settings).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('объединение не создаёт дублей', () => {
    const { merged, added } = mergeSessions([valid], [valid, ...newTypes]);
    expect(added).toBe(newTypes.length);
    expect(merged).toHaveLength(newTypes.length + 1);
  });
});
