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
        <p className="lead">Найдите все элементы по порядку как можно быстрее и без ошибок.</p>
      </header>
      <SchulteGame
        gridSize={settings.schulteGridSize}
        mode={settings.schulteMode}
        colorMode={settings.schulteColorMode}
        onColorModeChange={(schulteColorMode) => onSettingsChange({ schulteColorMode })}
        onGridSizeChange={(schulteGridSize) => onSettingsChange({ schulteGridSize })}
        onModeChange={(schulteMode) => onSettingsChange({ schulteMode })}
        onComplete={onComplete}
      />
    </div>
  );
}
