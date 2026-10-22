import { ColorMatchGame } from '../features/colorMatch/ColorMatchGame';
import type { ColorMatchSession, Settings } from '../types/session';

type Props = {
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onComplete: (session: ColorMatchSession) => boolean;
};

export function ColorMatchPage({ settings, onSettingsChange, onComplete }: Props) {
  return (
    <div className="page">
      <header className="page__header">
        <h1>Совпадает ли цвет?</h1>
        <p className="lead">Тренировка внимания: сравните название цвета слева с цветом букв справа.</p>
      </header>
      <ColorMatchGame
        minutes={settings.colorMatchMinutes}
        onMinutesChange={(colorMatchMinutes) => onSettingsChange({ colorMatchMinutes })}
        onComplete={onComplete}
      />
    </div>
  );
}
