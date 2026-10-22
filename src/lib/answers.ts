/** Нормализация слова: нижний регистр, без краевой пунктуации; по желанию «ё» = «е». */
export function normalizeWord(raw: string, yoAsE = true): string {
  const lower = raw.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  return yoAsE ? lower.replace(/ё/g, 'е') : lower;
}

/** Разбивает ввод на слова: пробелы, запятые, точки с запятой, переносы строк. Пустые токены удаляются. */
export function tokenizeAnswers(input: string, yoAsE = true): string[] {
  return input
    .split(/[\s,;]+/u)
    .map((token) => normalizeWord(token, yoAsE))
    .filter((token) => token !== '');
}

export type AnswerCheck = {
  /** Найденные цели — в исходном написании, в порядке целей. */
  found: string[];
  /** Пропущенные цели — в исходном написании. */
  missed: string[];
  /** Лишние ответы — уникальные, в нормализованном виде, в порядке ввода. */
  extra: string[];
};

/** Сверяет ответы с целями. Каждое верное слово засчитывается один раз. */
export function checkAnswers(targets: readonly string[], input: string, yoAsE = true): AnswerCheck {
  const given = new Set(tokenizeAnswers(input, yoAsE));
  const targetKeys = new Set(targets.map((word) => normalizeWord(word, yoAsE)));
  const found: string[] = [];
  const missed: string[] = [];
  for (const target of targets) {
    (given.has(normalizeWord(target, yoAsE)) ? found : missed).push(target);
  }
  const extra = [...given].filter((token) => !targetKeys.has(token));
  return { found, missed, extra };
}

export function percent(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((part / total) * 100);
}
