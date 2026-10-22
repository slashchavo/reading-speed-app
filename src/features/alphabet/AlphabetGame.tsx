import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SaveStatus, type SaveState } from '../../components/SaveStatus';
import { Segmented } from '../../components/Segmented';
import { Stat } from '../../components/Stat';
import { RUSSIAN_ALPHABET } from '../../lib/alphabet';
import { formatClock, formatDuration, localDateString } from '../../lib/dateUtils';
import { createId } from '../../lib/storage';
import { useElapsed } from '../../lib/useCountdown';
import type { AlphabetSession } from '../../types/session';
import {
  buildSession,
  CATEGORIES,
  checkAnswer,
  completedTodayCount,
  completeLetter,
  isLockedToday,
  isRoundComplete,
  loadAlphabetState,
  nextSequentialLetter,
  recordAnswer,
  saveAlphabetState,
  startActive,
  unlockLabel,
  type AlphabetMode,
  type AlphabetState,
} from './alphabetUtils';

type Props = {
  onComplete: (session: AlphabetSession) => boolean;
};

const MODE_OPTIONS = [
  { value: 'sequential', label: 'По порядку' },
  { value: 'manual', label: 'Выбрать букву' },
] as const;

export function AlphabetGame({ onComplete }: Props) {
  const [state, setState] = useState<AlphabetState>(() => loadAlphabetState());
  const [mode, setMode] = useState<AlphabetMode>(() => state.active?.mode ?? 'sequential');
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<'empty' | 'mismatch' | null>(null);
  const [result, setResult] = useState<AlphabetSession | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [storageOk, setStorageOk] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const active = state.active;
  const elapsed = useElapsed(active ? active.startedAt : null);
  const today = localDateString();

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active?.index, active?.letter]);

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  const persist = (next: AlphabetState) => {
    setState(next);
    setStorageOk(saveAlphabetState(next));
  };

  const begin = (letter: string, chosenMode: AlphabetMode) => {
    const fresh = loadAlphabetState();
    // Если в другой вкладке уже идёт игра или буква уже пройдена — не начинаем заново.
    if (fresh.active) {
      setState(fresh);
      return;
    }
    if (isLockedToday(fresh, letter, localDateString())) {
      setState(fresh);
      return;
    }
    setResult(null);
    setSaveState('idle');
    setDraft('');
    setProblem(null);
    persist({ ...fresh, active: startActive(createId(), letter, chosenMode, Date.now()) });
  };

  const advance = (answer: string | null) => {
    if (!active) return;
    const next = recordAnswer(active, answer);
    setDraft('');
    setProblem(null);
    if (!isRoundComplete(next)) {
      persist({ ...state, active: next });
      return;
    }
    // Последняя карточка: одна запись в истории и блокировка буквы на сегодня.
    const session = buildSession(next, Date.now());
    const saved = onComplete(session);
    persist(completeLetter(state, next, localDateString()));
    setSaveState(saved ? 'saved' : 'failed');
    setResult(session);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!active) return;
    const check = checkAnswer(active.letter, draft);
    if (check === 'ok') {
      advance(draft);
      return;
    }
    setProblem(check);
  };

  if (result) {
    return (
      <section className="card result" aria-labelledby="ab-result">
        <h2 id="ab-result" className="card__title" tabIndex={-1} ref={resultRef}>
          Буква {result.letter} пройдена
        </h2>
        <dl className="stats">
          <Stat label="Время" value={formatDuration(result.durationSeconds)} />
          <Stat label="Заполнено" value={`${result.filled} из ${CATEGORIES.length}`} />
          <Stat label="Пропущено" value={String(result.skipped)} />
        </dl>
        <SaveStatus state={saveState} />
        <ul className="ab-answers">
          {result.answers.map((item) => (
            <li key={item.category} className={item.answer === null ? 'ab-answers__skipped' : undefined}>
              <span className="ab-answers__category">{item.category}</span>
              <span>
                {item.answer === null ? '— пропущено' : item.answer}
                {item.warning && (
                  <span className="ab-warning"> ⚠ не начинается на «{result.letter}»</span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <p className="muted">
          Приложение проверяет только первую букву ответа, а не то, подходит ли он к категории. Буква {result.letter}{' '}
          снова станет доступна завтра.
        </p>
        <div className="actions">
          <button type="button" className="button button--primary" onClick={() => setResult(null)}>
            К алфавиту
          </button>
        </div>
      </section>
    );
  }

  if (active) {
    const category = CATEGORIES[active.index] ?? '';
    const isLast = active.index === CATEGORIES.length - 1;
    return (
      <section className="card" aria-label={`Игра на букву ${active.letter}`}>
        {!storageOk && (
          <p className="alert alert--warning" role="alert">
            Не удалось сохранить прогресс в памяти браузера — при перезагрузке страницы ответы могут пропасть.
          </p>
        )}
        <div className="game-bar">
          <span>
            Время: <strong className="mono">{formatClock(elapsed)}</strong>
          </span>
          <span>
            Карточка {active.index + 1} из {CATEGORIES.length}
          </span>
        </div>
        <div className="ab-card">
          <div className="ab-card__letter" aria-hidden="true">
            {active.letter}
          </div>
          <form onSubmit={submit} className="ab-card__form" noValidate>
            <label className="field">
              <span className="field__label ab-card__category">
                {category} на букву «{active.letter}»
              </span>
              <input
                ref={inputRef}
                className="field__input"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setProblem(null);
                }}
                autoComplete="off"
                autoCorrect="off"
                aria-invalid={problem !== null}
                aria-describedby={problem ? 'ab-problem' : undefined}
              />
            </label>
            {problem === 'empty' && (
              <p id="ab-problem" className="alert alert--error" role="alert">
                Введите ответ или нажмите «Пропустить», если подобрать слово не получается.
              </p>
            )}
            {problem === 'mismatch' && (
              <div id="ab-problem" className="alert alert--error" role="alert">
                <p>Ответ не начинается на букву «{active.letter}». Исправьте его или пропустите категорию.</p>
                <button type="button" className="button button--small" onClick={() => advance(draft)}>
                  Оставить как есть
                </button>
              </div>
            )}
            <div className="actions">
              <button type="submit" className="button button--primary button--large">
                {isLast ? 'Завершить' : 'Далее'}
              </button>
              <button type="button" className="button" onClick={() => advance(null)}>
                {isLast ? 'Пропустить и завершить' : 'Пропустить'}
              </button>
            </div>
          </form>
        </div>
        <ol className="ab-progress" aria-label="Категории">
          {CATEGORIES.map((name, index) => {
            const answer = active.answers[index];
            const status = index < active.index ? (answer?.answer === null ? 'пропущено' : 'готово') : index === active.index ? 'сейчас' : '';
            return (
              <li key={name} className={index === active.index ? 'ab-progress__current' : undefined}>
                {name}
                {status && <span className="muted"> — {status}</span>}
              </li>
            );
          })}
        </ol>
      </section>
    );
  }

  const next = nextSequentialLetter(state, today);
  const doneToday = completedTodayCount(state, today);

  return (
    <section className="card" aria-labelledby="ab-setup">
      <h2 id="ab-setup" className="card__title">
        Выбор буквы
      </h2>
      <p className="muted">
        Для буквы нужно заполнить 12 категорий — по одной карточке. Трудную категорию можно пропустить. Пройденная буква
        открывается снова на следующий день. Отметки хранятся только в этом браузере.
      </p>
      <Segmented name="ab-mode" legend="Режим" options={MODE_OPTIONS} value={mode} onChange={setMode} />
      <p>
        Пройдено сегодня: <strong>{doneToday}</strong> из {RUSSIAN_ALPHABET.length}
      </p>
      {mode === 'sequential' &&
        (next ? (
          <button type="button" className="button button--primary button--large" onClick={() => begin(next, 'sequential')}>
            Начать букву «{next}»
          </button>
        ) : (
          <p className="note">Сегодня пройдены все буквы. Завтра алфавит откроется снова.</p>
        ))}
      <ul className="ab-map" aria-label="Буквы алфавита">
        {RUSSIAN_ALPHABET.map((letter) => {
          const locked = isLockedToday(state, letter, today);
          const isNext = mode === 'sequential' && letter === next;
          return (
            <li key={letter}>
              <button
                type="button"
                className={`ab-letter${locked ? ' ab-letter--done' : ''}${isNext ? ' ab-letter--next' : ''}`}
                disabled={locked || mode === 'sequential'}
                onClick={() => begin(letter, 'manual')}
                aria-label={locked ? `${letter}: пройдена сегодня. ${unlockLabel(today)}` : `Буква ${letter}`}
                title={locked ? unlockLabel(today) : undefined}
              >
                <span className="ab-letter__char">{letter}</span>
                {locked && <span className="ab-letter__state">✓ завтра</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {doneToday > 0 && <p className="muted">Отмеченные «✓» буквы: {unlockLabel(today).toLowerCase()}.</p>}
    </section>
  );
}
