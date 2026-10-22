import { useCallback, useEffect, useRef, useState } from 'react';
import { GameStage } from '../../components/GameStage';
import { SaveStatus, type SaveState } from '../../components/SaveStatus';
import { Segmented } from '../../components/Segmented';
import { Stat } from '../../components/Stat';
import { formatClock, formatDuration, roundSeconds } from '../../lib/dateUtils';
import { createId } from '../../lib/storage';
import { useCountdown } from '../../lib/useCountdown';
import type { ColorMatchSession } from '../../types/session';
import { accuracy, colorById, INK_BACKGROUND, isCorrectAnswer, nextTrial, type Trial } from './colorMatchUtils';

type Phase = 'setup' | 'playing' | 'finished';
type Minutes = 1 | 2 | 3;

type Props = {
  minutes: Minutes;
  onMinutesChange: (minutes: Minutes) => void;
  onComplete: (session: ColorMatchSession) => boolean;
};

const MINUTE_OPTIONS = [
  { value: 1, label: '1 минута' },
  { value: 2, label: '2 минуты' },
  { value: 3, label: '3 минуты' },
] as const;

export function ColorMatchGame({ minutes, onMinutesChange, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [trial, setTrial] = useState<Trial>(() => nextTrial([]));
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [lastAnswer, setLastAnswer] = useState<'ok' | 'error' | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [roundMinutes, setRoundMinutes] = useState<Minutes>(minutes);
  const [elapsed, setElapsed] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const historyRef = useRef<Trial[]>([]);
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const startedAtRef = useRef(0);
  const savedRef = useRef(false);
  const resultRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (phase === 'finished') resultRef.current?.focus();
  }, [phase]);

  const finish = useCallback(() => {
    setDeadline(null);
    if (phaseRef.current !== 'playing') return;
    phaseRef.current = 'finished';
    const seconds = roundSeconds(Date.now() - startedAtRef.current);
    setElapsed(seconds);
    setPhase('finished');
    if (savedRef.current) return;
    savedRef.current = true;
    const { correct, wrong } = scoreRef.current;
    const saved = onComplete({
      id: createId(),
      type: 'color_match',
      completedAt: new Date().toISOString(),
      durationSeconds: seconds,
      durationMinutes: roundMinutes,
      attempts: correct + wrong,
      correct,
      wrong,
    });
    setSaveState(saved ? 'saved' : 'failed');
  }, [onComplete, roundMinutes]);

  const remaining = useCountdown(phase === 'playing' ? deadline : null, finish);

  const start = () => {
    historyRef.current = [];
    const first = nextTrial([]);
    historyRef.current.push(first);
    setTrial(first);
    setScore({ correct: 0, wrong: 0 });
    setLastAnswer(null);
    setSaveState('idle');
    savedRef.current = false;
    setRoundMinutes(minutes);
    startedAtRef.current = Date.now();
    setDeadline(Date.now() + minutes * 60_000);
    setPhase('playing');
  };

  const answer = useCallback(
    (yes: boolean) => {
      // После окончания времени ответы не принимаются.
      if (phaseRef.current !== 'playing' || deadline === null || Date.now() >= deadline) return;
      const ok = isCorrectAnswer(trial, yes);
      setScore((s) => (ok ? { ...s, correct: s.correct + 1 } : { ...s, wrong: s.wrong + 1 }));
      setLastAnswer(ok ? 'ok' : 'error');
      const next = nextTrial(historyRef.current);
      historyRef.current = [...historyRef.current.slice(-20), next];
      setTrial(next);
    },
    [deadline, trial],
  );

  // Клавиатура: Y / ← — «Да», N / → — «Нет».
  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const k = event.key.toLowerCase();
      if (k === 'y' || k === 'н' || k === 'arrowleft') answer(true);
      if (k === 'n' || k === 'т' || k === 'arrowright') answer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, answer]);

  if (phase === 'setup') {
    return (
      <section className="card" aria-labelledby="cm-setup">
        <h2 id="cm-setup" className="card__title">
          Как играть
        </h2>
        <p>
          Слева — название цвета обычным текстом. Справа — слово, напечатанное цветными буквами. Нажмите{' '}
          <strong>«Да»</strong>, если слово слева совпадает с <strong>цветом букв</strong> справа, и{' '}
          <strong>«Нет»</strong>, если не совпадает. Что написано справа — не важно.
        </p>
        <div className="cm-example" aria-hidden="true">
          <div className="cm-card cm-card--plain">КРАСНЫЙ</div>
          <div className="cm-card cm-card--ink" style={{ background: INK_BACKGROUND, color: colorById('red').hex }}>
            СИНИЙ
          </div>
          <span className="cm-example__answer">→ «Да»: буквы справа красные</span>
        </div>
        <Segmented name="cm-minutes" legend="Длительность" options={MINUTE_OPTIONS} value={minutes} onChange={onMinutesChange} />
        <p className="muted">На клавиатуре можно отвечать клавишами Y (да) и N (нет) или стрелками ← и →.</p>
        <button type="button" className="button button--primary button--large" onClick={start}>
          Начать
        </button>
      </section>
    );
  }

  const attempts = score.correct + score.wrong;

  if (phase === 'finished') {
    return (
      <section className="card result" aria-labelledby="cm-result">
        <h2 id="cm-result" className="card__title" tabIndex={-1} ref={resultRef}>
          Результат
        </h2>
        <dl className="stats">
          <Stat label="Ответов" value={String(attempts)} />
          <Stat label="Верно" value={String(score.correct)} />
          <Stat label="Ошибок" value={String(score.wrong)} />
          <Stat label="Точность" value={`${accuracy(score.correct, attempts)} %`} />
          <Stat label="Длительность" value={formatDuration(elapsed)} />
        </dl>
        <SaveStatus state={saveState} />
        <div className="actions">
          <button type="button" className="button button--primary" onClick={start}>
            Ещё раунд
          </button>
          <button type="button" className="button" onClick={() => setPhase('setup')}>
            Изменить длительность
          </button>
        </div>
      </section>
    );
  }

  const left = colorById(trial.left);
  const right = colorById(trial.word);
  const ink = colorById(trial.ink);

  return (
    <GameStage label="Совпадает ли цвет?">
      <div className="stage-bar">
        <strong className="mono countdown">{formatClock(remaining)}</strong>
        <div className="stage-bar__stats">
          <span>
            Верно: <strong>{score.correct}</strong>
          </span>
          <span>
            Ошибок: <strong>{score.wrong}</strong>
          </span>
        </div>
      </div>
      <p className="stage-flash" aria-live="polite">
        {lastAnswer === 'ok' ? '✓ Верно' : lastAnswer === 'error' ? '✕ Ошибка' : ' '}
      </p>
      <p className="cm-question">Слово слева совпадает с цветом букв справа?</p>
      <div className="cm-cards">
        <div className="cm-card cm-card--plain" aria-label={`Слева написано: ${left.word.toLowerCase()}`}>
          {left.word}
        </div>
        <div
          className="cm-card cm-card--ink"
          style={{ background: INK_BACKGROUND, color: ink.hex }}
          aria-label={`Справа написано «${right.word.toLowerCase()}» цветом: ${ink.word.toLowerCase()}`}
        >
          {right.word}
        </div>
      </div>
      <div className="cm-answers">
        <button type="button" className="button cm-answer cm-answer--yes" onClick={() => answer(true)}>
          Да
        </button>
        <button type="button" className="button cm-answer cm-answer--no" onClick={() => answer(false)}>
          Нет
        </button>
      </div>
      <div className="stage-actions">
        <button type="button" className="button button--small" onClick={() => setPhase('setup')}>
          Прервать (не сохранять)
        </button>
      </div>
    </GameStage>
  );
}
