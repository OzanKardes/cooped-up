import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView,
  TouchableOpacity, TouchableWithoutFeedback, Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { FullForecast, HourlyItem } from '../services/weather';
import { Typography } from '../constants/theme';

const { height: SCREEN_H } = Dimensions.get('window');
const NAVY    = '#001845';
const SURFACE = '#0D2040';
const CARD    = '#162A4A';
const BORDER  = 'rgba(255,255,255,0.1)';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(255,255,255,0.5)';
const ACCENT  = 'rgba(255,255,255,0.12)';

function scoreColor(s: number) {
  if (s >= 8) return '#4CAF50';
  if (s >= 6) return '#8BC34A';
  if (s >= 4) return '#FF9800';
  return '#F44336';
}

// Maps an hourly item to a plan slot ID.
// Every hour is now covered — no nulls so every card is tappable.
function hourToSlotId(item: HourlyItem): string {
  const h = item.hourNum;
  const d = item.dayOffset;
  if (d === 0) {
    if (h < 13)  return 'now';           // midnight–12pm → "now / this morning"
    if (h < 15)  return 'afternoon';
    if (h < 18)  return 'late';
    if (h < 22)  return 'evening';
    return 'tmr_morning';                 // 10pm–midnight → tomorrow morning
  }
  // d === 1 (tomorrow) or later rolled over from today
  if (h < 13)  return 'tmr_morning';
  if (h < 17)  return 'tmr_afternoon';
  return 'tmr_evening';
}

// Maps a daily-forecast array index (0 = today) to a plan slot ID.
// Returns null for today (already covered by hourly) and day 6 (no slot).
function dailyToSlotId(index: number): string | null {
  if (index === 0) return null;          // today — use hourly strip instead
  if (index === 1) return 'tmr_afternoon';
  if (index === 2) return 'thu';
  if (index === 3) return 'fri';
  if (index === 4) return 'sat';
  if (index === 5) return 'sun';
  return null;
}

interface Props {
  visible: boolean;
  forecast: FullForecast | null;
  onClose: () => void;
  onPlanTime?: (slotId: string) => void;
}

