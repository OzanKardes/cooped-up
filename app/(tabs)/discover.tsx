import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  TouchableWithoutFeedback, Animated, Modal, Dimensions,
  PanResponder, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../../constants/theme';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { getFriends } from '../../services/friends';
import {
  setUserLocation,
  clearUserLocation,
  subscribeToUserLocationChanges,
} from '../../services/users';
import { CreatePlanModal } from './plans';
import type { User } from '../../types';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Canvas ───────────────────────────────────────────────────────────────────
const CW = 580;   // canvas width
const CH = 420;   // canvas height
const INIT_X = (SW - CW) / 2;
const INIT_Y = 100; // leave room for overlaid search bar

// ─── Data ─────────────────────────────────────────────────────────────────────
interface Space {
  id: string;
  name: string;
  code: string;
  type: 'INDOOR' | 'OUTDOOR';
  busyness: number;
  x: number; y: number; w: number; h: number;
  weather: string;
}

const SPACES: Space[] = [
  { id: 'qtr',       name: "Queen's Tower Room", code: 'QTR',         type: 'INDOOR',  busyness: 0.55, x: 20,  y: 20,  w: 285, h: 72, weather: '— Indoor space' },
  { id: 'cagb',      name: 'CAGB',               code: 'CAGB',        type: 'INDOOR',  busyness: 0.72, x: 325, y: 20,  w: 78,  h: 155, weather: '— Indoor space' },
  { id: 'library',   name: 'Library',             code: 'LIB',         type: 'INDOOR',  busyness: 0.45, x: 20,  y: 112, w: 62,  h: 118, weather: '— Indoor space' },
  { id: 'jcr',       name: 'JCR',                 code: 'JCR',         type: 'INDOOR',  busyness: 0.30, x: 102, y: 112, w: 152, h: 64, weather: '— Indoor space' },
  { id: 'biz',       name: 'Business School',      code: 'BIZ SCHOOL',  type: 'INDOOR',  busyness: 0.40, x: 270, y: 112, w: 45,  h: 64, weather: '— Indoor space' },
  { id: 'lawn',      name: "Queen's Lawn",         code: 'OUTDOOR HUB', type: 'OUTDOOR', busyness: 0.25, x: 102, y: 196, w: 152, h: 88, weather: '☀️ 19°C · Partly cloudy' },
  { id: 'dyson',     name: 'Dyson School',          code: 'DYSON',       type: 'INDOOR',  busyness: 0.25, x: 325, y: 196, w: 78,  h: 66, weather: '— Indoor space' },
  { id: 'union',     name: 'Union Bar',             code: 'UNION',       type: 'INDOOR',  busyness: 0.65, x: 20,  y: 250, w: 62,  h: 64, weather: '— Indoor space' },
  { id: 'beit',      name: 'Beit Hall',             code: 'BEIT',        type: 'INDOOR',  busyness: 0.50, x: 102, y: 304, w: 95,  h: 56, weather: '— Indoor space' },
  { id: 'saf',       name: 'SAF Terrace',           code: 'OUTDOOR HUB', type: 'OUTDOOR', busyness: 0.20, x: 213, y: 304, w: 105, h: 56, weather: '☀️ 18°C · Clear sky' },
  { id: 'sherfield', name: 'Sherfield',             code: 'SHF',         type: 'INDOOR',  busyness: 0.35, x: 20,  y: 334, w: 75,  h: 50, weather: '— Indoor space' },
];

const EVENTS = [
  { id: 'e1', title: 'IC Hackathon 2026',     location: 'Great Hall',      date: 'Sat 24 May' },
  { id: 'e2', title: 'Summer Union Party',     location: 'Metric',          date: 'Fri 23 May' },
  { id: 'e3', title: 'Startup Pitch Night',    location: 'Business School', date: 'Thu 22 May' },
  { id: 'e4', title: 'Campus Photography Walk',location: 'Meet at Beit',    date: 'Sun 25 May' },
];

