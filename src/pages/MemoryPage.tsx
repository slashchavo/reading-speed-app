import { MemoryGame } from '../features/memory/MemoryGame';
import type { MemoryWordsSession, Settings } from '../types/session';

type Props = {
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onComplete: (session: MemoryWordsSession) => boolean;
};

export function MemoryPage({ settings, onSettingsChange, onComplete }: Props) {
  return (
    <div className="page">
      <header className="page__header">
        <h1>Память на слова</h1>
        <p className="lead">Запомните список слов за отведённое время, а затем запишите всё, что вспомните.</p>
      </header>
      <MemoryGame
        wordCount={settings.memoryWordCount}
        minutes={settings.memoryMinutes}
        onSettingsChange={onSettingsChange}
        onComplete={onComplete}
      />
    </div>
  );
}
