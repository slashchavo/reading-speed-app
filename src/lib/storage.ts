import type {
  AlphabetAnswer,
  ColorMode,
  GridSize,
  MnemoLevel,
  MunsterbergLevel,
  ReadingSession,
  SchulteMode,
  Session,
  Settings,
} from '../types/session';
import { getBrowserStorage, isRecord, readJson, writeJson, type KeyValueStorage } from './localStore';

export type { KeyValueStorage } from './localStore';

/** Ключи первого этапа сохранены без изменений: новые типы записей просто добавляются в тот же массив. */
export const SESSIONS_KEY = 'focus-app:sessions:v1';
export const SETTINGS_KEY = 'focus-app:settings:v1';

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
  schulteColorMode: 'mono',
  munsterbergLevel: 'easy',
  memoryWordCount: 10,
  memoryMinutes: 1,
  mnemoLevel: 'easy',
  mnemoMinutes: 1,
  schulteOrder: 'forward',
  schulteSymbolSize: 3,
  schulteMinutes: 1,
  colorMatchMinutes: 1,
  triangleMode: 'timed',
  triangleMinutes: 2,
};

export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 32;
export const MEMORY_WORDS_MIN = 5;
export const MEMORY_WORDS_MAX = 50;

const LEVELS = ['easy', 'medium', 'hard', 'expert'] as const;

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isCount(value: unknown): value is number {
  return isFiniteNonNegative(value) && Number.isInteger(value);
}

function isPercent(value: unknown): value is number {
  return isFiniteNonNegative(value) && value <= 100;
}

function isValidIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isGridSize(value: unknown): value is GridSize {
  return value === 5 || value === 7;
}

function isSchulteMode(value: unknown): value is SchulteMode {
  return value === 'numbers' || value === 'letters' || value === 'cyrillic';
}

function isColorMode(value: unknown): value is ColorMode {
  return value === 'mono' || value === 'color';
}

function isLevel(value: unknown): value is MunsterbergLevel & MnemoLevel {
  return typeof value === 'string' && (LEVELS as readonly string[]).includes(value);
}

