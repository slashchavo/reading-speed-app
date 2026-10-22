import { useEffect, useRef, useState } from 'react';

/**
 * Обратный отсчёт до deadline (Date.now()-время в мс). Оставшееся время = deadline − сейчас,
 * интервал только перерисовывает экран; при возвращении на вкладку значение пересчитывается.
 * onExpire вызывается один раз, когда время вышло.
 */
export function useCountdown(deadline: number | null, onExpire: () => void): number {
  const [remaining, setRemaining] = useState(() => (deadline === null ? 0 : Math.max(0, deadline - Date.now())));
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (deadline === null) return undefined;
    let fired = false;
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (left === 0 && !fired) {
        fired = true;
        onExpireRef.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [deadline]);

  return deadline === null ? 0 : remaining;
}

/** Прямой отсчёт от startedAt (Date.now()-время в мс), пересчитывается при возвращении на вкладку. */
export function useElapsed(startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null) return undefined;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [startedAt]);

  return startedAt === null ? 0 : Math.max(0, now - startedAt);
}
