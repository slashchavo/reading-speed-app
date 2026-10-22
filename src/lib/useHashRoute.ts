import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Route = 'home' | 'schulte' | 'reading' | 'progress';

const ROUTES: readonly Route[] = ['home', 'schulte', 'reading', 'progress'];

export function routeHref(route: Route): string {
  return route === 'home' ? '#/' : `#/${route}`;
}

function parseHash(hash: string): Route {
  const name = hash.replace(/^#\/?/, '');
  return ROUTES.find((route) => route === name && route !== 'home') ?? 'home';
}

function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Простая навигация по адресу после «#». Отдельная библиотека-роутер для четырёх экранов не нужна.
 * Раздел хранится в состоянии React: если приложение открыто во встроенном окне (например, на claude.ai),
 * изменение адреса там может увести окно на пустую страницу, поэтому адрес меняется только вне такого окна.
 */
export function useHashRoute(): { route: Route; navigate: (route: Route) => void } {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    setRoute(next);
    if (isEmbedded()) return;
    try {
      window.location.hash = routeHref(next);
    } catch {
      // Адрес не обязателен: раздел уже переключён через состояние.
    }
  }, []);

  return { route, navigate };
}

export const NavigateContext = createContext<(route: Route) => void>(() => undefined);

export function useNavigate(): (route: Route) => void {
  return useContext(NavigateContext);
}
