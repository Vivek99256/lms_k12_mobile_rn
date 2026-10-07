import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleProp, Text, TextStyle, ViewStyle } from 'react-native';
import { colors } from '../config/theme';

/** Respect the OS "reduce motion" setting: animations collapse to their end state. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduce(v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** Fades and slides children up on mount. Use `delay` to stagger lists. */
export function FadeInUp({
  children,
  delay = 0,
  distance = 22,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    Animated.timing(v, { toValue: 1, duration: 480, delay, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }).start();
  }, [reduce, delay, v]);
  return (
    <Animated.View
      style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }, style]}
    >
      {children}
    </Animated.View>
  );
}

/** Pressable that squishes and springs back, for playful tactile feedback. */
export function Bounce({
  children,
  onPress,
  style,
  accessibilityLabel,
  scaleTo = 0.93,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  scaleTo?: number;
}) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(s, { toValue: v, friction: 4, tension: 220, useNativeDriver: true }).start();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
    >
      <Animated.View style={[{ transform: [{ scale: s }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Gently bobs up and down forever (decorative shapes, mascots). */
export function Floating({
  children,
  amplitude = 8,
  duration = 2200,
  style,
}: {
  children: React.ReactNode;
  amplitude?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, duration, v]);
  return (
    <Animated.View style={[{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -amplitude] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

/** An emoji that waves (rotates back and forth), e.g. the greeting hand. */
export function Wave({ emoji = '👋', size = 26 }: { emoji?: string; size?: number }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const seq = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(v, { toValue: -1, duration: 320, useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.delay(1600),
      ]),
    );
    seq.start();
    return () => seq.stop();
  }, [reduce, v]);
  return (
    <Animated.Text style={{ fontSize: size, transform: [{ rotate: v.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] }) }] }}>
      {emoji}
    </Animated.Text>
  );
}

/** Counts a number up from 0 when it appears. Non-numeric text is shown as-is. */
export function CountUp({ value, style }: { value: string | number; style?: StyleProp<TextStyle> }) {
  const reduce = useReduceMotion();
  const text = String(value);
  const target = parseFloat(text.replace(/,/g, ''));
  const numeric = Number.isFinite(target) && /^-?[\d,.]+%?$/.test(text.trim());
  const suffix = text.trim().endsWith('%') ? '%' : '';
  const decimals = text.includes('.') ? Math.min(2, (text.split('.')[1] ?? '').replace('%', '').length) : 0;
  const [shown, setShown] = useState(numeric && !reduce ? 0 : target);
  useEffect(() => {
    if (!numeric || reduce) {
      setShown(target);
      return;
    }
    const a = new Animated.Value(0);
    const id = a.addListener(({ value: v }) => setShown(v * target));
    Animated.timing(a, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => a.removeListener(id);
  }, [numeric, reduce, target]);
  if (!numeric) return <Text style={style}>{text}</Text>;
  return (
    <Text style={style}>
      {shown.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
      {suffix}
    </Text>
  );
}

/** Pulsing placeholder block for loading states. */
export function Skeleton({ height = 80, radius = 20, style }: { height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ height, borderRadius: radius, backgroundColor: '#d5deec', opacity: v }, style]} />;
}
