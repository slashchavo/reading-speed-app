import { useEffect, useRef } from 'react';
import { useElementWidth } from '../../lib/useElementWidth';
import type { GridSize, SymbolSize } from '../../types/session';
import { symbolFontPx } from './schulteUtils';

const GAP = 6;

type Props = {
  size: GridSize;
  cells: readonly (string | null)[];
  colors: readonly (string | null)[];
  symbolSize: SymbolSize;
  /** Найденные цели (для активной игры). */
  found?: ReadonlySet<string>;
  wrongCell?: string | null;
  onTap?: (value: string | null) => void;
  /** Сообщает фактический размер символа (для подписи в предпросмотре). */
  onFontPx?: (px: number) => void;
  label: string;
};

/** Поле Шульте. Размер символа считается от реальной ширины ячейки, поэтому предпросмотр совпадает с игрой. */
export function SchulteBoard({ size, cells, colors, symbolSize, found, wrongCell, onTap, onFontPx, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useElementWidth(ref);
  const cellPx = width > 0 ? (width - GAP * (size - 1)) / size : 0;
  const singlePx = symbolFontPx(cellPx, symbolSize, '8');
  useEffect(() => {
    if (onFontPx && singlePx > 0) onFontPx(singlePx);
  }, [onFontPx, singlePx]);
  const interactive = Boolean(onTap);

  return (
    <div
      ref={ref}
      className={`schulte-board schulte-board--${size}${interactive ? ' schulte-board--active' : ''}`}
      role="group"
      aria-label={label}
    >
      {cells.map((value, position) => {
        const style = {
          fontSize: value ? symbolFontPx(cellPx, symbolSize, value) : undefined,
          color: colors[position] ?? undefined,
        };
        if (value === null) return <div key={`empty-${position}`} className="cell cell--empty" aria-hidden="true" />;
        const isFound = found?.has(value) ?? false;
        const isWrong = wrongCell === value;
        const className = ['cell', isFound ? 'cell--found' : '', isWrong ? 'cell--wrong' : ''].join(' ').trim();
        if (!interactive) {
          return (
            <div key={value} className={className} style={style} aria-hidden="true">
              {value}
            </div>
          );
        }
        return (
          <button
            key={value}
            type="button"
            className={className}
            style={isFound || isWrong ? { fontSize: style.fontSize } : style}
            onClick={() => onTap?.(value)}
            aria-label={isFound ? `${value}, найдено` : value}
            aria-disabled={isFound || undefined}
          >
            {value}
            {isWrong && (
              <span className="cell__mark" aria-hidden="true">
                ✕
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