const ROOMS = [
  { id: 'r1', name: 'RODH 409',         building: 'Roderic Hill' },
  { id: 'r2', name: 'DBDE 301',         building: 'Dyson School' },
  { id: 'r3', name: 'ACEX 151',         building: 'ACE Extension' },
  { id: 'r4', name: 'Dyson Building Lev', building: 'Dyson School' },
  { id: 'r5', name: 'Great Hall',        building: 'Sherfield' },
  { id: 'r6', name: 'Metric',            building: 'Beit Hall' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function busyColor(b: number) {
  if (b < 0.4) return '#2D6A4F';
  if (b < 0.7) return '#E76F51';
  return '#C1121F';
}
function busyLabel(b: number) {
  if (b < 0.4) return 'QUIET';
  if (b < 0.7) return 'MODERATE';
  return 'BUSY';
}
function locationFresh(updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() < 7200_000;
}

// ─── Dot grid ─────────────────────────────────────────────────────────────────
const DOT = 3, GAP = 20;
const DOT_COLS = Math.ceil(SW / GAP) + 2;
const DOT_ROWS = Math.ceil(SH / GAP) + 2;
const DOTS: { key: string; l: number; t: number }[] = [];
for (let r = 0; r < DOT_ROWS; r++) {
  for (let c = 0; c < DOT_COLS; c++) {
    DOTS.push({ key: `${r}-${c}`, l: c * GAP, t: r * GAP });
  }
}

function DotGrid() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {DOTS.map(d => (
        <View key={d.key} style={[st.dot, { left: d.l, top: d.t }]} />
      ))}
    </View>
  );
}

