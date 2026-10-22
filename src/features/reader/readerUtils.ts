/** Минимальная длительность, при которой скорость считается осмысленной. */
export const MIN_READING_SECONDS = 1;

/** Тексты меньше этого числа слов разрешены, но результат будет неточным. */
export const SHORT_TEXT_WORDS = 20;

/** Максимальный размер загружаемого .txt файла (1 МБ). */
export const MAX_FILE_BYTES = 1024 * 1024;

/** Нормализует пробелы и считает слова, разделённые пробелами и переносами строк. */
export function countWords(text: string): number {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized === '') return 0;
  return normalized.split(' ').length;
}

/**
 * Скорость чтения в словах в минуту (целое число).
 * Возвращает null, если данных недостаточно (нет слов или сессия короче секунды) —
 * так в интерфейс не попадут NaN или Infinity.
 */
export function calculateWordsPerMinute(wordCount: number, durationSeconds: number): number | null {
  if (!Number.isFinite(wordCount) || wordCount <= 0) return null;
  if (!Number.isFinite(durationSeconds) || durationSeconds < MIN_READING_SECONDS) return null;
  return Math.round(wordCount / (durationSeconds / 60));
}

export function isTxtFile(file: { name: string; type: string }): boolean {
  return file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');
}
