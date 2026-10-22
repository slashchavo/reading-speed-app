import { routeHref, type Route } from '../lib/useHashRoute';

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
            <a
              className="nav__link"
              href={routeHref(item.route)}
              aria-current={item.route === current ? 'page' : undefined}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
