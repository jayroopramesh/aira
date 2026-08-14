import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/** A calm recording waveform — animated bars. Static under reduced-motion. */
export function Waveform({ bars = 13, color }: { bars?: number; color?: string }) {
  const theme = useTheme();
  const tint = color ?? theme.colors.brand;
  const values = useRef(Array.from({ length: bars }, () => new Animated.Value(0.3))).current;

  useEffect(() => {
    let cancelled = false;
    // Retain the started loop handles so cleanup can .stop() them. `Animated.loop` drives its values
    // independently of mount state, so flipping a flag isn't enough — the reduce-motion check resolves
    // within a frame, so by unmount the loops are already running and must be explicitly stopped, or
    // they orphan on the JS thread and accumulate across captures.
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
  }, [values]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 44 }} accessibilityLabel="Recording waveform">
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
