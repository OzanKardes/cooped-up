import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, Linking, Modal, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const MAP_W = SCREEN_W - 40;
const MAP_H = 260;
const IMPERIAL = '#003087';
const MAP_BG = '#CDD0D9';
const BUILDING_CLR = '#8A95A8';
const GREEN = '#2D6A4F';

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
    label: 'Queens Lawn',
    type: 'OUTDOOR', busyness: 0.50, weather: '☀️ 19°C — Partly cloudy', friends: 0,
    top: '60%', left: '19%', width: '40%', height: 65,
  },
  {
    id: 'dyson',
    label: 'Dyson',
    type: 'INDOOR', busyness: 0.25, weather: '— Indoor', friends: 0,
    top: '65%', right: '2%', width: '35%', height: 55,
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
  if (b < 0.4) return GREEN;
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
  building, highlighted, onPress,
}: {
  building: Building;
  highlighted: boolean;
  onPress: () => void;
}) {
  const pos: Record<string, any> = {
    position: 'absolute',
    top: building.top,
    width: building.width,
    height: building.height,
  };
  if (building.left  !== undefined) pos.left  = building.left;
  if (building.right !== undefined) pos.right = building.right;

  return (
    <TouchableOpacity
      style={[pos, styles.building, { opacity: highlighted ? 1 : 0.35 }]}
      onPress={onPress}
      activeOpacity={0.72}
    >
      {building.rotateText ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
          <Text
            style={[styles.buildingLabel, { transform: [{ rotate: '-90deg' }], width: building.height - 12 }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {building.label}
          </Text>
        </View>
      ) : (
        <Text style={styles.buildingLabel} numberOfLines={2} adjustsFontSizeToFit>
          {building.label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Campus map ───────────────────────────────────────────────────────────────
function CampusMap({
  filter,
  onSelect,
}: {
  filter: 'Outdoor' | 'Indoor';
  onSelect: (b: Building) => void;
}) {
  return (
    <View style={styles.mapContainer}>
      {BUILDINGS.map(b => (
        <BuildingBlock
          key={b.id}
          building={b}
          highlighted={filter === 'Outdoor' ? b.type === 'OUTDOOR' : b.type === 'INDOOR'}
          onPress={() => onSelect(b)}
        />
      ))}
    </View>
  );
}

// ─── Building bottom sheet content ───────────────────────────────────────────
function BuildingSheet({
  building, onClose, hereSet, onToggleHere,
}: {
  building: Building;
  onClose: () => void;
  hereSet: Set<string>;
  onToggleHere: (id: string) => void;
}) {
  const barColor = busynessColor(building.busyness);
  const label    = busynessLabel(building.busyness);
  const isHere   = hereSet.has(building.id);

  return (
    <View style={styles.sheetInner}>
      <View style={styles.sheetDragHandle} />

      {/* Header */}
      <View style={styles.sheetHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetName}>{building.label}</Text>
          <Text style={styles.sheetTypeTag}>{building.type}</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.sheetCloseBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={18} color={Colors.navy} />
        </TouchableOpacity>
      </View>

      {/* Busyness */}
      <Text style={styles.sheetLabel}>BUSYNESS</Text>
      <View style={styles.sheetBarRow}>
        <View style={styles.sheetBarTrack}>
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
      <Text style={[styles.sheetLabel, { marginTop: 16 }]}>CONDITIONS</Text>
      <Text style={styles.sheetWeather}>{building.weather}</Text>

      {/* Friends */}
      <View style={styles.sheetFriendRow}>
        <Ionicons name="people-outline" size={15} color={Colors.gray500} />
        <Text style={styles.sheetFriendText}>
          {building.friends === 0
            ? 'No friends here right now'
            : `${building.friends} friend${building.friends !== 1 ? 's' : ''} here`}
        </Text>
      </View>

      {/* I'm Here */}
      <TouchableOpacity
        style={[styles.hereBtn, isHere && styles.hereBtnActive]}
        onPress={() => onToggleHere(building.id)}
        activeOpacity={0.85}
      >
        <Text style={[styles.hereBtnText, isHere && styles.hereBtnTextActive]}>
          {isHere ? "✓ I'M HERE" : "I'M HERE"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Event card ───────────────────────────────────────────────────────────────
function EventCard({ event }: { event: typeof EVENTS[0] }) {
  return (
    <View style={styles.eventCard}>
      <Text style={styles.eventTitle}>{event.title}</Text>
      <Text style={styles.eventMeta}>{event.location}  ·  {event.date}</Text>
      <View style={styles.eventFooter}>
        <Text style={styles.eventGoing}>{event.going} going</Text>
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
export default function DiscoverScreen() {
  const [filter,  setFilter]  = useState<'Outdoor' | 'Indoor'>('Outdoor');
  const [search,  setSearch]  = useState('');
  const [hereSet, setHereSet] = useState<Set<string>>(new Set());

  const [activeBuilding, setActiveBuilding] = useState<Building | null>(null);
  const [sheetOpen,      setSheetOpen]      = useState(false);
  const sheetY = useRef(new Animated.Value(600)).current;

  const openSheet = (b: Building) => {
    setActiveBuilding(b);
    setSheetOpen(true);
    sheetY.setValue(600);
    Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
  };

  const closeSheet = () => {
    Animated.spring(sheetY, { toValue: 600, useNativeDriver: true, damping: 22, stiffness: 200 }).start(() => {
      setSheetOpen(false);
      setActiveBuilding(null);
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

  return (
    <View style={{ flex: 1, backgroundColor: Colors.lightGrey }}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Good Morning</Text>
              <Text style={styles.appName}>IMPERIAL</Text>
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
          <Text style={styles.tapHint}>Tap location to see what's on</Text>

          {/* ── Map ── */}
          <CampusMap filter={filter} onSelect={openSheet} />

          {/* ── Search ── */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={17} color={Colors.gray500} />
            <TextInput
              style={styles.searchInput}
              placeholder="ACC, Union party, Hackathon..."
              placeholderTextColor={Colors.gray500}
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
                <Ionicons name="close-circle" size={17} color={Colors.gray300} />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Events ── */}
          {filteredEvents.map(e => <EventCard key={e.id} event={e} />)}

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
          <TouchableOpacity
            style={styles.sheetBackdrop}
            onPress={closeSheet}
            activeOpacity={1}
          />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
            {activeBuilding !== null && (
              <BuildingSheet
                building={activeBuilding}
                onClose={closeSheet}
                hereSet={hereSet}
                onToggleHere={toggleHere}
              />
            )}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.lightGrey },
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
    color: Colors.gray500,
    marginBottom: 2,
  },
  appName: {
    fontSize: 30,
    fontWeight: Typography.weights.black,
    color: IMPERIAL,
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
    backgroundColor: GREEN,
  },
  liveDotCore: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: GREEN,
  },
  liveText: {
    fontSize: 16,
    fontWeight: Typography.weights.bold,
    color: GREEN,
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
    color: Colors.gray500,
    fontWeight: Typography.weights.regular,
    marginBottom: 12,
  },

  // Map
  mapContainer: {
    width: MAP_W,
    height: MAP_H,
    borderWidth: 3,
    borderColor: IMPERIAL,
    borderRadius: 14,
    backgroundColor: MAP_BG,
    overflow: 'hidden',
    marginBottom: 16,
  },
  building: {
    backgroundColor: BUILDING_CLR,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  buildingLabel: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: IMPERIAL,
    textAlign: 'center',
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E2E9',
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.md,
    color: Colors.navy,
    fontWeight: Typography.weights.regular,
    padding: 0,
  },

  // Event cards
  eventCard: {
    backgroundColor: '#D8DBE4',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 1,
  },
  eventTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: IMPERIAL,
    marginBottom: 4,
  },
  eventMeta: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray500,
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
    color: Colors.gray500,
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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
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
    backgroundColor: Colors.gray300,
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
    color: IMPERIAL,
    letterSpacing: -0.5,
  },
  sheetTypeTag: {
    fontSize: 11,
    fontWeight: Typography.weights.semibold,
    color: Colors.gray500,
    letterSpacing: 1.5,
    marginTop: 3,
  },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    flexShrink: 0,
  },
  sheetLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
    color: Colors.gray500,
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
    backgroundColor: Colors.gray100,
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
    fontSize: 14,
    fontWeight: Typography.weights.bold,
    marginBottom: 4,
  },
  sheetWeather: {
    fontSize: 14,
    color: Colors.navy,
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
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
  },
  hereBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: IMPERIAL,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  hereBtnActive: {
    backgroundColor: IMPERIAL,
    borderColor: IMPERIAL,
  },
  hereBtnText: {
    fontSize: 14,
    fontWeight: Typography.weights.black,
    letterSpacing: 1.5,
    color: IMPERIAL,
  },
  hereBtnTextActive: {
    color: '#FFFFFF',
  },
});
