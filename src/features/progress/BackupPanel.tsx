import { useRef, useState, type ChangeEvent } from 'react';
import { applyBackupExtras, buildBackup, parseBackup } from '../../lib/backup';
import { localDateString } from '../../lib/dateUtils';
import type { Session, Settings } from '../../types/session';

type Props = {
  sessions: Session[];
  settings: Settings;
  onImport: (sessions: Session[], settings: Settings) => number | null;
};

const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

/** Экспорт и импорт истории/настроек в JSON. Книги в копию не входят (они большие и остаются в браузере). */
export function BackupPanel({ sessions, settings, onImport }: Props) {
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const exportBackup = () => {
    try {
      const blob = new Blob([JSON.stringify(buildBackup(sessions, settings), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `focus-backup-${localDateString()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage({ kind: 'ok', text: 'Файл резервной копии создан.' });
    } catch {
      setMessage({ kind: 'error', text: 'Не удалось создать файл резервной копии.' });
    }
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setMessage({ kind: 'error', text: 'Файл слишком большой для резервной копии «Фокуса».' });
      return;
    }
    let parsed: ReturnType<typeof parseBackup>;
    try {
      parsed = parseBackup(JSON.parse(await file.text()) as unknown);
    } catch {
      setMessage({ kind: 'error', text: 'Файл не похож на резервную копию: это не JSON.' });
      return;
    }
    if (typeof parsed === 'string') {
      setMessage({ kind: 'error', text: parsed });
      return;
    }
    const added = onImport(parsed.sessions, parsed.settings);
    if (added === null) {
      setMessage({ kind: 'error', text: 'Не удалось записать данные в память браузера.' });
      return;
    }
    applyBackupExtras(parsed);
    const skipped = parsed.skipped > 0 ? ` Пропущено повреждённых записей: ${parsed.skipped}.` : '';
    setMessage({ kind: 'ok', text: `Восстановлено. Новых записей: ${added}, уже были: ${parsed.sessions.length - added}.${skipped}` });
  };

  return (
    <section className="section" aria-labelledby="backup-title">
      <h2 id="backup-title" className="section__title">
        Резервная копия
      </h2>
      <p className="muted">
        История и настройки хранятся только в этом браузере на этом устройстве и не синхронизируются. После очистки
        данных сайта или в другом браузере их не будет. Сохраните копию в файл, чтобы перенести или восстановить историю.
        Загруженные книги в копию не входят.
      </p>
      <div className="actions actions--compact">
        <button type="button" className="button" onClick={exportBackup}>
          Сохранить копию (JSON)
        </button>
        <button type="button" className="button" onClick={() => inputRef.current?.click()}>
          Восстановить из файла
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={importBackup}
        />
      </div>
      {message && (
        <p className={message.kind === 'ok' ? 'note note--success' : 'alert alert--error'} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}
