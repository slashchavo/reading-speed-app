import type { ReactNode } from 'react';
import type { StorageIssue } from '../lib/storage';
import { routeHref, type Route } from '../lib/useHashRoute';
import { Navigation } from './Navigation';

type AppLayoutProps = {
  route: Route;
  storageIssue: StorageIssue;
  children: ReactNode;
};

export function AppLayout({ route, storageIssue, children }: AppLayoutProps) {
  return (
    <div className="layout">
      <a className="skip-link" href="#main">
        Перейти к содержимому
      </a>
      <header className="header">
        <div className="header__inner">
          <a className="brand" href={routeHref('home')}>
            <span className="brand__dot" aria-hidden="true" />
            Фокус
          </a>
          <Navigation current={route} />
        </div>
      </header>
      <main id="main" className="main" tabIndex={-1}>
        {storageIssue === 'unavailable' && (
          <p className="alert alert--warning" role="alert">
            Локальное хранилище браузера недоступно (например, в приватном режиме). Тренировки работают, но
            результаты могут не сохраниться после закрытия страницы.
          </p>
        )}
        {storageIssue === 'corrupted' && (
          <p className="alert alert--warning" role="alert">
            Часть сохранённой истории повреждена и была пропущена. Корректные записи показаны как обычно.
          </p>
        )}
        {children}
      </main>
      <footer className="footer">
        Результаты хранятся только в этом браузере на этом устройстве.
      </footer>
    </div>
  );
}
