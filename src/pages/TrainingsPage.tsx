import { GAME_CARDS, TrainingCards } from '../components/TrainingCards';
import { summarize } from '../features/progress/progressUtils';
import type { Session, TrainingType } from '../types/session';

const TYPE_BY_ROUTE: Record<string, TrainingType> = {
  schulte: 'schulte',
  munsterberg: 'munsterberg',
  memory: 'memory_words',
  mnemo: 'mnemo_grid',
  alphabet: 'alphabet_association',
  colors: 'color_match',
  triangle: 'triangle_field',
};

type Props = { sessions: Session[] };

export function TrainingsPage({ sessions }: Props) {
  const { countByType } = summarize(sessions);
  return (
    <div className="page">
      <header className="page__header">
        <h1>Тренировки</h1>
        <p className="lead">Упражнения на внимание и память. Это тренировки, а не медицинские методики.</p>
      </header>
      <TrainingCards
        cards={GAME_CARDS}
        note={(card) => {
          const type = TYPE_BY_ROUTE[card.route];
          const count = type ? countByType[type] : 0;
          return count > 0 ? `Завершено: ${count}` : null;
        }}
      />
    </div>
  );
}
