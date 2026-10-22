import type { MouseEvent, ReactNode } from 'react';
import { routeHref, useNavigate, type Route } from '../lib/useHashRoute';

type RouteLinkProps = {
  to: Route;
  className?: string;
  current?: boolean;
  children: ReactNode;
};

/** Ссылка на раздел приложения: переключает экран без перезагрузки и перехода по адресу. */
export function RouteLink({ to, className, current, children }: RouteLinkProps) {
  const navigate = useNavigate();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate(to);
  };

  return (
    <a className={className} href={routeHref(to)} onClick={handleClick} aria-current={current ? 'page' : undefined}>
      {children}
    </a>
  );
}
