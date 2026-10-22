import { RUSSIAN_ALPHABET } from '../../lib/alphabet';
import { isRecord, readJson, writeJson, type KeyValueStorage } from '../../lib/localStore';
import type { AlphabetAnswer, AlphabetSession } from '../../types/session';

export const ALPHABET_KEY = 'focus-app:alphabet:v1';

export const CATEGORIES: readonly string[] = [
  'Животное',
  'Птица',
  'Растение',
  'Автомобиль (марка или модель)',
  'Предмет одежды',
  'Известная личность',
  'Поэт или писатель',
  'Страна',
  'Город',
  'Река или океан',
  'Женское имя',
  'Мужское имя',
];

export type AlphabetMode = 'sequential' | 'manual';

export type LetterCompletion = {
  letter: string;
  completedOnLocalDate: string; // YYYY-MM-DD
  resultId: string;
};

export type ActiveAlphabet = {
  /** Он же будет id записи в истории — завершение идемпотентно. */
  id: string;
  letter: string;
  mode: AlphabetMode;
  /** Индекс текущей категории (0–11). */
  index: number;
  /** Ответы по категориям; null — пропуск. Длина = числу пройденных карточек. */
  answers: AlphabetAnswer[];
  /** Момент показа первой карточки, Date.now() в мс. */
  startedAt: number;
};

export type AlphabetState = {
  completions: Record<string, LetterCompletion>;
  active: ActiveAlphabet | null;
};

export const EMPTY_STATE: AlphabetState = { completions: {}, active: null };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseCompletion(value: unknown): LetterCompletion | null {
  if (!isRecord(value)) return null;
  const { letter, completedOnLocalDate, resultId } = value;
  if (typeof letter !== 'string' || !RUSSIAN_ALPHABET.includes(letter)) return null;
  if (typeof completedOnLocalDate !== 'string' || !DATE_RE.test(completedOnLocalDate)) return null;
  if (typeof resultId !== 'string') return null;
  return { letter, completedOnLocalDate, resultId };
}

function parseActive(value: unknown): ActiveAlphabet | null {
  if (!isRecord(value)) return null;
  const { id, letter, mode, index, answers, startedAt } = value;
  if (typeof id !== 'string' || typeof letter !== 'string' || !RUSSIAN_ALPHABET.includes(letter)) return null;
  if (mode !== 'sequential' && mode !== 'manual') return null;
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= CATEGORIES.length) return null;
  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt)) return null;
  if (!Array.isArray(answers) || answers.length !== index) return null;
  const parsed: AlphabetAnswer[] = [];
  for (const item of answers) {
    if (!isRecord(item) || typeof item.category !== 'string') return null;
    if (item.answer !== null && typeof item.answer !== 'string') return null;
    parsed.push({ category: item.category, answer: item.answer, warning: item.warning === true });
  }
  return { id, letter, mode, index, answers: parsed, startedAt };
}

/** Безопасное чтение состояния: повреждённые части отбрасываются. */
export function parseAlphabetState(value: unknown): AlphabetState {
  if (!isRecord(value)) return EMPTY_STATE;
  const completions: Record<string, LetterCompletion> = {};
  if (isRecord(value.completions)) {
    for (const item of Object.values(value.completions)) {
      const completion = parseCompletion(item);
      if (completion) completions[completion.letter] = completion;
    }
  }
  return { completions, active: parseActive(value.active) };
}

export function loadAlphabetState(storage?: KeyValueStorage | null): AlphabetState {
  const result = readJson(ALPHABET_KEY, storage);
  return result.status === 'ok' ? parseAlphabetState(result.value) : EMPTY_STATE;
}

export function saveAlphabetState(state: AlphabetState, storage?: KeyValueStorage | null): boolean {
  return writeJson(ALPHABET_KEY, state, storage);
}

/** Буква завершена сегодня (по локальной дате устройства) и недоступна до завтра. */
export function isLockedToday(state: AlphabetState, letter: string, today: string): boolean {
  return state.completions[letter]?.completedOnLocalDate === today;
}

export function completedTodayCount(state: AlphabetState, today: string): number {
  return RUSSIAN_ALPHABET.filter((letter) => isLockedToday(state, letter, today)).length;
}

/** Следующая буква для последовательного режима: первая по алфавиту, не завершённая сегодня. */
export function nextSequentialLetter(state: AlphabetState, today: string): string | null {
  return RUSSIAN_ALPHABET.find((letter) => !isLockedToday(state, letter, today)) ?? null;
}

export function startActive(id: string, letter: string, mode: AlphabetMode, now: number): ActiveAlphabet {
  return { id, letter, mode, index: 0, answers: [], startedAt: now };
}

export type AnswerCheck = 'empty' | 'ok' | 'mismatch';

/** Первая буква ответа (любой алфавит) в верхнем регистре или null. */
export function firstLetter(text: string): string | null {
  const match = text.match(/\p{L}/u);
  return match ? match[0].toUpperCase() : null;
}

/**
 * Проверяет только первую букву: первая буква ответа должна совпадать с выбранной.
 * Смысл ответа (действительно ли это птица) не проверяется.
 */
export function checkAnswer(letter: string, text: string): AnswerCheck {
  const first = firstLetter(text.trim());
  if (first === null) return 'empty';
  return first === letter ? 'ok' : 'mismatch';
}

/** Записывает ответ (или пропуск) текущей карточки и переходит к следующей. */
export function recordAnswer(active: ActiveAlphabet, answer: string | null): ActiveAlphabet {
  const category = CATEGORIES[active.index] ?? '';
  const trimmed = answer === null ? null : answer.trim();
  const warning = trimmed !== null && checkAnswer(active.letter, trimmed) !== 'ok';
  return {
    ...active,
    index: active.index + 1,
    answers: [...active.answers, { category, answer: trimmed, warning }],
  };
}

export function isRoundComplete(active: ActiveAlphabet): boolean {
  return active.answers.length >= CATEGORIES.length;
}

/** Запись истории для завершённого раунда. */
export function buildSession(active: ActiveAlphabet, finishedAt: number): AlphabetSession {
  const filled = active.answers.filter((a) => a.answer !== null).length;
  return {
    id: active.id,
    type: 'alphabet_association',
    completedAt: new Date(finishedAt).toISOString(),
    durationSeconds: Math.max(0, Math.round((finishedAt - active.startedAt) / 100) / 10),
    letter: active.letter,
    filled,
    skipped: active.answers.length - filled,
    answers: active.answers,
  };
}

/** Фиксирует завершение: буква блокируется на сегодня, активная игра очищается. Повторный вызов ничего не меняет. */
export function completeLetter(state: AlphabetState, active: ActiveAlphabet, today: string): AlphabetState {
  return {
    completions: {
      ...state.completions,
      [active.letter]: { letter: active.letter, completedOnLocalDate: today, resultId: active.id },
    },
    active: null,
  };
}

/** Подпись для заблокированной буквы: «Доступно завтра, 23.10 с 00:00». */
export function unlockLabel(today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  const tomorrow = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1);
  const dd = String(tomorrow.getDate()).padStart(2, '0');
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  return `Доступно завтра, ${dd}.${mm} с 00:00`;
}
