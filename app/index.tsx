import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, Animated, ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Typography, Borders, Shadows } from '../constants/theme';

const { width } = Dimensions.get('window');

// ─── Onboarding slide content ─────────────────────────────────────────────────
const SLIDES = [
  {
    id: '1',
    tag: '01 / PLANS',
    headline: 'STOP\nMISSING\nOUT.',
    body: 'Weather just cleared up. Your friends are free. Cooped Up finds the moment and makes the plan — before it passes.',
    bg: Colors.navy,
    textColor: Colors.white,
    accentColor: Colors.bluePale,
    shape: '◆',
  },
  {
    id: '2',
    tag: '02 / DISCOVER',
    headline: "FIND\nYOUR\nSPOT.",
    body: "Queen's Lawn, Beit Quad, SAF Terrace — see what's open, how busy it is, and whether the weather is worth it.",
    bg: Colors.white,
    textColor: Colors.navy,
    accentColor: Colors.blue,
    shape: '●',
  },
  {
    id: '3',
    tag: '03 / CHAT',
    headline: 'BRING\nPEOPLE\nTOGETHER.',
    body: 'Message friends, share plans, react to the weather. Less group chat chaos — more actually going outside.',
    bg: Colors.bluePale,
    textColor: Colors.navy,
    accentColor: Colors.navy,
    shape: '▲',
  },
];

// ─── Individual slide ─────────────────────────────────────────────────────────
function Slide({ item }: { item: typeof SLIDES[0] }) {
  return (
    <View style={[styles.slide, { backgroundColor: item.bg, width }]}>
      {/* Decorative shape */}
      <View style={styles.shapeContainer}>
        <Text style={[styles.shape, { color: item.accentColor }]}>{item.shape}</Text>
      </View>

      {/* Tag */}
      <View style={[styles.tag, { borderColor: item.textColor }]}>
        <Text style={[styles.tagText, { color: item.textColor }]}>{item.tag}</Text>
      </View>

      {/* Headline */}
      <Text style={[styles.headline, { color: item.textColor }]}>{item.headline}</Text>

      {/* Body */}
      <Text style={[styles.body, { color: item.textColor, opacity: 0.75 }]}>{item.body}</Text>
    </View>
  );
}

// ─── Main onboarding screen ───────────────────────────────────────────────────
export default function OnboardingScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setActiveIndex(viewableItems[0].index ?? 0);
      }
    }
  ).current;

  const isLast = activeIndex === SLIDES.length - 1;
  const currentSlide = SLIDES[activeIndex];

  const handleNext = () => {
    if (isLast) {
      router.replace('/auth/login');
    } else {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={({ item }) => <Slide item={item} />}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      />

      {/* Bottom controls — sit over the slides */}
      <View style={[styles.controls, { backgroundColor: currentSlide.bg }]}>
        {/* Dot indicators */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === activeIndex ? currentSlide.textColor : 'transparent',
                  borderColor: currentSlide.textColor,
                  width: i === activeIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* CTA button */}
        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: currentSlide.textColor,
              borderColor: currentSlide.textColor,
            },
          ]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={[styles.buttonText, { color: currentSlide.bg }]}>
            {isLast ? 'GET STARTED →' : 'NEXT →'}
          </Text>
        </TouchableOpacity>

        {/* Skip */}
        {!isLast && (
          <TouchableOpacity onPress={() => router.replace('/auth/login')} style={styles.skip}>
            <Text style={[styles.skipText, { color: currentSlide.textColor, opacity: 0.5 }]}>
              skip
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 180,
    justifyContent: 'flex-end',
  },
  shapeContainer: {
    position: 'absolute',
    top: 60,
    right: 28,
  },
  shape: {
    fontSize: 120,
    opacity: 0.12,
  },
  tag: {
    alignSelf: 'flex-start',
    borderWidth: Borders.width,
    borderRadius: Borders.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 20,
  },
  tagText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    letterSpacing: 2,
  },
  headline: {
    fontSize: Typography.sizes.hero,
    fontWeight: Typography.weights.black,
    lineHeight: 46,
    letterSpacing: -1,
    marginBottom: 20,
  },
  body: {
    fontSize: Typography.sizes.md,
    lineHeight: 24,
    fontWeight: Typography.weights.regular,
    maxWidth: 300,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    paddingBottom: 48,
    paddingTop: 20,
    alignItems: 'center',
    gap: 16,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginBottom: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  button: {
    width: '100%',
    paddingVertical: 18,
    borderWidth: Borders.widthHeavy,
    borderRadius: Borders.radius,
    alignItems: 'center',
    ...Shadows.md,
  },
  buttonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
  },
  skip: {
    paddingVertical: 4,
  },
  skipText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    letterSpacing: 1,
  },
});