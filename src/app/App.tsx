import { useEffect } from 'react';
import { AppLayout } from '../components/AppLayout';
import { NavigateContext, useHashRoute } from '../lib/useHashRoute';
import { HomePage } from '../pages/HomePage';
import { ProgressPage } from '../pages/ProgressPage';
import { ReaderPage } from '../pages/ReaderPage';
import { SchultePage } from '../pages/SchultePage';
import { useAppData } from './useAppData';

const TITLES = {
  home: 'Фокус — тренировка чтения и внимания',
  schulte: 'Таблица Шульте — Фокус',
  reading: 'Чтение — Фокус',
  progress: 'Прогресс — Фокус',
} as const;

export function App() {
  const { route, navigate } = useHashRoute();
  const data = useAppData();

  useEffect(() => {
    document.title = TITLES[route];
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <NavigateContext.Provider value={navigate}>
      <AppLayout route={route} storageIssue={data.storageIssue}>
        {route === 'home' && <HomePage sessions={data.sessions} />}
        {route === 'schulte' && (
          <SchultePage settings={data.settings} onSettingsChange={data.updateSettings} onComplete={data.addSession} />
        )}
        {route === 'reading' && (
          <ReaderPage settings={data.settings} onSettingsChange={data.updateSettings} onComplete={data.addSession} />
        )}
        {route === 'progress' && <ProgressPage sessions={data.sessions} />}
      </AppLayout>
    </NavigateContext.Provider>
  );
}
