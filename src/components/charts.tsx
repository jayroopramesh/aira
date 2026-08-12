import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { Reading } from '../data/types';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './ui';

/**
 * Caseload sparkline. Sparse series (≤ 2 readings) render as a DOT-STRIP with NO trend
 * line — a line would imply a trajectory the data can't support (treated as a correctness
 * rule, not a style choice).
 */
export function Sparkline({ values, width = 84, height = 26, color }: { values: number[]; width?: number; height?: number; color?: string }) {
  const theme = useTheme();
  const tint = color ?? theme.colors.brand;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pad = 4;
  const x = (i: number) => pad + (i * (width - pad * 2)) / Math.max(values.length - 1, 1);
  const y = (v: number) => pad + (1 - (v - min) / range) * (height - pad * 2);
  const sparse = values.length <= 2;

  return (
    <Svg width={width} height={height}>
      {sparse ? (
        values.map((v, i) => <Circle key={i} cx={x(i)} cy={height / 2} r={2.6} fill={theme.colors.ink3} />)
      ) : (
        <>
          <Polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={tint} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2.6} fill={tint} />
        </>
      )}
    </Svg>
  );
}

const PHQ_BANDS = [
  { from: 20, to: 27, label: 'severe', key: 'bandSev' as const },
  { from: 15, to: 19, label: 'mod-sev', key: 'bandModSev' as const },
  { from: 10, to: 14, label: 'moderate', key: 'bandMod' as const },
  { from: 5, to: 9, label: 'mild', key: 'bandMild' as const },
  { from: 0, to: 4, label: 'minimal', key: 'bandMin' as const },
];

/**
 * The banded PHQ-9 chart: a square-gridded line plot inside a rounded card shell, with
 * faint severity bands behind it. Renders in the calm-chrome/crisp-data tension — the
 * data itself stays sharp (the mascot is banned from chart plots).
 */
export function BandedChart({ readings, max = 27 }: { readings: Reading[]; max?: number }) {
  const theme = useTheme();
  const c = theme.colors;

  const W = 560;
  const H = 300;
  const padL = 34;
  const padR = 96;
  const padT = 20;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xAt = (i: number) => padL + (i * plotW) / Math.max(readings.length - 1, 1);
  const yAt = (v: number) => padT + (1 - v / max) * plotH;

  return (
    <View style={{ width: '100%', backgroundColor: c.sunken, borderRadius: theme.radii.md, padding: theme.spacing.md }}>
      <Svg width="100%" height={undefined as unknown as number} viewBox={`0 0 ${W} ${H}`} style={{ aspectRatio: W / H }}>
        {/* Severity bands */}
        {PHQ_BANDS.map((b) => {
          const yTop = yAt(b.to + 1 > max ? max : b.to + 1);
          const yBot = yAt(b.from);
          return (
            <React.Fragment key={b.label}>
              <Rect x={padL} y={yTop} width={plotW} height={yBot - yTop} fill={c[b.key]} />
              <SvgText x={padL + plotW + 10} y={(yTop + yBot) / 2 + 4} fontSize={12} fill={c.ink3} fontFamily={theme.type.small.fontFamily}>
                {b.label}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Square grid lines (vertical per reading) */}
        {readings.map((_, i) => (
          <Line key={`v${i}`} x1={xAt(i)} y1={padT} x2={xAt(i)} y2={padT + plotH} stroke={c.line} strokeWidth={1} opacity={0.4} />
        ))}
        {/* y ticks 0 / 14 / 27 */}
        {[0, 14, max].map((t) => (
          <React.Fragment key={`y${t}`}>
            <Line x1={padL} y1={yAt(t)} x2={padL + plotW} y2={yAt(t)} stroke={c.line} strokeWidth={1} opacity={0.5} />
            <SvgText x={padL - 8} y={yAt(t) + 4} fontSize={12} fill={c.ink3} textAnchor="end" fontFamily={theme.type.numeric.fontFamily}>
              {t}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Line */}
        <Polyline
          points={readings.map((r, i) => `${xAt(i)},${yAt(r.value)}`).join(' ')}
          fill="none"
          stroke={c.brand}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Points + value labels */}
        {readings.map((r, i) => {
          const last = i === readings.length - 1;
          return (
            <React.Fragment key={`p${i}`}>
              <Circle cx={xAt(i)} cy={yAt(r.value)} r={5} fill={last ? c.brand : c.sunken} stroke={c.brand} strokeWidth={2.4} />
              <SvgText x={xAt(i)} y={yAt(r.value) - 12} fontSize={13} fill={c.ink} textAnchor="middle" fontFamily={theme.type.numeric.fontFamily}>
                {r.value}
              </SvgText>
              <SvgText x={xAt(i)} y={padT + plotH + 22} fontSize={12} fill={c.ink3} textAnchor="middle" fontFamily={theme.type.small.fontFamily}>
                {r.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

/**
 * Sparse dot-strip: for series with too few readings for a trend (Amara's 2 sleep
 * readings). Points only, with an explicit "not enough for a trend yet" caption upstream.
 */
export function DotStrip({ readings, unit }: { readings: Reading[]; unit?: string }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={{ backgroundColor: c.sunken, borderRadius: theme.radii.md, padding: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        {readings.map((r) => (
          <View key={r.label} style={{ alignItems: 'center' }}>
            <AppText variant="h2">
              {r.value}
              {unit}
            </AppText>
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.brand, marginTop: 10 }} />
          </View>
        ))}
      </View>
      <View style={{ height: 1, backgroundColor: c.line, marginTop: 18 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 }}>
        {readings.map((r) => (
          <AppText key={r.label} variant="small" color="ink3">
            {r.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}
