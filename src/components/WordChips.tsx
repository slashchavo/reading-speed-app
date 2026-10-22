type WordChipsProps = {
  title: string;
  words: readonly string[];
  tone: 'ok' | 'missed' | 'extra';
  empty: string;
};

const MARKS = { ok: '✓', missed: '○', extra: '✕' } as const;

/** Список слов результата. Состояние показано и значком, и подписью — не только цветом. */
export function WordChips({ title, words, tone, empty }: WordChipsProps) {
  return (
    <section className="chips-block">
      <h3 className="chips-block__title">
        {title}: {words.length}
      </h3>
      {words.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="chips">
          {words.map((word) => (
            <li key={word} className={`chip chip--${tone}`}>
              <span aria-hidden="true">{MARKS[tone]}</span> {word}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
