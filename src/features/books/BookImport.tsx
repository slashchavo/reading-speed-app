import { useRef, useState, type ChangeEvent } from 'react';
import type { BookMeta } from './bookTypes';
import { formatFileSize, MAX_BOOK_BYTES } from './bookUtils';
import { importBook, type ImportStage } from './importBook';

type Props = {
  onImported: (book: BookMeta) => void;
  onOpen: (book: BookMeta) => void;
};

type Status =
  | { kind: 'idle' }
  | { kind: 'working'; fileName: string; size: number; stage: ImportStage; percent?: number }
  | { kind: 'done'; book: BookMeta }
  | { kind: 'duplicate'; book: BookMeta }
  | { kind: 'error'; fileName: string; message: string };

const STAGE_LABEL: Record<ImportStage, string> = {
  reading: 'Чтение файла',
  parsing: 'Извлечение текста',
  saving: 'Сохранение в библиотеку',
};

export function BookImport({ onImported, onOpen }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = status.kind === 'working';

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file || busy) return;
    setStatus({ kind: 'working', fileName: file.name, size: file.size, stage: 'reading', percent: 0 });
    const outcome = await importBook(file, (stage, percent) =>
      setStatus({ kind: 'working', fileName: file.name, size: file.size, stage, percent }),
    );
    if (outcome.status === 'imported') {
      setStatus({ kind: 'done', book: outcome.book });
      onImported(outcome.book);
    } else if (outcome.status === 'duplicate') {
      setStatus({ kind: 'duplicate', book: outcome.book });
    } else {
      setStatus({ kind: 'error', fileName: file.name, message: outcome.message });
    }
  };

  return (
    <section className="card" aria-labelledby="books-import">
      <h2 id="books-import" className="card__title">
        Добавить книгу
      </h2>
      <p className="muted">
        Форматы: EPUB, DOCX (Word) и TXT, до {formatFileSize(MAX_BOOK_BYTES)}. Файл обрабатывается прямо на этом
        устройстве и никуда не отправляется. Книга сохранится в этом браузере.
      </p>
      <button
        type="button"
        className="button button--primary"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        Выбрать файл
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".epub,.docx,.txt,.doc,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/msword"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFile}
      />
      <div aria-live="polite">
        {status.kind === 'working' && (
          <div className="import-status">
            <p>
              <strong>{status.fileName}</strong> · {formatFileSize(status.size)}
            </p>
            <p>
              {STAGE_LABEL[status.stage]}
              {status.stage === 'reading' && status.percent !== undefined ? ` — ${status.percent} %` : '…'}
            </p>
            <progress
              className="import-progress"
              max={100}
              value={status.stage === 'reading' ? status.percent : undefined}
              aria-label={STAGE_LABEL[status.stage]}
            />
          </div>
        )}
        {status.kind === 'done' && (
          <p className="note note--success">
            ✓ Книга «{status.book.title}» добавлена: {status.book.wordCount.toLocaleString('ru-RU')} слов, разделов:{' '}
            {status.book.chapterCount}.{' '}
            <button type="button" className="link-button" onClick={() => onOpen(status.book)}>
              Начать чтение
            </button>
          </p>
        )}
        {status.kind === 'duplicate' && (
          <p className="note">
            Эта книга уже есть в библиотеке: «{status.book.title}».{' '}
            <button type="button" className="link-button" onClick={() => onOpen(status.book)}>
              Продолжить чтение
            </button>
          </p>
        )}
        {status.kind === 'error' && (
          <p className="alert alert--error" role="alert">
            <strong>{status.fileName}:</strong> {status.message}
          </p>
        )}
      </div>
    </section>
  );
}
