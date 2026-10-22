import { StatCard } from '../components/StatCard';
import { sessionTypeLabel, summarize } from '../features/progress/progressUtils';
import { formatDateTime } from '../lib/dateUtils';
import { RouteLink } from '../components/RouteLink';
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
          Простые упражнения на внимание и чтение. Выберите тренировку — результаты сохранятся в истории на этом
          устройстве.
        </p>
      </header>

      <div className="cards">
        <RouteLink className="card card--link" to="schulte">
          <span className="card__icon" aria-hidden="true">
            ▦
          </span>
          <h2 className="card__title">Таблица Шульте</h2>
          <p className="muted">Найдите числа или буквы по порядку в таблице 5×5 или 7×7.</p>
          <span className="card__cta">Начать →</span>
        </RouteLink>
        <RouteLink className="card card--link" to="reading">
          <span className="card__icon" aria-hidden="true">
            ¶
          </span>
          <h2 className="card__title">Чтение</h2>
          <p className="muted">Прочитайте демонстрационный или свой текст и узнайте темп в словах в минуту.</p>
          <span className="card__cta">Начать →</span>
        </RouteLink>
      </div>

      <section className="section" aria-labelledby="home-stats-title">
        <h2 id="home-stats-title" className="section__title">
          Кратко
        </h2>
        <dl className="stats">
          <StatCard label="Завершено занятий" value={String(summary.totalSessions)} />
          <StatCard
            label="Лучший результат чтения"
            value={summary.bestWordsPerMinute === null ? 'Пока нет' : `${summary.bestWordsPerMinute} слов/мин`}
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
