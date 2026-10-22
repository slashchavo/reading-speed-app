export type GridSize = 5 | 7;
/** 'letters' — латиница (значение сохранено с первого этапа для совместимости истории). */
export type SchulteMode = 'numbers' | 'letters' | 'cyrillic';
export type ColorMode = 'mono' | 'color';
export type MunsterbergLevel = 'easy' | 'medium' | 'hard' | 'expert';
export type MnemoLevel = 'easy' | 'medium' | 'hard' | 'expert';

export type TrainingType =
  | 'reading'
  | 'schulte'
  | 'munsterberg'
  | 'memory_words'
  | 'mnemo_grid'
  | 'alphabet_association';

type BaseSession = {
  id: string;
  completedAt: string; // ISO 8601
  durationSeconds: number;
};

export type SchulteSession = BaseSession & {
  type: 'schulte';
  gridSize: GridSize;
  mode: SchulteMode;
  mistakes: number;
  /** Нет в записях первого этапа — тогда считается чёрно-белым. */
  colorMode?: ColorMode;
};

export type ReadingSource = 'builtin' | 'custom' | 'book';

export type ReadingSession = BaseSession & {
  type: 'reading';
  wordCount: number;
  wordsPerMinute: number;
  /** Нет в записях первого этапа (тогда это демо- или свой текст). */
  source?: ReadingSource;
  textId?: string;
  bookId?: string;
  title?: string;
};

export type MunsterbergSession = BaseSession & {
  type: 'munsterberg';
  level: MunsterbergLevel;
  rows: number;
  targetCount: number;
  found: number;
  missed: number;
  extra: number;
};

export type MemoryWordsSession = BaseSession & {
  type: 'memory_words';
  wordCount: number;
  memorizeMinutes: number;
  correct: number;
  missed: number;
  extra: number;
};

export type MnemoGridSession = BaseSession & {
  type: 'mnemo_grid';
  level: MnemoLevel;
  elementCount: number;
  memorizeMinutes: number;
  /** Доля верно восстановленных клеток 5×5 (включая пустые), 0–100. */
  positionAccuracy: number;
  /** Доля элементов с верно выбранным цветом, 0–100. */
  colorAccuracy: number;
};

export type AlphabetAnswer = {
  category: string;
  /** null — категория пропущена. */
  answer: string | null;
  /** true, если ответ не начинается с нужной буквы. */
  warning: boolean;
};

export type AlphabetSession = BaseSession & {
  type: 'alphabet_association';
  letter: string;
  filled: number;
  skipped: number;
  answers: AlphabetAnswer[];
};

export type Session =
  | SchulteSession
  | ReadingSession
  | MunsterbergSession
  | MemoryWordsSession
  | MnemoGridSession
  | AlphabetSession;

export type Settings = {
  readerFontSize: number;
  schulteGridSize: GridSize;
  schulteMode: SchulteMode;
  schulteColorMode: ColorMode;
  munsterbergLevel: MunsterbergLevel;
  memoryWordCount: number;
  memoryMinutes: 1 | 2 | 3;
  mnemoLevel: MnemoLevel;
  mnemoMinutes: 1 | 2 | 3 | 4 | 5;
};
