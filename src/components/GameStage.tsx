import type { ReactNode } from 'react';
import { useScrollLock } from '../lib/useScrollLock';

type Props = {
  label: string;
  children: ReactNode;
};

/**
 * Полноэкранная игровая сцена на время активного раунда: поле стоит на месте,
 * страница под ним не прокручивается. Кнопка «Назад» браузера продолжает работать.
 */
export function GameStage({ label, children }: Props) {
  useScrollLock(true);
  return (
    <section className="game-stage" aria-label={label}>
      <div className="game-stage__inner">{children}</div>
    </section>
  );
}
