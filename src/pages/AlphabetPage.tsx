import { AlphabetGame } from '../features/alphabet/AlphabetGame';
import type { AlphabetSession } from '../types/session';

type Props = {
  onComplete: (session: AlphabetSession) => boolean;
};

export function AlphabetPage({ onComplete }: Props) {
  return (
    <div className="page">
      <header className="page__header">
        <h1>От А до Я</h1>
        <p className="lead">Подберите слова на одну букву для 12 категорий: животное, город, имя и другие.</p>
      </header>
      <AlphabetGame onComplete={onComplete} />
    </div>
  );
}
