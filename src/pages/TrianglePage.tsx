import { TriangleGame } from '../features/triangle/TriangleGame';
import type { Settings, TriangleFieldSession } from '../types/session';

type Props = {
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onComplete: (session: TriangleFieldSession) => boolean;
};

export function TrianglePage({ settings, onSettingsChange, onComplete }: Props) {
  return (
    <div className="page">
      <header className="page__header">
        <h1>Треугольное поле</h1>
        <p className="lead">Найдите числа от 1 до 99 по порядку среди разноцветных треугольников.</p>
      </header>
      <TriangleGame
        mode={settings.triangleMode}
        minutes={settings.triangleMinutes}
        onSettingsChange={onSettingsChange}
        onComplete={onComplete}
      />
    </div>
  );
}
