import { useEffect } from 'react';
import { AppLayout } from '../components/AppLayout';
import { NavigateContext, useHashRoute, type Route } from '../lib/useHashRoute';
import { AlphabetPage } from '../pages/AlphabetPage';
import { BooksPage } from '../pages/BooksPage';
import { HomePage } from '../pages/HomePage';
import { MemoryPage } from '../pages/MemoryPage';
import { MnemoPage } from '../pages/MnemoPage';
import { MunsterbergPage } from '../pages/MunsterbergPage';
import { ProgressPage } from '../pages/ProgressPage';
import { ReaderPage } from '../pages/ReaderPage';
import { SchultePage } from '../pages/SchultePage';
import { TrainingsPage } from '../pages/TrainingsPage';
import { useAppData } from './useAppData';

const TITLES: Record<Route, string> = {
  home: 'Фокус — тренировка чтения и внимания',
  trainings: 'Тренировки — Фокус',
  schulte: 'Таблица Шульте — Фокус',
  munsterberg: 'Тест Мюнстерберга — Фокус',
  memory: 'Память на слова — Фокус',
  mnemo: 'Мнемотаблица — Фокус',
  alphabet: 'От А до Я — Фокус',
  reading: 'Чтение — Фокус',
  books: 'Мои книги — Фокус',
  progress: 'Прогресс — Фокус',
};

export function App() {
  const { route, navigate } = useHashRoute();
  const data = useAppData();
  const common = { settings: data.settings, onSettingsChange: data.updateSettings, onComplete: data.addSession };

  useEffect(() => {
    document.title = TITLES[route];
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <NavigateContext.Provider value={navigate}>
      <AppLayout route={route} storageIssue={data.storageIssue}>
        {route === 'home' && <HomePage sessions={data.sessions} />}
        {route === 'trainings' && <TrainingsPage sessions={data.sessions} />}
        {route === 'schulte' && <SchultePage {...common} />}
        {route === 'munsterberg' && <MunsterbergPage {...common} />}
        {route === 'memory' && <MemoryPage {...common} />}
        {route === 'mnemo' && <MnemoPage {...common} />}
        {route === 'alphabet' && <AlphabetPage onComplete={data.addSession} />}
        {route === 'reading' && <ReaderPage {...common} />}
        {route === 'books' && <BooksPage {...common} />}
        {route === 'progress' && (
          <ProgressPage sessions={data.sessions} settings={data.settings} onImport={data.importSessions} />
        )}
      </AppLayout>
    </NavigateContext.Provider>
  );
}
