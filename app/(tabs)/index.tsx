import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Toast, ToastRef, setToastRef, showToast } from '../../components/Toast';
import { CreatePlanModal, EXISTING_PLANS } from './plans';
import { Colors, Typography, Shadows } from '../../constants/theme';

const BG   = Colors.lightGrey;
const NAVY = '#001845';
import { useAuth } from '../../hooks/useAuth';
import { getPlansForToday, formatPlanTime, subscribeToTodayPlans } from '../../services/plans';
import { getOnlineFriends } from '../../services/friends';
import { setOnlineStatus } from '../../services/users';
import type { User } from '../../types';
import { getBookmarkedPlans, subscribe as subscribeBookmarks, type BookmarkedPlan } from '../../lib/suggestedStore';
import { isDark, subscribe as subscribeTheme, DarkTheme } from '../../lib/themeStore';
import WeatherModal from '../../components/WeatherModal';
import { fetchFullForecast, type FullForecast, type HourlyItem } from '../../services/weather';


import { DE_TIMETABLE } from '../../lib/timetable';

// ─── Hardcoded fallback data ───────────────────────────────────────────────────
const WEATHER_FALLBACK = {
  temp: 18, condition: 'Partly Cloudy', feelsLike: 16,
  wind: 12, humidity: 58, score: 8,
};

const CAMPUS_SPACES = [
  { id: '1', title: "Queen's Lawn", status: 'BUSY',  tag: 'OUTDOOR' },
  { id: '2', title: 'Beit Quad',    status: 'QUIET', tag: 'OUTDOOR' },
  { id: '3', title: 'SAF Terrace',  status: 'EMPTY', tag: 'HIDDEN GEM' },
];

// ─── Maps an hourly forecast item to a CreatePlanModal slot ID ────────────────
function hourToSlotId(item: HourlyItem): string | null {
  const { hourNum: h, dayOffset: d } = item;
  if (d === 0) {
    if (h >= 9  && h < 13) return 'now';
    if (h >= 13 && h < 15) return 'afternoon';
    if (h >= 15 && h < 18) return 'late';
    if (h >= 18 && h < 22) return 'evening';
  } else if (d === 1) {
    if (h >= 7  && h < 13) return 'tmr_morning';
    if (h >= 13 && h < 17) return 'tmr_afternoon';
    if (h >= 17 && h < 21) return 'tmr_evening';
  }
  return null;
}

