import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, TouchableWithoutFeedback, Animated, Linking, Modal, Dimensions, RefreshControl,
} from 'react-native';
import { CreatePlanModal } from './plans';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../../constants/theme';

const IMPERIAL = '#003087';
const GREEN    = '#2D6A4F';
import { isDark, subscribe as subscribeTheme } from '../../lib/themeStore';

const { width: SCREEN_W } = Dimensions.get('window');
const MAP_W = SCREEN_W - 40;
const MAP_H = 260;
const MAP_BG_LIGHT = '#CDD0D9';
const MAP_BG_DARK  = '#050D1A';
const BUILDING_LIGHT = '#8A95A8';
const BUILDING_DARK  = '#1A3560';

// ─── Data ─────────────────────────────────────────────────────────────────────
interface Building {
  id: string;
  label: string;
  type: 'INDOOR' | 'OUTDOOR';
  busyness: number;
  weather: string;
  friends: number;
  rotateText?: boolean;
  top: string | number;
  left?: string | number;
  right?: string | number;
  width: string | number;
  height: number;
}

const BUILDINGS: Building[] = [
  {
    id: 'queens-tower-room',
    label: 'Queens Tower Room',
    type: 'INDOOR', busyness: 0.55, weather: '— Indoor', friends: 0,
    top: '4%', left: '3%', width: '56%', height: 55,
  },
  {
    id: 'cagb',
    label: 'CAGB',
    type: 'INDOOR', busyness: 0.72, weather: '— Indoor', friends: 0,
    top: '4%', right: '2%', width: '14%', height: 130,
    rotateText: true,
  },
  {
    id: 'library',
    label: 'Library',
    type: 'INDOOR', busyness: 0.45, weather: '— Indoor', friends: 0,
    top: '34%', left: '3%', width: '13%', height: 95,
    rotateText: true,
  },
  {
    id: 'jcr',
    label: 'JCR',
    type: 'INDOOR', busyness: 0.30, weather: '— Indoor', friends: 0,
    top: '34%', left: '19%', width: '40%', height: 55,
  },
  {
    id: 'queens-lawn',
    label: "Queen's Lawn",
    type: 'OUTDOOR', busyness: 0.25, weather: '☀️ 19°C — Partly cloudy', friends: 0,
    top: '60%', left: '19%', width: '40%', height: 65,
  },
  {
    id: 'dyson',
    label: 'Dyson',
    type: 'INDOOR', busyness: 0.25, weather: '— Indoor', friends: 0,
    top: '65%', right: '2%', width: '35%', height: 55,
  },
  {
    id: 'union',
    label: 'Union Bar',
    type: 'INDOOR', busyness: 0.65, weather: '— Indoor', friends: 3,
    top: '73%', left: '3%', width: '13%', height: 50,
    rotateText: true,
  },
];

