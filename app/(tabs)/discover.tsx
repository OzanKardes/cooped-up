import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Circle, Text as SvgText } from 'react-native-svg';
import { Colors, Typography, Borders, Shadows } from '../../constants/theme';
import { CreatePlanModal } from './plans';
import { showToast } from '../../components/Toast';

const { width } = Dimensions.get('window');
const MAP_W = width - 40;

// ─── Hardcoded data ───────────────────────────────────────────────────────────
const SPACES = [
  {
    id: '1', name: "Queen's Lawn", type: 'OUTDOOR', status: 'BUSY',
    capacity: 0.75, weather: '⛅ 18°C — Partly Cloudy',
    desc: '20+ students out. Frisbee, revision, good energy.',
    bg: Colors.bluePale,
    mx: 15, my: 15, mw: 112, mh: 87,
  },
  {
    id: '2', name: 'Beit Quad', type: 'OUTDOOR', status: 'QUIET',
    capacity: 0.30, weather: '⛅ 18°C — Good for outdoors',
    desc: 'A handful of people. Good for a quiet sit-down.',
    bg: Colors.cream,
    mx: 137, my: 10, mw: 78, mh: 68,
  },
  {
    id: '3', name: 'SAF Terrace', type: 'OUTDOOR', status: 'EMPTY',
    capacity: 0.10, weather: '⛅ 18°C — Great views',
    desc: 'Nearly empty. Hidden gem with great views today.',
    bg: Colors.accent,
    mx: 137, my: 88, mw: 52, mh: 45,
  },
  {
    id: '4', name: 'Sherfield Library', type: 'INDOOR', status: 'BUSY',
    capacity: 0.85, weather: '— Indoor',
    desc: 'Very busy. Most seats taken on all floors.',
    bg: Colors.gray100,
    mx: 15, my: 112, mw: 92, mh: 48,
  },
  {
    id: '5', name: 'JCR Bar', type: 'INDOOR', status: 'QUIET',
    capacity: 0.40, weather: '— Indoor',
    desc: 'Relaxed atmosphere. Good for a coffee and chat.',
    bg: Colors.white,
    mx: 117, my: 122, mw: 58, mh: 38,
  },
  {
    id: '6', name: 'Skempton Building', type: 'INDOOR', status: 'QUIET',
    capacity: 0.35, weather: '— Indoor',
    desc: 'Study spaces available on most floors. Fairly quiet.',
    bg: Colors.gray100,
    mx: 216, my: 88, mw: 54, mh: 66,
  },
];

const PUBLIC_EVENTS = [
  {
    id: 'e1',
    title: 'Outdoor Yoga',
    location: "Queen's Lawn",
    time: 'Today, 1pm',
    weather: '☀️ 20°C',
    spots: 15,
    host: 'ICL Wellness',
  },
  {
    id: 'e2',
    title: 'Street Food Festival',
    location: 'Beit Quad',
    time: 'Today, 12pm',
    weather: '⛅ 18°C',
    spots: 50,
    host: 'Imperial Union',
  },
  {
    id: 'e3',
    title: 'Photography Walk',
    location: 'South Kensington',
    time: 'Today, 3pm',
    weather: '🌤 19°C',
    spots: 12,
    host: 'ICL Photo Soc',
  },
  {
    id: 'e4',
    title: 'Live Acoustic Set',
    location: 'JCR Bar',
    time: 'Today, 6pm',
    weather: '— Indoor',
    spots: 30,
    host: 'ICL Music',
  },
];

const MAP_LABELS: Record<string, string> = {
  '1': "Q'S LAWN", '2': 'BEIT', '3': 'SAF',
  '4': 'LIBRARY', '5': 'JCR', '6': 'SKEMP.',
};

function statusDotColor(status: string) {
  switch (status) {
    case 'BUSY':  return Colors.orange;
    case 'QUIET': return Colors.blueLight;
    case 'EMPTY': return Colors.green;
    default:      return Colors.gray300;
  }
}