function isMinutes5(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/** Добавляет к записи необязательные числовые поля, только если они корректны. */
function optionalCounts<T extends object>(target: T, source: Record<string, unknown>, keys: readonly string[]): T {
  const extra: Record<string, number> = {};
  for (const key of keys) if (isCount(source[key])) extra[key] = source[key] as number;
  return { ...target, ...extra };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function parseAlphabetAnswers(value: unknown): AlphabetAnswer[] | null {
  if (!Array.isArray(value)) return null;
  const answers: AlphabetAnswer[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.category !== 'string') return null;
    if (item.answer !== null && typeof item.answer !== 'string') return null;
    answers.push({ category: item.category, answer: item.answer, warning: item.warning === true });
  }
  return answers;
}

/** Проверяет, что неизвестное значение — корректная запись о сессии любого типа. */
export function parseSession(value: unknown): Session | null {
  if (!isRecord(value)) return null;
  const { id, type, completedAt, durationSeconds } = value;
  if (typeof id !== 'string' || id === '') return null;
  if (!isValidIsoDate(completedAt)) return null;
  if (!isFiniteNonNegative(durationSeconds)) return null;
  const base = { id, completedAt, durationSeconds };

  switch (type) {
    case 'schulte': {
      const { gridSize, mode, mistakes, colorMode } = value;
      if (!isGridSize(gridSize) || !isSchulteMode(mode) || !isCount(mistakes)) return null;
      const session = optionalCounts(
        { ...base, type, gridSize, mode, mistakes, ...(isColorMode(colorMode) ? { colorMode } : {}) },
        value,
        ['sessionMinutes', 'tablesCompleted', 'correctTaps'],
      );
      const { order, symbolSize } = value;
      return {
        ...session,
        ...(order === 'forward' || order === 'reverse' ? { order } : {}),
        ...(isMinutes5(symbolSize) ? { symbolSize } : {}),
      };
    }
    case 'reading': {
      const { wordCount, wordsPerMinute, source } = value;
      if (!isCount(wordCount) || wordCount === 0 || !isFiniteNonNegative(wordsPerMinute)) return null;
      const session: ReadingSession = { ...base, type, wordCount, wordsPerMinute };
      if (source === 'builtin' || source === 'custom' || source === 'book') session.source = source;
      const textId = optionalString(value.textId);
      const bookId = optionalString(value.bookId);
      const title = optionalString(value.title);
      if (textId) session.textId = textId;
      if (bookId) session.bookId = bookId;
      if (title) session.title = title;
      return optionalCounts(session, value, ['startWordIndex', 'endWordIndex']);
    }
    case 'munsterberg': {
      const { level, rows, targetCount, found, missed, extra } = value;
      if (!isLevel(level) || !isCount(rows) || !isCount(targetCount) || targetCount === 0) return null;
      if (!isCount(found) || !isCount(missed) || !isCount(extra)) return null;
      return optionalCounts({ ...base, type, level, rows, targetCount, found, missed, extra }, value, ['wrongTaps', 'rowLength']);
    }
    case 'memory_words': {
      const { wordCount, memorizeMinutes, correct, missed, extra } = value;
      if (!isCount(wordCount) || wordCount === 0 || !isFiniteNonNegative(memorizeMinutes)) return null;
      if (!isCount(correct) || !isCount(missed) || !isCount(extra)) return null;
      return { ...base, type, wordCount, memorizeMinutes, correct, missed, extra };
    }
    case 'mnemo_grid': {
      const { level, elementCount, memorizeMinutes, positionAccuracy, colorAccuracy } = value;
      if (!isLevel(level) || !isCount(elementCount) || !isFiniteNonNegative(memorizeMinutes)) return null;
      if (!isPercent(positionAccuracy) || !isPercent(colorAccuracy)) return null;
      return { ...base, type, level, elementCount, memorizeMinutes, positionAccuracy, colorAccuracy };
    }
    case 'alphabet_association': {
      const { letter, filled, skipped } = value;
      const answers = parseAlphabetAnswers(value.answers);
      if (typeof letter !== 'string' || letter === '' || !isCount(filled) || !isCount(skipped) || !answers) return null;
      return { ...base, type, letter, filled, skipped, answers };
    }
    case 'color_match': {
      const { durationMinutes, attempts, correct, wrong } = value;
      if (!isFiniteNonNegative(durationMinutes) || !isCount(attempts) || !isCount(correct) || !isCount(wrong)) return null;
      if (correct + wrong !== attempts) return null;
      return { ...base, type, durationMinutes, attempts, correct, wrong };
    }
    case 'triangle_field': {
      const { mode, found, mistakes, completed, timeLimitMinutes } = value;
      if (mode !== 'timed' && mode !== 'complete') return null;
      if (!isCount(found) || found > 99 || !isCount(mistakes) || typeof completed !== 'boolean') return null;
      return {
        ...base,
        type,
        mode,
        found,
        mistakes,
        completed,
        ...(isMinutes5(timeLimitMinutes) ? { timeLimitMinutes } : {}),
      };
    }
    default:
      return null;
  }
}

/** Разбирает массив записей: корректные возвращаются, некорректные пропускаются. */
export function parseSessionList(value: unknown): { sessions: Session[]; skipped: number } | null {
  if (!Array.isArray(value)) return null;
  const sessions: Session[] = [];
  for (const item of value) {
    const session = parseSession(item);
    if (session) sessions.push(session);
  }
  return { sessions, skipped: value.length - sessions.length };
}

/**
 * Загружает историю. Никогда не бросает исключений:
 * при повреждённых данных возвращает только корректные записи и помечает проблему.
 */
export function loadSessions(storage: KeyValueStorage | null = getBrowserStorage()): LoadSessionsResult {
  const result = readJson(SESSIONS_KEY, storage);
  if (result.status === 'unavailable') return { sessions: [], issue: 'unavailable' };
  if (result.status === 'missing') return { sessions: [], issue: 'none' };
  if (result.status === 'corrupted') return { sessions: [], issue: 'corrupted' };
  const parsed = parseSessionList(result.value);
  if (!parsed) return { sessions: [], issue: 'corrupted' };
  return { sessions: parsed.sessions, issue: parsed.skipped === 0 ? 'none' : 'corrupted' };
}

/** Сохраняет историю целиком. Возвращает false, если записать не удалось. */
export function saveSessions(sessions: Session[], storage: KeyValueStorage | null = getBrowserStorage()): boolean {
  return writeJson(SESSIONS_KEY, sessions, storage);
}

export function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.readerFontSize;
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(value)));
}

