import { useState } from 'react';
import { RouteLink } from '../components/RouteLink';
import { LIBRARY, loadUsedIds, markUsed, pickNextText, saveUsedIds, type LibraryText } from '../features/library/library';
import { CustomTextEditor } from '../features/reader/CustomTextEditor';
import { ReadingRun } from '../features/reader/ReadingRun';
import { countWords } from '../features/reader/readerUtils';
import { clampFontSize } from '../lib/storage';
import type { ReadingSession, Settings } from '../types/session';

type ReaderPageProps = {
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onComplete: (session: ReadingSession) => boolean;
};

type Tab = 'library' | 'custom';

export function ReaderPage({ settings, onSettingsChange, onComplete }: ReaderPageProps) {
  const [tab, setTab] = useState<Tab>('library');
  const [usedIds, setUsedIds] = useState<string[]>(() => loadUsedIds());
  const [current, setCurrent] = useState<LibraryText | null>(() => pickNextText(loadUsedIds()));
  const [customText, setCustomText] = useState('');
  const fontProps = {
    fontSize: settings.readerFontSize,
    onFontSizeChange: (size: number) => onSettingsChange({ readerFontSize: clampFontSize(size) }),
  };

  const markCurrentUsed = () => {
    if (!current) return;
    const next = markUsed(usedIds, current.id);
    setUsedIds(next);
    saveUsedIds(next);
  };

  const nextText = () => setCurrent(pickNextText(usedIds, current?.id ?? null));

  const resetUsed = () => {
    setUsedIds([]);
    saveUsedIds([]);
    setCurrent(pickNextText([]));
  };

  const remaining = LIBRARY.length - usedIds.length;

  return (
    <div className="page">
      <header className="page__header">
        <h1>Чтение</h1>
        <p className="lead">Измерьте ориентировочную скорость чтения в словах в минуту.</p>
      </header>
      <div className="tabs" role="tablist" aria-label="Источник текста">
        <button type="button" role="tab" aria-selected={tab === 'library'} className="tab" onClick={() => setTab('library')}>
          Новый текст
        </button>
        <button type="button" role="tab" aria-selected={tab === 'custom'} className="tab" onClick={() => setTab('custom')}>
          Свой текст
        </button>
        <RouteLink className="tab" to="books">
          Мои книги →
        </RouteLink>
      </div>

      {tab === 'library' &&
        (current ? (
          <ReadingRun
            key={current.id}
            text={current.text}
            source="builtin"
            textId={current.id}
            title={current.title}
            {...fontProps}
            onComplete={onComplete}
            onStart={markCurrentUsed}
            readyView={
              <>
                <p className="eyebrow">{current.topic}</p>
                <h2 className="card__title">{current.title}</h2>
                <p className="muted">
                  {countWords(current.text)} слов. Текст появится после нажатия «Начать» — так замер будет честным.
                  Новых текстов в библиотеке: {remaining} из {LIBRARY.length}.
                </p>
                {remaining > 1 && (
                  <button type="button" className="button button--small" onClick={nextText}>
                    Другой текст
                  </button>
                )}
              </>
            }
            resultActions={
              <button type="button" className="button button--primary" onClick={nextText}>
                Следующий новый текст
              </button>
            }
          />
        ) : (
          <section className="card">
            <h2 className="card__title">Все тексты библиотеки прочитаны</h2>
            <p className="muted">
              Вы прочитали все {LIBRARY.length} встроенных текстов. Новых пока нет. Можно сбросить отметки и читать их
              заново — тогда они снова будут выдаваться по одному, без повторов. Или загрузите свою книгу.
            </p>
            <div className="actions">
              <button type="button" className="button button--primary" onClick={resetUsed}>
                Сбросить историю использованных текстов
              </button>
              <RouteLink className="button" to="books">
                Мои книги
              </RouteLink>
            </div>
          </section>
        ))}

      {tab === 'custom' && (
        <ReadingRun
          key="custom"
          text={customText}
          source="custom"
          {...fontProps}
          onComplete={onComplete}
          readyView={<CustomTextEditor text={customText} onChange={setCustomText} />}
          blockedReason={
            countWords(customText) === 0 ? 'Текст пустой. Вставьте текст или загрузите файл .txt.' : null
          }
        />
      )}
    </div>
  );
}