function statusCardColors(status: string) {
  switch (status) {
    case 'BUSY':  return { bg: Colors.orangeLight, text: Colors.orange };
    case 'QUIET': return { bg: Colors.bluePale,    text: Colors.blue };
    case 'EMPTY': return { bg: Colors.greenLight,  text: Colors.green };
    default:      return { bg: Colors.gray100,     text: Colors.gray500 };
  }
}

// ─── Campus map ───────────────────────────────────────────────────────────────
function CampusMap({
  spaces, selectedId, onSelect,
}: {
  spaces: typeof SPACES; selectedId: string | null; onSelect: (id: string) => void;
}) {
  return (
    <View style={[styles.mapContainer, Shadows.md]}>
      <View style={styles.mapHeader}>
        <Text style={styles.mapHeaderText}>IMPERIAL COLLEGE — SOUTH KENSINGTON</Text>
        <Text style={styles.mapHeaderSub}>Schematic · Tap a space</Text>
      </View>
      <Svg width={MAP_W} height={170} viewBox="0 0 280 165">
        <Rect x={0} y={0} width={280} height={165} fill={Colors.cream} />
        {spaces.map(s => {
          const isSelected = s.id === selectedId;
          const dotColor = statusDotColor(s.status);
          return (
            <React.Fragment key={s.id}>
              <Rect
                x={s.mx} y={s.my} width={s.mw} height={s.mh}
                fill={s.bg}
                stroke={isSelected ? Colors.navy : Colors.black}
                strokeWidth={isSelected ? 3 : 1.5}
                onPress={() => onSelect(s.id)}
              />
              <Circle
                cx={s.mx + s.mw - 9} cy={s.my + 9}
                r={5} fill={dotColor}
                stroke={Colors.black} strokeWidth={1}
              />
              <SvgText
                x={s.mx + s.mw / 2} y={s.my + s.mh / 2 + 3}
                textAnchor="middle"
                fontSize={7}
                fontWeight="bold"
                fill={Colors.navy}
              >
                {MAP_LABELS[s.id]}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={styles.mapLegend}>
        {[
          { label: 'Busy',  color: Colors.orange },
          { label: 'Quiet', color: Colors.blueLight },
          { label: 'Empty', color: Colors.green },
        ].map(l => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={styles.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Capacity bar ─────────────────────────────────────────────────────────────
function CapacityBar({ ratio }: { ratio: number }) {
  const fillColor = ratio > 0.7 ? Colors.orange : ratio > 0.4 ? Colors.blueLight : Colors.green;
  return (
    <View style={styles.capacityTrack}>
      <View style={[
        styles.capacityFill,
        { width: `${Math.round(ratio * 100)}%` as any, backgroundColor: fillColor },
      ]} />
    </View>
  );
}

// ─── Space card ───────────────────────────────────────────────────────────────
function SpaceCard({
  space, selected, onPress, hereSet, onHereToggle, onPlanHere,
}: {
  space: typeof SPACES[0];
  selected: boolean;
  onPress: () => void;
  hereSet: Set<string>;
  onHereToggle: (id: string) => void;
  onPlanHere: () => void;
}) {
  const sc = statusCardColors(space.status);
  const isHere = hereSet.has(space.id);
  return (
    <TouchableOpacity
      style={[styles.spaceCard, { backgroundColor: space.bg }, selected && styles.spaceCardSelected]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.spaceCardTop}>
        <Text style={styles.spaceName}>{space.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
          <Text style={[styles.statusBadgeText, { color: sc.text }]}>{space.status}</Text>
        </View>
      </View>
      <Text style={styles.spaceWeather}>{space.weather}</Text>
      <Text style={styles.spaceDesc}>{space.desc}</Text>
      <View style={styles.capacityRow}>
        <Text style={styles.capacityLabel}>CAPACITY</Text>
        <CapacityBar ratio={space.capacity} />
        <Text style={styles.capacityPct}>{Math.round(space.capacity * 100)}%</Text>
      </View>
      <View style={styles.spaceFooter}>
        <View style={[
          styles.typePill,
          space.type === 'OUTDOOR' ? styles.typePillOutdoor : styles.typePillIndoor,
        ]}>
          <Text style={[
            styles.typePillText,
            space.type === 'OUTDOOR' ? styles.typePillTextOut : styles.typePillTextIn,
          ]}>
            {space.type}
          </Text>
        </View>
        <View style={styles.spaceFooterBtns}>
          <TouchableOpacity
            style={[styles.hereBtn, isHere && styles.hereBtnActive]}
            activeOpacity={0.85}
            onPress={() => onHereToggle(space.id)}
          >
            <Text style={[styles.hereBtnText, isHere && styles.hereBtnTextActive]}>
              {isHere ? '✓ HERE' : "I'M HERE"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.planHereBtn} activeOpacity={0.85} onPress={onPlanHere}>
            <Text style={styles.planHereBtnText}>PLAN HERE →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Event card ───────────────────────────────────────────────────────────────
function EventCard({ event }: { event: typeof PUBLIC_EVENTS[0] }) {
  const [joined, setJoined] = useState(false);
  return (
    <View style={styles.eventCard}>
      <View style={styles.eventTop}>
        <View style={styles.eventHostTag}>
          <Text style={styles.eventHostText}>{event.host}</Text>
        </View>
        <Text style={styles.eventWeather}>{event.weather}</Text>
      </View>
      <Text style={styles.eventTitle}>{event.title}</Text>
      <Text style={styles.eventMeta}>{event.location}  ·  {event.time}</Text>
      <View style={styles.eventFooter}>
        <Text style={styles.eventSpots}>{event.spots} spots open</Text>
        {joined ? (
          <TouchableOpacity
            style={styles.joinedEvtBtn}
            onPress={() => { setJoined(false); showToast(`Left "${event.title}"`); }}
          >
            <Text style={styles.joinedEvtBtnText}>✓ JOINED</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.joinEvtBtn}
            onPress={() => { setJoined(true); showToast(`Joined "${event.title}"! 🎉`); }}
            activeOpacity={0.85}
          >
            <Text style={styles.joinEvtBtnText}>JOIN →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Discover screen ──────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const [filter, setFilter] = useState<'ALL' | 'OUTDOOR' | 'INDOOR'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapVisible, setMapVisible] = useState(true);
  const [hereSet, setHereSet] = useState<Set<string>>(new Set());
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [planningAtSpace, setPlanningAtSpace] = useState<string | null>(null);

  const FILTERS = ['ALL', 'OUTDOOR', 'INDOOR'] as const;
  const filtered = filter === 'ALL' ? SPACES : SPACES.filter(s => s.type === filter);

  const toggleSelect = (id: string) => setSelectedId(prev => (prev === id ? null : id));

  const toggleHere = (id: string) => {
    const space = SPACES.find(s => s.id === id)!;
    const next = new Set(hereSet);
    if (next.has(id)) {
      next.delete(id);
      showToast(`Checked out of ${space.name}`);
    } else {
      next.add(id);
      showToast(`You're at ${space.name} — friends can see you!`);
    }
    setHereSet(next);
  };

  const openPlanHere = (spaceName: string) => {
    setPlanningAtSpace(spaceName);
    setPlanModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>DISCOVER</Text>
            <Text style={styles.headerSub}>What's open on campus</Text>
          </View>
          <View style={styles.liveTag}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* Filter strip */}
        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Map */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>CAMPUS MAP</Text>
          <TouchableOpacity onPress={() => setMapVisible(v => !v)}>
            <Text style={styles.toggleText}>{mapVisible ? 'HIDE ▴' : 'SHOW ▾'}</Text>
          </TouchableOpacity>
        </View>
        {mapVisible && (
          <CampusMap spaces={SPACES} selectedId={selectedId} onSelect={toggleSelect} />
        )}

        {/* Spaces list */}
        <View style={[styles.sectionRow, { marginTop: 24 }]}>
          <Text style={styles.sectionLabel}>
            {filter === 'ALL' ? 'ALL SPACES' : `${filter} SPACES`}
          </Text>
          <Text style={styles.countBadge}>{filtered.length}</Text>
        </View>
        {filtered.map(space => (
          <SpaceCard
            key={space.id}
            space={space}
            selected={selectedId === space.id}
            onPress={() => toggleSelect(space.id)}
            hereSet={hereSet}
            onHereToggle={toggleHere}
            onPlanHere={() => openPlanHere(space.name)}
          />
        ))}

        {/* Public events */}
        <View style={[styles.sectionRow, { marginTop: 8 }]}>
          <Text style={styles.sectionLabel}>PUBLIC EVENTS</Text>
          <View style={styles.publicTag}>
            <Text style={styles.publicTagText}>TODAY</Text>
          </View>
        </View>
        {PUBLIC_EVENTS.map(event => (
          <EventCard key={event.id} event={event} />
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>

      <CreatePlanModal
        visible={planModalVisible}
        onClose={() => { setPlanModalVisible(false); setPlanningAtSpace(null); }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  headerTitle: { fontSize: Typography.sizes.xxl, fontWeight: Typography.weights.black, color: Colors.navy, letterSpacing: -1 },
  headerSub: { fontSize: Typography.sizes.sm, color: Colors.gray500, fontWeight: Typography.weights.medium, marginTop: 2 },
  liveTag: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: Borders.width, borderColor: Colors.black, borderRadius: Borders.radius,
    paddingHorizontal: 10, paddingVertical: 6, gap: 6,
    backgroundColor: Colors.white, ...Shadows.sm,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.green },
  liveText: { fontSize: Typography.sizes.xs, fontWeight: Typography.weights.black, letterSpacing: 2, color: Colors.navy },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  filterChip: {
    borderWidth: Borders.width, borderColor: Colors.black, borderRadius: Borders.radius,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.white,
  },
  filterChipActive: { backgroundColor: Colors.navy },
  filterChipText: { fontSize: Typography.sizes.xs, fontWeight: Typography.weights.black, letterSpacing: 2, color: Colors.navy },
  filterChipTextActive: { color: Colors.white },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel: { fontSize: Typography.sizes.xs, fontWeight: Typography.weights.black, letterSpacing: 3, color: Colors.gray500 },
  toggleText: { fontSize: Typography.sizes.xs, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.navy },
  countBadge: {
    fontSize: Typography.sizes.xs, fontWeight: Typography.weights.black,
    color: Colors.white, backgroundColor: Colors.navy,
    borderRadius: Borders.radiusSm, paddingHorizontal: 8, paddingVertical: 2,
    letterSpacing: 1, overflow: 'hidden',
  },

  mapContainer: {
    borderWidth: Borders.widthHeavy, borderColor: Colors.black,
    borderRadius: Borders.radius, backgroundColor: Colors.cream, marginBottom: 4, overflow: 'hidden',
  },
  mapHeader: {
    backgroundColor: Colors.navy, paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  mapHeaderText: { fontSize: 9, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.white },
  mapHeaderSub: { fontSize: 9, color: Colors.blueMuted, fontWeight: Typography.weights.medium },
  mapLegend: {
    flexDirection: 'row', gap: 16, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.navy, borderTopWidth: 2, borderTopColor: Colors.black,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: Colors.black },
  legendText: { fontSize: 10, color: Colors.blueMuted, fontWeight: Typography.weights.medium },

  capacityTrack: {
    flex: 1, height: 6, backgroundColor: Colors.gray100,
    borderWidth: 1, borderColor: Colors.black, borderRadius: 2,
    overflow: 'hidden', marginHorizontal: 8,
  },
  capacityFill: { height: '100%', borderRadius: 1 },

  spaceCard: {
    borderWidth: Borders.widthHeavy, borderColor: Colors.black,
    borderRadius: Borders.radius, padding: 16, marginBottom: 12, ...Shadows.sm,
  },
  spaceCardSelected: { borderColor: Colors.navy, shadowOffset: { width: 5, height: 5 } },
  spaceCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  spaceName: { fontSize: Typography.sizes.lg, fontWeight: Typography.weights.black, color: Colors.navy, letterSpacing: -0.5, flex: 1 },
  statusBadge: { borderRadius: Borders.radiusSm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1.5, borderColor: Colors.black },
  statusBadgeText: { fontSize: 10, fontWeight: Typography.weights.black, letterSpacing: 1 },
  spaceWeather: { fontSize: Typography.sizes.sm, color: Colors.gray500, fontWeight: Typography.weights.medium, marginBottom: 6 },
  spaceDesc: { fontSize: Typography.sizes.sm, color: Colors.gray700, lineHeight: 20, marginBottom: 14 },
  capacityRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  capacityLabel: { fontSize: 9, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.gray500, width: 64 },
  capacityPct: { fontSize: 11, fontWeight: Typography.weights.black, color: Colors.navy, width: 34, textAlign: 'right' },
  spaceFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  spaceFooterBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  typePill: { borderWidth: 1.5, borderRadius: Borders.radiusSm, paddingHorizontal: 8, paddingVertical: 3 },
  typePillOutdoor: { borderColor: Colors.blue, backgroundColor: Colors.bluePale },
  typePillIndoor:  { borderColor: Colors.gray500, backgroundColor: Colors.gray100 },
  typePillText: { fontSize: 9, fontWeight: Typography.weights.black, letterSpacing: 1.5 },
  typePillTextOut: { color: Colors.blue },
  typePillTextIn:  { color: Colors.gray500 },
  hereBtn: {
    borderWidth: Borders.width, borderColor: Colors.black, borderRadius: Borders.radius,
    paddingHorizontal: 10, paddingVertical: 7, backgroundColor: Colors.white,
  },
  hereBtnActive: { backgroundColor: Colors.navy },
  hereBtnText: { fontSize: 10, fontWeight: Typography.weights.black, letterSpacing: 1, color: Colors.navy },
  hereBtnTextActive: { color: Colors.white },
  planHereBtn: {
    borderWidth: Borders.width, borderColor: Colors.black, borderRadius: Borders.radius,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.white, ...Shadows.sm,
  },
  planHereBtnText: { fontSize: 10, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.navy },

  publicTag: {
    backgroundColor: Colors.greenLight,
    borderWidth: Borders.width, borderColor: Colors.black,
    borderRadius: Borders.radiusSm, paddingHorizontal: 8, paddingVertical: 3,
  },
  publicTagText: { fontSize: 9, fontWeight: Typography.weights.black, letterSpacing: 2, color: Colors.green },

  eventCard: {
    backgroundColor: Colors.white,
    borderWidth: Borders.widthHeavy, borderColor: Colors.black,
    borderRadius: Borders.radius, padding: 16, marginBottom: 12, ...Shadows.sm,
  },
  eventTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  eventHostTag: {
    backgroundColor: Colors.bluePale,
    borderWidth: 1, borderColor: Colors.black,
    borderRadius: Borders.radiusSm, paddingHorizontal: 8, paddingVertical: 3,
  },
  eventHostText: { fontSize: 9, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.navy },
  eventWeather: { fontSize: Typography.sizes.sm, color: Colors.gray500, fontWeight: Typography.weights.medium },
  eventTitle: {
    fontSize: Typography.sizes.lg, fontWeight: Typography.weights.black,
    color: Colors.navy, letterSpacing: -0.5, marginBottom: 4,
  },
  eventMeta: { fontSize: Typography.sizes.sm, color: Colors.gray500, fontWeight: Typography.weights.medium, marginBottom: 12 },
  eventFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventSpots: { fontSize: 11, color: Colors.gray500, fontWeight: Typography.weights.medium },
  joinEvtBtn: {
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy, borderColor: Colors.black,
    borderRadius: Borders.radius, paddingHorizontal: 16, paddingVertical: 8, ...Shadows.sm,
  },
  joinEvtBtnText: { fontSize: Typography.sizes.xs, fontWeight: Typography.weights.black, letterSpacing: 2, color: Colors.white },
  joinedEvtBtn: {
    backgroundColor: Colors.greenLight,
    borderWidth: Borders.width, borderColor: Colors.black,
    borderRadius: Borders.radius, paddingHorizontal: 14, paddingVertical: 8,
  },
  joinedEvtBtnText: { fontSize: Typography.sizes.xs, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.green },
});