// ─── Weather banner ────────────────────────────────────────────────────────────
function WeatherBanner({
  forecast, onPress, onTimePress,
}: {
  forecast: FullForecast | null;
  onPress: () => void;
  onTimePress: (slotId: string) => void;
}) {
  const [selIdx, setSelIdx] = useState<number | null>(null);

  const cur = forecast?.current;
  const temp      = cur ? cur.temp      : WEATHER_FALLBACK.temp;
  const condition = cur ? cur.condition : WEATHER_FALLBACK.condition;
  const score     = cur ? cur.score     : WEATHER_FALLBACK.score;
  const wind      = cur ? cur.windspeed : WEATHER_FALLBACK.wind;
  const humidity  = cur ? cur.humidity  : WEATHER_FALLBACK.humidity;
  const feelsLike = cur ? cur.feelsLike : WEATHER_FALLBACK.feelsLike;
  const hourly    = forecast?.hourly ?? [];
  const selItem   = selIdx !== null ? hourly[selIdx] : null;

  const handleHourPress = (item: HourlyItem, i: number) => {
    const slotId = hourToSlotId(item);
    if (!slotId) return;
    setSelIdx(prev => prev === i ? null : i);
  };

  const bestHourScore = Math.max(...hourly.filter(h => hourToSlotId(h) !== null).map(h => h.score), 0);

  return (
    <View style={styles.weatherCard}>
      {/* Tappable header → opens full weather modal */}
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <View style={styles.weatherRow}>
          <View>
            <Text style={styles.weatherTemp}>{temp}°C</Text>
            <Text style={styles.weatherCond}>{condition}</Text>
          </View>
          <View style={styles.weatherRight}>
            <View style={styles.scorePill}>
              <Text style={styles.scoreText}>{score}/10</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={Colors.blueMuted} style={{ marginTop: 4 }} />
          </View>
        </View>
        <Text style={styles.weatherNudge}>
          {score >= 7
            ? 'Good conditions outside — make the most of it.'
            : 'Not ideal — warm spots available on campus.'}
        </Text>
        <View style={styles.weatherStats}>
          <Text style={styles.weatherStat}>{wind} km/h wind</Text>
          <Text style={styles.weatherStatDot}>·</Text>
          <Text style={styles.weatherStat}>{humidity}% humidity</Text>
          <Text style={styles.weatherStatDot}>·</Text>
          <Text style={styles.weatherStat}>Feels {feelsLike}°C</Text>
        </View>
      </TouchableOpacity>

      {/* Scrollable hourly suggestion strip */}
      {hourly.length > 0 && (
        <>
          <View style={styles.weatherDivider} />
          <Text style={styles.weatherStripLabel}>TIMES TO PLAN</Text>
          <FlatList
            horizontal
            data={hourly}
            keyExtractor={(_, i) => String(i)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hourlyStrip}
            nestedScrollEnabled={true}
            renderItem={({ item, index }) => {
              const slotId = hourToSlotId(item);
              const isGood   = slotId !== null && bestHourScore >= 7 && item.score === bestHourScore;
              const isSel    = selIdx === index;
              const tappable = slotId !== null;
              return (
                <TouchableOpacity
                  style={[styles.hourBox, isGood && styles.hourBoxGood, isSel && styles.hourBoxSel]}
                  onPress={() => handleHourPress(item, index)}
                  activeOpacity={tappable ? 0.75 : 1}
                  disabled={!tappable}
                >
                  <Text style={[styles.hourLabel, (isGood || isSel) && styles.hourLabelGood]}>{item.hour}</Text>
                  <Text style={styles.hourEmoji}>{item.emoji}</Text>
                  <Text style={[styles.hourTemp, (isGood || isSel) && styles.hourTempGood]}>{item.temp}°</Text>
                  {isGood && !isSel && <Text style={styles.hourPlanLabel}>BEST</Text>}
                  {isSel            && <Text style={[styles.hourPlanLabel, { color: '#4CAF50' }]}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />

          {/* Plan now panel — visible when any hour is selected */}
          {selItem && hourToSlotId(selItem) && (
            <TouchableOpacity
              style={styles.planNowPanel}
              onPress={() => {
                const slotId = hourToSlotId(selItem);
                if (slotId) { setSelIdx(null); onTimePress(slotId); }
              }}
              activeOpacity={0.85}
            >
              <View style={styles.planNowLeft}>
                <Text style={styles.planNowEmoji}>{selItem.emoji}</Text>
                <View>
                  <Text style={styles.planNowTime}>{selItem.hour}</Text>
                  <Text style={styles.planNowSub}>{selItem.temp}°C · score {selItem.score}/10</Text>
                </View>
              </View>
              <View style={styles.planNowBtn}>
                <Text style={styles.planNowBtnText}>Plan for this time</Text>
                <Ionicons name="arrow-forward" size={13} color="#001845" />
              </View>
            </TouchableOpacity>
          )}
        </>
      )}
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
export interface HomeTourRefs {
  weatherCard: React.RefObject<View>;
  yourDay:     React.RefObject<View>;
  makePlan:    React.RefObject<View>;
}

export default function HomeScreen({
  onModalChange, homeTourRefs,
}: {
  onModalChange?: (open: boolean) => void;
  homeTourRefs?: HomeTourRefs;
}) {
  const [dark, setDarkMode] = useState(isDark());
  useEffect(() => subscribeTheme(() => setDarkMode(isDark())), []);

  const bg = dark ? DarkTheme.bg : BG;
  const surface = dark ? DarkTheme.surface : Colors.white;
  const textPrimary = dark ? DarkTheme.text : NAVY;
  const textMuted = dark ? DarkTheme.textMuted : Colors.gray500;

  const { user, profile } = useAuth();
  const toastRef = useRef<ToastRef>(null);

  const [fullForecast, setFullForecast] = useState<FullForecast | null>(null);
  const [weatherModalVisible, setWeatherModalVisible] = useState(false);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [planSlot, setPlanSlot] = useState<string | undefined>(undefined);
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

  useEffect(() => {
    fetchFullForecast().then(setFullForecast).catch(() => {});
  }, []);

  useEffect(() => subscribeBookmarks(() => setBookmarkedPlans(getBookmarkedPlans())), []);

  const refetchTodayPlans = useCallback(async () => {
    if (!user?.id) return;
    const plans = await getPlansForToday(user.id);
    setDbTodayPlans(plans.map(p => ({
      id: p.id,
      title: p.title,
      location: p.location,
      time: formatPlanTime(p.time),
    })));
    // Once DB data is available, drop the optimistic local entries
    setUserCreatedPlans([]);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    setOnlineStatus(user.id, true);
    refetchTodayPlans();
    getOnlineFriends(user.id).then(setOnlineFriends);
    return () => { if (user) setOnlineStatus(user.id, false); };
  }, [user?.id, refetchTodayPlans]);

  // Realtime: refetch YOUR DAY when user is added to a plan or creates a new plan
  useEffect(() => {
    if (!user?.id) return;
    return subscribeToTodayPlans(user.id, refetchTodayPlans);
  }, [user?.id, refetchTodayPlans]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const firstName = profile?.full_name?.split(' ')[0] ?? '';

  const todayTimetable = DE_TIMETABLE
    .filter(e => e.day === new Date().getDay())
    .sort((a, b) => a.startHour - b.startHour);

  const hardcodedMyPlans = EXISTING_PLANS.filter(p => p.creator === 'You');
  const basePlans = dbTodayPlans.length > 0
    ? dbTodayPlans
    : hardcodedMyPlans.map(p => ({ id: p.id, title: p.title, location: p.location, time: p.time }));
  const seenIds = new Set(basePlans.map(p => p.id));
  const seenTitles = new Set(basePlans.map(p => p.title));
  const allPlans = [
    ...basePlans,
    // only show optimistic entries that haven't been replaced by DB data yet
    ...userCreatedPlans.filter(p => !seenIds.has(p.id) && !seenTitles.has(p.title)),
    ...bookmarkedPlans.filter(p => !seenIds.has(p.id) && !seenTitles.has(p.title)),
  ];

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchTodayPlans(),
        user?.id ? getOnlineFriends(user.id).then(setOnlineFriends) : Promise.resolve(),
        fetchFullForecast().then(setFullForecast).catch(() => {}),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchTodayPlans, user?.id]);

  const anyModalOpen = weatherModalVisible || createModalVisible;

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <View style={{ flex: 1 }} pointerEvents={anyModalOpen ? 'none' : 'auto'}>
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={dark ? '#FFFFFF' : NAVY}
              colors={[NAVY]}
            />
          }
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
          <View ref={homeTourRefs?.yourDay} collapsable={false} style={styles.yourDayCard}>
            <Text style={styles.yourDayTitle}>Your day</Text>

            {/* Plans */}
            {allPlans.slice(0, 4).map(plan => (
              <View key={plan.id} style={styles.planRow}>
                <Text style={styles.planTime}>{plan.time}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planTitle} numberOfLines={1}>{plan.title}</Text>
                  <Text style={styles.planLocation} numberOfLines={1}>{plan.location}</Text>
                </View>
              </View>
            ))}

            {/* Timetable events — gray outline, visually distinct from plans */}
            {todayTimetable.map(event => (
              <View key={event.id} style={styles.ttRow}>
                <Text style={styles.ttRowTime}>
                  {`${String(event.startHour).padStart(2, '0')}:00`}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ttRowTitle} numberOfLines={1}>{event.title}</Text>
                  <Text style={styles.ttRowLoc} numberOfLines={1}>{event.location}</Text>
                </View>
                <View style={styles.ttRowTag}>
                  <Text style={styles.ttRowTagText}>
                    {event.title.includes('Tutorial') ? 'TUTORIAL' : 'LECTURE'}
                  </Text>
                </View>
              </View>
            ))}

            {/* Empty state — only when both lists are empty */}
            {allPlans.length === 0 && todayTimetable.length === 0 && (
              <Text style={styles.emptyDayText}>Nothing planned yet — add one below.</Text>
            )}
          </View>

          {/* ── Make Plan card ── */}
          <TouchableOpacity
            ref={homeTourRefs?.makePlan as any}
            style={styles.makePlanCard}
            onPress={() => { setCreateModalVisible(true); onModalChange?.(true); }}
            activeOpacity={0.88}
          >
            <Text style={styles.makePlanText}>Make Plan</Text>
            <View style={styles.plusCircle}>
              <Ionicons name="add" size={20} color={Colors.navy} />
            </View>
          </TouchableOpacity>

          {/* ── Section: Weather ── */}
          <Text style={[styles.sectionLabel, { color: textMuted }]}>WEATHER</Text>
          <View ref={homeTourRefs?.weatherCard} collapsable={false}>
            <WeatherBanner
              forecast={fullForecast}
              onPress={() => { setWeatherModalVisible(true); onModalChange?.(true); }}
              onTimePress={(slotId) => {
                setPlanSlot(slotId);
                setCreateModalVisible(true);
                onModalChange?.(true);
              }}
            />
          </View>

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
      </View>

      <CreatePlanModal
        visible={createModalVisible}
        onClose={() => { setCreateModalVisible(false); setPlanSlot(undefined); onModalChange?.(false); }}
        onCreate={plan => setUserCreatedPlans(prev => [...prev, plan])}
        initialValues={planSlot ? { slot: planSlot } : undefined}
      />
      <WeatherModal
        visible={weatherModalVisible}
        forecast={fullForecast}
        onClose={() => { setWeatherModalVisible(false); onModalChange?.(false); }}
        onPlanTime={(slotId) => {
          setWeatherModalVisible(false);
          onModalChange?.(false);
          setPlanSlot(slotId);
          setCreateModalVisible(true);
          onModalChange?.(true);
        }}
      />
      <Toast ref={toastRef} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },

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
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
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

  // Hourly suggestion strip
  weatherDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginTop: 16,
    marginBottom: 14,
  },
  weatherStripLabel: {
    fontSize: 9,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 10,
  },
  hourlyStrip: {
    gap: 8,
    paddingBottom: 4,
  },
  hourBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 60,
    gap: 3,
  },
  hourBoxGood: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  hourBoxSel: {
    backgroundColor: 'rgba(76,175,80,0.22)',
    borderColor: '#4CAF50',
    borderWidth: 1.5,
  },
  hourLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.medium,
    color: 'rgba(255,255,255,0.45)',
  },
  hourLabelGood: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: Typography.weights.black,
  },
  hourEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  hourTemp: {
    fontSize: 13,
    fontWeight: Typography.weights.black,
    color: 'rgba(255,255,255,0.55)',
  },
  hourTempGood: {
    color: '#FFFFFF',
  },
  hourPlanLabel: {
    fontSize: 8,
    fontWeight: Typography.weights.black,
    letterSpacing: 1.5,
    color: Colors.green,
    marginTop: 2,
  },

  // Plan-now panel (appears when a good hour is selected)
  planNowPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    marginTop: 10,
    gap: 10,
  },
  planNowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planNowEmoji: { fontSize: 22 },
  planNowTime: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
  },
  planNowSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: Typography.weights.medium,
    marginTop: 1,
  },
  planNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 5,
    flexShrink: 0,
  },
  planNowBtnText: {
    fontSize: 11,
    fontWeight: Typography.weights.black,
    color: '#001845',
  },
  // Friend rows
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
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
    color: Colors.navy,
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

  // Timetable inline rows (inside yourDayCard — gray outline to distinguish from plans)
  ttRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  ttRowTime: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: 'rgba(255,255,255,0.38)',
    width: 42,
  },
  ttRowTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: 'rgba(255,255,255,0.68)',
    marginBottom: 2,
  },
  ttRowLoc: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.38)',
    fontWeight: Typography.weights.medium,
  },
  ttRowTag: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexShrink: 0,
  },
  ttRowTagText: {
    fontSize: 7,
    fontWeight: Typography.weights.black,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
});
