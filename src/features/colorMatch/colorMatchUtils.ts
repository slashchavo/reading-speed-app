import { randomInt, type RandomFn } from '../../lib/random';

export type ColorId = 'red' | 'orange' | 'yellow' | 'green' | 'lightblue' | 'blue' | 'violet' | 'pink';

/**
 * Только цвета радуги и розовый. Значения подобраны для тёмного фона правой карточки:
 * все цвета читаются (контраст ≥ 4.5:1) и не путаются между собой.
 */
export const COLOR_WORDS: readonly { id: ColorId; word: string; hex: string }[] = [
  { id: 'red', word: 'КРАСНЫЙ', hex: '#ff4d4d' },
  { id: 'orange', word: 'ОРАНЖЕВЫЙ', hex: '#ff9500' },
  { id: 'yellow', word: 'ЖЁЛТЫЙ', hex: '#ffe600' },
  { id: 'green', word: 'ЗЕЛЁНЫЙ', hex: '#2ecc40' },
  { id: 'lightblue', word: 'ГОЛУБОЙ', hex: '#5ac8fa' },
  { id: 'blue', word: 'СИНИЙ', hex: '#6f8bff' },
  { id: 'violet', word: 'ФИОЛЕТОВЫЙ', hex: '#c27bff' },
  { id: 'pink', word: 'РОЗОВЫЙ', hex: '#ff7ac6' },
];

/** Фон карточки с цветными буквами. */
export const INK_BACKGROUND = '#1f232a';

export type Trial = {
  /** Название цвета на левой карточке (нейтральным текстом). */
  left: ColorId;
  /** Слово на правой карточке. */
  word: ColorId;
  /** Фактический цвет букв правой карточки. */
  ink: ColorId;
};

/** Правильный ответ «Да», если слово слева совпадает с цветом букв справа (а не со словом справа). */
export function isMatch(trial: Trial): boolean {
  return trial.left === trial.ink;
}

export function isCorrectAnswer(trial: Trial, answerYes: boolean): boolean {
  return isMatch(trial) === answerYes;
}

const key = (t: Trial) => `${t.left}|${t.word}|${t.ink}`;
const ids = COLOR_WORDS.map((c) => c.id);
const pick = (random: RandomFn, except?: ColorId): ColorId => {
  const pool = except ? ids.filter((id) => id !== except) : ids;
  return pool[randomInt(pool.length, random)] ?? 'red';
};

/** Окно последних пар, в котором не повторяем одинаковую комбинацию. */
export const RECENT_WINDOW = 6;

/**
 * Новая пара: «Да» и «Нет» примерно поровну; одинаковая комбинация не повторяется подряд
 * и в окне последних RECENT_WINDOW пар.
 */
export function nextTrial(recent: readonly Trial[], random: RandomFn = Math.random): Trial {
  const avoid = new Set(recent.slice(-RECENT_WINDOW).map(key));
  let trial: Trial = { left: 'red', word: 'red', ink: 'red' };
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const left = pick(random);
    const ink = random() < 0.5 ? left : pick(random, left);
    const word = pick(random);
    trial = { left, word, ink };
    if (!avoid.has(key(trial))) return trial;
  }
  return trial;
}

export function colorById(id: ColorId) {
  return COLOR_WORDS.find((c) => c.id === id) ?? COLOR_WORDS[0]!;
}

export function accuracy(correct: number, attempts: number): number {
  return attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
}
