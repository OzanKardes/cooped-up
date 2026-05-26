import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Toast, ToastRef, setToastRef, showToast } from '../../components/Toast';
import { CreatePlanModal, EXISTING_PLANS } from './plans';
import { Colors, Typography, Borders, Shadows } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { getPlansForToday, formatPlanTime } from '../../services/plans';
import { getOnlineFriends } from '../../services/friends';
import { setOnlineStatus } from '../../services/users';
import type { User } from '../../types';
import { getBookmarkedPlans, subscribe as subscribeBookmarks, type BookmarkedPlan } from '../../lib/suggestedStore';
import { isDark, subscribe as subscribeTheme, DarkTheme } from '../../lib/themeStore';

const BG = Colors.lightGrey;
const NAVY = '#001845';

// ─── Hardcoded fallback data ───────────────────────────────────────────────────
const WEATHER = {
  temp: 18, condition: 'Partly Cloudy', feelsLike: 16,
  wind: 12, humidity: 58, score: 8,
};

const HOURLY_FORECAST = [
  { hour: '12pm', temp: 18, score: 7 },
  { hour: '1pm',  temp: 19, score: 8 },
  { hour: '2pm',  temp: 20, score: 9 },
  { hour: '3pm',  temp: 20, score: 9 },
  { hour: '4pm',  temp: 17, score: 6 },
  { hour: '5pm',  temp: 14, score: 3 },
];

const CAMPUS_SPACES = [
  { id: '1', title: "Queen's Lawn", status: 'BUSY',  tag: 'OUTDOOR' },
  { id: '2', title: 'Beit Quad',    status: 'QUIET', tag: 'OUTDOOR' },
  { id: '3', title: 'SAF Terrace',  status: 'EMPTY', tag: 'HIDDEN GEM' },
];

