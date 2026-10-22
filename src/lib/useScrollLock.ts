import { useEffect } from 'react';

/**
 * Пока active = true, страница не прокручивается (в том числе «резиновая» прокрутка на iPad).
 * Стили восстанавливаются при завершении раунда и при уходе со страницы.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    const html = document.documentElement;
    const body = document.body;
    const saved = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
    };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    return () => {
      html.style.overflow = saved.htmlOverflow;
      body.style.overflow = saved.bodyOverflow;
      html.style.overscrollBehavior = saved.htmlOverscroll;
    };
  }, [active]);
}
