import { useCallback, useState } from 'react';
import { loadSessions, loadSettings, saveSessions, saveSettings, type StorageIssue } from '../lib/storage';
import type { Session, Settings } from '../types/session';

export type AppData = {
  sessions: Session[];
  storageIssue: StorageIssue;
  settings: Settings;
  /** Добавляет завершённую сессию. Возвращает false, если сохранить в хранилище не удалось. */
  addSession: (session: Session) => boolean;
  updateSettings: (patch: Partial<Settings>) => void;
};

/** Состояние истории и настроек; все обращения к localStorage идут через lib/storage. */
export function useAppData(): AppData {
  const [initial] = useState(() => loadSessions());
  const [sessions, setSessions] = useState<Session[]>(initial.sessions);
  const [storageIssue, setStorageIssue] = useState<StorageIssue>(initial.issue);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  const addSession = useCallback(
    (session: Session): boolean => {
      // Защита от дубликатов: одна и та же запись не добавляется дважды.
      if (sessions.some((existing) => existing.id === session.id)) return true;
      const next = [...sessions, session];
      setSessions(next);
      const saved = saveSessions(next);
      if (saved && storageIssue === 'corrupted') setStorageIssue('none');
      return saved;
    },
    [sessions, storageIssue],
  );

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  return { sessions, storageIssue, settings, addSession, updateSettings };
}