// ─── Weather banner ────────────────────────────────────────────────────────────
function WeatherBanner() {
  const [expanded, setExpanded] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    Animated.spring(anim, { toValue: next ? 1 : 0, useNativeDriver: false, damping: 22, stiffness: 160 }).start();
  };

  const expandH = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 200] });

  return (
    <View style={styles.weatherCard}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.9}>
        <View style={styles.weatherRow}>
          <View>
            <Text style={styles.weatherTemp}>{WEATHER.temp}°C</Text>
            <Text style={styles.weatherCond}>{WEATHER.condition}</Text>
          </View>
          <View style={styles.weatherRight}>
            <View style={styles.scorePill}>
              <Text style={styles.scoreText}>{WEATHER.score}/10</Text>
            </View>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.blueMuted} style={{ marginTop: 4 }} />
          </View>
        </View>
        <Text style={styles.weatherNudge}>
          {WEATHER.score >= 7
            ? 'Good conditions outside — make the most of it.'
            : 'Not ideal — warm spots available on campus.'}
        </Text>
        <View style={styles.weatherStats}>
          <Text style={styles.weatherStat}>{WEATHER.wind} km/h wind</Text>
          <Text style={styles.weatherStatDot}>·</Text>
          <Text style={styles.weatherStat}>{WEATHER.humidity}% humidity</Text>
          <Text style={styles.weatherStatDot}>·</Text>
          <Text style={styles.weatherStat}>Feels {WEATHER.feelsLike}°C</Text>
        </View>
      </TouchableOpacity>

      <Animated.View style={{ maxHeight: expandH, overflow: 'hidden' }}>
        <View style={styles.forecastDivider} />
        <Text style={styles.forecastLabel}>HOURLY FORECAST</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {HOURLY_FORECAST.map((h, i) => (
            <View key={i} style={styles.forecastCol}>
              <Text style={styles.forecastHour}>{h.hour}</Text>
              <Text style={styles.forecastTemp}>{h.temp}°</Text>
              <View style={styles.scoreBarTrack}>
                <View style={[styles.scoreBarFill, { height: Math.round(h.score * 2.4) }]} />
              </View>
              <Text style={styles.forecastScore}>{h.score}</Text>
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ─── Campus space row ──────────────────────────────────────────────────────────
function SpaceRow({ title, status, tag, dark }: { title: string; status: string; tag: string; dark: boolean }) {
  const statusColor = status === 'BUSY' ? Colors.orange : status === 'QUIET' ? Colors.green : Colors.gray500;
  return (
    <View style={styles.spaceRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.spaceTitle, dark && { color: DarkTheme.text }]}>{title}</Text>
        <Text style={[styles.spaceTag, dark && { color: DarkTheme.textMuted }]}>{tag}</Text>
      </View>
      <View style={[styles.statusPill, { borderColor: statusColor }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
      </View>
    </View>
  );
}

// ─── Home screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const [dark, setDarkMode] = useState(isDark());
  useEffect(() => subscribeTheme(() => setDarkMode(isDark())), []);

  const bg = dark ? DarkTheme.bg : BG;
  const surface = dark ? DarkTheme.surface : Colors.white;
  const textPrimary = dark ? DarkTheme.text : Colors.navy;
  const textMuted = dark ? DarkTheme.textMuted : Colors.gray500;

  const { user, profile } = useAuth();
  const toastRef = useRef<ToastRef>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [notifOn, setNotifOn] = useState(true);
  const [dbTodayPlans, setDbTodayPlans] = useState<
    { id: string; title: string; location: string; time: string }[]
  >([]);
  const [userCreatedPlans, setUserCreatedPlans] = useState<
    { id: string; title: string; location: string; time: string; weather: string }[]
  >([]);
  const [onlineFriends, setOnlineFriends] = useState<User[]>([]);
  const [bookmarkedPlans, setBookmarkedPlans] = useState<BookmarkedPlan[]>(getBookmarkedPlans());

  useEffect(() => { setToastRef(toastRef); }, []);

  useEffect(() => subscribeBookmarks(() => setBookmarkedPlans(getBookmarkedPlans())), []);

  useEffect(() => {
    if (!user) return;
    setOnlineStatus(user.id, true);
    getPlansForToday(user.id).then(plans => {
      setDbTodayPlans(plans.map(p => ({
        id: p.id,
        title: p.title,
        location: p.location,
        time: formatPlanTime(p.time),
      })));
    });
    getOnlineFriends(user.id).then(setOnlineFriends);
    return () => { if (user) setOnlineStatus(user.id, false); };
  }, [user?.id]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const firstName = profile?.full_name?.split(' ')[0] ?? '';

  const hardcodedMyPlans = EXISTING_PLANS.filter(p => p.creator === 'You');
  const basePlans = dbTodayPlans.length > 0
    ? dbTodayPlans
    : hardcodedMyPlans.map(p => ({ id: p.id, title: p.title, location: p.location, time: p.time }));
  const seenIds = new Set(basePlans.map(p => p.id));
  const allPlans = [
    ...basePlans,
    ...userCreatedPlans,
    ...bookmarkedPlans.filter(p => !seenIds.has(p.id)),
  ];

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: textMuted }]}>{greeting}{firstName ? `, ${firstName}` : ''}</Text>
              <Text style={[styles.appName, { color: textPrimary }]}>IMPERIAL</Text>
            </View>
            <TouchableOpacity
              style={[styles.bellBtn, !notifOn && { opacity: 0.45 }, dark && { backgroundColor: DarkTheme.surface, borderColor: DarkTheme.border }]}
              onPress={() => setNotifOn(v => !v)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={notifOn ? 'notifications-outline' : 'notifications-off-outline'}
                size={22}
                color={textPrimary}
              />
            </TouchableOpacity>
          </View>

          {/* ── Your day card ── */}
          <View style={styles.yourDayCard}>
            <Text style={styles.yourDayTitle}>Your day</Text>
            {allPlans.length > 0 ? (
              allPlans.slice(0, 4).map(plan => (
                <View key={plan.id} style={styles.planRow}>
                  <Text style={styles.planTime}>{plan.time}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planTitle} numberOfLines={1}>{plan.title}</Text>
                    <Text style={styles.planLocation} numberOfLines={1}>{plan.location}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyDayText}>Nothing planned yet — add one below.</Text>
            )}
          </View>

          {/* ── Make Plan card ── */}
          <TouchableOpacity
            style={styles.makePlanCard}
            onPress={() => setCreateModalVisible(true)}
            activeOpacity={0.88}
          >
            <Text style={styles.makePlanText}>Make Plan</Text>
            <View style={styles.plusCircle}>
              <Ionicons name="add" size={20} color={NAVY} />
            </View>
          </TouchableOpacity>

          {/* ── Section: Weather ── */}
          <Text style={[styles.sectionLabel, { color: textMuted }]}>WEATHER</Text>
          <WeatherBanner />

          {/* ── Section: Friends online ── */}
          <Text style={[styles.sectionLabel, { color: textMuted }]}>FRIENDS RIGHT NOW</Text>
          {onlineFriends.length > 0 ? (
            onlineFriends.map(f => (
              <View key={f.id} style={[styles.friendRow, { backgroundColor: surface }]}>
                <View style={styles.friendAvatar}>
                  <Text style={styles.friendInitials}>{f.avatar_initials}</Text>
                  <View style={styles.onlineDot} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.friendName, { color: textPrimary }]}>{f.full_name}</Text>
                  <Text style={[styles.friendStatus, { color: textMuted }]}>Active on campus</Text>
                </View>
                <TouchableOpacity
                  style={styles.joinBtn}
                  onPress={() => showToast(`Said hi to ${f.full_name.split(' ')[0]}`)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.joinBtnText}>SAY HI</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: surface }]}>
              <Text style={[styles.emptyCardText, { color: textPrimary }]}>No friends online right now.</Text>
              <Text style={[styles.emptyCardHint, { color: textMuted }]}>Add friends in the Chat tab.</Text>
            </View>
          )}

          {/* ── Section: On campus now ── */}
          <Text style={[styles.sectionLabel, { color: textMuted }]}>ON CAMPUS NOW</Text>
          <View style={[styles.spacesCard, { backgroundColor: surface }]}>
            {CAMPUS_SPACES.map((s, i) => (
              <View key={s.id}>
                {i > 0 && <View style={[styles.spaceDivider, dark && { backgroundColor: DarkTheme.border }]} />}
                <SpaceRow title={s.title} status={s.status} tag={s.tag} dark={dark} />
              </View>
            ))}
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>

      <CreatePlanModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreate={plan => setUserCreatedPlans(prev => [...prev, plan])}
      />
      <Toast ref={toastRef} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
    color: Colors.gray500,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  appName: {
    fontSize: 30,
    fontWeight: Typography.weights.black,
    color: NAVY,
    letterSpacing: 2,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.gray300,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    ...Shadows.sm,
  },

  // Your day card
  yourDayCard: {
    backgroundColor: NAVY,
    borderRadius: 12,
    padding: 22,
    marginBottom: 12,
    minHeight: 170,
  },
  yourDayTitle: {
    fontSize: 22,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  planTime: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: 'rgba(255,255,255,0.55)',
    width: 60,
    paddingTop: 2,
  },
  planTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
    marginBottom: 1,
  },
  planLocation: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: Typography.weights.medium,
  },
  emptyDayText: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: Typography.weights.medium,
    lineHeight: 22,
  },

  // Make Plan card
  makePlanCard: {
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 18,
    marginBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  makePlanText: {
    fontSize: 18,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  plusCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section labels
  sectionLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 2.5,
    color: Colors.gray500,
    marginBottom: 10,
  },

  // Weather card
  weatherCard: {
    backgroundColor: NAVY,
    borderRadius: 12,
    padding: 20,
    marginBottom: 28,
  },
  weatherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  weatherTemp: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  weatherCond: {
    fontSize: Typography.sizes.xs,
    color: Colors.blueMuted,
    fontWeight: Typography.weights.medium,
  },
  weatherRight: { alignItems: 'flex-end', gap: 4 },
  scorePill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  scoreText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
  },
  weatherNudge: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginBottom: 10,
    fontWeight: Typography.weights.medium,
  },
  weatherStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weatherStat: {
    fontSize: 11,
    color: Colors.blueMuted,
    fontWeight: Typography.weights.medium,
  },
  weatherStatDot: {
    fontSize: 11,
    color: Colors.blueMuted,
  },
  forecastDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 14,
    marginBottom: 12,
  },
  forecastLabel: {
    fontSize: 9,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
    color: Colors.blueMuted,
    marginBottom: 10,
  },
  forecastCol: { alignItems: 'center', marginRight: 18, gap: 4 },
  forecastHour: { fontSize: 10, color: Colors.blueMuted, fontWeight: Typography.weights.bold },
  forecastTemp: { fontSize: 11, color: '#FFFFFF', fontWeight: Typography.weights.black },
  scoreBarTrack: {
    width: 16, height: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  scoreBarFill: { width: '100%', backgroundColor: Colors.bluePale, borderRadius: 2 },
  forecastScore: { fontSize: 9, color: Colors.blueMuted, fontWeight: Typography.weights.bold },

  // Friend rows
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    ...Shadows.sm,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bluePale,
    borderWidth: 2,
    borderColor: Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  friendInitials: {
    fontSize: 14,
    fontWeight: Typography.weights.black,
    color: NAVY,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.green,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  friendName: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    marginBottom: 2,
  },
  friendStatus: {
    fontSize: 11,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
  },
  joinBtn: {
    backgroundColor: NAVY,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  joinBtnText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 1.5,
    color: '#FFFFFF',
  },

  // Empty states
  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  emptyCardText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
  },
  emptyCardHint: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
    textAlign: 'center',
  },

  // Campus spaces card
  spacesCard: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
    ...Shadows.sm,
  },
  spaceDivider: {
    height: 1,
    backgroundColor: Colors.gray100,
    marginHorizontal: 16,
  },
  spaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  spaceTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    marginBottom: 2,
  },
  spaceTag: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.5,
    color: Colors.gray500,
  },
  statusPill: {
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 1,
  },
});
