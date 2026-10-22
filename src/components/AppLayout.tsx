import type { ReactNode } from 'react';
import type { StorageIssue } from '../lib/storage';
import type { Route } from '../lib/useHashRoute';
import { Navigation } from './Navigation';
import { RouteLink } from './RouteLink';

type AppLayoutProps = {
  route: Route;
  storageIssue: StorageIssue;
  children: ReactNode;
};

export function AppLayout({ route, storageIssue, children }: AppLayoutProps) {
  return (
    <div className="layout">
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          // Переводим фокус вручную, не меняя адрес страницы.
          event.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Перейти к содержимому
      </a>
      <header className="header">
        <div className="header__inner">
          <RouteLink className="brand" to="home">
            <span className="brand__dot" aria-hidden="true" />
            Фокус
          </RouteLink>
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