export function clampMemoryWordCount(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.memoryWordCount;
  return Math.min(MEMORY_WORDS_MAX, Math.max(MEMORY_WORDS_MIN, Math.round(value)));
}

/** Приводит неизвестное значение к корректным настройкам, подставляя значения по умолчанию. */
export function parseSettings(value: unknown): Settings {
  if (!isRecord(value)) return DEFAULT_SETTINGS;
  const d = DEFAULT_SETTINGS;
  const memoryMinutes = value.memoryMinutes;
  const mnemoMinutes = value.mnemoMinutes;
  return {
    readerFontSize: typeof value.readerFontSize === 'number' ? clampFontSize(value.readerFontSize) : d.readerFontSize,
    schulteGridSize: isGridSize(value.schulteGridSize) ? value.schulteGridSize : d.schulteGridSize,
    schulteMode: isSchulteMode(value.schulteMode) ? value.schulteMode : d.schulteMode,
    schulteColorMode: isColorMode(value.schulteColorMode) ? value.schulteColorMode : d.schulteColorMode,
    munsterbergLevel: isLevel(value.munsterbergLevel) ? value.munsterbergLevel : d.munsterbergLevel,
    memoryWordCount:
      typeof value.memoryWordCount === 'number' ? clampMemoryWordCount(value.memoryWordCount) : d.memoryWordCount,
    memoryMinutes: memoryMinutes === 1 || memoryMinutes === 2 || memoryMinutes === 3 ? memoryMinutes : d.memoryMinutes,
    mnemoLevel: isLevel(value.mnemoLevel) ? value.mnemoLevel : d.mnemoLevel,
    mnemoMinutes: isMinutes5(mnemoMinutes) ? mnemoMinutes : d.mnemoMinutes,
    schulteOrder: value.schulteOrder === 'forward' || value.schulteOrder === 'reverse' ? value.schulteOrder : d.schulteOrder,
    schulteSymbolSize: isMinutes5(value.schulteSymbolSize) ? value.schulteSymbolSize : d.schulteSymbolSize,
    schulteMinutes: isMinutes5(value.schulteMinutes) ? value.schulteMinutes : d.schulteMinutes,
    colorMatchMinutes:
      value.colorMatchMinutes === 1 || value.colorMatchMinutes === 2 || value.colorMatchMinutes === 3
        ? value.colorMatchMinutes
        : d.colorMatchMinutes,
    triangleMode: value.triangleMode === 'timed' || value.triangleMode === 'complete' ? value.triangleMode : d.triangleMode,
    triangleMinutes: isMinutes5(value.triangleMinutes) ? value.triangleMinutes : d.triangleMinutes,
  };
}

export function loadSettings(storage: KeyValueStorage | null = getBrowserStorage()): Settings {
  const result = readJson(SETTINGS_KEY, storage);
  return result.status === 'ok' ? parseSettings(result.value) : DEFAULT_SETTINGS;
}

export function saveSettings(settings: Settings, storage: KeyValueStorage | null = getBrowserStorage()): boolean {
  return writeJson(SETTINGS_KEY, settings, storage);
}

/**
 * Уникальный идентификатор записи.
 * crypto.randomUUID доступен только на HTTPS/localhost, поэтому есть запасной вариант.
 */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
