import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, ImageStyle, StyleProp } from 'react-native';
import { motion } from '../theme/tokens';

/**
 * The captain's final mascot art, one image per mood. These replace the earlier hand-drawn
 * inline-SVG elephant on every human surface (rev 6 app-bar chrome, rev 7 welcome/unlock heroes).
 *
 * Locked usage rule is unchanged: the mascot is PRESENCE, not decoration — it lives only on
 * human surfaces (the app-bar wordmark, welcome onboarding, unlock/login/decrypt/recovery) and
 * stays banned from charts, tables, the risk queue/review content, and the in-session capture.
 *
 * Art comes from the captain's final background-removed emotion set. `require()` paths must be
 * static literals, so every mood is listed explicitly.
 */
export const MOOD_ART = {
  breathing: require('../../assets/mascot/breathing.png'),
  calm: require('../../assets/mascot/calm.png'),
  concerned: require('../../assets/mascot/concerned.png'),
  curious: require('../../assets/mascot/curious.png'),
  empathetic: require('../../assets/mascot/empathetic.png'),
  encouraging: require('../../assets/mascot/encouraging.png'),
  happy: require('../../assets/mascot/happy.png'),
  joyful: require('../../assets/mascot/joyful.png'),
  loved: require('../../assets/mascot/loved.png'),
  overwhelmed: require('../../assets/mascot/overwhelmed.png'),
  peaceful: require('../../assets/mascot/peaceful.png'),
  playful: require('../../assets/mascot/playful.png'),
  relieved: require('../../assets/mascot/relieved.png'),
  sleepy: require('../../assets/mascot/sleepy.png'),
  supportive: require('../../assets/mascot/supportive.png'),
  thinking: require('../../assets/mascot/thinking.png'),
} as const;

export type Mood = keyof typeof MOOD_ART;

/**
 * A mood-specific mascot image. `float` (the 5.5s bob, reduced-motion aware) is reserved for
 * the welcome/unlock heroes, matching the prototype's floating hero art.
 */
export function MascotMood({
  mood,
  size = 132,
  float = false,
  style,
}: {
  mood: Mood;
  size?: number;
  float?: boolean;
  style?: StyleProp<ImageStyle>;
}) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!float) return;
    let cancelled = false;
    // Retain the loop handle so cleanup can .stop() it: the started loop outlives the hero on unmount,
    // and a float toggle re-runs this effect, so without an explicit stop the prior loop keeps running
    // (and a second would stack on top of it).
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return; // respect reduced-motion (design-direction lock)
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: motion.mascotFloat / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: motion.mascotFloat / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      if (loop) loop.stop();
    };
  }, [float, bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <Animated.View style={{ transform: [{ translateY }] }} accessibilityRole="image" accessibilityLabel="Airava mascot">
      <Image source={MOOD_ART[mood]} style={[{ width: size, height: size, resizeMode: 'contain' }, style]} />
    </Animated.View>
  );
}

/**
 * The per-workflow app-bar mood (rev 6 mapping). `risk` narrows the Patterns workflow to its
 * acute-review step, where the chrome softens curious → supportive (risk stays clay, never alarm;
 * the mascot never enters the risk content itself).
 */
export function appBarMood(pathname: string, risk: boolean): Mood {
  if (pathname.startsWith('/welcome')) return 'happy';
  if (pathname.startsWith('/unlock')) return 'peaceful';
  if (pathname.includes('/today')) return 'encouraging';
  if (pathname.includes('/session')) return 'thinking';
  if (pathname.includes('/patterns')) return risk ? 'supportive' : 'curious';
  return 'happy';
}
