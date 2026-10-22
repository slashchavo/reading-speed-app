/** Генератор случайных чисел в [0, 1). В тестах подменяется детерминированным. */
export type RandomFn = () => number;

/** Случайная перестановка (Фишер — Йетс). Исходный массив не изменяется. */
export function shuffle<T>(items: readonly T[], random: RandomFn = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const current = result[i] as T;
    result[i] = result[j] as T;
    result[j] = current;
  }
  return result;
}

/** count различных элементов в случайном порядке. */
export function sample<T>(items: readonly T[], count: number, random: RandomFn = Math.random): T[] {
  return shuffle(items, random).slice(0, Math.max(0, Math.min(count, items.length)));
}

export function randomInt(maxExclusive: number, random: RandomFn = Math.random): number {
  return Math.floor(random() * maxExclusive);
}

/** Детерминированный генератор (mulberry32) — для воспроизводимых тестов. */
export function seededRandom(seed: number): RandomFn {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
