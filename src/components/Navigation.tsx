import type { Route } from '../lib/useHashRoute';
import { RouteLink } from './RouteLink';

const ITEMS: { route: Route; label: string }[] = [
  { route: 'home', label: 'Главная' },
  { route: 'schulte', label: 'Шульте' },
  { route: 'reading', label: 'Чтение' },
  { route: 'progress', label: 'Прогресс' },
];

type NavigationProps = {
  current: Route;
};

export function Navigation({ current }: NavigationProps) {
  return (
    <nav className="nav" aria-label="Основные разделы">
      <ul className="nav__list">
        {ITEMS.map((item) => (
          <li key={item.route}>
            <RouteLink className="nav__link" to={item.route} current={item.route === current}>
              {item.label}
            </RouteLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
