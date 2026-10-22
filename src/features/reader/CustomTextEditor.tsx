import { useRef, useState, type ChangeEvent } from 'react';
import { countWords, isTxtFile, MAX_FILE_BYTES, SHORT_TEXT_WORDS } from './readerUtils';

type Props = {
  text: string;
  onChange: (text: string) => void;
};

/** Поле для своего текста: вставка или загрузка небольшого .txt файла. */
export function CustomTextEditor({ text, onChange }: Props) {
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wordCount = countWords(text);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!isTxtFile(file)) {
      setMessage({ kind: 'error', text: 'Здесь поддерживаются только файлы .txt. EPUB и DOCX загрузите в разделе «Мои книги».' });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setMessage({ kind: 'error', text: 'Файл больше 1 МБ. Большие книги загружайте в разделе «Мои книги».' });
      return;
    }
    try {
      const content = await file.text();
      if (countWords(content) === 0) {
        setMessage({ kind: 'error', text: `В файле «${file.name}» нет текста.` });
        return;
      }
      onChange(content);
      setMessage({ kind: 'info', text: `Загружен файл «${file.name}».` });
    } catch {
      setMessage({ kind: 'error', text: 'Не удалось прочитать файл. Попробуйте другой .txt файл.' });
    }
  };

  return (
    <>
      <h2 className="card__title">Свой текст</h2>
      <p className="muted">Вставьте текст или загрузите файл .txt. Нажмите «Начать», прочитайте текст в привычном темпе и нажмите «Завершить чтение».</p>
      <label className="field">
        <span className="field__label">Текст для чтения</span>
        <textarea
          className="field__textarea"
          value={text}
          onChange={(event) => {
            onChange(event.target.value);
            setMessage(null);
          }}
          rows={10}
          aria-describedby="reader-word-count"
        />
      </label>
      <div className="reader__tools">
        <span id="reader-word-count" className="muted">
          Слов: <strong>{wordCount}</strong>
        </span>
        <div className="actions actions--compact">
          <button type="button" className="button button--small" onClick={() => fileInputRef.current?.click()}>
            Загрузить .txt
          </button>
          <button
            type="button"
            className="button button--small"
            onClick={() => {
              onChange('');
              setMessage(null);
            }}
            disabled={text === ''}
          >
            Очистить
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,text/plain"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleFile}
        />
      </div>
      {message && (
        <p className={message.kind === 'error' ? 'alert alert--error' : 'note'} role="status">
          {message.text}
        </p>
      )}
      {wordCount > 0 && wordCount < SHORT_TEXT_WORDS && (
        <p className="note">Текст очень короткий — результат будет неточным. Лучше взять текст от 100 слов.</p>
      )}
    </>
  );
}
