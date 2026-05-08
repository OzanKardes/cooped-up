import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Borders, Shadows } from '../../constants/theme';

const { width, height } = Dimensions.get('window');

// ─── Wheel nav items ──────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'home',     label: 'HOME',     icon: '⌂' },
  { id: 'plans',    label: 'PLANS',    icon: '◈' },
  { id: 'discover', label: 'DISCOVER', icon: '◎' },
  { id: 'chat',     label: 'CHAT',     icon: '◇' },
  { id: 'profile',  label: 'PROFILE',  icon: '○' },
];

// ─── Hardcoded data ───────────────────────────────────────────────────────────
const WEATHER = {
  temp: 18, condition: 'Partly Cloudy', feelsLike: 16,
  wind: 12, humidity: 58, icon: '⛅', score: 8,
};

const ACTIVITIES = [
  {
    id: '1', title: "Queen's Lawn", status: 'BUSY', tag: 'OUTDOOR',
    desc: '20+ students out. Frisbee, revision, good energy.',
    bg: Colors.bluePale,
  },
  {
    id: '2', title: 'Beit Quad', status: 'QUIET', tag: 'OUTDOOR',
    desc: 'A handful of people. Good for a quiet sit-down.',
    bg: Colors.cream,
  },
  {
    id: '3', title: 'SAF Terrace', status: 'EMPTY', tag: 'HIDDEN GEM',
    desc: 'Rare — nearly empty with great views today.',
    bg: Colors.accent,
  },
];

