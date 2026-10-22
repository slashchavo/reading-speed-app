import { MnemoGame } from '../features/mnemo/MnemoGame';
import type { MnemoGridSession, Settings } from '../types/session';

type Props = {
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onComplete: (session: MnemoGridSession) => boolean;
};

export function MnemoPage({ settings, onSettingsChange, onComplete }: Props) {
  return (
    <div className="page">
      <header className="page__header">
        <h1>Мнемотаблица</h1>
        <p className="lead">Запомните положение и цвет каждого элемента на поле 5×5, а затем восстановите их.</p>
      </header>
      <MnemoGame
        level={settings.mnemoLevel}
        minutes={settings.mnemoMinutes}
        onSettingsChange={onSettingsChange}
        onComplete={onComplete}
      />
    </div>
  );
}
