import { SchulteGame } from '../features/schulte/SchulteGame';
import type { SchulteSession, Settings } from '../types/session';

type SchultePageProps = {
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onComplete: (session: SchulteSession) => boolean;
};

export function SchultePage({ settings, onSettingsChange, onComplete }: SchultePageProps) {
  return (
    <div className="page">
      <header className="page__header">
        <h1>Таблица Шульте</h1>
        <p className="lead">Находите элементы по порядку. Сессия по таймеру: чем больше таблиц, тем лучше.</p>
      </header>
      <SchulteGame settings={settings} onSettingsChange={onSettingsChange} onComplete={onComplete} />
    </div>
  );
}