// ─── Small avatar stack (on map block) ────────────────────────────────────────
function AvatarStack({ users }: { users: User[] }) {
  if (!users.length) return null;
  const shown = users.slice(0, 3);
  const extra = users.length - 3;
  return (
    <View style={{ flexDirection: 'row', marginTop: 4 }}>
      {shown.map((u, i) => (
        <View key={u.id} style={[st.stackAvatar, { marginLeft: i === 0 ? 0 : -7, zIndex: 3 - i }]}>
          <Text style={st.stackAvatarText}>{u.avatar_initials ?? '?'}</Text>
        </View>
      ))}
      {extra > 0 && (
        <View style={[st.stackAvatar, { marginLeft: -7, backgroundColor: '#555' }]}>
          <Text style={st.stackAvatarText}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Building block ───────────────────────────────────────────────────────────
function BuildingBlock({
  space, friendsHere, isUserHere, filterMode, onPress,
}: {
  space: Space;
  friendsHere: User[];
  isUserHere: boolean;
  filterMode: 'outdoor' | 'indoor' | 'both';
  onPress: () => void;
}) {
  const outdoor = space.type === 'OUTDOOR';
  const active = filterMode === 'both'
    || (filterMode === 'outdoor' && outdoor)
    || (filterMode === 'indoor' && !outdoor);

  const bc = busyColor(space.busyness);
  const bl = busyLabel(space.busyness);

  const bg        = outdoor ? '#EBEBEB' : '#111111';
  const txtColor  = outdoor ? '#111111' : '#FFFFFF';
  const subColor  = outdoor ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)';

  return (
    <TouchableOpacity
      style={[
        st.block,
        {
          position: 'absolute',
          left: space.x, top: space.y,
          width: space.w, height: space.h,
          backgroundColor: bg,
          opacity: active ? 1 : 0.3,
        },
        isUserHere && { borderColor: '#003087', borderWidth: 3 },
      ]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View>
          <Text style={[st.blockName, { color: txtColor }]} numberOfLines={2} adjustsFontSizeToFit>
            {space.name}
          </Text>
          <Text style={[st.blockCode, { color: subColor }]} numberOfLines={1}>
            {space.code}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <View style={[st.busyPill, { borderColor: bc }]}>
            <View style={[st.busyDot, { backgroundColor: bc }]} />
            <Text style={[st.busyPillTxt, { color: bc }]}>{bl}</Text>
          </View>
          {friendsHere.length > 0 && <AvatarStack users={friendsHere} />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Building detail sheet ─────────────────────────────────────────────────────
function BuildingSheet({
  space, isUserHere, friendsHere, onClose, onIAmHere, onLeave, onPlanHere, loading,
}: {
  space: Space;
  isUserHere: boolean;
  friendsHere: User[];
  onClose: () => void;
  onIAmHere: () => void;
  onLeave: () => void;
  onPlanHere: () => void;
  loading: boolean;
}) {
  const bc = busyColor(space.busyness);
  const bl = busyLabel(space.busyness);
  const pct = Math.round(space.busyness * 100);
  return (
    <View style={st.sheetInner}>
      <View style={st.sheetHandle} />

      <View style={st.sheetHeader}>
        <View style={{ flex: 1 }}>
          <Text style={st.sheetName}>{space.name}</Text>
          <Text style={st.sheetTypeTag}>{space.type} · {space.code}</Text>
        </View>
        <TouchableOpacity
          style={st.sheetCloseBtn}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={18} color="#333" />
        </TouchableOpacity>
      </View>

      <Text style={st.sheetLabel}>BUSYNESS</Text>
      <View style={st.sheetBarRow}>
        <View style={st.sheetBarTrack}>
          <View style={[st.sheetBarFill, { width: `${pct}%` as any, backgroundColor: bc }]} />
        </View>
        <Text style={[st.sheetBarPct, { color: bc }]}>{pct}%</Text>
      </View>
      <Text style={[st.sheetBusyWord, { color: bc }]}>{bl}</Text>

      <Text style={[st.sheetLabel, { marginTop: 14 }]}>CONDITIONS</Text>
      <Text style={st.sheetWeather}>{space.weather}</Text>

      <Text style={[st.sheetLabel, { marginTop: 14 }]}>FRIENDS HERE</Text>
      {friendsHere.length === 0 ? (
        <Text style={st.sheetNoFriends}>No friends here right now</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {friendsHere.map(f => (
            <View key={f.id} style={st.sheetFriendItem}>
              <View style={st.sheetFriendAvatar}>
                <Text style={st.sheetFriendInitials}>{f.avatar_initials ?? '?'}</Text>
              </View>
              <Text style={st.sheetFriendName} numberOfLines={1}>
                {f.full_name?.split(' ')[0] ?? 'Friend'}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={st.sheetBtns}>
        <TouchableOpacity
          style={[st.hereBtnBase, isUserHere ? st.hereBtnActive : st.hereBtnInactive]}
          onPress={isUserHere ? onLeave : onIAmHere}
          activeOpacity={0.85}
          disabled={loading}
        >
          <Text style={[st.hereBtnTxt, isUserHere && st.hereBtnTxtActive]}>
            {loading ? '...' : isUserHere ? 'LEAVE' : "I'M HERE"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.planHereBtn} onPress={onPlanHere} activeOpacity={0.85}>
          <Text style={st.planHereTxt}>PLAN HERE →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Search bar ───────────────────────────────────────────────────────────────
interface SearchResult {
  kind: 'location' | 'friend' | 'event' | 'room';
  id: string;
  title: string;
  subtitle: string;
  spaceId?: string;
}

function SearchBar({
  query, onChangeQuery, focused, onFocus, results, onSelectResult,
}: {
  query: string;
  onChangeQuery: (q: string) => void;
  focused: boolean;
  onFocus: () => void;
  results: SearchResult[];
  onSelectResult: (r: SearchResult) => void;
}) {
  const iconForKind = (k: string) =>
    k === 'location' ? 'location' : k === 'friend' ? 'person' : k === 'event' ? 'calendar' : 'grid-outline';

  return (
    <View style={st.searchContainer}>
      <View style={st.searchPill}>
        <Ionicons name="search" size={16} color={Colors.gray500} />
        <TextInput
          style={st.searchInput}
          placeholder="Search buildings, friends, events..."
          placeholderTextColor={Colors.gray300}
          value={query}
          onChangeText={onChangeQuery}
          onFocus={onFocus}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => onChangeQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={Colors.gray300} />
          </TouchableOpacity>
        )}
        <Ionicons name="options-outline" size={16} color={Colors.gray500} />
      </View>

      {focused && results.length > 0 && (
        <View style={st.searchDropdown}>
          {results.map((r, i) => (
            <TouchableOpacity
              key={`${r.kind}-${r.id}`}
              style={[
                st.searchRow,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.gray100 },
              ]}
              onPress={() => onSelectResult(r)}
              activeOpacity={0.8}
            >
              <View style={st.searchIcon}>
                <Ionicons name={iconForKind(r.kind) as any} size={13} color={Colors.gray500} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.searchTitle} numberOfLines={1}>{r.title}</Text>
                <Text style={st.searchSub}   numberOfLines={1}>{r.subtitle}</Text>
              </View>
              <Text style={st.searchKind}>{r.kind.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Discover (Map) screen ────────────────────────────────────────────────────
export default function DiscoverScreen({ onModalChange }: { onModalChange?: (open: boolean) => void }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // ── State ────────────────────────────────────────────────────────────────────
  const [filterMode, setFilterMode] = useState<'outdoor' | 'indoor' | 'both'>('both');
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [sheetVisible,  setSheetVisible]  = useState(false);
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [planLocation,     setPlanLocation]     = useState('');

  const [friends,     setFriends]     = useState<User[]>([]);
  const [locationMap, setLocationMap] = useState<Record<string, { spaceId: string; updatedAt: string }>>({});
  const [mySpaceId,   setMySpaceId]   = useState<string | null>(null);
  const [locLoading,  setLocLoading]  = useState(false);

  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [zoomLevel,     setZoomLevel]     = useState(1.0);
  const zoomRef = useRef(1.0);

  // ── Animations ───────────────────────────────────────────────────────────────
  const panX   = useRef(new Animated.Value(INIT_X)).current;
  const panY   = useRef(new Animated.Value(INIT_Y)).current;
  const lastPan = useRef({ x: INIT_X, y: INIT_Y });
  const startPan = useRef({ x: INIT_X, y: INIT_Y });
  const scaleAnim = useRef(new Animated.Value(1.0)).current;
  const sheetY    = useRef(new Animated.Value(700)).current;

  // ── Pan responder ─────────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 6 || Math.abs(dy) > 6,
      onPanResponderGrant: () => {
        startPan.current = { ...lastPan.current };
      },
      onPanResponderMove: (_, { dx, dy }) => {
        panX.setValue(startPan.current.x + dx);
        panY.setValue(startPan.current.y + dy);
      },
      onPanResponderRelease: (_, { dx, dy }) => {
        lastPan.current = {
          x: startPan.current.x + dx,
          y: startPan.current.y + dy,
        };
      },
    })
  ).current;

  // ── Zoom helpers ──────────────────────────────────────────────────────────────
  const doZoom = useCallback((delta: number) => {
    const next = Math.min(2.0, Math.max(0.6, Math.round((zoomRef.current + delta) * 10) / 10));
    zoomRef.current = next;
    setZoomLevel(next);
    Animated.spring(scaleAnim, { toValue: next, tension: 80, friction: 14, useNativeDriver: true }).start();
  }, []);

  const resetView = useCallback(() => {
    zoomRef.current = 1.0;
    setZoomLevel(1.0);
    lastPan.current = { x: INIT_X, y: INIT_Y };
    panX.setValue(INIT_X);
    panY.setValue(INIT_Y);
    Animated.spring(scaleAnim, { toValue: 1.0, tension: 80, friction: 14, useNativeDriver: true }).start();
  }, []);

  // ── Sheet helpers ─────────────────────────────────────────────────────────────
  const openSheet = useCallback((space: Space) => {
    setSelectedSpace(space);
    setSheetVisible(true);
    onModalChange?.(true);
    sheetY.setValue(700);
    Animated.spring(sheetY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }).start();
  }, []);

  const closeSheet = useCallback(() => {
    Animated.spring(sheetY, { toValue: 700, tension: 50, friction: 12, useNativeDriver: true }).start(() => {
      setSheetVisible(false);
      setSelectedSpace(null);
      onModalChange?.(false);
    });
  }, []);

  // ── Load friends & initial locations ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    getFriends(user.id).then(fs => {
      setFriends(fs);
      const map: Record<string, { spaceId: string; updatedAt: string }> = {};
      for (const f of fs) {
        if (f.current_location && locationFresh(f.location_updated_at)) {
          map[f.id] = { spaceId: f.current_location, updatedAt: f.location_updated_at! };
        }
      }
      setLocationMap(map);
    }).catch(() => {});
  }, [user?.id]);

  // ── Realtime friend locations ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const friendIds = new Set(friends.map(f => f.id));
    const unsub = subscribeToUserLocationChanges((userId, location, updatedAt) => {
      if (userId === user.id) {
        setMySpaceId(location && locationFresh(updatedAt) ? location : null);
        return;
      }
      if (!friendIds.has(userId)) return;
      if (location && locationFresh(updatedAt)) {
        setLocationMap(prev => ({ ...prev, [userId]: { spaceId: location, updatedAt: updatedAt! } }));
      } else {
        setLocationMap(prev => { const n = { ...prev }; delete n[userId]; return n; });
      }
    });
    return unsub;
  }, [user?.id, friends]);

  // ── I'm Here / Leave ─────────────────────────────────────────────────────────
  const handleIAmHere = useCallback(async () => {
    if (!user || !selectedSpace) return;
    setLocLoading(true);
    try {
      await setUserLocation(user.id, selectedSpace.id);
      setMySpaceId(selectedSpace.id);
      showToast(`Checked in at ${selectedSpace.name}`);
    } catch {
      showToast('Could not check in — check your connection');
    } finally {
      setLocLoading(false);
    }
  }, [user?.id, selectedSpace?.id]);

  const handleLeave = useCallback(async () => {
    if (!user) return;
    setLocLoading(true);
    try {
      await clearUserLocation(user.id);
      setMySpaceId(null);
      showToast('Checked out');
    } catch {
      showToast('Could not check out — check your connection');
    } finally {
      setLocLoading(false);
    }
  }, [user?.id]);

  const handlePlanHere = useCallback(() => {
    const loc = selectedSpace?.name ?? '';
    Animated.spring(sheetY, { toValue: 700, tension: 50, friction: 12, useNativeDriver: true }).start(() => {
      setSheetVisible(false);
      setSelectedSpace(null);
      setPlanLocation(loc);
      setPlanModalVisible(true);
    });
  }, [selectedSpace?.name]);

  // ── Search ────────────────────────────────────────────────────────────────────
  const buildResults = useCallback((): SearchResult[] => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const out: SearchResult[] = [];

    for (const s of SPACES) {
      if (s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)) {
        out.push({ kind: 'location', id: s.id, title: s.name, subtitle: `${s.type} · ${busyLabel(s.busyness)}`, spaceId: s.id });
      }
    }
    for (const f of friends) {
      if (f.full_name?.toLowerCase().includes(q) || f.email?.toLowerCase().includes(q)) {
        const loc = locationMap[f.id];
        const sp = loc ? SPACES.find(s => s.id === loc.spaceId) : null;
        out.push({ kind: 'friend', id: f.id, title: f.full_name ?? 'Friend', subtitle: sp ? `At ${sp.name}` : 'Location unknown', spaceId: sp?.id });
      }
    }
    for (const e of EVENTS) {
      if (e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q)) {
        out.push({ kind: 'event', id: e.id, title: e.title, subtitle: `${e.location} · ${e.date}` });
      }
    }
    for (const r of ROOMS) {
      if (r.name.toLowerCase().includes(q) || r.building.toLowerCase().includes(q)) {
        out.push({ kind: 'room', id: r.id, title: r.name, subtitle: r.building });
      }
    }
    return out.slice(0, 8);
  }, [searchQuery, friends, locationMap]);

  const handleSelectResult = useCallback((r: SearchResult) => {
    setSearchFocused(false);
    setSearchQuery('');
    if (r.spaceId) {
      const sp = SPACES.find(s => s.id === r.spaceId);
      if (sp) {
        const tx = SW / 2 - (sp.x + sp.w / 2);
        const ty = SH / 2 - (sp.y + sp.h / 2);
        lastPan.current = { x: tx, y: ty };
        panX.setValue(tx);
        panY.setValue(ty);
        if (r.kind === 'location') openSheet(sp);
      }
    }
  }, [openSheet]);

  const getFriendsAt = useCallback((spaceId: string): User[] =>
    friends.filter(f => {
      const loc = locationMap[f.id];
      return loc && loc.spaceId === spaceId && locationFresh(loc.updatedAt);
    }),
  [friends, locationMap]);

  const results = buildResults();
  const TOP = insets.top + 14;

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
      {/* ── Dotted background ── */}
      <DotGrid />

      {/* ── Pannable / zoomable canvas ── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX: panX }, { translateY: panY }, { scale: scaleAnim }] },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={{ width: CW, height: CH }}>
          {SPACES.map(sp => (
            <BuildingBlock
              key={sp.id}
              space={sp}
              friendsHere={getFriendsAt(sp.id)}
              isUserHere={mySpaceId === sp.id}
              filterMode={filterMode}
              onPress={() => openSheet(sp)}
            />
          ))}
        </View>
      </Animated.View>

      {/* ── Search bar (floating) ── */}
      {!sheetVisible && (
        <View
          style={[st.floatingSearch, { top: TOP }]}
          pointerEvents="box-none"
        >
          <SearchBar
            query={searchQuery}
            onChangeQuery={setSearchQuery}
            focused={searchFocused}
            onFocus={() => setSearchFocused(true)}
            results={results}
            onSelectResult={handleSelectResult}
          />
        </View>
      )}

      {/* ── Toggle pills ── */}
      {!sheetVisible && (
        <View style={[st.toggleWrap, { top: TOP }]}>
          {(['outdoor', 'indoor', 'both'] as const).map(opt => (
            <TouchableOpacity
              key={opt}
              style={[st.togglePill, filterMode === opt && st.togglePillActive]}
              onPress={() => setFilterMode(opt)}
              activeOpacity={0.82}
            >
              <Text style={[st.togglePillTxt, filterMode === opt && st.togglePillTxtActive]}>
                {opt === 'both' ? 'All' : opt === 'outdoor' ? 'Out' : 'In'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Zoom controls ── */}
      {!sheetVisible && (
        <View style={st.zoomWrap}>
          <TouchableOpacity style={st.zoomBtn} onPress={() => doZoom(0.2)} activeOpacity={0.85}>
            <Text style={st.zoomBtnTxt}>+</Text>
          </TouchableOpacity>
          <Text style={st.zoomLbl}>{zoomLevel.toFixed(1)}×</Text>
          <TouchableOpacity style={st.zoomBtn} onPress={() => doZoom(-0.2)} activeOpacity={0.85}>
            <Text style={st.zoomBtnTxt}>−</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Reset / locate button ── */}
      {!sheetVisible && (
        <TouchableOpacity
          style={[st.targetBtn, { bottom: insets.bottom + 96 }]}
          onPress={resetView}
          activeOpacity={0.85}
        >
          <Ionicons name="locate" size={20} color="#0D0D0D" />
        </TouchableOpacity>
      )}

      {/* ── Search backdrop ── */}
      {searchFocused && (
        <TouchableWithoutFeedback onPress={() => setSearchFocused(false)}>
          <View style={[StyleSheet.absoluteFill, { zIndex: 8 }]} pointerEvents="box-only" />
        </TouchableWithoutFeedback>
      )}

      {/* ── Building detail sheet ── */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
      >
        <View style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={closeSheet}>
            <View style={st.sheetBackdrop} pointerEvents="box-only" />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View style={[st.sheet, { transform: [{ translateY: sheetY }] }]}>
              {selectedSpace && (
                <BuildingSheet
                  space={selectedSpace}
                  isUserHere={mySpaceId === selectedSpace.id}
                  friendsHere={getFriendsAt(selectedSpace.id)}
                  onClose={closeSheet}
                  onIAmHere={handleIAmHere}
                  onLeave={handleLeave}
                  onPlanHere={handlePlanHere}
                  loading={locLoading}
                />
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </Modal>

      {/* ── Plan modal ── */}
      <CreatePlanModal
        visible={planModalVisible}
        onClose={() => { setPlanModalVisible(false); onModalChange?.(false); }}
        initialValues={{ location: planLocation }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  // Dot grid
  dot: {
    position: 'absolute',
    width: DOT, height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },

  // Building block
  block: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#0D0D0D',
    padding: 8,
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  blockName: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: -0.2,
    marginBottom: 1,
  },
  blockCode: {
    fontSize: 7,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  busyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 3,
  },
  busyDot: { width: 5, height: 5, borderRadius: 3 },
  busyPillTxt: {
    fontSize: 6,
    fontWeight: Typography.weights.black,
    letterSpacing: 0.6,
  },

  // Avatar stack on block
  stackAvatar: {
    width: 18, height: 18,
    borderRadius: 9,
    backgroundColor: '#003087',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackAvatarText: {
    fontSize: 6,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
  },

  // Search
  floatingSearch: {
    position: 'absolute',
    left: 16,
    right: 110,
    zIndex: 10,
  },
  searchContainer: { zIndex: 10 },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 0,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: '#0D0D0D',
    padding: 0,
  },
  searchDropdown: {
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#0D0D0D',
    overflow: 'hidden',
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
    zIndex: 20,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  searchIcon: {
    width: 26, height: 26,
    borderRadius: 13,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: '#0D0D0D',
    marginBottom: 1,
  },
  searchSub: {
    fontSize: 10,
    fontWeight: Typography.weights.medium,
    color: Colors.gray500,
  },
  searchKind: {
    fontSize: 7,
    fontWeight: Typography.weights.black,
    color: Colors.gray500,
    letterSpacing: 0.5,
  },

  // Toggle pills (right column)
  toggleWrap: {
    position: 'absolute',
    right: 16,
    flexDirection: 'column',
    gap: 6,
    zIndex: 10,
  },
  togglePill: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#0D0D0D',
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    alignItems: 'center',
  },
  togglePillActive: {
    backgroundColor: '#001845',
    borderColor: '#001845',
  },
  togglePillTxt: {
    fontSize: 11,
    fontWeight: Typography.weights.black,
    color: '#0D0D0D',
    letterSpacing: 0.3,
  },
  togglePillTxtActive: {
    color: '#FFFFFF',
  },

  // Zoom controls (right center)
  zoomWrap: {
    position: 'absolute',
    right: 16,
    top: '42%',
    alignItems: 'center',
    gap: 5,
    zIndex: 10,
  },
  zoomBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  zoomBtnTxt: {
    fontSize: 22,
    fontWeight: Typography.weights.black,
    color: '#0D0D0D',
    lineHeight: 26,
  },
  zoomLbl: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    color: '#333',
    letterSpacing: 0.5,
    marginVertical: 2,
  },

  // Target / locate button (bottom right)
  targetBtn: {
    position: 'absolute',
    right: 16,
    width: 46, height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    zIndex: 10,
  },

  // Bottom sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 24,
  },
  sheetInner: {
    padding: 20,
    paddingBottom: 44,
  },
  sheetHandle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gray300,
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  sheetName: {
    fontSize: 22,
    fontWeight: Typography.weights.black,
    color: '#0D0D0D',
    letterSpacing: -0.5,
    marginBottom: 3,
  },
  sheetTypeTag: {
    fontSize: 11,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 1.5,
    color: Colors.gray500,
  },
  sheetCloseBtn: {
    width: 34, height: 34,
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
    flex: 1, height: 10,
    borderRadius: 5,
    backgroundColor: Colors.gray100,
    overflow: 'hidden',
  },
  sheetBarFill: { height: '100%', borderRadius: 5 },
  sheetBarPct: {
    fontSize: 13,
    fontWeight: Typography.weights.black,
    width: 36,
    textAlign: 'right',
  },
  sheetBusyWord: {
    fontSize: 13,
    fontWeight: Typography.weights.bold,
    marginBottom: 4,
  },
  sheetWeather: {
    fontSize: 13,
    fontWeight: Typography.weights.medium,
    color: '#0D0D0D',
    marginBottom: 4,
  },
  sheetNoFriends: {
    fontSize: 13,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  sheetFriendItem: {
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 16,
  },
  sheetFriendAvatar: {
    width: 42, height: 42,
    borderRadius: 21,
    backgroundColor: '#001845',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sheetFriendInitials: {
    fontSize: 13,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
  },
  sheetFriendName: {
    fontSize: 10,
    fontWeight: Typography.weights.medium,
    color: Colors.gray500,
    maxWidth: 44,
    textAlign: 'center',
  },
  sheetBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  hereBtnBase: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
  },
  hereBtnInactive: {
    backgroundColor: 'transparent',
    borderColor: '#0D0D0D',
  },
  hereBtnActive: {
    backgroundColor: '#001845',
    borderColor: '#001845',
  },
  hereBtnTxt: {
    fontSize: 13,
    fontWeight: Typography.weights.black,
    letterSpacing: 1.5,
    color: '#0D0D0D',
  },
  hereBtnTxtActive: {
    color: '#FFFFFF',
  },
  planHereBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#003087',
    borderWidth: 2,
    borderColor: '#003087',
  },
  planHereTxt: {
    fontSize: 13,
    fontWeight: Typography.weights.black,
    letterSpacing: 1,
    color: '#FFFFFF',
  },
});
