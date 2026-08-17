import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/**
 * A recording waveform — real per-bar input levels when `getLevels` is supplied (driven off the
 * live MediaStream via a Web Audio AnalyserNode, see `audioCapture.ts`), a calm ambient animation
 * otherwise. `getLevels` is polled on a `requestAnimationFrame` loop and fed straight into each
 * bar's `Animated.Value` via `.setValue()` — an imperative update RN's Animated module applies
 * without going through React state/re-render, which is what keeps a per-frame poll cheap. Static
 * under reduced-motion (ambient mode only — real levels ARE the honest signal, not decoration, so
 * they still animate under reduced-motion; they just never run at all without a live stream).
 */
export function Waveform({ bars = 13, color, getLevels }: { bars?: number; color?: string; getLevels?: (bars: number) => number[] | null }) {
  const theme = useTheme();
  const tint = color ?? theme.colors.brand;
  const values = useRef(Array.from({ length: bars }, () => new Animated.Value(0.3))).current;

  useEffect(() => {
    // LIVE mode: real amplitude from the same stream MediaRecorder is encoding. Never the canned
    // loop below — faking responsiveness here would be exactly the kind of dead promise this app
    // avoids elsewhere (a "live" waveform that isn't actually listening).
    if (getLevels) {
      let raf = 0;
      let cancelled = false;
      const loop = () => {
        if (cancelled) return;
        const levels = getLevels(bars);
        if (levels) levels.forEach((lv, i) => values[i]?.setValue(Math.max(0.04, Math.min(1, lv))));
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    }

    // No live stream to read (native, the sample clip, an unsupported browser, or the caller just
    // didn't pass one) — the honest fallback is a calm ambient loop, never a fake "responsive" one.
    let cancelled = false;
    let loops: Animated.CompositeAnimation[] = [];
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      loops = values.map((v, i) => {
        const peak = 0.5 + ((i * 7) % 5) / 10; // deterministic per-bar peak (no Math.random)
        const dur = 380 + ((i * 53) % 260);
        return Animated.loop(
          Animated.sequence([
            Animated.timing(v, { toValue: peak, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
            Animated.timing(v, { toValue: 0.25, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          ]),
        );
      });
      loops.forEach((l) => l.start());
    });
    return () => {
      cancelled = true;
      loops.forEach((l) => l.stop());
    };
  }, [getLevels, bars, values]);

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 44 }}
      accessibilityLabel={getLevels ? 'Live recording waveform' : 'Recording waveform'}
    >
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: 4,
            borderRadius: 2,
            backgroundColor: tint,
            height: v.interpolate({ inputRange: [0, 1], outputRange: [6, 44] }),
          }}
        />
      ))}
    </View>
  );
}
