import { describe, expect, it } from 'vitest';
import type { Session } from '../types/session';
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

describe('loadSessions', () => {
  it('пустое хранилище — пустая история без ошибки', () => {
    expect(loadSessions(memoryStorage())).toEqual({ sessions: [], issue: 'none' });
  });

  it('сохранённые данные читаются обратно', () => {
    const storage = memoryStorage();
    expect(saveSessions([valid], storage)).toBe(true);
    expect(loadSessions(storage)).toEqual({ sessions: [valid], issue: 'none' });
  });

  it('повреждённый JSON не роняет приложение', () => {
    expect(loadSessions(memoryStorage({ [SESSIONS_KEY]: '{не json' }))).toEqual({ sessions: [], issue: 'corrupted' });
    expect(loadSessions(memoryStorage({ [SESSIONS_KEY]: '{"a":1}' }))).toEqual({ sessions: [], issue: 'corrupted' });
  });

  it('некорректные записи пропускаются, корректные остаются', () => {
    const raw = JSON.stringify([valid, { id: 'x', type: 'reading' }, null, { ...valid, id: '2', wordsPerMinute: 'быстро' }]);
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
    const raw = JSON.stringify({ readerFontSize: 999, schulteGridSize: 6, schulteMode: 'letters' });
    expect(loadSettings(memoryStorage({ [SETTINGS_KEY]: raw }))).toEqual({
      readerFontSize: 32,
      schulteGridSize: 5,
      schulteMode: 'letters',
    });
  });
});
