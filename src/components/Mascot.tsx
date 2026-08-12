import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { motion } from '../theme/tokens';

/**
 * The Aira mascot — a seafoam elephant raising its trunk toward a small heart.
 * Ported verbatim from the inline SVG in `aira-ui-s3/design-direction.html`.
 *
 * Locked usage rule: the mascot is PRESENCE, not decoration. Render it ONLY on human
 * surfaces (unlock, empty states, the app wordmark). It is banned from charts, tables,
 * and the risk queue/review. `float` (the 5.5s bob) is reserved for the unlock hero.
 */
export function Mascot({
  size = 168,
  float = false,
}: {
  size?: number;
  float?: boolean;
}) {
  const height = (size * 138) / 140;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!float) return;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return; // respect reduced-motion (design-direction lock)
      Animated.loop(
        Animated.sequence([
          Animated.timing(bob, {
            toValue: 1,
            duration: motion.mascotFloat / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(bob, {
            toValue: 0,
            duration: motion.mascotFloat / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });
    return () => {
      cancelled = true;
    };
  }, [float, bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <Animated.View
      style={{ transform: [{ translateY }] }}
      accessibilityRole="image"
      accessibilityLabel="Aira mascot, a seafoam elephant raising its trunk toward a small heart"
    >
      <View pointerEvents="none">
        <Svg width={size} height={height} viewBox="0 0 140 138">
          {/* Ears */}
          <Ellipse cx={30} cy={54} rx={20} ry={25} fill="#7FCEC0" stroke="#2E7370" strokeWidth={2.2} />
          <Ellipse cx={110} cy={54} rx={20} ry={25} fill="#7FCEC0" stroke="#2E7370" strokeWidth={2.2} />
          <Ellipse cx={33} cy={55} rx={12} ry={16} fill="#C4E8E0" />
          <Ellipse cx={107} cy={55} rx={12} ry={16} fill="#C4E8E0" />
          <G stroke="#8FD2C6" strokeWidth={1.3} fill="none" strokeLinecap="round" opacity={0.85}>
            <Path d="M33 47c0 6 0 13 0 17" />
            <Path d="M33 51c3-1 5-3 6-6" />
            <Path d="M33 55c-3-1-5-3-6-6" />
            <Path d="M33 59c3-1 5-3 6-6" />
            <Path d="M107 47c0 6 0 13 0 17" />
            <Path d="M107 51c-3-1-5-3-6-6" />
            <Path d="M107 55c3-1 5-3 6-6" />
            <Path d="M107 59c-3-1-5-3-6-6" />
          </G>
          {/* Head tuft */}
          <G fill="#7FCEC0" stroke="#2E7370" strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round">
            <Path d="M62 41C61 32 66 31 67 40Z" />
            <Path d="M67 40C66 29 72 29 72 39Z" />
            <Path d="M72 39C73 31 78 32 77 41Z" />
          </G>
          {/* Head + belly */}
          <Ellipse cx={70} cy={77} rx={44} ry={44} fill="#7FCEC0" stroke="#2E7370" strokeWidth={2.2} />
          <Ellipse cx={70} cy={88} rx={27} ry={24} fill="#C9E9E1" />
          {/* Feet */}
          <Ellipse cx={50} cy={115} rx={13} ry={9} fill="#7FCEC0" stroke="#2E7370" strokeWidth={2.2} />
          <Ellipse cx={90} cy={115} rx={13} ry={9} fill="#7FCEC0" stroke="#2E7370" strokeWidth={2.2} />
          <G fill="#E9F6F2">
            <Ellipse cx={44} cy={117} rx={2} ry={2.6} />
            <Ellipse cx={50} cy={118} rx={2} ry={2.6} />
            <Ellipse cx={56} cy={117} rx={2} ry={2.6} />
            <Ellipse cx={84} cy={117} rx={2} ry={2.6} />
            <Ellipse cx={90} cy={118} rx={2} ry={2.6} />
            <Ellipse cx={96} cy={117} rx={2} ry={2.6} />
          </G>
          {/* Brows */}
          <G stroke="#2E7370" strokeWidth={1.8} fill="none" strokeLinecap="round">
            <Path d="M47 52Q54 47 62 51" />
            <Path d="M74 51Q82 47 89 52" />
          </G>
          {/* Eyes */}
          <Ellipse cx={54} cy={64} rx={7.5} ry={9} fill="#12302A" />
          <Ellipse cx={82} cy={64} rx={7.5} ry={9} fill="#12302A" />
          <Ellipse cx={51.5} cy={60.5} rx={2.8} ry={3.4} fill="#fff" />
          <Ellipse cx={79.5} cy={60.5} rx={2.8} ry={3.4} fill="#fff" />
          <Circle cx={56.5} cy={67.5} r={1.5} fill="#fff" opacity={0.85} />
          <Circle cx={84.5} cy={67.5} r={1.5} fill="#fff" opacity={0.85} />
          {/* Cheeks */}
          <Circle cx={43} cy={72} r={3.4} fill="#EDA983" opacity={0.45} />
          <Circle cx={97} cy={72} r={3.4} fill="#EDA983" opacity={0.45} />
          {/* Mouth */}
          <Path d="M63 82C66 86 72 86 75 82" stroke="#2E7370" strokeWidth={2} fill="none" strokeLinecap="round" />
          {/* Trunk (outline then fill) */}
          <Path
            d="M68 75C66 62 67 52 71 49C79 43 95 46 95 55C95 60 88 60 89 54"
            fill="none"
            stroke="#2E7370"
            strokeWidth={12}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M68 75C66 62 67 52 71 49C79 43 95 46 95 55C95 60 88 60 89 54"
            fill="none"
            stroke="#7FCEC0"
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <G stroke="#2E7370" strokeWidth={1.3} fill="none" strokeLinecap="round" opacity={0.75}>
            <Path d="M63 70L71 67" />
            <Path d="M63 64L72 61" />
            <Path d="M64 58L73 55" />
            <Path d="M68 52L77 49" />
          </G>
          <Circle cx={89} cy={55} r={1.1} fill="#2E7370" />
          <Circle cx={91.5} cy={52.5} r={1.1} fill="#2E7370" />
          {/* Heart */}
          <Circle cx={101} cy={43} r={14} fill="#E68A66" opacity={0.2} />
          <Path
            d="M101 50C97 45 90 45 90 40C90 36.5 94 35.5 97 38C99 39.5 100 41 101 42C102 41 103 39.5 105 38C108 35.5 112 36.5 112 40C112 45 105 45 101 50Z"
            fill="#E68A66"
            stroke="#C75B38"
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </Animated.View>
  );
}
