import { useState } from 'react';
import { RouteLink } from '../components/RouteLink';
import { StatCard } from '../components/StatCard';
import { BackupPanel } from '../features/progress/BackupPanel';
import { describeSession, sessionTypeLabel, sortNewestFirst, summarize, TRAINING_LABELS } from '../features/progress/progressUtils';
import { formatDateTime, formatDuration } from '../lib/dateUtils';
import type { Session, Settings, TrainingType } from '../types/session';

type ProgressPageProps = {
  sessions: Session[];
  settings: Settings;
  onImport: (sessions: Session[], settings: Settings) => number | null;
};

const PAGE_SIZE = 30;
type Filter = 'all' | TrainingType;

const show = (value: number | null, suffix: string) => (value === null ? '—' : `${value}${suffix}`);

export function ProgressPage({ sessions, settings, onImport }: ProgressPageProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Блок резервной копии всегда стоит на одном месте, чтобы не терять сообщение после восстановления.
  return (
    <div className="page">
      <header className="page__header">
        <h1>Прогресс</h1>
        {sessions.length > 0 && (
          <p className="lead">
            Все завершённые тренировки на этом устройстве. Метрики разных упражнений не сравниваются между собой.
          </p>
        )}
      </header>
      {sessions.length === 0 ? (
        <section className="card empty">
          <h2 className="card__title">История пока пуста</h2>
          <p className="muted">Завершите первую тренировку — её результат появится здесь.</p>
          <div className="actions">
            <RouteLink className="button button--primary" to="reading">
              Чтение
            </RouteLink>
            <RouteLink className="button button--primary" to="trainings">
              Тренировки
            </RouteLink>
          </div>
        </section>
      ) : (
        <ProgressContent sessions={sessions} filter={filter} limit={limit} onFilter={setFilter} onLimit={setLimit} />
      )}
      <BackupPanel sessions={sessions} settings={settings} onImport={onImport} />
    </div>
  );
}

type ContentProps = {
  sessions: Session[];
  filter: Filter;
  limit: number;
  onFilter: (filter: Filter) => void;
  onLimit: (limit: number) => void;
};

function ProgressContent({ sessions, filter, limit, onFilter, onLimit }: ContentProps) {
  const s = summarize(sessions);
  const c = s.countByType;
  const ordered = sortNewestFirst(sessions).filter((item) => filter === 'all' || item.type === filter);
  const visible = ordered.slice(0, limit);
  const types = (Object.keys(TRAINING_LABELS) as TrainingType[]).filter((type) => c[type] > 0);

  return (
    <>
      <section className="section section--first" aria-labelledby="progress-summary-title">
        <h2 id="progress-summary-title" className="section__title">
          Сводка
        </h2>
        <dl className="stats">
          <StatCard label="Всего занятий" value={String(s.totalSessions)} />
          {c.reading > 0 && (
            <StatCard
              label="Чтение: лучший темп"
              value={show(s.reading.best, ' слов/мин')}
              hint={`В среднем ${show(s.reading.average, ' слов/мин')} · занятий: ${c.reading}`}
            />
          )}
          {s.schulte.bestSession && (
            <StatCard
              label="Шульте: лучшая сессия"
              value={`${s.schulte.bestSession.tables} табл.`}
              hint={`за ${s.schulte.bestSession.minutes} мин, ${s.schulte.bestSession.gridSize}×${s.schulte.bestSession.gridSize} · занятий: ${c.schulte}`}
            />
          )}
          {(s.schulte.best[5] !== null || s.schulte.best[7] !== null) && (
            <StatCard
              label="Шульте: лучшее время таблицы (старые записи)"
              value={`5×5: ${s.schulte.best[5] === null ? '—' : formatDuration(s.schulte.best[5])}`}
              hint={`7×7: ${s.schulte.best[7] === null ? '—' : formatDuration(s.schulte.best[7])}`}
            />
          )}
          {c.munsterberg > 0 && (
            <StatCard
              label="Мюнстерберг: лучший результат"
              value={show(s.munsterberg.bestPercent, ' %')}
              hint={`В среднем ${show(s.munsterberg.averagePercent, ' %')} найденных слов · тестов: ${c.munsterberg}`}
            />
          )}
          {c.memory_words > 0 && (
            <StatCard
              label="Память на слова: лучший результат"
              value={show(s.memory.bestPercent, ' %')}
              hint={`В среднем ${show(s.memory.averagePercent, ' %')} вспомненных слов · раундов: ${c.memory_words}`}
            />
          )}
          {c.mnemo_grid > 0 && (
            <StatCard
              label="Мнемотаблица: средняя точность"
              value={`положение ${show(s.mnemo.averagePosition, ' %')}`}
              hint={`цвет ${show(s.mnemo.averageColor, ' %')} · раундов: ${c.mnemo_grid}`}
            />
          )}
          {c.color_match > 0 && (
            <StatCard
              label="Совпадает ли цвет?: лучшая точность"
              value={show(s.colorMatch.bestAccuracy, ' %')}
              hint={`В среднем ${show(s.colorMatch.averageAccuracy, ' %')} · раундов: ${c.color_match}`}
            />
          )}
          {c.triangle_field > 0 && (
            <StatCard
              label="Треугольное поле"
              value={s.triangle.bestCompleteSeconds === null ? `до ${show(s.triangle.bestFound, '')} из 99` : formatDuration(s.triangle.bestCompleteSeconds)}
              hint={`${s.triangle.bestCompleteSeconds === null ? 'Лучший результат на время' : 'Лучшее время всего поля'} · раундов: ${c.triangle_field}`}
            />
          )}
          {c.alphabet_association > 0 && (
            <StatCard
              label="От А до Я: пройдено букв"
              value={`${s.alphabet.letters} из 33`}
              hint={`В среднем заполнено ${show(s.alphabet.averageFilled, '')} из 12 · раундов: ${c.alphabet_association}`}
            />
          )}
        </dl>
      </section>

      <section className="section" aria-labelledby="progress-history-title">
        <h2 id="progress-history-title" className="section__title">
          История
        </h2>
        {types.length > 1 && (
          <label className="field history-filter">
            <span className="field__label">Показать</span>
            <select
              className="field__select"
              value={filter}
              onChange={(event) => {
                onFilter(event.target.value as Filter);
                onLimit(PAGE_SIZE);
              }}
            >
              <option value="all">Все тренировки ({s.totalSessions})</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {TRAINING_LABELS[type]} ({c[type]})
                </option>
              ))}
            </select>
          </label>
        )}
        <ul className="history">
          {visible.map((session) => (
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
                <span>{describeSession(session)}</span>
              </div>
            </li>
          ))}
        </ul>
        {ordered.length > limit && (
          <button type="button" className="button" onClick={() => onLimit(limit + PAGE_SIZE)}>
            Показать ещё ({ordered.length - limit})
          </button>
        )}
      </section>
    </>
  );
}
