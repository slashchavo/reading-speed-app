import { FONT_SIZE_MAX, FONT_SIZE_MIN } from '../../lib/storage';

const FONT_STEP = 2;

type Props = {
  fontSize: number;
  onChange: (size: number) => void;
};

export function FontControls({ fontSize, onChange }: Props) {
  return (
    <div className="font-controls" role="group" aria-label="Размер шрифта">
      <button
        type="button"
        className="button button--small"
        onClick={() => onChange(fontSize - FONT_STEP)}
        disabled={fontSize <= FONT_SIZE_MIN}
        aria-label="Уменьшить шрифт"
      >
        A−
      </button>
      <span className="font-controls__value" aria-live="polite">
        {fontSize} px
      </span>
      <button
        type="button"
        className="button button--small"
        onClick={() => onChange(fontSize + FONT_STEP)}
        disabled={fontSize >= FONT_SIZE_MAX}
        aria-label="Увеличить шрифт"
      >
        A+
      </button>
    </div>
  );
}
