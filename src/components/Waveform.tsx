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
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      const loops = values.map((v, i) => {
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
