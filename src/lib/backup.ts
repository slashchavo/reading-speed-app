import { loadAlphabetState, parseAlphabetState, saveAlphabetState, type LetterCompletion } from '../features/alphabet/alphabetUtils';
import { loadUsedIds, saveUsedIds } from '../features/library/library';
import type { Session, Settings } from '../types/session';
import { isRecord, isStringArray } from './localStore';
import { parseSessionList, parseSettings } from './storage';

export const BACKUP_APP = 'focus-app';
export const BACKUP_VERSION = 1;

export type Backup = {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  sessions: Session[];
  settings: Settings;
  usedTextIds: string[];
  alphabetCompletions: Record<string, LetterCompletion>;
};

export function buildBackup(sessions: Session[], settings: Settings): Backup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sessions,
    settings,
    usedTextIds: loadUsedIds(),
    alphabetCompletions: loadAlphabetState().completions,
  };
}

export type ParsedBackup = Omit<Backup, 'app' | 'version' | 'exportedAt'> & { skipped: number };

/** Проверяет структуру и версию файла резервной копии. Возвращает строку с причиной, если файл не подходит. */
export function parseBackup(value: unknown): ParsedBackup | string {
  if (!isRecord(value) || value.app !== BACKUP_APP) return 'Это не файл резервной копии приложения «Фокус».';
  if (value.version !== BACKUP_VERSION) return `Неподдерживаемая версия резервной копии: ${String(value.version)}.`;
  const list = parseSessionList(value.sessions);
  if (!list) return 'В файле нет списка тренировок.';
  return {
    sessions: list.sessions,
    skipped: list.skipped,
    settings: parseSettings(value.settings),
    usedTextIds: isStringArray(value.usedTextIds) ? value.usedTextIds : [],
    alphabetCompletions: parseAlphabetState({ completions: value.alphabetCompletions }).completions,
  };
}

/** Объединяет историю: записи с одинаковым id не дублируются. */
export function mergeSessions(current: readonly Session[], incoming: readonly Session[]): { merged: Session[]; added: number } {
  const ids = new Set(current.map((s) => s.id));
  const fresh = incoming.filter((s) => !ids.has(s.id));
  return { merged: [...current, ...fresh], added: fresh.length };
}

/** Применяет к localStorage то, что не входит в историю и настройки: использованные тексты и отметки букв. */
export function applyBackupExtras(backup: ParsedBackup): void {
  saveUsedIds([...loadUsedIds(), ...backup.usedTextIds]);
  const state = loadAlphabetState();
  const completions = { ...state.completions };
  for (const [letter, completion] of Object.entries(backup.alphabetCompletions)) {
    const existing = completions[letter];
    if (!existing || existing.completedOnLocalDate < completion.completedOnLocalDate) completions[letter] = completion;
  }
  saveAlphabetState({ ...state, completions });
}
