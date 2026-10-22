/**
 * Общий адаптер localStorage: все модули читают и пишут небольшие данные только через него.
 * Ошибки доступа и повреждённый JSON не бросают исключений наружу.
 */

/** Минимальный интерфейс хранилища — позволяет подменять localStorage в тестах. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'removeItem'>>;

export type ReadResult =
  | { status: 'missing' }
  | { status: 'ok'; value: unknown }
  | { status: 'corrupted' }
  | { status: 'unavailable' };

export function getBrowserStorage(): KeyValueStorage | null {
  try {
    // В некоторых режимах (строгая приватность, встроенные окна) доступ к localStorage бросает исключение.
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readJson(key: string, storage: KeyValueStorage | null = getBrowserStorage()): ReadResult {
  if (!storage) return { status: 'unavailable' };
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { status: 'unavailable' };
  }
  if (raw === null) return { status: 'missing' };
  try {
    return { status: 'ok', value: JSON.parse(raw) as unknown };
  } catch {
    return { status: 'corrupted' };
  }
}

/** Записывает значение. Возвращает false, если записать не удалось (нет доступа, переполнение). */
export function writeJson(key: string, value: unknown, storage: KeyValueStorage | null = getBrowserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
