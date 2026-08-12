import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

type P = { size?: number; color?: string; strokeWidth?: number };
const base = (size = 22, sw = 2) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  strokeWidth: sw,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/** Get ready — a day/agenda glyph. */
export function ReadyTabIcon({ size = 22, color = 'currentColor', strokeWidth = 2 }: P) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Rect x={3} y={4.5} width={18} height={16} rx={2.5} />
      <Path d="M3 9h18M8 3v3M16 3v3M7.5 13h4M7.5 16.5h8" />
    </Svg>
  );
}

/** Session — mic. */
export function SessionTabIcon({ size = 22, color = 'currentColor', strokeWidth = 2 }: P) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Rect x={9} y={2.5} width={6} height={11} rx={3} />
      <Path d="M5.5 10.5a6.5 6.5 0 0013 0M12 17v4M8.5 21h7" />
    </Svg>
  );
}

/** Patterns — trend chart. */
export function PatternsTabIcon({ size = 22, color = 'currentColor', strokeWidth = 2 }: P) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M4 4v16h16" />
      <Path d="M7 15l3.5-4 3 2.5L20 7" />
    </Svg>
  );
}
