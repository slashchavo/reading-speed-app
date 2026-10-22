# «Фокус» — прототип приложения для тренировки чтения и внимания

Веб-прототип (MVP): таблицы Шульте, измерение ориентировочной скорости чтения и локальная история занятий.
Без сервера и регистрации — результаты хранятся в `localStorage` браузера на этом устройстве.

## Что нужно установить

- [Node.js](https://nodejs.org/) версии **20.19+ или 22.12+** (рекомендуется LTS). Проверить: `node -v`.

## Запуск

```bash
npm install      # один раз: установить зависимости
npm run dev      # запустить в режиме разработки
```

Откройте адрес, который покажет терминал (обычно http://localhost:5173).

### Открыть на iPad или телефоне

1. Компьютер и iPad должны быть в **одной Wi-Fi сети**.
2. На компьютере выполните `npm run dev:ipad`.
3. В терминале появится строка `Network: http://192.168.x.x:5173/` — откройте этот адрес в Safari на iPad.
4. Если не открывается — разрешите Node.js входящие подключения в файрволе компьютера.

## Другие команды

| Команда | Что делает |
| --- | --- |
| `npm run build` | Проверка TypeScript и сборка в папку `dist/` |
| `npm run typecheck` | Только проверка типов TypeScript |
| `npm test` | Автотесты логики (сетки Шульте, подсчёт слов, хранилище, сводка) |
| `npm run preview` | Запуск собранной версии из `dist/` (доступна и в локальной сети) |

## Зависимости

- `react`, `react-dom` — интерфейс.
- `vite`, `@vitejs/plugin-react`, `typescript` — сборка и проверка типов.
- `vitest` — автотесты чистых функций (единственная дополнительная зависимость).

## Структура

```text
src/
  app/          App.tsx, useAppData.ts — корень приложения, история и настройки
  components/   AppLayout, Navigation, StatCard, SaveStatus
  pages/        HomePage, SchultePage, ReaderPage, ProgressPage
  features/
    schulte/    schulteUtils.ts (генерация сетки), SchulteGame.tsx
    reader/     readerUtils.ts (слова, слова/мин), ReaderSession.tsx, demoText.ts
    progress/   progressUtils.ts (сортировка, сводка)
  lib/          storage.ts (localStorage), dateUtils.ts, useStopwatch.ts, useHashRoute.ts
  types/        session.ts
  styles/       global.css
```

Хранилище: `focus-app:sessions:v1` — завершённые занятия, `focus-app:settings:v1` — настройки (размер шрифта, сетка, режим).

## Документы проекта

- `PRODUCT.md` — идея продукта, экраны и границы MVP.
- `TECH_SPEC.md` — техническое задание и критерии приёмки.
- `CLAUDE.md` — правила работы для Claude Code.
- `FIRST_TASK.md` — первый запрос и план следующих итераций.
