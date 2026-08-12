import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

type IconProps = { size?: number; color?: string; strokeWidth?: number };

const base = (size = 20, strokeWidth = 2) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function ShieldIcon({ size = 20, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
    </Svg>
  );
}

export function LockIcon({ size = 20, color = 'currentColor', strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Rect x={5} y={11} width={14} height={10} rx={2} />
      <Path d="M8 11V8a4 4 0 018 0v3" />
    </Svg>
  );
}

export function MicIcon({ size = 20, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Rect x={9} y={2} width={6} height={12} rx={3} />
      <Path d="M5 10a7 7 0 0014 0M12 17v4" />
    </Svg>
  );
}

export function StopIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Rect x={6} y={6} width={12} height={12} rx={2} />
    </Svg>
  );
}

export function ChevronRight({ size = 20, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M9 6l6 6-6 6" />
    </Svg>
  );
}

export function ChevronLeft({ size = 20, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M15 6l-6 6 6 6" />
    </Svg>
  );
}

export function ArrowRight({ size = 18, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M4 12h16M14 6l6 6-6 6" />
    </Svg>
  );
}

export function CloseIcon({ size = 20, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function SearchIcon({ size = 18, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M11 4a7 7 0 105.2 11.7L21 20M11 4a7 7 0 010 14" />
    </Svg>
  );
}

export function BiometricIcon({ size = 22, color = 'currentColor', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M5 8a10 10 0 0114 0M8 11a6 6 0 018 0M12 14v3M9 17v1M15 16v2" />
    </Svg>
  );
}

export function BackspaceIcon({ size = 22, color = 'currentColor', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M21 5H8L2 12l6 7h13a1 1 0 001-1V6a1 1 0 00-1-1zM17 9l-6 6M11 9l6 6" />
    </Svg>
  );
}

export function CheckIcon({ size = 16, color = 'currentColor', strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M4 12l5 5L20 6" />
    </Svg>
  );
}

export function FileUpIcon({ size = 28, color = 'currentColor', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <Path d="M14 3v5h5M12 18v-6M9.5 14.5L12 12l2.5 2.5" />
    </Svg>
  );
}

export function PhoneIcon({ size = 18, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M4 4h4l2 5-2 1a11 11 0 005 5l1-2 5 2v4a1 1 0 01-1 1A16 16 0 013 5a1 1 0 011-1z" />
    </Svg>
  );
}

export function MoonIcon({ size = 20, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M20 14.5A8 8 0 019.5 4 7 7 0 1020 14.5z" />
    </Svg>
  );
}

export function SunIcon({ size = 20, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M6 6L4.5 4.5M19.5 19.5L18 18M18 6l1.5-1.5M4.5 19.5L6 18" />
      <Path d="M12 8a4 4 0 100 8 4 4 0 000-8z" />
    </Svg>
  );
}

export function BulbIcon({ size = 16, color = 'currentColor', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10c.7.7 1 1.3 1 2h6c0-.7.3-1.3 1-2a6 6 0 00-4-10z" />
    </Svg>
  );
}

export function InfoIcon({ size = 16, color = 'currentColor', strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 16v-4M12 8h.01" />
    </Svg>
  );
}

export function AlertTriangleIcon({ size = 16, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
      <Path d="M12 9v4M12 17h.01" />
    </Svg>
  );
}

export function EyeIcon({ size = 16, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <Path d="M12 9a3 3 0 100 6 3 3 0 000-6z" />
    </Svg>
  );
}

export function CopyIcon({ size = 16, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Rect x={9} y={9} width={13} height={13} rx={2} />
      <Path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </Svg>
  );
}

export function DownloadIcon({ size = 16, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </Svg>
  );
}

export function KeyIcon({ size = 16, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M15 7a4 4 0 11-4 4M12.5 9.5L3 19l2 2M8 15l2 2" />
    </Svg>
  );
}

export function PencilIcon({ size = 16, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
    </Svg>
  );
}

export function TrendingIcon({ size = 16, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M3 3v18h18M7 15l4-5 3 3 5-7" />
    </Svg>
  );
}

export function SparklesIcon({ size = 16, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4" />
    </Svg>
  );
}

export function PlusIcon({ size = 16, color = 'currentColor', strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg {...base(size, strokeWidth)} stroke={color}>
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function PlayIcon({ size = 16, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M6 4l14 8-14 8V4z" />
    </Svg>
  );
}
