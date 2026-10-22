import { RouteLink } from '../components/RouteLink';
import { StatCard } from '../components/StatCard';
import { GAME_CARDS, READING_CARDS, TrainingCards } from '../components/TrainingCards';
import { sessionTypeLabel, summarize } from '../features/progress/progressUtils';
import { formatDateTime } from '../lib/dateUtils';
import type { Session } from '../types/session';

type HomePageProps = {
  sessions: Session[];
};

export function HomePage({ sessions }: HomePageProps) {
  const summary = summarize(sessions);
  const last = summary.lastSession;

  return (
    <div className="page">
      <header className="page__header">
        <h1>Добро пожаловать в «Фокус»</h1>
        <p className="lead">
          Простые упражнения на внимание, память и чтение. Выберите тренировку — результаты сохранятся в истории на этом
          устройстве.
        </p>
      </header>

      <section className="section section--first" aria-labelledby="home-reading">
        <h2 id="home-reading" className="section__title">
          Чтение
        </h2>
        <TrainingCards cards={READING_CARDS} />
      </section>

      <section className="section" aria-labelledby="home-games">
        <h2 id="home-games" className="section__title">
          Тренировки
        </h2>
        <TrainingCards cards={GAME_CARDS} />
      </section>

      <section className="section" aria-labelledby="home-stats-title">
        <h2 id="home-stats-title" className="section__title">
          Кратко
        </h2>
        <dl className="stats">
          <StatCard label="Завершено занятий" value={String(summary.totalSessions)} />
          <StatCard
            label="Лучший результат чтения"
            value={summary.reading.best === null ? 'Пока нет' : `${summary.reading.best} слов/мин`}
          />
          <StatCard
            label="Последняя тренировка"
            value={last ? sessionTypeLabel(last) : 'Пока нет'}
            hint={last ? formatDateTime(last.completedAt) : undefined}
          />
        </dl>
        <p>
          <RouteLink className="button" to="progress">
            Смотреть историю и прогресс
          </RouteLink>
        </p>
      </section>
    </div>
  );
}
