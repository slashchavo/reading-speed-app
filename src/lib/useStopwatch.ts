import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Секундомер на основе временных меток: прошедшее время = сейчас − момент старта.
 * Интервал нужен только для перерисовки, поэтому задержки вкладки не накапливают ошибку.
 */
export function useStopwatch() {
  const startRef = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!running) return undefined;
    const tick = () => {
      if (startRef.current !== null) setElapsedMs(performance.now() - startRef.current);
    };
    const id = window.setInterval(tick, 100);
    // При возвращении на вкладку сразу показываем актуальное время.
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [running]);

  const start = useCallback(() => {
    startRef.current = performance.now();
    setElapsedMs(0);
    setRunning(true);
  }, []);

  /** Останавливает секундомер и возвращает точную длительность в миллисекундах. */
  const stop = useCallback((): number => {
    const duration = startRef.current === null ? 0 : performance.now() - startRef.current;
    startRef.current = null;
    setElapsedMs(duration);
    setRunning(false);
    return duration;
  }, []);

  const reset = useCallback(() => {
    startRef.current = null;
    setElapsedMs(0);
    setRunning(false);
  }, []);

  return { elapsedMs, running, start, stop, reset };
}
