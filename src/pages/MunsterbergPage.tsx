import { MunsterbergGame } from '../features/munsterberg/MunsterbergGame';
import type { MunsterbergSession, Settings } from '../types/session';

type Props = {
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onComplete: (session: MunsterbergSession) => boolean;
};

export function MunsterbergPage({ settings, onSettingsChange, onComplete }: Props) {
  return (
    <div className="page">
      <header className="page__header">
        <h1>Тест Мюнстерберга</h1>
        <p className="lead">Найдите слова, спрятанные в сплошном ряду букв.</p>
      </header>
      <MunsterbergGame
        level={settings.munsterbergLevel}
        onLevelChange={(munsterbergLevel) => onSettingsChange({ munsterbergLevel })}
        onComplete={onComplete}
      />
    </div>
  );
}