const EVENTS = [
  { id: 'e1', title: 'IC Hackathon 2026',        location: 'Great Hall',       date: 'Sat 24 May', going: 200, url: 'https://www.imperialcollegeunion.org' },
  { id: 'e2', title: 'Summer Union Party',         location: 'Metric',           date: 'Fri 23 May', going: 350, url: 'https://www.imperialcollegeunion.org' },
  { id: 'e3', title: 'Startup Pitch Night',        location: 'Business School',  date: 'Thu 22 May', going: 80,  url: 'https://www.imperialcollegeunion.org' },
  { id: 'e4', title: 'Campus Photography Walk',    location: 'Meet at Beit',     date: 'Sun 25 May', going: 24,  url: 'https://www.imperialcollegeunion.org' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function busynessColor(b: number) {
  if (b < 0.4) return Colors.green;
  if (b < 0.7) return Colors.orange;
  return Colors.red;
}

function busynessLabel(b: number) {
  if (b < 0.4) return 'Quiet';
  if (b < 0.7) return 'Moderate';
  return 'Busy';
}

// ─── Pulsing Live indicator ───────────────────────────────────────────────────
function LiveIndicator() {
  const pulseOpacity = useRef(new Animated.Value(0.7)).current;
  const pulseScale   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 2.0, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={styles.liveWrap}>
      <View style={styles.liveDotWrap}>
        <Animated.View style={[styles.livePulse, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
        <View style={styles.liveDotCore} />
      </View>
      <Text style={styles.liveText}>Live</Text>
    </View>
  );
}

// ─── Building block ───────────────────────────────────────────────────────────
function BuildingBlock({
  building, highlighted, onPress, dark,
}: {
  building: Building;
  highlighted: boolean;
  onPress: () => void;
  dark: boolean;
}) {
  const clr = busynessColor(building.busyness);
  const lbl = busynessLabel(building.busyness);

  const pos: Record<string, any> = {
    position: 'absolute',
    top: building.top,
    width: building.width,
    height: building.height,
  };
  if (building.left  !== undefined) pos.left  = building.left;
  if (building.right !== undefined) pos.right = building.right;

  const buildingStyle = dark
    ? { backgroundColor: BUILDING_DARK, borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1.5, shadowOpacity: 0.5 }
    : { backgroundColor: BUILDING_LIGHT, borderColor: 'rgba(0,0,0,0.12)', borderWidth: 1, shadowOpacity: 0.1 };

  const labelColor = dark ? '#FFFFFF' : IMPERIAL;
  const barTrackBg = dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,18,51,0.15)';

  return (
    <TouchableOpacity
      style={[pos, styles.building, buildingStyle, { opacity: highlighted ? 1 : 0.35 }]}
      onPress={onPress}
      activeOpacity={0.72}
    >
      {building.rotateText ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', width: '100%' }}>
          <Text
            style={[styles.buildingLabel, { color: labelColor, transform: [{ rotate: '-90deg' }], width: building.height - 12 }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {building.label}
          </Text>
          <View style={[styles.busyStrip, { backgroundColor: clr }]} />
        </View>
      ) : (
        <View style={styles.blockInner}>
          <Text style={[styles.buildingLabel, { color: labelColor }]} numberOfLines={1} adjustsFontSizeToFit>
            {building.label}
          </Text>
          <View style={styles.blockBusy}>
            <View style={[styles.blockBarBg, { backgroundColor: barTrackBg }]}>
              <View style={[styles.blockBarFill, {
                width: `${Math.round(building.busyness * 100)}%` as any,
                backgroundColor: clr,
              }]} />
            </View>
            <Text style={[styles.blockBusyLbl, { color: clr }]}>{lbl}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Campus map ───────────────────────────────────────────────────────────────
function CampusMap({
  filter, onSelect, dark,
}: {
  filter: 'Outdoor' | 'Indoor';
  onSelect: (b: Building) => void;
  dark: boolean;
}) {
  const mapStyle = dark
    ? { backgroundColor: MAP_BG_DARK, borderColor: 'rgba(255,255,255,0.15)', borderWidth: 2 }
    : { backgroundColor: MAP_BG_LIGHT, borderColor: IMPERIAL, borderWidth: 2 };

  return (
    <View style={[styles.mapContainer, mapStyle]}>
      {BUILDINGS.map(b => (
        <BuildingBlock
          key={b.id}
          building={b}
          highlighted={filter === 'Outdoor' ? b.type === 'OUTDOOR' : b.type === 'INDOOR'}
          onPress={() => onSelect(b)}
          dark={dark}
        />
      ))}
    </View>
  );
}

// ─── Building bottom sheet content ───────────────────────────────────────────
function BuildingSheet({
  building, onClose, hereSet, onToggleHere, onPlanHere, dark,
}: {
  building: Building;
  onClose: () => void;
  hereSet: Set<string>;
  onToggleHere: (id: string) => void;
  onPlanHere: () => void;
  dark: boolean;
}) {
  const barColor = busynessColor(building.busyness);
  const label    = busynessLabel(building.busyness);
  const isHere   = hereSet.has(building.id);

  const nameColor      = dark ? '#FFFFFF'                  : Colors.navy;
  const tagColor       = dark ? 'rgba(255,255,255,0.5)'   : Colors.gray500;
  const closeBtnBg     = dark ? 'rgba(255,255,255,0.1)'   : Colors.gray100;
  const closeIconColor = dark ? 'rgba(255,255,255,0.7)'   : Colors.navy;
  const labelColor     = dark ? 'rgba(255,255,255,0.45)'  : Colors.gray500;
  const barTrack       = dark ? 'rgba(255,255,255,0.1)'   : Colors.gray100;
  const weatherColor   = dark ? 'rgba(255,255,255,0.85)'  : Colors.navy;
  const friendColor    = dark ? 'rgba(255,255,255,0.5)'   : Colors.gray500;
  const friendIcon     = dark ? 'rgba(255,255,255,0.45)'  : Colors.gray500;
  const handleColor    = dark ? 'rgba(255,255,255,0.2)'   : Colors.gray300;

  const hereBorderColor  = dark ? 'rgba(255,255,255,0.3)' : Colors.navy;
  const hereTextColor    = dark ? 'rgba(255,255,255,0.7)' : Colors.navy;
  const hereBtnActiveBg  = dark ? 'rgba(255,255,255,0.15)': Colors.navy;
  const hereBtnActiveBdr = dark ? 'rgba(255,255,255,0.5)' : Colors.navy;

  return (
    <View style={styles.sheetInner}>
      <View style={[styles.sheetDragHandle, { backgroundColor: handleColor }]} />

      {/* Header */}
      <View style={styles.sheetHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sheetName, { color: nameColor }]}>{building.label}</Text>
          <Text style={[styles.sheetTypeTag, { color: tagColor }]}>{building.type}</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={[styles.sheetCloseBtn, { backgroundColor: closeBtnBg }]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={18} color={closeIconColor} />
        </TouchableOpacity>
      </View>

      {/* Busyness */}
      <Text style={[styles.sheetLabel, { color: labelColor }]}>BUSYNESS</Text>
      <View style={styles.sheetBarRow}>
        <View style={[styles.sheetBarTrack, { backgroundColor: barTrack }]}>
          <View
            style={[
              styles.sheetBarFill,
              { width: `${Math.round(building.busyness * 100)}%` as any, backgroundColor: barColor },
            ]}
          />
        </View>
        <Text style={[styles.sheetBusynessPct, { color: barColor }]}>
          {Math.round(building.busyness * 100)}%
        </Text>
      </View>
      <Text style={[styles.sheetBusynessWord, { color: barColor }]}>{label}</Text>

      {/* Conditions */}
      <Text style={[styles.sheetLabel, { color: labelColor, marginTop: 16 }]}>CONDITIONS</Text>
      <Text style={[styles.sheetWeather, { color: weatherColor }]}>{building.weather}</Text>

      {/* Friends */}
      <View style={styles.sheetFriendRow}>
        <Ionicons name="people-outline" size={15} color={friendIcon} />
        <Text style={[styles.sheetFriendText, { color: friendColor }]}>
          {building.friends === 0
            ? 'No friends here right now'
            : `${building.friends} friend${building.friends !== 1 ? 's' : ''} here`}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.sheetBtnRow}>
        <TouchableOpacity
          style={[styles.hereBtn, { borderColor: hereBorderColor }, isHere && { backgroundColor: hereBtnActiveBg, borderColor: hereBtnActiveBdr }, { flex: 1 }]}
          onPress={() => onToggleHere(building.id)}
          activeOpacity={0.85}
        >
          <Text style={[styles.hereBtnText, { color: isHere ? '#FFFFFF' : hereTextColor }]}>
            {isHere ? "✓ I'M HERE" : "I'M HERE"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.planHereBtn}
          onPress={onPlanHere}
          activeOpacity={0.85}
        >
          <Ionicons name="calendar-outline" size={16} color="#FFFFFF" />
          <Text style={styles.planHereBtnText}>PLAN HERE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Event card ───────────────────────────────────────────────────────────────
function EventCard({ event, dark }: { event: typeof EVENTS[0]; dark: boolean }) {
  const cardBg    = dark ? '#002060'                 : Colors.white;
  const titleClr  = dark ? '#FFFFFF'                 : Colors.navy;
  const metaClr   = dark ? 'rgba(255,255,255,0.5)'  : Colors.gray500;
  const goingClr  = dark ? 'rgba(255,255,255,0.5)'  : Colors.gray500;

  return (
    <View style={[styles.eventCard, { backgroundColor: cardBg }]}>
      <Text style={[styles.eventTitle, { color: titleClr }]}>{event.title}</Text>
      <Text style={[styles.eventMeta, { color: metaClr }]}>{event.location}  ·  {event.date}</Text>
      <View style={styles.eventFooter}>
        <Text style={[styles.eventGoing, { color: goingClr }]}>{event.going} going</Text>
        <TouchableOpacity
          style={styles.webBtn}
          onPress={() => Linking.openURL(event.url)}
          activeOpacity={0.85}
        >
          <Text style={styles.webBtnText}>OPEN ON WEB</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Discover screen ──────────────────────────────────────────────────────────
export default function DiscoverScreen({ onModalChange }: { onModalChange?: (open: boolean) => void }) {
  const [dark, setDarkMode] = useState(isDark());
  useEffect(() => subscribeTheme(() => setDarkMode(isDark())), []);

  const bg              = dark ? '#001233'                : Colors.lightGrey;
  const greetingClr     = dark ? 'rgba(255,255,255,0.5)' : Colors.gray500;
  const appNameClr      = dark ? '#FFFFFF'                : IMPERIAL;
  const hintClr         = dark ? 'rgba(255,255,255,0.45)': Colors.gray500;
  const searchBg        = dark ? '#002060'                : '#E0E2E9';
  const searchTextClr   = dark ? '#FFFFFF'                : Colors.navy;
  const searchPlaceholdr = dark ? 'rgba(255,255,255,0.35)': Colors.gray500;
  const searchIconClr   = dark ? 'rgba(255,255,255,0.4)' : Colors.gray500;
  const sheetBg         = dark ? '#001845'                : '#FFFFFF';

  const [filter,  setFilter]  = useState<'Outdoor' | 'Indoor'>('Outdoor');
  const [search,  setSearch]  = useState('');
  const [hereSet, setHereSet] = useState<Set<string>>(new Set());

  const [activeBuilding, setActiveBuilding] = useState<Building | null>(null);
  const [sheetOpen,      setSheetOpen]      = useState(false);
  const sheetY = useRef(new Animated.Value(600)).current;

  const [planModalOpen,  setPlanModalOpen]  = useState(false);
  const [planLocation,   setPlanLocation]   = useState('');

  const openSheet = (b: Building) => {
    setActiveBuilding(b);
    setSheetOpen(true);
    onModalChange?.(true);
    sheetY.setValue(600);
    Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
  };

  const closeSheet = () => {
    Animated.spring(sheetY, { toValue: 600, useNativeDriver: true, damping: 22, stiffness: 200 }).start(() => {
      setSheetOpen(false);
      setActiveBuilding(null);
      onModalChange?.(false);
    });
  };

  const handlePlanHere = () => {
    const loc = activeBuilding?.label ?? '';
    Animated.spring(sheetY, { toValue: 600, useNativeDriver: true, damping: 22, stiffness: 200 }).start(() => {
      setSheetOpen(false);
      setActiveBuilding(null);
      setPlanLocation(loc);
      setPlanModalOpen(true);
      // onModalChange stays true — plan modal opens immediately after
    });
  };

  const toggleHere = (id: string) => {
    setHereSet(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredEvents = EVENTS.filter(e => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q);
  });

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setHereSet(new Set());
    await new Promise<void>(r => setTimeout(r, 700));
    setRefreshing(false);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={dark ? '#FFFFFF' : IMPERIAL}
              colors={[IMPERIAL]}
            />
          }
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: greetingClr }]}>What's going on at</Text>
              <Text style={[styles.appName, { color: appNameClr }]}>IMPERIAL</Text>
            </View>
            <LiveIndicator />
          </View>

          {/* ── Outdoor / Indoor toggle ── */}
          <View style={styles.toggleRow}>
            {(['Outdoor', 'Indoor'] as const).map(opt => (
              <TouchableOpacity
                key={opt}
                style={[styles.toggleOpt, filter === opt && styles.toggleOptActive]}
                onPress={() => setFilter(opt)}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleOptTxt, filter === opt && styles.toggleOptTxtActive]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Hint ── */}
          <Text style={[styles.tapHint, { color: hintClr }]}>Tap location to see what's on</Text>

          {/* ── Map ── */}
          <CampusMap filter={filter} onSelect={openSheet} dark={dark} />

          {/* ── Search ── */}
          <View style={[styles.searchBar, { backgroundColor: searchBg }]}>
            <Ionicons name="search-outline" size={17} color={searchIconClr} />
            <TextInput
              style={[styles.searchInput, { color: searchTextClr }]}
              placeholder="ACC, Union party, Hackathon..."
              placeholderTextColor={searchPlaceholdr}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={17} color={searchIconClr} />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Events ── */}
          {filteredEvents.map(e => <EventCard key={e.id} event={e} dark={dark} />)}

          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>

      {/* ── Bottom sheet ── */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
      >
        <View style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={closeSheet}>
            <View style={styles.sheetBackdrop} pointerEvents="box-only" />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback onPress={() => {}}>
          <Animated.View style={[styles.sheet, { backgroundColor: sheetBg, transform: [{ translateY: sheetY }] }]}>
            {activeBuilding !== null && (
              <BuildingSheet
                building={activeBuilding}
                onClose={closeSheet}
                hereSet={hereSet}
                onToggleHere={toggleHere}
                onPlanHere={handlePlanHere}
                dark={dark}
              />
            )}
          </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </Modal>

      {/* Plan modal */}
      <CreatePlanModal
        visible={planModalOpen}
        onClose={() => { setPlanModalOpen(false); onModalChange?.(false); }}
        initialValues={{ location: planLocation }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  greeting: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    marginBottom: 2,
  },
  appName: {
    fontSize: 30,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
  },

  // Live indicator
  liveWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingTop: 6,
  },
  liveDotWrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePulse: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.green,
  },
  liveDotCore: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.green,
  },
  liveText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.green,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#1C2540',
    borderRadius: 50,
    padding: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  toggleOpt: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 46,
  },
  toggleOptActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  toggleOptTxt: {
    fontSize: 15,
    fontWeight: Typography.weights.bold,
    color: 'rgba(255,255,255,0.45)',
  },
  toggleOptTxtActive: {
    color: '#FFFFFF',
  },

  // Hint
  tapHint: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.regular,
    marginBottom: 12,
  },

  // Building block busyness overlay
  blockInner: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 5,
    paddingVertical: 4,
    justifyContent: 'space-between',
  },
  blockBusy: { gap: 2 },
  blockBarBg: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  blockBarFill: { height: '100%', borderRadius: 2 },
  blockBusyLbl: {
    fontSize: 7,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.2,
  },
  busyStrip: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },

  // Map
  mapContainer: {
    width: MAP_W,
    height: MAP_H,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  building: {
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  buildingLabel: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    textAlign: 'center',
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.regular,
    padding: 0,
  },

  // Event cards
  eventCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  eventTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    marginBottom: 4,
  },
  eventMeta: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.regular,
    marginBottom: 12,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventGoing: {
    fontSize: 12,
    fontWeight: Typography.weights.medium,
  },
  webBtn: {
    backgroundColor: IMPERIAL,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  webBtnText: {
    fontSize: 11,
    fontWeight: Typography.weights.black,
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },

  // Bottom sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 24,
  },
  sheetInner: {
    padding: 20,
    paddingBottom: 36,
  },
  sheetDragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  sheetName: {
    fontSize: 22,
    fontWeight: Typography.weights.black,
    letterSpacing: -0.5,
  },
  sheetTypeTag: {
    fontSize: 11,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 1.5,
    marginTop: 3,
  },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    flexShrink: 0,
  },
  sheetLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
    marginBottom: 8,
  },
  sheetBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 5,
  },
  sheetBarTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  sheetBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  sheetBusynessPct: {
    fontSize: 13,
    fontWeight: Typography.weights.black,
    width: 36,
    textAlign: 'right',
  },
  sheetBusynessWord: {
    fontSize: 13,
    fontWeight: Typography.weights.bold,
    marginBottom: 4,
  },
  sheetWeather: {
    fontSize: 13,
    fontWeight: Typography.weights.medium,
    marginBottom: 14,
  },
  sheetFriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  sheetFriendText: {
    fontSize: 13,
    fontWeight: Typography.weights.medium,
  },
  sheetBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  hereBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  hereBtnText: {
    fontSize: 13,
    fontWeight: Typography.weights.black,
    letterSpacing: 1.5,
  },
  planHereBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: IMPERIAL,
    borderRadius: 10,
    paddingVertical: 14,
  },
  planHereBtnText: {
    fontSize: 13,
    fontWeight: Typography.weights.black,
    letterSpacing: 1.5,
    color: '#FFFFFF',
  },
});
