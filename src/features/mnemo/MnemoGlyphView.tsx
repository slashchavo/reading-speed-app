import type { MnemoGlyph } from './mnemoUtils';

/** Контуры фигур в поле 24×24. Рисуем SVG, а не символы Юникода, чтобы iPad не подменял их эмодзи. */
const SHAPES: Record<string, string> = {
  circle: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z',
  ring: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zm0 4a5 5 0 1 1 0 10a5 5 0 1 1 0-10z',
  square: 'M4 4h16v16H4z',
  'square-outline': 'M4 4h16v16H4zM8 8v8h8V8z',
  triangle: 'M12 3l10 18H2z',
  'triangle-down': 'M2 3h20L12 21z',
  diamond: 'M12 2l10 10-10 10L2 12z',
  star: 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.2l7.1-.6z',
  plus: 'M9 2h6v7h7v6h-7v7H9v-7H2V9h7z',
  cross: 'M5.6 2.8L12 9.2l6.4-6.4 2.8 2.8L14.8 12l6.4 6.4-2.8 2.8L12 14.8l-6.4 6.4-2.8-2.8L9.2 12 2.8 5.6z',
  hexagon: 'M7 3h10l5 9-5 9H7l-5-9z',
  pentagon: 'M12 2l10 7.3-3.8 11.7H5.8L2 9.3z',
  heart: 'M12 21s-9-5.6-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.4-9 12-9 12z',
  crescent: 'M15 2a10 10 0 1 0 7 17 8 8 0 1 1-7-17z',
  drop: 'M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z',
};

type Props = {
  glyph: MnemoGlyph;
  /** null — чёрно-белый вид. */
  color: string | null;
};

export function MnemoGlyphView({ glyph, color }: Props) {
  const style = { color: color ?? 'var(--text)' };
  if (glyph.kind === 'shape') {
    return (
      <svg className="mnemo-glyph mnemo-glyph--shape" viewBox="0 0 24 24" style={style} aria-hidden="true" focusable="false">
        <path d={SHAPES[glyph.glyph] ?? SHAPES.circle} fill="currentColor" fillRule="evenodd" />
      </svg>
    );
  }
  return (
    <span className="mnemo-glyph mnemo-glyph--text" style={style} aria-hidden="true">
      {glyph.glyph}
    </span>
  );
}
