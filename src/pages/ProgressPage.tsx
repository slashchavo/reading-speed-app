import { RouteLink } from '../components/RouteLink';
import { StatCard } from '../components/StatCard';
import { sessionTypeLabel, sortNewestFirst, summarize } from '../features/progress/progressUtils';
import { gridLabel, modeLabel } from '../features/schulte/schulteUtils';
import { formatDateTime, formatDuration } from '../lib/dateUtils';
import type { Session } from '../types/session';

type ProgressPageProps = {
  sessions: Session[];
};

function describeResult(session: Session): string {
  if (session.type === 'reading') {
    return `${session.wordsPerMinute} слов/мин · ${session.wordCount} слов`;
  }
  return `${gridLabel(session.gridSize)}, ${modeLabel(session.mode)} · ошибок: ${session.mistakes}`;
}

export function ProgressPage({ sessions }: ProgressPageProps) {
  if (sessions.length === 0) {
    return (
      <div className="page">
        <header className="page__header">
          <h1>Прогресс</h1>
        </header>
        <section className="card empty">
          <h2 className="card__title">История пока пуста</h2>
          <p className="muted">Завершите первую тренировку — её результат появится здесь.</p>
          <div className="actions">
            <RouteLink className="button button--primary" to="schulte">
              Таблица Шульте
            </RouteLink>
            <RouteLink className="button button--primary" to="reading">
              Чтение
            </RouteLink>
          </div>
        </section>
      </div>
    );
  }

  const summary = summarize(sessions);
  const ordered = sortNewestFirst(sessions);
  const best5 = summary.bestSchulteSeconds[5];
  const best7 = summary.bestSchulteSeconds[7];

  return (
    <div className="page">
      <header className="page__header">
        <h1>Прогресс</h1>
        <p className="lead">Все завершённые тренировки на этом устройстве.</p>
      </header>

      <section className="section" aria-labelledby="progress-summary-title">
        <h2 id="progress-summary-title" className="section__title">
          Сводка
        </h2>
        <dl className="stats">
          <StatCard label="Всего занятий" value={String(summary.totalSessions)} />
          <StatCard
            label="Чтение: лучший темп"
            value={summary.bestWordsPerMinute === null ? '—' : `${summary.bestWordsPerMinute} слов/мин`}
            hint={
              summary.averageWordsPerMinute === null
                ? 'Нет занятий'
                : `В среднем ${summary.averageWordsPerMinute} слов/мин · занятий: ${summary.readingCount}`
            }
          />
          <StatCard
            label="Шульте 5×5: лучшее время"
            value={best5 === null ? '—' : formatDuration(best5)}
          />
          <StatCard
            label="Шульте 7×7: лучшее время"
            value={best7 === null ? '—' : formatDuration(best7)}
            hint={`Всего занятий Шульте: ${summary.schulteCount}`}
          />
        </dl>
      </section>

      <section className="section" aria-labelledby="progress-history-title">
        <h2 id="progress-history-title" className="section__title">
          История
        </h2>
        <ul className="history">
          {ordered.map((session) => (
            <li key={session.id} className={`history__item history__item--${session.type}`}>
              <div className="history__main">
                <span className="history__type">{sessionTypeLabel(session)}</span>
                <time className="history__date" dateTime={session.completedAt}>
                  {formatDateTime(session.completedAt)}
                </time>
              </div>
              <div className="history__details">
                <span>
                  Длительность: <strong>{formatDuration(session.durationSeconds)}</strong>
                </span>
                <span>{describeResult(session)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
