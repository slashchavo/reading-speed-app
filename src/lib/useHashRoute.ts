import { useEffect, useState } from 'react';

export type Route = 'home' | 'schulte' | 'reading' | 'progress';

const ROUTES: readonly Route[] = ['home', 'schulte', 'reading', 'progress'];

export function routeHref(route: Route): string {
  return route === 'home' ? '#/' : `#/${route}`;
}

function parseHash(hash: string): Route {
  const name = hash.replace(/^#\/?/, '');
  return ROUTES.find((route) => route === name && route !== 'home') ?? 'home';
}

/**
 * Простая навигация по адресу после «#». Отдельная библиотека-роутер для четырёх экранов не нужна,
 * а кнопка «Назад» в браузере и обновление страницы работают.
 */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
