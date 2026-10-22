import type { Route } from '../lib/useHashRoute';
import { RouteLink } from './RouteLink';

export type TrainingCard = { route: Route; title: string; icon: string; description: string };

export const GAME_CARDS: readonly TrainingCard[] = [
  { route: 'schulte', title: 'Таблица Шульте', icon: '▦', description: 'Числа, латиница или кириллица по порядку; сетка 5×5 или 7×7, цветная или чёрно-белая.' },
  { route: 'munsterberg', title: 'Тест Мюнстерберга', icon: 'Аб', description: 'Найдите слова, спрятанные в сплошном ряду букв. Четыре уровня сложности.' },
  { route: 'memory', title: 'Память на слова', icon: '≡', description: 'Запомните от 5 до 50 слов за 1–3 минуты и запишите всё, что вспомните.' },
  { route: 'mnemo', title: 'Мнемотаблица', icon: '◩', description: 'Запомните положение и цвет фигур, букв и символов на поле 5×5 и восстановите их.' },
  { route: 'alphabet', title: 'От А до Я', icon: 'Я', description: 'Подберите слова на одну букву для 12 категорий. Каждая буква — раз в день.' },
];

export const READING_CARDS: readonly TrainingCard[] = [
  { route: 'reading', title: 'Скорость чтения', icon: '¶', description: 'Новый текст из библиотеки или свой текст — узнайте темп в словах в минуту.' },
  { route: 'books', title: 'Мои книги', icon: '❐', description: 'Загрузите EPUB, DOCX или TXT и читайте по фрагментам с сохранением места.' },
];

type Props = {
  cards: readonly TrainingCard[];
  /** Короткая подпись под карточкой, например число занятий. */
  note?: (card: TrainingCard) => string | null;
};

export function TrainingCards({ cards, note }: Props) {
  return (
    <div className="cards">
      {cards.map((card) => {
        const extra = note?.(card) ?? null;
        return (
          <RouteLink key={card.route} className="card card--link" to={card.route}>
            <span className="card__icon" aria-hidden="true">
              {card.icon}
            </span>
            <h2 className="card__title">{card.title}</h2>
            <p className="muted">{card.description}</p>
            {extra && <p className="card__note">{extra}</p>}
            <span className="card__cta">Начать →</span>
          </RouteLink>
        );
      })}
    </div>
  );
}