// ─── Semicircular wheel navigator ────────────────────────────────────────────
function WheelNav({
  activeTab, onTabChange,
}: {
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const [dragIndex, setDragIndex] = useState(
    NAV_ITEMS.findIndex(n => n.id === activeTab)
  );

  const toggleWheel = () => {
    const toValue = expanded ? 0 : 1;
    Animated.spring(expandAnim, {
      toValue,
      useNativeDriver: false,
      tension: 80,
      friction: 10,
    }).start();
    setExpanded(!expanded);
  };

  const wheelHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [72, 220],
  });

  const activeItem = NAV_ITEMS[dragIndex];

  // Pan responder for scroll-to-switch
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const step = width / NAV_ITEMS.length;
        const rawIndex = Math.floor((gestureState.moveX) / step);
        const clamped = Math.max(0, Math.min(NAV_ITEMS.length - 1, rawIndex));
        setDragIndex(clamped);
      },
      onPanResponderRelease: (_, gestureState) => {
        const step = width / NAV_ITEMS.length;
        const rawIndex = Math.floor(gestureState.moveX / step);
        const clamped = Math.max(0, Math.min(NAV_ITEMS.length - 1, rawIndex));
        onTabChange(NAV_ITEMS[clamped].id);
        setDragIndex(clamped);
        // Collapse after selection
        Animated.spring(expandAnim, {
          toValue: 0, useNativeDriver: false, tension: 80, friction: 10,
        }).start();
        setExpanded(false);
      },
    })
  ).current;

  return (
    <Animated.View style={[styles.wheelContainer, { height: wheelHeight }]}>
      {/* Collapsed pill — always visible */}
      <TouchableOpacity
        style={styles.wheelPill}
        onPress={toggleWheel}
        activeOpacity={0.9}
      >
        <Text style={styles.wheelPillIcon}>{activeItem.icon}</Text>
        <Text style={styles.wheelPillLabel}>{activeItem.label}</Text>
        <Text style={styles.wheelPillChevron}>{expanded ? '▼' : '▲'}</Text>
      </TouchableOpacity>

      {/* Expanded wheel — drag to select */}
      {expanded && (
        <View style={styles.wheelExpanded} {...panResponder.panHandlers}>
          {/* Arc line */}
          <View style={styles.arcLine} />

          {/* Nav items laid out in a fan */}
          <View style={styles.wheelItems}>
            {NAV_ITEMS.map((item, i) => {
              const isActive = i === dragIndex;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.wheelItem, isActive && styles.wheelItemActive]}
                  onPress={() => {
                    setDragIndex(i);
                    onTabChange(item.id);
                    toggleWheel();
                  }}
                >
                  <Text style={[styles.wheelItemIcon, isActive && styles.wheelItemIconActive]}>
                    {item.icon}
                  </Text>
                  <Text style={[styles.wheelItemLabel, isActive && styles.wheelItemLabelActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.wheelHint}>drag or tap to navigate</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Weather banner ───────────────────────────────────────────────────────────
function WeatherBanner() {
  return (
    <View style={styles.weatherCard}>
      <View style={styles.weatherTop}>
        <View>
          <Text style={styles.weatherTemp}>{WEATHER.temp}°C</Text>
          <Text style={styles.weatherCondition}>{WEATHER.condition}</Text>
        </View>
        <Text style={styles.weatherIcon}>{WEATHER.icon}</Text>
        <View style={styles.scorePill}>
          <Text style={styles.scoreText}>{WEATHER.score}/10</Text>
        </View>
      </View>
      <View style={styles.weatherDivider} />
      <Text style={styles.nudgeText}>
        {WEATHER.score >= 7
          ? "Conditions are good. Stop being cooped up. 🐣"
          : "Not ideal outside — warm spots available on campus."}
      </Text>
      <View style={styles.weatherStats}>
        <Text style={styles.weatherStat}>💨 {WEATHER.wind}km/h</Text>
        <Text style={styles.weatherStat}>💧 {WEATHER.humidity}%</Text>
        <Text style={styles.weatherStat}>Feels {WEATHER.feelsLike}°C</Text>
      </View>
    </View>
  );
}

// ─── Space card ───────────────────────────────────────────────────────────────
function SpaceCard({ item }: { item: typeof ACTIVITIES[0] }) {
  return (
    <TouchableOpacity
      style={[styles.spaceCard, { backgroundColor: item.bg }]}
      activeOpacity={0.85}
    >
      <View style={styles.spaceCardTop}>
        <Text style={styles.spaceTitle}>{item.title}</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.spaceDesc}>{item.desc}</Text>
      <View style={styles.tagPill}>
        <Text style={styles.tagPillText}>{item.tag}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Placeholder screens ──────────────────────────────────────────────────────
function PlaceholderScreen({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderIcon}>{icon}</Text>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderSub}>Coming soon</Text>
    </View>
  );
}

// ─── Home content ─────────────────────────────────────────────────────────────
function HomeContent() {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.homeContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.homeHeader}>
        <View>
          <Text style={styles.greeting}>GOOD AFTERNOON</Text>
          <Text style={styles.campus}>Imperial College London</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn}>
          <Text style={styles.notifIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      <WeatherBanner />

      <Text style={styles.sectionTitle}>ON CAMPUS NOW</Text>
      {ACTIVITIES.map(item => (
        <SpaceCard key={item.id} item={item} />
      ))}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState('home');

  const renderContent = () => {
    switch (activeTab) {
      case 'home':     return <HomeContent />;
      case 'plans':    return <PlaceholderScreen title="PLANS" icon="◈" />;
      case 'discover': return <PlaceholderScreen title="DISCOVER" icon="◎" />;
      case 'chat':     return <PlaceholderScreen title="CHAT" icon="◇" />;
      case 'profile':  return <PlaceholderScreen title="PROFILE" icon="○" />;
      default:         return <HomeContent />;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        {renderContent()}
      </View>
      <WheelNav activeTab={activeTab} onTabChange={setActiveTab} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    flex: 1,
  },

  // Wheel
  wheelContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.navy,
    borderTopWidth: Borders.widthHeavy,
    borderTopColor: Colors.black,
    overflow: 'hidden',
  },
  wheelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 10,
  },
  wheelPillIcon: {
    fontSize: 18,
    color: Colors.white,
  },
  wheelPillLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    letterSpacing: 3,
    color: Colors.white,
  },
  wheelPillChevron: {
    fontSize: 10,
    color: Colors.blueMuted,
    marginLeft: 4,
  },
  wheelExpanded: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 16,
  },
  arcLine: {
    width: '85%',
    height: 2,
    backgroundColor: Colors.blueLight,
    marginBottom: 20,
    borderRadius: 1,
  },
  wheelItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 12,
  },
  wheelItem: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: Borders.radius,
    borderWidth: 0,
    gap: 6,
    flex: 1,
  },
  wheelItemActive: {
    backgroundColor: Colors.blueLight,
    borderWidth: Borders.width,
    borderColor: Colors.white,
  },
  wheelItemIcon: {
    fontSize: 20,
    color: Colors.blueMuted,
  },
  wheelItemIconActive: {
    color: Colors.white,
  },
  wheelItemLabel: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.5,
    color: Colors.blueMuted,
  },
  wheelItemLabelActive: {
    color: Colors.white,
  },
  wheelHint: {
    fontSize: 10,
    color: Colors.blueMuted,
    marginTop: 12,
    letterSpacing: 1,
  },

  // Home
  homeContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  homeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 3,
    color: Colors.gray500,
  },
  campus: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    letterSpacing: -0.5,
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  notifIcon: { fontSize: 18 },

  // Weather card
  weatherCard: {
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    padding: 20,
    marginBottom: 28,
    ...Shadows.md,
  },
  weatherTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  weatherTemp: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.black,
    color: Colors.white,
    letterSpacing: -1,
  },
  weatherCondition: {
    fontSize: Typography.sizes.sm,
    color: Colors.blueMuted,
    fontWeight: Typography.weights.medium,
  },
  weatherIcon: {
    fontSize: 40,
    marginLeft: 'auto',
    marginRight: 12,
  },
  scorePill: {
    backgroundColor: Colors.bluePale,
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scoreText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
  },
  weatherDivider: {
    height: 2,
    backgroundColor: Colors.blueLight,
    marginBottom: 14,
  },
  nudgeText: {
    fontSize: Typography.sizes.md,
    color: Colors.white,
    lineHeight: 22,
    marginBottom: 14,
    fontWeight: Typography.weights.medium,
  },
  weatherStats: {
    flexDirection: 'row',
    gap: 16,
  },
  weatherStat: {
    fontSize: Typography.sizes.xs,
    color: Colors.blueMuted,
    fontWeight: Typography.weights.medium,
  },

  // Section title
  sectionTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 3,
    color: Colors.gray500,
    marginBottom: 12,
  },

  // Space card
  spaceCard: {
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    padding: 16,
    marginBottom: 12,
    ...Shadows.sm,
  },
  spaceCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  spaceTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    letterSpacing: -0.5,
  },
  statusPill: {
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radiusSm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.white,
  },
  statusText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 1,
    color: Colors.navy,
  },
  spaceDesc: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray700,
    lineHeight: 20,
    marginBottom: 10,
  },
  tagPill: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: Colors.navy,
    borderRadius: Borders.radiusSm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagPillText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.5,
    color: Colors.navy,
  },

  // Placeholder
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  placeholderIcon: {
    fontSize: 48,
    color: Colors.gray300,
  },
  placeholderTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    letterSpacing: 2,
  },
  placeholderSub: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray500,
    letterSpacing: 1,
  },
});