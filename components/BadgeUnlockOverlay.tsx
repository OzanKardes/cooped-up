import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableWithoutFeedback, Dimensions,
} from 'react-native';
import type { BadgeDef } from '../services/badges';
import { TIER_COLORS, TIER_LABELS } from '../services/badges';
import { Typography, Borders, Shadows } from '../constants/theme';

const { height: SCREEN_H } = Dimensions.get('window');

interface Props {
  badge: BadgeDef;
  onDismiss: () => void;
}

export default function BadgeUnlockOverlay({ badge, onDismiss }: Props) {
  const backdrop = useRef(new Animated.Value(0)).current;
  const slideY   = useRef(new Animated.Value(SCREEN_H * 0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1, duration: 280, useNativeDriver: true,
      }),
      Animated.spring(slideY, {
        toValue: 0, tension: 50, friction: 12, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideY,   { toValue: SCREEN_H * 0.5, duration: 220, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  const tier = TIER_COLORS[badge.tier];

  return (
    <TouchableWithoutFeedback onPress={dismiss}>
      <View style={StyleSheet.absoluteFill} pointerEvents="auto">
        {/* Backdrop */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdrop }]}
          pointerEvents="none"
        />

        {/* Card */}
        <Animated.View
          style={[styles.cardWrap, { transform: [{ translateY: slideY }] }]}
          pointerEvents="none"
        >
          <View style={[styles.card, { borderColor: tier.bg }]}>
            {/* Tier pill */}
            <View style={[styles.tierPill, { backgroundColor: tier.bg }]}>
              <Text style={[styles.tierText, { color: tier.text }]}>
                {TIER_LABELS[badge.tier].toUpperCase()}
              </Text>
            </View>

            {/* New unlock label */}
            <Text style={styles.newLabel}>TROPHY UNLOCKED</Text>

            {/* Emoji */}
            <Text style={styles.emoji}>{badge.emoji}</Text>

            {/* Name */}
            <Text style={styles.name}>{badge.name}</Text>

            {/* Desc */}
            <Text style={styles.desc}>{badge.desc}</Text>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: tier.bg }]} />

            {/* Tap hint */}
            <Text style={styles.tapHint}>TAP TO CONTINUE</Text>
          </View>
        </Animated.View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  cardWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: '#001845',
    borderRadius: Borders.radiusLg,
    borderWidth: 3,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
    gap: 10,
    ...Shadows.lg,
  },
  tierPill: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  tierText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 2.5,
  },
  newLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.45)',
  },
  emoji: {
    fontSize: 80,
    marginVertical: 8,
  },
  name: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  desc: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 20,
  },
  divider: {
    height: 2,
    width: 48,
    borderRadius: 1,
    marginVertical: 6,
  },
  tapHint: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.35)',
  },
});
