import { ReaderSession } from '../features/reader/ReaderSession';
import { clampFontSize } from '../lib/storage';
import type { ReadingSession, Settings } from '../types/session';

type ReaderPageProps = {
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onComplete: (session: ReadingSession) => boolean;
};

export function ReaderPage({ settings, onSettingsChange, onComplete }: ReaderPageProps) {
  return (
    <div className="page">
      <header className="page__header">
        <h1>Чтение</h1>
        <p className="lead">Измерьте ориентировочную скорость чтения в словах в минуту.</p>
      </header>
      <ReaderSession
        fontSize={settings.readerFontSize}
        onFontSizeChange={(size) => onSettingsChange({ readerFontSize: clampFontSize(size) })}
        onComplete={onComplete}
      />
    </div>
  );
}