export default function WeatherModal({ visible, forecast, onClose, onPlanTime }: Props) {
  const insets = useSafeAreaInsets();
  const slideY     = useRef(new Animated.Value(SCREEN_H)).current;
  const bannerAnim = useRef(new Animated.Value(0)).current;

  // Which hourly card is selected (-1 = none)
  const [selHourIdx, setSelHourIdx] = useState(-1);
  // Which daily row is selected (-1 = none)
  const [selDayIdx,  setSelDayIdx]  = useState(-1);

  const hasSelection = selHourIdx >= 0 || selDayIdx >= 0;

  useEffect(() => {
    if (visible) {
      slideY.setValue(SCREEN_H);
      setSelHourIdx(-1);
      setSelDayIdx(-1);
      Animated.spring(slideY, {
        toValue: 0, damping: 24, stiffness: 200, useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Animate plan banner height in/out
  useEffect(() => {
    Animated.spring(bannerAnim, {
      toValue: hasSelection ? 1 : 0,
      damping: 22, stiffness: 260, useNativeDriver: false,
    }).start();
  }, [hasSelection]);

  const handleClose = () => {
    Animated.timing(slideY, {
      toValue: SCREEN_H, duration: 240, useNativeDriver: true,
    }).start(() => onClose());
  };

  const handleHourPress = (idx: number) => {
    setSelDayIdx(-1);
    setSelHourIdx(prev => prev === idx ? -1 : idx);
  };

  const handleDayPress = (idx: number) => {
    if (dailyToSlotId(idx) === null) return; // today row — not plannable here
    setSelHourIdx(-1);
    setSelDayIdx(prev => prev === idx ? -1 : idx);
  };

  const handlePlanPress = () => {
    let slotId: string | null = null;
    if (selHourIdx >= 0 && forecast) {
      slotId = hourToSlotId(forecast.hourly[selHourIdx]);
    } else if (selDayIdx >= 0) {
      slotId = dailyToSlotId(selDayIdx);
    }
    if (!slotId) return;
    Animated.timing(slideY, {
      toValue: SCREEN_H, duration: 200, useNativeDriver: true,
    }).start(() => {
      onClose();
      onPlanTime?.(slotId!);
    });
  };

  if (!forecast) return null;
  const { current, hourly, daily } = forecast;

  const bestHourScore = Math.max(...hourly.map(h => h.score), 0);

  // Derive banner display info from whichever selection is active
  const bannerEmoji = selHourIdx >= 0
    ? hourly[selHourIdx]?.emoji
    : selDayIdx >= 0
    ? daily[selDayIdx]?.emoji
    : '';
  const bannerLabel = selHourIdx >= 0
    ? (selHourIdx === 0 ? 'Now' : hourly[selHourIdx]?.hour)
    : selDayIdx >= 0
    ? daily[selDayIdx]?.day
    : '';
  const bannerScore = selHourIdx >= 0
    ? hourly[selHourIdx]?.score
    : selDayIdx >= 0
    ? daily[selDayIdx]?.score
    : 0;
  const bannerTemp = selHourIdx >= 0
    ? `${hourly[selHourIdx]?.temp}°C`
    : selDayIdx >= 0
    ? `${daily[selDayIdx]?.tempMax}°C high`
    : '';

  const bannerMaxHeight = bannerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 80],
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.backdrop} pointerEvents="box-only" />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[styles.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideY }] }]}
        >
          <View style={styles.handle} />

          <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={18} color={MUTED} />
          </TouchableOpacity>

          {/* ── Current conditions ── */}
          <View style={styles.currentWrap}>
            <View>
              <View style={styles.currentTop}>
                <Text style={styles.currentEmoji}>{current.emoji}</Text>
                <Text style={styles.currentTemp}>{current.temp}°C</Text>
              </View>
              <Text style={styles.currentCond}>{current.condition}</Text>
            </View>
            <View style={[styles.scoreBadge, { backgroundColor: scoreColor(current.score) }]}>
              <Text style={styles.scoreBadgeNum}>{current.score}</Text>
              <Text style={styles.scoreBadgeLabel}>/10</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Ionicons name="thermometer-outline" size={15} color={MUTED} />
              <Text style={styles.statVal}>Feels {current.feelsLike}°</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Ionicons name="water-outline" size={15} color={MUTED} />
              <Text style={styles.statVal}>{current.humidity}% humidity</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Ionicons name="partly-sunny-outline" size={15} color={MUTED} />
              <Text style={styles.statVal}>{current.windspeed} km/h</Text>
            </View>
          </View>

          <View style={styles.nudgeRow}>
            <Text style={styles.nudgeText}>
              {current.score >= 8
                ? 'Great conditions — perfect time to head outside.'
                : current.score >= 6
                ? 'Decent conditions — grab a layer and go.'
                : current.score >= 4
                ? 'Not ideal — warm spots still available on campus.'
                : 'Poor conditions — best to stay indoors today.'}
            </Text>
          </View>

          {/* ── Hourly strip ── */}
          <Text style={styles.sectionLabel}>TODAY — HOURLY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.hourlyScroll}
            contentContainerStyle={styles.hourlyContent}
            scrollEventThrottle={16}
          >
            {hourly.map((h, i) => {
              const isGood = bestHourScore >= 7 && h.score === bestHourScore;
              const isSel  = selHourIdx === i;
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.hourCol,
                    i === 0 && styles.hourColNow,
                    isGood && styles.hourColGood,
                    isSel  && styles.hourColSel,
                  ]}
                  onPress={() => handleHourPress(i)}
                  activeOpacity={0.7}
                >
                  <View style={styles.bestPillRow}>
                    {isGood && !isSel && (
                      <View style={styles.bestPill}>
                        <Text style={styles.bestPillText}>BEST</Text>
                      </View>
                    )}
                    {isSel && (
                      <View style={[styles.bestPill, styles.selPill]}>
                        <Text style={styles.bestPillText}>✓</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.hourLabel, (i === 0 || isGood || isSel) && styles.hourLabelBright]}>
                    {i === 0 ? 'Now' : h.hour}
                  </Text>
                  <Text style={styles.hourEmoji}>{h.emoji}</Text>
                  <Text style={styles.hourTemp}>{h.temp}°</Text>
                  <View style={styles.hourBarTrack}>
                    <View style={[styles.hourBarFill, { height: Math.round(h.score * 2.6), backgroundColor: scoreColor(h.score) }]} />
                  </View>
                  <Text style={[styles.hourScore, { color: scoreColor(h.score) }]}>{h.score}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── THIS WEEK — every row is tappable ── */}
          <Text style={styles.sectionLabel}>THIS WEEK</Text>
          <ScrollView
            style={styles.dailyScroll}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            <View style={styles.dailyCard}>
              {daily.map((d, i) => {
                const slotId  = dailyToSlotId(i);
                const tappable = slotId !== null;
                const isSel    = selDayIdx === i;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.dailyRow,
                      i < daily.length - 1 && styles.dailyRowBorder,
                      isSel && styles.dailyRowSel,
                    ]}
                    onPress={() => handleDayPress(i)}
                    activeOpacity={tappable ? 0.7 : 1}
                    disabled={!tappable}
                  >
                    <View style={styles.dailyLeft}>
                      <Text style={[styles.dailyDay, isSel && styles.dailyTextSel]}>{d.day}</Text>
                      <Text style={styles.dailyDate}>{d.date}</Text>
                    </View>
                    <View style={styles.dailyMid}>
                      <Text style={styles.dailyEmoji}>{d.emoji}</Text>
                      <Text style={styles.dailyCond} numberOfLines={1}>{d.condition}</Text>
                    </View>
                    <View style={styles.dailyRight}>
                      <Text style={[styles.dailyHigh, isSel && styles.dailyTextSel]}>{d.tempMax}°</Text>
                      <Text style={styles.dailyLow}>{d.tempMin}°</Text>
                      <View style={[styles.dailyScore, { backgroundColor: scoreColor(d.score) }]}>
                        <Text style={styles.dailyScoreText}>{d.score}</Text>
                      </View>
                      {tappable && (
                        <Ionicons
                          name="add-circle-outline"
                          size={18}
                          color={isSel ? WHITE : 'rgba(255,255,255,0.35)'}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* ── Unified plan banner — animates in when any time is selected ── */}
          <Animated.View style={[styles.planBanner, { maxHeight: bannerMaxHeight, overflow: 'hidden' }]}>
            <TouchableOpacity style={styles.planBannerInner} onPress={handlePlanPress} activeOpacity={0.85}>
              <View style={styles.planBannerLeft}>
                <Text style={styles.planBannerEmoji}>{bannerEmoji}</Text>
                <View>
                  <Text style={styles.planBannerTime}>{bannerLabel}</Text>
                  <Text style={styles.planBannerSub}>{bannerTemp} · score {bannerScore}/10</Text>
                </View>
              </View>
              <View style={styles.planBannerBtn}>
                <Text style={styles.planBannerBtnText}>Plan for this time</Text>
                <Ionicons name="arrow-forward" size={14} color={NAVY} />
              </View>
            </TouchableOpacity>
          </Animated.View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: NAVY,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: BORDER,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: SCREEN_H * 0.88,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 20, right: 20,
    width: 30, height: 30,
    borderRadius: 15,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Current conditions
  currentWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    marginTop: 4,
  },
  currentTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  currentEmoji: { fontSize: 40 },
  currentTemp: { fontSize: 52, fontWeight: Typography.weights.black, color: WHITE, letterSpacing: -2 },
  currentCond: { fontSize: Typography.sizes.md, color: MUTED, fontWeight: Typography.weights.medium, marginLeft: 48 },
  scoreBadge: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginTop: 8,
  },
  scoreBadgeNum: { fontSize: 22, fontWeight: Typography.weights.black, color: WHITE },
  scoreBadgeLabel: { fontSize: 12, fontWeight: Typography.weights.bold, color: 'rgba(255,255,255,0.75)' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: BORDER, marginVertical: 4 },
  statVal: { fontSize: Typography.sizes.xs, color: WHITE, fontWeight: Typography.weights.bold },

  nudgeRow: {
    backgroundColor: SURFACE,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  nudgeText: { fontSize: Typography.sizes.sm, color: 'rgba(255,255,255,0.8)', lineHeight: 20, fontWeight: Typography.weights.medium },

  // Hourly strip
  sectionLabel: {
    fontSize: 9,
    fontWeight: Typography.weights.black,
    letterSpacing: 2.5,
    color: MUTED,
    marginBottom: 12,
  },
  hourlyScroll: { marginBottom: 16 },
  hourlyContent: { gap: 6, paddingRight: 4 },
  hourCol: {
    alignItems: 'center',
    gap: 3,
    backgroundColor: CARD,
    borderRadius: 12,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: BORDER,
    minWidth: 62,
  },
  hourColNow: { borderColor: 'rgba(255,255,255,0.3)', backgroundColor: SURFACE },
  hourColGood: {
    backgroundColor: '#0A2850',
    borderColor: 'rgba(76,175,80,0.5)',
    borderWidth: 1.5,
  },
  hourColSel: {
    backgroundColor: '#0E3060',
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  bestPillRow: { height: 16, alignItems: 'center', justifyContent: 'center' },
  bestPill: { backgroundColor: '#4CAF50', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  selPill:  { backgroundColor: '#2D6A4F' },
  bestPillText: { fontSize: 7, fontWeight: Typography.weights.black, color: WHITE, letterSpacing: 0.5 },
  hourLabel:      { fontSize: 10, color: MUTED, fontWeight: Typography.weights.bold },
  hourLabelBright:{ color: WHITE },
  hourEmoji: { fontSize: 20 },
  hourTemp:  { fontSize: Typography.sizes.sm, color: WHITE, fontWeight: Typography.weights.black },
  hourBarTrack: {
    width: 18, height: 26,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  hourBarFill:  { width: '100%', borderRadius: 3 },
  hourScore: { fontSize: 9, fontWeight: Typography.weights.black },

  // Daily rows
  dailyScroll: { flexGrow: 0, maxHeight: SCREEN_H * 0.26 },
  dailyCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 8,
  },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  dailyRowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  dailyRowSel: { backgroundColor: 'rgba(76,175,80,0.12)' },
  dailyLeft: { width: 52 },
  dailyDay:  { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, color: WHITE },
  dailyDate: { fontSize: 10, color: MUTED, fontWeight: Typography.weights.medium },
  dailyTextSel: { color: '#4CAF50' },
  dailyMid:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dailyEmoji: { fontSize: 20 },
  dailyCond: { fontSize: 11, color: MUTED, fontWeight: Typography.weights.medium, flex: 1 },
  dailyRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dailyHigh: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, color: WHITE, width: 30, textAlign: 'right' },
  dailyLow:  { fontSize: Typography.sizes.sm, color: MUTED, fontWeight: Typography.weights.medium, width: 28, textAlign: 'right' },
  dailyScore: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dailyScoreText: { fontSize: 9, fontWeight: Typography.weights.black, color: WHITE },

  // Unified plan banner
  planBanner: { marginTop: 4 },
  planBannerInner: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  planBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planBannerEmoji: { fontSize: 26 },
  planBannerTime: { fontSize: Typography.sizes.md, fontWeight: Typography.weights.black, color: NAVY },
  planBannerSub:  { fontSize: 11, color: '#3D5A80', fontWeight: Typography.weights.medium, marginTop: 1 },
  planBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    flexShrink: 0,
  },
  planBannerBtnText: { fontSize: 12, fontWeight: Typography.weights.black, color: NAVY },
});
