export type SaveState = 'idle' | 'saved' | 'failed';

type SaveStatusProps = {
  state: SaveState;
};

export function SaveStatus({ state }: SaveStatusProps) {
  if (state === 'saved') {
    return <p className="note note--success">✓ Результат сохранён в историю.</p>;
  }
  if (state === 'failed') {
    return (
      <p className="alert alert--warning" role="alert">
        Не удалось сохранить результат в памяти браузера. Он виден в истории до закрытия страницы, но после
        обновления может пропасть.
      </p>
    );
  }
  return null;
}
