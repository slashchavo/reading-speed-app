export type GridSize = 5 | 7;
export type SchulteMode = 'numbers' | 'letters';

export type SchulteSession = {
  id: string;
  type: 'schulte';
  completedAt: string; // ISO 8601
  durationSeconds: number;
  gridSize: GridSize;
  mode: SchulteMode;
  mistakes: number;
};

export type ReadingSession = {
  id: string;
  type: 'reading';
  completedAt: string; // ISO 8601
  durationSeconds: number;
  wordCount: number;
  wordsPerMinute: number;
};

export type Session = SchulteSession | ReadingSession;

export type Settings = {
  readerFontSize: number;
  schulteGridSize: GridSize;
  schulteMode: SchulteMode;
};
