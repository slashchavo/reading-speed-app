import type { GridSize, ReadingSession, SchulteMode, SchulteSession, Session, Settings } from '../types/session';

export const SESSIONS_KEY = 'focus-app:sessions:v1';
export const SETTINGS_KEY = 'focus-app:settings:v1';

/** Минимальный интерфейс хранилища — позволяет подменять localStorage в тестах. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Проблема, обнаруженная при чтении истории. */
export type StorageIssue = 'none' | 'corrupted' | 'unavailable';

export type LoadSessionsResult = {
  sessions: Session[];
  issue: StorageIssue;
};

export const DEFAULT_SETTINGS: Settings = {
  readerFontSize: 18,
  schulteGridSize: 5,
  schulteMode: 'numbers',
};

export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 32;

function getBrowserStorage(): KeyValueStorage | null {
  try {
    // В некоторых режимах (например, строгая приватность) доступ к localStorage бросает исключение.
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isValidIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isGridSize(value: unknown): value is GridSize {
  return value === 5 || value === 7;
}

function isSchulteMode(value: unknown): value is SchulteMode {
  return value === 'numbers' || value === 'letters';
}

/** Проверяет, что неизвестное значение — корректная запись о сессии. */
export function parseSession(value: unknown): Session | null {
  if (!isRecord(value)) return null;
  const { id, type, completedAt, durationSeconds } = value;
  if (typeof id !== 'string' || id === '') return null;
  if (!isValidIsoDate(completedAt)) return null;
  if (!isFiniteNonNegative(durationSeconds)) return null;

  if (type === 'schulte') {
    const { gridSize, mode, mistakes } = value;
    if (!isGridSize(gridSize) || !isSchulteMode(mode)) return null;
    if (!isFiniteNonNegative(mistakes) || !Number.isInteger(mistakes)) return null;
    const session: SchulteSession = { id, type, completedAt, durationSeconds, gridSize, mode, mistakes };
    return session;
  }

  if (type === 'reading') {
    const { wordCount, wordsPerMinute } = value;
    if (!isFiniteNonNegative(wordCount) || !Number.isInteger(wordCount) || wordCount === 0) return null;
    if (!isFiniteNonNegative(wordsPerMinute)) return null;
    const session: ReadingSession = { id, type, completedAt, durationSeconds, wordCount, wordsPerMinute };
    return session;
  }

  return null;
}

/**
 * Загружает историю. Никогда не бросает исключений:
 * при повреждённых данных возвращает только корректные записи и помечает проблему.
 */
export function loadSessions(storage: KeyValueStorage | null = getBrowserStorage()): LoadSessionsResult {
  if (!storage) return { sessions: [], issue: 'unavailable' };

  let raw: string | null;
  try {
    raw = storage.getItem(SESSIONS_KEY);
  } catch {
    return { sessions: [], issue: 'unavailable' };
  }
  if (raw === null) return { sessions: [], issue: 'none' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { sessions: [], issue: 'corrupted' };
  }
  if (!Array.isArray(parsed)) return { sessions: [], issue: 'corrupted' };

  const sessions: Session[] = [];
  for (const item of parsed) {
    const session = parseSession(item);
    if (session) sessions.push(session);
  }
  const issue: StorageIssue = sessions.length === parsed.length ? 'none' : 'corrupted';
  return { sessions, issue };
}

/** Сохраняет историю целиком. Возвращает false, если записать не удалось. */
export function saveSessions(
  sessions: Session[],
  storage: KeyValueStorage | null = getBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    return true;
  } catch {
    return false;
  }
}

export function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.readerFontSize;
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(value)));
}

export function loadSettings(storage: KeyValueStorage | null = getBrowserStorage()): Settings {
  if (!storage) return DEFAULT_SETTINGS;
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (raw === null) return DEFAULT_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return DEFAULT_SETTINGS;
    return {
      readerFontSize:
        typeof parsed.readerFontSize === 'number'
          ? clampFontSize(parsed.readerFontSize)
          : DEFAULT_SETTINGS.readerFontSize,
      schulteGridSize: isGridSize(parsed.schulteGridSize) ? parsed.schulteGridSize : DEFAULT_SETTINGS.schulteGridSize,
      schulteMode: isSchulteMode(parsed.schulteMode) ? parsed.schulteMode : DEFAULT_SETTINGS.schulteMode,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings, storage: KeyValueStorage | null = getBrowserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/**
 * Уникальный идентификатор записи.
 * crypto.randomUUID доступен только на HTTPS/localhost, а на iPad по адресу в локальной сети
 * его нет — поэтому есть запасной вариант.
 */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
