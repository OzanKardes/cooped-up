import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { BadgeDef } from '../services/badges';
import { TIER_COLORS, TIER_LABELS } from '../services/badges';
import { Typography, Shadows } from '../constants/theme';

interface Props {
  badge: BadgeDef;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 3800;

export default function BadgeToast({ badge, onDismiss }: Props) {
  const insets  = useSafeAreaInsets();
  const slideY  = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    if (timer.current) clearTimeout(timer.current);
    Animated.parallel([
      Animated.timing(slideY,  { toValue: -120, duration: 240, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0,    duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.parallel([
      Animated.spring(slideY,  { toValue: 0, tension: 65, friction: 13, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    timer.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const tier = TIER_COLORS[badge.tier];

  return (
    <Animated.View
      style={[styles.positioner, { top: insets.top + 10, opacity, transform: [{ translateY: slideY }] }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity style={styles.toast} onPress={dismiss} activeOpacity={0.88}>
        {/* Left tier accent */}
        <View style={[styles.accentBar, { backgroundColor: tier.bg }]} />

        {/* Emoji */}
        <Text style={styles.emoji}>{badge.emoji}</Text>

        {/* Text */}
        <View style={styles.textWrap}>
          <Text style={styles.caption}>TROPHY UNLOCKED</Text>
          <Text style={styles.name} numberOfLines={1}>{badge.name}</Text>
          <View style={[styles.tierPill, { backgroundColor: tier.bg }]}>
            <Text style={[styles.tierLabel, { color: tier.text }]}>
              {TIER_LABELS[badge.tier].toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Dismiss hint */}
        <Text style={styles.tapHint}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  positioner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#001845',
    borderRadius: 14,
    overflow: 'hidden',
    gap: 12,
    paddingRight: 14,
    ...Shadows.lg,
  },
  accentBar: {
    width: 5,
    alignSelf: 'stretch',
  },
  emoji: {
    fontSize: 36,
    marginLeft: 4,
  },
  textWrap: {
    flex: 1,
    paddingVertical: 12,
    gap: 3,
  },
  caption: {
    fontSize: 9,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.45)',
  },
  name: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  tierPill: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 2,
  },
  tierLabel: {
    fontSize: 9,
    fontWeight: Typography.weights.black,
    letterSpacing: 1.5,
  },
  tapHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: Typography.weights.bold,
  },
});
