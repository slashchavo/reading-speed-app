import { describe, expect, it } from 'vitest';
import { RUSSIAN_ALPHABET } from '../../lib/alphabet';
import { localDateString } from '../../lib/dateUtils';
import type { KeyValueStorage } from '../../lib/localStore';
import {
  ALPHABET_KEY,
  buildSession,
  CATEGORIES,
  checkAnswer,
  completedTodayCount,
  completeLetter,
  EMPTY_STATE,
  isLockedToday,
  isRoundComplete,
  loadAlphabetState,
  nextSequentialLetter,
  recordAnswer,
  saveAlphabetState,
  startActive,
  unlockLabel,
  type AlphabetState,
} from './alphabetUtils';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const data = new Map(Object.entries(initial));
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('категории и алфавит', () => {
  it('12 категорий и 33 буквы', () => {
    expect(CATEGORIES).toHaveLength(12);
    expect(RUSSIAN_ALPHABET).toHaveLength(33);
  });
});

describe('checkAnswer', () => {
  it('проверяет первую букву без учёта регистра и краевых знаков', () => {
    expect(checkAnswer('А', '  «аист»')).toBe('ok');
    expect(checkAnswer('А', 'Бобр')).toBe('mismatch');
    expect(checkAnswer('А', '   ')).toBe('empty');
    expect(checkAnswer('А', '123 !')).toBe('empty');
  });

  it('Ё и Е — разные буквы', () => {
    expect(checkAnswer('Ё', 'ёж')).toBe('ok');
    expect(checkAnswer('Ё', 'еж')).toBe('mismatch');
  });

  it('латинская первая буква — несовпадение (с предупреждением)', () => {
    expect(checkAnswer('А', 'Audi')).toBe('mismatch');
  });
});

describe('ежедневная блокировка', () => {
  const today = '2026-10-22';
  const state: AlphabetState = {
    completions: { А: { letter: 'А', completedOnLocalDate: today, resultId: 'r1' } },
    active: null,
  };

  it('буква завершена сегодня — заблокирована, другие доступны', () => {
    expect(isLockedToday(state, 'А', today)).toBe(true);
    expect(isLockedToday(state, 'Б', today)).toBe(false);
  });

  it('на следующий локальный день буква снова доступна', () => {
    expect(isLockedToday(state, 'А', '2026-10-23')).toBe(false);
  });

  it('последовательный режим пропускает буквы, завершённые вручную', () => {
    expect(nextSequentialLetter(state, today)).toBe('Б');
    const withManual: AlphabetState = {
      ...state,
      completions: { ...state.completions, Б: { letter: 'Б', completedOnLocalDate: today, resultId: 'r2' } },
    };
    expect(nextSequentialLetter(withManual, today)).toBe('В');
    expect(completedTodayCount(withManual, today)).toBe(2);
  });

  it('когда пройдены все буквы — следующей нет', () => {
    const all: AlphabetState = {
      active: null,
      completions: Object.fromEntries(
        RUSSIAN_ALPHABET.map((letter) => [letter, { letter, completedOnLocalDate: today, resultId: letter }]),
      ),
    };
    expect(nextSequentialLetter(all, today)).toBeNull();
  });

  it('подпись разблокировки и локальная дата', () => {
    expect(unlockLabel('2026-12-31')).toBe('Доступно завтра, 01.01 с 00:00');
    expect(localDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('раунд', () => {
  it('ответы, пропуски, предупреждения и завершение', () => {
    let active = startActive('id1', 'А', 'manual', 1_000);
    active = recordAnswer(active, 'Аист');
    active = recordAnswer(active, null);
    active = recordAnswer(active, 'Бобр');
    expect(active.index).toBe(3);
    expect(active.answers.map((a) => a.warning)).toEqual([false, false, true]);
    while (!isRoundComplete(active)) active = recordAnswer(active, null);
    const session = buildSession(active, 61_000);
    expect(session).toMatchObject({ id: 'id1', letter: 'А', filled: 2, skipped: 10, durationSeconds: 60 });
    const done = completeLetter(EMPTY_STATE, active, '2026-10-22');
    expect(done.active).toBeNull();
    expect(done.completions.А?.resultId).toBe('id1');
  });

  it('активная игра переживает перезагрузку (сохранение и чтение)', () => {
    const storage = memoryStorage();
    const active = recordAnswer(startActive('id2', 'Ы', 'sequential', 5_000), null);
    saveAlphabetState({ completions: {}, active }, storage);
    expect(loadAlphabetState(storage).active).toEqual(active);
  });

  it('повреждённые данные не роняют игру', () => {
    expect(loadAlphabetState(memoryStorage({ [ALPHABET_KEY]: '{oops' }))).toEqual(EMPTY_STATE);
    const weird = JSON.stringify({ completions: { x: { letter: 'Q' } }, active: { id: 1 } });
    expect(loadAlphabetState(memoryStorage({ [ALPHABET_KEY]: weird }))).toEqual(EMPTY_STATE);
  });
});
