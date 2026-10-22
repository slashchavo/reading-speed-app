/** Локальная дата и время, например «22.10.2026, 14:05». */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Длительность: «42,3 с» до минуты, затем «2 мин 05 с». */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) {
    return `${seconds.toFixed(1).replace('.', ',')} с`;
  }
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes} мин ${String(rest).padStart(2, '0')} с`;
}

/** Секундомер для активной тренировки: «0:42.3» → «0:42,3». */
export function formatStopwatch(milliseconds: number): string {
  const safe = Number.isFinite(milliseconds) && milliseconds > 0 ? milliseconds : 0;
  const tenths = Math.floor(safe / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  const fraction = tenths % 10;
  return `${minutes}:${String(seconds).padStart(2, '0')},${fraction}`;
}

/** Локальная дата устройства в формате YYYY-MM-DD. */
export function localDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Часы обратного/прямого отсчёта: «02:05» (или «1:02:05» дольше часа). */
export function formatClock(milliseconds: number): string {
  const totalSeconds = Number.isFinite(milliseconds) && milliseconds > 0 ? Math.floor(milliseconds / 1000) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Округление длительности до десятых секунды для истории. */
export function roundSeconds(milliseconds: number): number {
  return Number.isFinite(milliseconds) && milliseconds > 0 ? Math.round(milliseconds / 100) / 10 : 0;
}
