import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TouchableWithoutFeedback,
  Modal, TextInput, KeyboardAvoidingView, Platform, Dimensions,
  ActivityIndicator, Animated, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { getMyPlans, getPublicPlans, createPlan as createPlanInDB, joinPlan, leavePlan, formatPlanTime, getPendingInvites, subscribeToPlanInvites, acceptPlanInvite, declinePlanInvite, updatePlan, cancelPlan, inviteMoreToPlan } from '../../services/plans';
import { sendSystemMessage, getGroupChatForPlan, leaveGroup } from '../../services/messages';
import type { Plan, PendingInviteDisplay } from '../../types';
import { useFriends } from '../../hooks/useFriends';
import { bookmarkPlan, unbookmarkPlan } from '../../lib/suggestedStore';
import { useWeather } from '../../hooks/useWeather';
import { isDark, subscribe as subscribeTheme, DarkTheme } from '../../lib/themeStore';
import { notifyPlanInviteCount } from '../../lib/planInviteStore';
import { checkAndUnlockBadges } from '../../services/badges';
import { notifyBadgeUnlocked } from '../../lib/badgeQueue';
import { getPlanCount } from '../../services/users';

const { width } = Dimensions.get('window');


// ─── Hardcoded data ───────────────────────────────────────────────────────────
const SUGGESTED_PLANS = [
  {
    id: 's1',
    title: 'Frisbee on the Lawn',
    location: "Queen's Lawn",
    time: 'Today, 3pm',
    weather: '☀️ 19°C — perfect',
    reason: 'Weather is great and the lawn is quiet right now.',
    friends: [
      { initials: 'TB', name: 'Tom B.' },
      { initials: 'AK', name: 'Alex K.' },
      { initials: 'PM', name: 'Priya M.' },
    ],
  },
  {
    id: 's2',
    title: 'Revision outside',
    location: 'Beit Quad',
    time: 'Today, 2pm',
    weather: '⛅ 18°C — good',
    reason: 'Light cloud cover — ideal for outdoor studying.',
    friends: [
      { initials: 'SN', name: 'Sam N.' },
      { initials: 'JL', name: 'Jamie L.' },
    ],
  },
];

export const EXISTING_PLANS = [
  {
    id: 'p1',
    title: 'Lunch at SAF',
    creator: 'Tom B.',
    location: 'SAF Terrace',
    time: 'Today, 1pm',
    visibility: 'FRIENDS',
    attendees: ['TB', 'AK'],
    spots: 4,
    weather: '⛅ 18°C',
  },
  {
    id: 'p2',
    title: 'Evening walk',
    creator: 'Priya M.',
    location: 'Hyde Park',
    time: 'Today, 6pm',
    visibility: 'PUBLIC',
    attendees: ['PM', 'SN', 'JL'],
    spots: 6,
    weather: '🌤 16°C',
  },
  {
    id: 'p3',
    title: 'Study group',
    creator: 'You',
    location: 'Central Library',
    time: 'Tomorrow, 10am',
    visibility: 'INVITE',
    attendees: ['AK', 'TB'],
    spots: 5,
    weather: '🌧 14°C',
  },
];

// ─── Plan wizard data ─────────────────────────────────────────────────────────
const TIME_PERIODS = [
  {
    day: 'today', label: 'TODAY',
    slots: [
      { id: 'now',       label: 'Now',           sub: 'Right now',       weather: '☀️', temp: 19 },
      { id: 'afternoon', label: 'Afternoon',      sub: '1:00 – 3:00pm',  weather: '⛅', temp: 18 },
      { id: 'late',      label: 'Late afternoon', sub: '3:00 – 5:00pm',  weather: '🌤', temp: 17 },
      { id: 'evening',   label: 'Evening',        sub: 'From 6:00pm',    weather: '🌙', temp: 15 },
    ],
  },
  {
    day: 'tomorrow', label: 'TOMORROW',
    slots: [
      { id: 'tmr_morning',   label: 'Morning',   sub: '9:00 – 12:00pm', weather: '🌧', temp: 14 },
      { id: 'tmr_afternoon', label: 'Afternoon', sub: '1:00 – 4:00pm',  weather: '⛅', temp: 16 },
      { id: 'tmr_evening',   label: 'Evening',   sub: 'From 5:00pm',    weather: '🌤', temp: 15 },
    ],
  },
  {
    day: 'week', label: 'THIS WEEK',
    slots: [
      { id: 'thu', label: 'Thursday', sub: 'All day', weather: '☀️', temp: 21 },
      { id: 'fri', label: 'Friday',   sub: 'All day', weather: '⛅', temp: 18 },
      { id: 'sat', label: 'Saturday', sub: 'All day', weather: '🌤', temp: 19 },
      { id: 'sun', label: 'Sunday',   sub: 'All day', weather: '🌙', temp: 17 },
    ],
  },
];

const LOCATIONS_DATA = [
  { name: "Queen's Lawn", busyness: 0.25 },
  { name: 'Beit Quad',    busyness: 0.55 },
  { name: 'SAF Terrace',  busyness: 0.75 },
  { name: 'JCR',          busyness: 0.30 },
  { name: 'Library',      busyness: 0.45 },
  { name: 'Hyde Park',    busyness: 0.20 },
  { name: 'Union Bar',    busyness: 0.65 },
  { name: 'Dyson',        busyness: 0.25 },
  { name: 'Sherfield',    busyness: 0.45 },
];

const ACTIVITIES = [
  { id: 'coffee', label: 'Coffee',  icon: '☕' },
  { id: 'study',  label: 'Study',   icon: '📚' },
  { id: 'lunch',  label: 'Lunch',   icon: '🍽️' },
  { id: 'walk',   label: 'Walk',    icon: '🚶' },
  { id: 'sport',  label: 'Sport',   icon: '⚽' },
  { id: 'drinks', label: 'Drinks',  icon: '🍺' },
  { id: 'chill',  label: 'Chill',   icon: '😎' },
  { id: 'cinema', label: 'Cinema',  icon: '🎬' },
];

const ACT_BOX_W = Math.floor((width - 48 - 30) / 4);

const DURATIONS = [
  { label: '30 min', value: 30  },
  { label: '1 hr',   value: 60  },
  { label: '1.5 hr', value: 90  },
  { label: '2 hr',   value: 120 },
  { label: '3 hr',   value: 180 },
  { label: '4+ hr',  value: 240 },
];

function busynessColor(v: number) {
  if (v < 0.3)  return '#4CAF50';
  if (v < 0.55) return '#8BC34A';
  if (v < 0.75) return '#FF9800';
  return '#F44336';
}
function busynessLabel(v: number) {
  if (v < 0.3)  return 'Quiet';
  if (v < 0.55) return 'Moderate';
  if (v < 0.75) return 'Busy';
  return 'Very busy';
}
function slotToISO(slotId: string): string {
  const now = new Date();
  const map: Record<string, [number, number, number]> = {
    now:           [0, now.getHours(), now.getMinutes()],
    afternoon:     [0, 13, 0],
    late:          [0, 15, 0],
    evening:       [0, 18, 0],
    tmr_morning:   [1,  9, 0],
    tmr_afternoon: [1, 13, 0],
    tmr_evening:   [1, 18, 0],
    thu:           [2, 12, 0],
    fri:           [3, 12, 0],
    sat:           [4, 12, 0],
    sun:           [5, 12, 0],
  };
  const [days, h, m] = map[slotId] ?? [0, 12, 0];
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
function slotDisplayLabel(slotId: string): string {
  for (const period of TIME_PERIODS) {
    for (const slot of period.slots) {
      if (slot.id === slotId) return `${slot.label}  ·  ${slot.sub}`;
    }
  }
  return slotId;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sortByTime(plans: any[]) {
  return [...plans].sort((a, b) => {
    if (!a.rawTime && !b.rawTime) return 0;
    if (!a.rawTime) return 1;
    if (!b.rawTime) return -1;
    return new Date(a.rawTime).getTime() - new Date(b.rawTime).getTime();
  });
}

function visibilityLabel(v: string) {
  switch (v) {
    case 'PUBLIC':  return 'Public';
    case 'FRIENDS': return 'Friends';
    case 'INVITE':  return 'Invite only';
    default:        return v;
  }
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({
  initials, size = 36, selected = false, free = true,
}: {
  initials: string; size?: number; selected?: boolean; free?: boolean;
}) {
  return (
    <View style={[
      styles.avatar,
      {
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: selected ? Colors.navy : free ? Colors.bluePale : Colors.gray100,
        borderColor: selected ? Colors.white : free ? Colors.black : Colors.gray300,
        borderWidth: selected ? 3 : 2,
        opacity: free ? 1 : 0.55,
      },
    ]}>
      <Text style={[
        styles.avatarText,
        { color: selected ? Colors.white : free ? Colors.navy : Colors.gray500, fontSize: size * 0.33 },
      ]}>
        {initials}
      </Text>
    </View>
  );
}

// ─── Friend invite grid ───────────────────────────────────────────────────────
function FriendInviteGrid({
  selected, onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const { friends, loading } = useFriends();
  const COLS = 4;
  const cellW = (width - 48) / COLS;

  if (loading) {
    return (
      <View style={styles.friendGridEmpty}>
        <ActivityIndicator color={Colors.navy} />
        <Text style={styles.friendGridEmptyText}>Loading friends…</Text>
      </View>
    );
  }

  if (friends.length === 0) {
    return (
      <View style={styles.friendGridEmpty}>
        <Text style={styles.friendGridEmptyText}>No friends yet.</Text>
        <Text style={styles.friendGridEmptyHint}>Add friends in the Chat tab to invite them to plans.</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.friendGrid}>
        {friends.map(friend => {
          const isSelected = selected.includes(friend.id);
          return (
            <TouchableOpacity
              key={friend.id}
              style={[styles.friendCell, { width: cellW }]}
              onPress={() => onToggle(friend.id)}
              activeOpacity={0.75}
            >
              <View style={{ position: 'relative' }}>
                <Avatar initials={friend.avatar_initials} size={42} selected={isSelected} free={true} />
                {isSelected && (
                  <View style={[styles.tickBadge, { top: -2, right: -2 }]}>
                    <Text style={styles.tickText}>✓</Text>
                  </View>
                )}
              </View>
              <Text style={[
                styles.friendCellName,
                isSelected && styles.friendCellNameSelected,
              ]}>
                {friend.full_name.split(' ')[0]}
              </Text>
              <Text style={[styles.friendCellStatus, { color: Colors.green }]}>
                Free
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selected.length > 0 && (
        <View style={styles.selectedSummary}>
          <Text style={styles.selectedSummaryText}>
            {selected.length} friend{selected.length > 1 ? 's' : ''} invited
          </Text>
          <TouchableOpacity onPress={() => selected.forEach(id => onToggle(id))}>
            <Text style={styles.clearText}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}


// ─── Suggested detail sheet ───────────────────────────────────────────────────
function SuggestedDetailSheet({
  plan, visible, onClose, bookmarked, onToggleBookmark,
}: {
  plan: typeof SUGGESTED_PLANS[0];
  visible: boolean;
  onClose: () => void;
  bookmarked: boolean;
  onToggleBookmark: () => void;
}) {
  const sheetY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      sheetY.setValue(600);
      Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.spring(sheetY, { toValue: 600, useNativeDriver: true, damping: 22, stiffness: 200 }).start(() => onClose());
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.sheetBackdrop} pointerEvents="box-only" />
        </TouchableWithoutFeedback>
        <TouchableWithoutFeedback onPress={() => {}}>
          <Animated.View style={[styles.detailSheet, { transform: [{ translateY: sheetY }] }]}>
            {/* Drag handle */}
            <View style={styles.sheetHandle} />

            {/* Header row */}
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>{plan.title}</Text>
              <TouchableOpacity onPress={handleClose} style={styles.sheetCloseBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={18} color={Colors.navy} />
              </TouchableOpacity>
            </View>

            {/* Details */}
            <View style={styles.sheetDetailRow}>
              <Ionicons name="location-outline" size={15} color={Colors.gray500} />
              <Text style={styles.sheetDetailText}>{plan.location}</Text>
            </View>
            <View style={styles.sheetDetailRow}>
              <Ionicons name="time-outline" size={15} color={Colors.gray500} />
              <Text style={styles.sheetDetailText}>{plan.time}</Text>
            </View>
            <View style={styles.sheetDetailRow}>
              <Ionicons name="partly-sunny-outline" size={15} color={Colors.gray500} />
              <Text style={styles.sheetDetailText}>{plan.weather}</Text>
            </View>

            <Text style={styles.sheetReason}>{plan.reason}</Text>

            {/* Suggested friends */}
            <Text style={styles.sheetSectionLabel}>SUGGESTED FRIENDS</Text>
            <View style={styles.sheetFriendRow}>
              {plan.friends.map(f => (
                <View key={f.initials} style={styles.sheetFriendItem}>
                  <View style={styles.sheetFriendCircle}>
                    <Text style={styles.sheetFriendInitials}>{f.initials}</Text>
                  </View>
                  <Text style={styles.sheetFriendName}>{f.name.split(' ')[0]}</Text>
                </View>
              ))}
            </View>

            {/* Add to My Day button */}
            <TouchableOpacity
              style={[styles.addDayBtn, bookmarked && styles.addDayBtnActive]}
              onPress={() => { onToggleBookmark(); handleClose(); }}
              activeOpacity={0.85}
            >
              <Ionicons
                name={bookmarked ? 'checkmark-circle' : 'add-circle-outline'}
                size={18}
                color={bookmarked ? '#FFFFFF' : Colors.navy}
              />
              <Text style={[styles.addDayBtnText, bookmarked && styles.addDayBtnTextActive]}>
                {bookmarked ? 'Added to Your Day' : 'Add to Your Day'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
}

// ─── Suggested card ───────────────────────────────────────────────────────────
function SuggestedCard({ plan, onModalChange }: { plan: typeof SUGGESTED_PLANS[0]; onModalChange?: (open: boolean) => void }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleToggleBookmark = () => {
    const next = !bookmarked;
    setBookmarked(next);
    if (next) {
      bookmarkPlan({ id: plan.id, title: plan.title, location: plan.location, time: plan.time });
    } else {
      unbookmarkPlan(plan.id);
    }
  };

  return (
    <>
      {/* Row: left margin + card + tab flush at top-right */}
      <View style={styles.suggestedWrap}>
        <TouchableOpacity
          style={styles.suggestedCard}
          onPress={() => { setDetailOpen(true); onModalChange?.(true); }}
          activeOpacity={0.88}
        >
          <Text style={styles.suggestedTitle}>{plan.title}</Text>
          <Text style={styles.suggestedMeta}>{plan.location}  ·  {plan.time}</Text>
          <Text style={styles.suggestedWeather}>{plan.weather}</Text>
        </TouchableOpacity>

        {/* Rectangle tab — same dark bg, rounded top-right only */}
        <TouchableOpacity
          style={[styles.bookmarkTab, bookmarked && styles.bookmarkTabActive]}
          onPress={handleToggleBookmark}
          activeOpacity={0.75}
        >
          <Ionicons
            name="checkmark"
            size={22}
            color={bookmarked ? '#FFFFFF' : 'rgba(255,255,255,0.35)'}
          />
        </TouchableOpacity>
      </View>

      <SuggestedDetailSheet
        plan={plan}
        visible={detailOpen}
        onClose={() => { setDetailOpen(false); onModalChange?.(false); }}
        bookmarked={bookmarked}
        onToggleBookmark={handleToggleBookmark}
      />
    </>
  );
}

// ─── Plan card ────────────────────────────────────────────────────────────────
function PlanCard({
  plan, currentUserId, onEdit, onLeft, onJoined,
}: {
  plan: typeof EXISTING_PLANS[0];
  currentUserId?: string;
  onEdit?: () => void;
  onLeft?: (planId: string) => void;
  onJoined?: (planId: string) => void;
}) {
  const [loadingJoin, setLoadingJoin] = useState(false);
  const isYours = plan.creator === 'You';

  const handleJoin = async () => {
    if (loadingJoin) return;
    setLoadingJoin(true);
    try {
      if (currentUserId && (plan as any).dbId) {
        await joinPlan((plan as any).dbId, currentUserId);
      }
      showToast(`Joined "${plan.title}"! 🎉`);
      onJoined?.((plan as any).dbId ?? plan.id);
    } catch {
      showToast('Connection error — check your internet');
    } finally {
      setLoadingJoin(false);
    }
  };

  const handleLeave = async () => {
    if (loadingJoin) return;
    setLoadingJoin(true);
    try {
      if (currentUserId && (plan as any).dbId) {
        await leavePlan((plan as any).dbId, currentUserId);
        try {
          const groupId = await getGroupChatForPlan((plan as any).dbId);
          if (groupId) await leaveGroup(groupId, currentUserId);
        } catch { /* silent */ }
      }
      setJoined(false);
      showToast('You left the plan');
      onLeft?.((plan as any).dbId);
    } catch {
      showToast('Connection error — check your internet');
    } finally {
      setLoadingJoin(false);
    }
  };

  return (
    <View style={[styles.planCard, isYours && styles.planCardOwn]}>
      <View style={styles.planCardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.planTitle}>{plan.title}</Text>
          <Text style={styles.planMeta}>{plan.location}  ·  {plan.time}</Text>
          <Text style={styles.planWeather}>{plan.weather}</Text>
        </View>
        <View style={styles.visBadge}>
          <Text style={styles.visBadgeText}>{visibilityLabel(plan.visibility)}</Text>
        </View>
      </View>

      <View style={styles.planFooter}>
        {/* Stacked avatars */}
        <View style={styles.avatarRow}>
          {plan.attendees.map((init, idx) => (
            <View key={idx} style={[styles.avatarStack, { left: idx * 20 }]}>
              <View style={styles.planAvatarCircle}>
                <Text style={styles.planAvatarText}>{init}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.spotsText}>{plan.spots} spots</Text>
        {!isYours ? (
          <TouchableOpacity style={styles.joinBtn} onPress={handleJoin} disabled={loadingJoin}>
            {loadingJoin
              ? <ActivityIndicator size="small" color={Colors.navy} />
              : <Text style={styles.joinBtnText}>Join</Text>}
          </TouchableOpacity>
        ) : (
          <View style={styles.yourPlanActions}>
            <Text style={styles.yourPlanText}>Your plan</Text>
            {onEdit && (
              <TouchableOpacity style={styles.editBtn} onPress={onEdit} activeOpacity={0.85}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Duration slider ─────────────────────────────────────────────────────────
// Implemented as discrete tap-targets so it works reliably inside a ScrollView
// (PanResponder-based drag gets eaten by the scroll gesture recogniser).
function DurationSlider({
  value, onChange, dark, durBg, textCol, mutedCol,
}: {
  value: number; onChange: (v: number) => void;
  dark: boolean; durBg: string; textCol: string; mutedCol: string;
}) {
  const idx = Math.max(0, DURATIONS.findIndex(d => d.value === value));

  return (
    <View style={[mst.durationWrap, { backgroundColor: durBg }]}>
      <View style={mst.durationHeaderRow}>
        <Text style={[mst.durationHeadLabel, { color: mutedCol }]}>DURATION</Text>
        <Text style={[mst.durationValueLabel, { color: textCol }]}>{DURATIONS[idx].label}</Text>
      </View>

      {/* Step track */}
      <View style={mst.durRow}>
        {DURATIONS.map((d, i) => (
          <React.Fragment key={d.value}>
            {i > 0 && (
              <View style={[
                mst.durConnector,
                i <= idx ? mst.durConnectorActive : dark && { backgroundColor: 'rgba(255,255,255,0.15)' },
              ]} />
            )}
            <TouchableOpacity
              onPress={() => onChange(d.value)}
              hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <View style={[
                mst.durDot,
                i < idx   && mst.durDotPast,
                i === idx  && mst.durDotCurrent,
                i > idx && dark && { borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'transparent' },
              ]} />
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>

      {/* Labels */}
      <View style={mst.durLabelRow}>
        {DURATIONS.map(d => (
          <Text key={d.value} style={[mst.durLabelText, { color: mutedCol }]}>{d.label}</Text>
        ))}
      </View>
    </View>
  );
}

// ─── Create plan modal — 5-step wizard ───────────────────────────────────────
const STEP_TITLES = ["Who's coming?", "See who's free", 'Where?', "What's the plan?", 'Review & send'];

export function CreatePlanModal({
  visible, onClose, onCreate, onCreated, initialValues,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate?: (plan: { id: string; title: string; location: string; time: string; weather: string }) => void;
  onCreated?: (plan: any) => void;
  initialValues?: { title?: string; location?: string; slot?: string };
}) {
  const { user } = useAuth();
  const { friends } = useFriends();
  const { slotWeather, forecastLoading } = useWeather();
  const [step, setStep] = useState<1|2|3|4|5>(1);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<'today' | 'tomorrow' | 'week'>('today');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedActivity, setSelectedActivity] = useState('');
  const [createGroupChat, setCreateGroupChat] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (visible) {
      const initSlot = initialValues?.slot ?? '';
      setStep(1); setSelectedFriends([]);
      setSelectedSlot(initSlot); setSelectedDuration(60);
      setSelectedLocation(initialValues?.location ?? ''); setSelectedActivity('');
      setCreateGroupChat(true); setCreating(false);
      if (initSlot.startsWith('tmr_')) setSelectedDay('tomorrow');
      else if (['thu','fri','sat','sun'].includes(initSlot)) setSelectedDay('week');
      else setSelectedDay('today');
    }
  }, [visible, initialValues?.location, initialValues?.slot]);

  const toggleFriend = (id: string) =>
    setSelectedFriends(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);

  const selectedFriendObjs = friends.filter(f => selectedFriends.includes(f.id));

  const autoTitle = [selectedActivity, selectedLocation ? `at ${selectedLocation}` : ''].filter(Boolean).join(' ') || 'Hangout';

  const canNext = step === 2 ? !!selectedSlot : step === 3 ? !!selectedLocation : step === 4 ? !!selectedActivity : true;

  const handleCreate = async () => {
    if (creating) return;
    const savedFriends = [...selectedFriends];
    const slotISO = slotToISO(selectedSlot || 'afternoon');
    const slotLabel = selectedSlot ? slotDisplayLabel(selectedSlot) : 'Afternoon  ·  1:00 – 3:00pm';
    const fallbackSlot = TIME_PERIODS.flatMap(p => p.slots).find(s => s.id === selectedSlot);
    const wx = slotWeather(selectedSlot || 'afternoon');
    const weatherEmoji = wx ? wx.emoji : (fallbackSlot?.weather ?? '⛅');
    const weatherTemp  = wx ? wx.temp  : (fallbackSlot?.temp  ?? 18);
    const weatherStr   = `${weatherEmoji} ${weatherTemp}°C`;

    const localPlan = { id: `u_${Date.now()}`, title: autoTitle, location: selectedLocation, time: slotLabel, weather: weatherStr };
    onClose();
    onCreate?.(localPlan);
    showToast(`Plan created! 🎉`);

    if (user) {
      setCreating(true);
      try {
        const groupEndTime = new Date(new Date(slotISO).getTime() + selectedDuration * 60 * 1000).toISOString();
        const { plan: dbPlan } = await createPlanInDB(
          {
            creator_id: user.id,
            title: autoTitle,
            location: selectedLocation,
            time: slotISO,
            visibility: 'friends',
            weather_snapshot: { emoji: weatherEmoji, temp: weatherTemp, condition: 'Forecast' },
            groupEndTime,
          },
          savedFriends
        );
        onCreated?.({
          ...localPlan, id: dbPlan.id, dbId: dbPlan.id, rawTime: slotISO,
          creator: 'You', visibility: 'FRIENDS', attendees: [], spots: 5,
        });
      } catch { /* optimistic already applied */ } finally { setCreating(false); }
    }
  };

  const goBack  = () => setStep(s => (s - 1) as any);
  const goNext  = () => setStep(s => (s + 1) as any);

  // Dark mode
  const [dark, setDarkMode] = useState(isDark());
  useEffect(() => subscribeTheme(() => setDarkMode(isDark())), []);
  const sheetBg     = dark ? '#0C1829' : Colors.white;
  const cardBg      = dark ? '#162640' : Colors.white;
  const cardBorder  = dark ? 'rgba(255,255,255,0.15)' : Colors.gray300;
  const textCol     = dark ? '#FFFFFF' : Colors.navy;
  const mutedCol    = dark ? 'rgba(255,255,255,0.5)' : Colors.gray500;
  const durBg       = dark ? '#1C3050' : Colors.gray100;
  const summaryBg   = dark ? '#1A2F50' : Colors.bluePale;
  const summaryBord = dark ? 'rgba(255,255,255,0.12)' : Colors.black;
  const dividerCol  = dark ? 'rgba(255,255,255,0.08)' : Colors.gray100;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mst.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={mst.backdrop} pointerEvents="box-only" />
        </TouchableWithoutFeedback>
        <TouchableWithoutFeedback onPress={() => {}}>
        <View style={[mst.sheet, { backgroundColor: sheetBg }]}>
          <View style={[mst.handle, dark && { backgroundColor: 'rgba(255,255,255,0.18)' }]} />

          {/* Step dots */}
          <View style={mst.stepRow}>
            {([1,2,3,4,5] as const).map((s, i) => (
              <React.Fragment key={s}>
                <View style={[mst.dot, step >= s && mst.dotActive, step === s && mst.dotCurrent, dark && step < s && { borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'transparent' }]} />
                {i < 4 && <View style={[mst.dotLine, step > s && mst.dotLineActive, dark && step <= s && { backgroundColor: 'rgba(255,255,255,0.12)' }]} />}
              </React.Fragment>
            ))}
          </View>

          {/* Title */}
          <View style={mst.header}>
            <Text style={[mst.title, { color: textCol }]}>{STEP_TITLES[step - 1]}</Text>
            <TouchableOpacity onPress={onClose} style={[mst.closeBtn, { backgroundColor: dark ? 'rgba(255,255,255,0.1)' : Colors.gray100 }]} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={18} color={textCol} />
            </TouchableOpacity>
          </View>

          {/* Scrollable content */}
          <ScrollView style={mst.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ── Step 1: Friends ── */}
            {step === 1 && (
              <>
                <Text style={[mst.hint, { color: mutedCol }]}>Tap to add them to the plan. You can skip this step.</Text>
                <FriendInviteGrid selected={selectedFriends} onToggle={toggleFriend} />
              </>
            )}

            {/* ── Step 2: When ── */}
            {step === 2 && (() => {
              const activePeriod = TIME_PERIODS.find(p => p.day === selectedDay)!;
              const onlineFriends = selectedFriendObjs;
              return (
                <>
                  {/* Day toggle */}
                  <View style={mst.dayToggleRow}>
                    {TIME_PERIODS.map(p => {
                      const active = selectedDay === p.day;
                      return (
                        <TouchableOpacity
                          key={p.day}
                          style={[mst.dayBtn, active && mst.dayBtnActive, !active && { backgroundColor: cardBg, borderColor: cardBorder }]}
                          onPress={() => { setSelectedDay(p.day as any); setSelectedSlot(''); }}
                          activeOpacity={0.8}
                        >
                          <Text style={[mst.dayBtnText, active && mst.dayBtnTextActive, !active && { color: mutedCol }]}>
                            {p.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Slots for selected day */}
                  {activePeriod.slots.map(slot => {
                    const sel = selectedSlot === slot.id;
                    const isNow = slot.id === 'now';
                    const wx = slotWeather(slot.id);
                    const emoji = wx ? wx.emoji : slot.weather;
                    const temp  = wx ? wx.temp  : slot.temp;
                    return (
                      <TouchableOpacity
                        key={slot.id}
                        style={[mst.slotCard, sel && mst.slotCardSel, !sel && { backgroundColor: cardBg, borderColor: cardBorder }]}
                        onPress={() => setSelectedSlot(slot.id)}
                        activeOpacity={0.85}
                      >
                        <View style={mst.slotTop}>
                          <View>
                            <Text style={[mst.slotLabel, sel ? mst.slotLabelSel : { color: textCol }]}>{slot.label}</Text>
                            <Text style={[mst.slotSub,   sel ? mst.slotSubSel  : { color: mutedCol }]}>{slot.sub}</Text>
                          </View>
                          <View style={mst.slotWeatherWrap}>
                            {forecastLoading
                              ? <ActivityIndicator size="small" color={sel ? 'rgba(255,255,255,0.6)' : mutedCol} />
                              : <Text style={mst.slotEmoji}>{emoji}</Text>
                            }
                            <Text style={[mst.slotTemp, sel ? mst.slotTempSel : { color: textCol }]}>{forecastLoading ? '—' : `${temp}°C`}</Text>
                          </View>
                        </View>
                        {selectedFriendObjs.length > 0 && (
                          <View style={mst.slotFriends}>
                            {selectedFriendObjs.slice(0, 5).map(f => (
                              <View key={f.id} style={mst.slotAvatar}>
                                <Text style={mst.slotAvatarTxt}>{f.avatar_initials || f.full_name.slice(0,2).toUpperCase()}</Text>
                                {isNow && <View style={mst.slotGreenDot} />}
                              </View>
                            ))}
                            <Text style={[mst.slotCount, sel ? { color: 'rgba(255,255,255,0.75)' } : { color: mutedCol }]}>
                              {isNow ? `${onlineFriends.length} free now` : `${selectedFriendObjs.length} might join`}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  {/* Duration — shown after a slot is picked */}
                  {selectedSlot && (
                    <DurationSlider value={selectedDuration} onChange={setSelectedDuration} dark={dark} durBg={durBg} textCol={textCol} mutedCol={mutedCol} />
                  )}
                </>
              );
            })()}

            {/* ── Step 3: Location ── */}
            {step === 3 && LOCATIONS_DATA.map(loc => {
              const sel = selectedLocation === loc.name;
              return (
                <TouchableOpacity
                  key={loc.name}
                  style={[mst.locCard, sel && mst.locCardSel, !sel && { backgroundColor: cardBg, borderColor: cardBorder }]}
                  onPress={() => setSelectedLocation(loc.name)}
                  activeOpacity={0.85}
                >
                  <View style={mst.locTop}>
                    <Text style={[mst.locName, sel ? mst.locNameSel : { color: textCol }]}>{loc.name}</Text>
                    <Text style={[mst.locBusy, { color: sel ? 'rgba(255,255,255,0.85)' : busynessColor(loc.busyness) }]}>
                      {busynessLabel(loc.busyness)}
                    </Text>
                  </View>
                  <View style={[mst.barBg, !sel && dark && { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                    <View style={[mst.barFill, {
                      width: `${Math.round(loc.busyness * 100)}%` as any,
                      backgroundColor: sel ? 'rgba(255,255,255,0.5)' : busynessColor(loc.busyness),
                    }]} />
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* ── Step 4: Activity ── */}
            {step === 4 && (
              <View style={mst.actGrid}>
                {ACTIVITIES.map(act => {
                  const sel = selectedActivity === act.label;
                  return (
                    <TouchableOpacity
                      key={act.id}
                      style={[mst.actBox, sel && mst.actBoxSel, !sel && { backgroundColor: cardBg, borderColor: cardBorder }]}
                      onPress={() => setSelectedActivity(act.label)}
                      activeOpacity={0.8}
                    >
                      <Text style={mst.actIcon}>{act.icon}</Text>
                      <Text style={[mst.actLabel, sel ? mst.actLabelSel : { color: textCol }]}>{act.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* ── Step 5: Summary ── */}
            {step === 5 && (
              <>
                <View style={[mst.summaryCard, { backgroundColor: summaryBg, borderColor: summaryBord }]}>
                  <View style={mst.summaryRow}>
                    <Text style={[mst.summaryKey, { color: mutedCol }]}>WITH</Text>
                    <View style={mst.summaryAvatarRow}>
                      {selectedFriendObjs.length === 0
                        ? <Text style={[mst.summaryVal, { color: textCol }]}>Just you</Text>
                        : selectedFriendObjs.slice(0, 6).map(f => (
                            <View key={f.id} style={mst.summaryAvatar}>
                              <Text style={mst.summaryAvatarTxt}>{f.avatar_initials || f.full_name.slice(0,2).toUpperCase()}</Text>
                            </View>
                          ))
                      }
                      {selectedFriendObjs.length > 6 && <Text style={[mst.summaryVal, { color: textCol }]}>+{selectedFriendObjs.length - 6}</Text>}
                    </View>
                  </View>
                  <View style={[mst.summaryDivider, { backgroundColor: dividerCol }]} />
                  <View style={mst.summaryRow}>
                    <Text style={[mst.summaryKey, { color: mutedCol }]}>WHEN</Text>
                    <Text style={[mst.summaryVal, { color: textCol }]} numberOfLines={1}>{selectedSlot ? slotDisplayLabel(selectedSlot) : '—'}</Text>
                  </View>
                  <View style={[mst.summaryDivider, { backgroundColor: dividerCol }]} />
                  <View style={mst.summaryRow}>
                    <Text style={[mst.summaryKey, { color: mutedCol }]}>FOR</Text>
                    <Text style={[mst.summaryVal, { color: textCol }]}>{DURATIONS.find(d => d.value === selectedDuration)?.label ?? '1 hr'}</Text>
                  </View>
                  <View style={[mst.summaryDivider, { backgroundColor: dividerCol }]} />
                  <View style={mst.summaryRow}>
                    <Text style={[mst.summaryKey, { color: mutedCol }]}>WHERE</Text>
                    <Text style={[mst.summaryVal, { color: textCol }]}>{selectedLocation || '—'}</Text>
                  </View>
                  <View style={[mst.summaryDivider, { backgroundColor: dividerCol }]} />
                  <View style={mst.summaryRow}>
                    <Text style={[mst.summaryKey, { color: mutedCol }]}>ACTIVITY</Text>
                    <Text style={[mst.summaryVal, { color: textCol }]}>{selectedActivity || '—'}</Text>
                  </View>
                </View>

                {/* Group chat toggle */}
                <TouchableOpacity style={[mst.chatToggleRow, { backgroundColor: durBg }]} onPress={() => setCreateGroupChat(v => !v)} activeOpacity={0.85}>
                  <View style={mst.chatToggleLeft}>
                    <Text style={[mst.chatToggleTitle, { color: textCol }]}>Create group chat</Text>
                    <Text style={[mst.chatToggleSub, { color: mutedCol }]}>A disposable chat for this plan — everyone added automatically.</Text>
                  </View>
                  <View style={[mst.toggle, createGroupChat && mst.toggleOn]}>
                    <View style={[mst.toggleThumb, createGroupChat && mst.toggleThumbOn]} />
                  </View>
                </TouchableOpacity>
              </>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Footer */}
          <View style={[mst.footer, dark && { borderTopColor: 'rgba(255,255,255,0.08)' }]}>
            {step > 1
              ? <TouchableOpacity style={[mst.backBtn, { borderColor: cardBorder }]} onPress={goBack} activeOpacity={0.85}><Text style={[mst.backBtnTxt, { color: textCol }]}>← BACK</Text></TouchableOpacity>
              : <View style={{ flex: 1 }} />
            }
            {step < 5
              ? <TouchableOpacity style={[mst.nextBtn, !canNext && mst.nextBtnOff]} onPress={goNext} disabled={!canNext} activeOpacity={0.85}>
                  <Text style={mst.nextBtnTxt}>NEXT →</Text>
                </TouchableOpacity>
              : <TouchableOpacity style={[mst.nextBtn, creating && { opacity: 0.6 }]} onPress={handleCreate} disabled={creating} activeOpacity={0.85}>
                  {creating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={mst.nextBtnTxt}>SEND PLAN →</Text>}
                </TouchableOpacity>
            }
          </View>
        </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
}

// ─── Invite card ─────────────────────────────────────────────────────────────
function InviteCard({
  invite,
  userId,
  onAccepted,
  onDeclined,
}: {
  invite: PendingInviteDisplay;
  userId: string;
  onAccepted: (inviteId: string) => void;
  onDeclined: (inviteId: string) => void;
}) {
  const [loadingAccept, setLoadingAccept] = useState(false);
  const [loadingDecline, setLoadingDecline] = useState(false);

  const handleAccept = async () => {
    if (loadingAccept || loadingDecline) return;
    setLoadingAccept(true);
    try {
      await acceptPlanInvite(invite.inviteId, invite.planId, userId);
      onAccepted(invite.inviteId);
    } catch {
      setLoadingAccept(false);
    }
  };

  const handleDecline = async () => {
    if (loadingAccept || loadingDecline) return;
    setLoadingDecline(true);
    try {
      await declinePlanInvite(invite.inviteId);
      onDeclined(invite.inviteId);
    } catch {
      setLoadingDecline(false);
    }
  };

  return (
    <View style={styles.inviteCard}>
      <Text style={styles.inviteTitle}>{invite.title}</Text>
      <Text style={styles.inviteMeta}>{invite.location}  ·  {formatPlanTime(invite.time)}</Text>
      {invite.weather && (
        <Text style={styles.inviteWeather}>{invite.weather.emoji} {invite.weather.temp}°C</Text>
      )}
      <Text style={styles.inviteFrom}>From {invite.creatorName}</Text>
      <View style={styles.inviteActions}>
        <TouchableOpacity
          style={[styles.inviteDeclineBtn, loadingDecline && { opacity: 0.6 }]}
          onPress={handleDecline}
          disabled={loadingAccept || loadingDecline}
          activeOpacity={0.85}
        >
          {loadingDecline
            ? <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
            : <Text style={styles.inviteDeclineBtnText}>Decline</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.inviteAcceptBtn, loadingAccept && { opacity: 0.6 }]}
          onPress={handleAccept}
          disabled={loadingAccept || loadingDecline}
          activeOpacity={0.85}
        >
          {loadingAccept
            ? <ActivityIndicator size="small" color={Colors.navy} />
            : <Text style={styles.inviteAcceptBtnText}>Accept</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Plan edit sheet ──────────────────────────────────────────────────────────
function PlanEditSheet({
  plan, visible, onClose, userId, onUpdated, onCancelled,
}: {
  plan: any;
  visible: boolean;
  onClose: () => void;
  userId: string;
  onUpdated: (planId: string, updates: { title?: string; location?: string; time?: string; rawTime?: string }) => void;
  onCancelled: (planId: string) => void;
}) {
  const [customTitle, setCustomTitle] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedDay, setSelectedDay] = useState<'today' | 'tomorrow' | 'week'>('today');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [inviteIds, setInviteIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const sheetY = useRef(new Animated.Value(900)).current;

  useEffect(() => {
    if (visible && plan) {
      setCustomTitle(plan.title || '');
      setSelectedLocation(plan.location || '');
      setSelectedDay('today');
      setSelectedSlot('');
      setInviteIds([]);
      setSaving(false);
      setCancelling(false);
      setConfirmCancel(false);
      sheetY.setValue(900);
      Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
    }
  }, [visible, plan?.dbId]);

  const handleClose = () => {
    Animated.spring(sheetY, { toValue: 900, useNativeDriver: true, damping: 22, stiffness: 200 }).start(() => onClose());
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const updates: any = {};
      const trimmedTitle = customTitle.trim();
      if (trimmedTitle && trimmedTitle !== plan.title) updates.title = trimmedTitle;
      if (selectedLocation && selectedLocation !== plan.location) updates.location = selectedLocation;
      const slotISO = selectedSlot ? slotToISO(selectedSlot) : null;
      if (slotISO) updates.time = slotISO;

      if (Object.keys(updates).length > 0) {
        await updatePlan(plan.dbId, updates);
        try {
          const groupId = await getGroupChatForPlan(plan.dbId);
          if (groupId) {
            const parts: string[] = [];
            if (updates.title) parts.push(`renamed to "${updates.title}"`);
            if (updates.location) parts.push(`moved to ${updates.location}`);
            if (updates.time) parts.push(`rescheduled to ${formatPlanTime(updates.time)}`);
            if (parts.length) await sendSystemMessage(groupId, userId, `📢 Plan ${parts.join(', ')}.`);
          }
        } catch { /* silent */ }
        onUpdated(plan.dbId, {
          ...(updates.title ? { title: updates.title } : {}),
          ...(updates.location ? { location: updates.location } : {}),
          ...(slotISO ? { time: formatPlanTime(slotISO), rawTime: slotISO } : {}),
        });
      }

      if (inviteIds.length > 0) {
        await inviteMoreToPlan(plan.dbId, inviteIds);
        showToast(`Invited ${inviteIds.length} friend${inviteIds.length > 1 ? 's' : ''}! ✅`);
      } else if (Object.keys(updates).length > 0) {
        showToast('Plan updated! ✅');
      }

      if (Object.keys(updates).length === 0 && inviteIds.length === 0) {
        handleClose();
        return;
      }
      handleClose();
    } catch {
      showToast('Connection error — check your internet');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!confirmCancel) { setConfirmCancel(true); return; }
    if (cancelling) return;
    setCancelling(true);
    try {
      await cancelPlan(plan.dbId);
      try {
        const groupId = await getGroupChatForPlan(plan.dbId);
        if (groupId) await sendSystemMessage(groupId, userId, '📢 This plan has been cancelled.');
      } catch { /* silent */ }
      showToast('Plan cancelled');
      onCancelled(plan.dbId);
      handleClose();
    } catch {
      showToast('Connection error — check your internet');
    } finally {
      setCancelling(false);
    }
  };

  if (!plan) return null;

  const activePeriod = TIME_PERIODS.find(p => p.day === selectedDay)!;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.sheetBackdrop} pointerEvents="box-only" />
        </TouchableWithoutFeedback>
        <Animated.View style={[est.sheet, { transform: [{ translateY: sheetY }] }]}>
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeaderRow}>
            <Text style={[styles.sheetTitle, { flex: 1 }]}>Edit Plan</Text>
            <TouchableOpacity onPress={handleClose} style={styles.sheetCloseBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={18} color={Colors.navy} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Title */}
            <Text style={est.fieldLabel}>TITLE</Text>
            <TextInput
              style={est.textInput}
              value={customTitle}
              onChangeText={setCustomTitle}
              placeholder="Plan title..."
              placeholderTextColor={Colors.gray300}
            />

            {/* Location */}
            <Text style={[est.fieldLabel, { marginTop: 16 }]}>LOCATION</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={est.chipScroll}>
              {LOCATIONS_DATA.map(loc => {
                const sel = selectedLocation === loc.name;
                return (
                  <TouchableOpacity
                    key={loc.name}
                    style={[est.chip, sel && est.chipActive]}
                    onPress={() => setSelectedLocation(loc.name)}
                    activeOpacity={0.85}
                  >
                    <Text style={[est.chipText, sel && est.chipTextActive]}>{loc.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Time */}
            <Text style={[est.fieldLabel, { marginTop: 16 }]}>CHANGE TIME</Text>
            <View style={est.dayToggleRow}>
              {TIME_PERIODS.map(p => (
                <TouchableOpacity
                  key={p.day}
                  style={[est.dayBtn, selectedDay === p.day && est.dayBtnActive]}
                  onPress={() => { setSelectedDay(p.day as any); setSelectedSlot(''); }}
                  activeOpacity={0.8}
                >
                  <Text style={[est.dayBtnText, selectedDay === p.day && est.dayBtnTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {activePeriod.slots.map(slot => {
              const sel = selectedSlot === slot.id;
              return (
                <TouchableOpacity
                  key={slot.id}
                  style={[est.slotRow, sel && est.slotRowActive]}
                  onPress={() => setSelectedSlot(slot.id)}
                  activeOpacity={0.85}
                >
                  <View>
                    <Text style={[est.slotLabel, sel && est.slotLabelActive]}>{slot.label}</Text>
                    <Text style={[est.slotSub, sel && est.slotSubActive]}>{slot.sub}</Text>
                  </View>
                  {sel && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                </TouchableOpacity>
              );
            })}

            {/* Add more people */}
            <Text style={[est.fieldLabel, { marginTop: 16 }]}>ADD PEOPLE</Text>
            <FriendInviteGrid
              selected={inviteIds}
              onToggle={(id) => setInviteIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
            />

            {/* Cancel plan */}
            <TouchableOpacity
              style={[est.cancelBtn, confirmCancel && est.cancelBtnConfirm, cancelling && { opacity: 0.6 }]}
              onPress={handleCancel}
              disabled={cancelling}
              activeOpacity={0.85}
            >
              {cancelling
                ? <ActivityIndicator size="small" color={confirmCancel ? '#FFFFFF' : '#CC3333'} />
                : <Text style={[est.cancelBtnText, confirmCancel && est.cancelBtnTextConfirm]}>
                    {confirmCancel ? 'Tap again to confirm cancel' : 'Cancel Plan'}
                  </Text>
              }
            </TouchableOpacity>

            <View style={{ height: 120 }} />
          </ScrollView>

          {/* Save */}
          <View style={est.footer}>
            <TouchableOpacity
              style={[est.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={est.saveBtnText}>SAVE CHANGES</Text>
              }
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Plans screen ─────────────────────────────────────────────────────────────
export default function PlansScreen({ onModalChange }: { onModalChange?: (open: boolean) => void }) {
  const [dark, setDarkMode] = useState(isDark());
  useEffect(() => subscribeTheme(() => setDarkMode(isDark())), []);

  const bg = dark ? DarkTheme.bg : Colors.lightGrey;
  const surface = dark ? DarkTheme.surface : '#E0E2E9';
  const textPrimary = dark ? DarkTheme.text : Colors.navy;
  const textMuted = dark ? DarkTheme.textMuted : Colors.gray500;

  const { user } = useAuth();
  const { friends: allFriends, loading: friendsLoading } = useFriends();
  const onlineFriends = allFriends;
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState<{ title: string; location: string } | null>(null);
  const [editSheetPlan, setEditSheetPlan] = useState<any>(null);
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  // My plans (created or already joined) shown first; public plans by others shown below
  const [myDbPlans, setMyDbPlans] = useState<typeof EXISTING_PLANS>([]);
  const [joinablePlans, setJoinablePlans] = useState<typeof EXISTING_PLANS>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notifOn, setNotifOn] = useState(true);
  const [pendingInvites, setPendingInvites] = useState<PendingInviteDisplay[]>([]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const toPlanRow = useCallback((p: Plan, uid: string) => ({
    id: p.id,
    dbId: p.id,
    rawTime: p.time,
    title: p.title,
    creator: (p as any).creator_id === uid ? 'You' : ((p as any).creator?.full_name ?? 'Unknown'),
    location: p.location,
    time: formatPlanTime(p.time),
    visibility: p.visibility.toUpperCase(),
    attendees: (p.attendees ?? []).map((a: any) => a.user?.avatar_initials ?? '??').slice(0, 4),
    spots: 5,
    weather: p.weather_snapshot
      ? `${(p.weather_snapshot as any).emoji} ${(p.weather_snapshot as any).temp}°C`
      : '⛅ —',
  }), []);

  const fetchPlans = useCallback(async () => {
    if (!user) return;
    const [mine, pub] = await Promise.all([getMyPlans(user.id), getPublicPlans()]);
    const myIds = new Set(mine.map(p => p.id));
    setMyDbPlans(sortByTime(mine.map(p => toPlanRow(p, user.id))) as any);
    setJoinablePlans(sortByTime(
      pub
        .filter(p => (p as any).creator_id !== user.id && !myIds.has(p.id))
        .map(p => toPlanRow(p, user.id))
    ) as any);
  }, [user?.id, toPlanRow]);

  useEffect(() => {
    setLoadingPlans(true);
    fetchPlans().finally(() => setLoadingPlans(false));
  }, [fetchPlans]);

  useEffect(() => {
    if (!user) return;
    getPendingInvites(user.id).then(setPendingInvites);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToPlanInvites(user.id, (invite) => {
      setPendingInvites(prev => {
        if (prev.some(i => i.inviteId === invite.inviteId)) return prev;
        return [invite, ...prev];
      });
    });
    return unsub;
  }, [user?.id]);

  useEffect(() => {
    notifyPlanInviteCount(pendingInvites.length);
  }, [pendingInvites.length]);

  const handleInviteAccepted = useCallback(async (inviteId: string) => {
    setPendingInvites(prev => prev.filter(i => i.inviteId !== inviteId));
    await fetchPlans();
  }, [fetchPlans]);

  const handleInviteDeclined = useCallback((inviteId: string) => {
    setPendingInvites(prev => prev.filter(i => i.inviteId !== inviteId));
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const tasks: Promise<any>[] = [fetchPlans()];
    if (user) tasks.push(getPendingInvites(user.id).then(setPendingInvites));
    await Promise.all(tasks);
    setRefreshing(false);
  }, [fetchPlans, user?.id]);

  const handlePlanUpdated = useCallback((planId: string, updates: { title?: string; location?: string; time?: string; rawTime?: string }) => {
    setMyDbPlans(prev => prev.map(p => (p as any).dbId === planId ? { ...p, ...updates } : p) as any);
  }, []);

  const handlePlanCancelled = useCallback((planId: string) => {
    setMyDbPlans(prev => prev.filter(p => (p as any).dbId !== planId));
  }, []);

  const handlePlanLeft = useCallback((planId: string) => {
    setMyDbPlans(prev => prev.filter(p => (p as any).dbId !== planId));
  }, []);

  // When a user joins a public plan: remove from joinable list and add to my plans
  const handlePlanJoined = useCallback((planId: string) => {
    setJoinablePlans(prev => {
      const plan = prev.find(p => (p as any).dbId === planId);
      if (plan) {
        const updated = { ...plan, creator: 'You' } as any;
        setMyDbPlans(mp => sortByTime([updated, ...mp]) as any);
      }
      return prev.filter(p => (p as any).dbId !== planId);
    });
  }, []);

  const activeMyPlans = myDbPlans.length > 0 ? myDbPlans : EXISTING_PLANS.filter(p => p.creator === 'You');
  const activeJoinable = joinablePlans.length > 0 ? joinablePlans : EXISTING_PLANS.filter(p => p.creator !== 'You');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={bg === Colors.lightGrey ? '#001845' : '#FFFFFF'}
            colors={['#001845']}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: textMuted }]}>{greeting}</Text>
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

        {/* ── Invited to ── */}
        {pendingInvites.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: textPrimary }]}>Invited to</Text>
            {pendingInvites.map(invite => (
              <InviteCard
                key={invite.inviteId}
                invite={invite}
                userId={user!.id}
                onAccepted={handleInviteAccepted}
                onDeclined={handleInviteDeclined}
              />
            ))}
          </>
        )}

        {/* ── Make Plan ── */}
        <TouchableOpacity style={styles.createCta} onPress={() => { setModalVisible(true); onModalChange?.(true); }} activeOpacity={0.85}>
          <Text style={styles.ctaTitle}>Make Plan</Text>
          <Ionicons name="chevron-forward" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        {/* ── Who's free now ── */}
        <Text style={[styles.sectionLabel, { color: textPrimary }]}>Who's free now</Text>
        <View style={[styles.whosFreeCard, { backgroundColor: surface }]}>
          {friendsLoading ? (
            <ActivityIndicator color={Colors.navy} />
          ) : onlineFriends.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {onlineFriends.map(f => (
                <View key={f.id} style={styles.freeAvatarWrap}>
                  <View style={styles.freeAvatarCircle}>
                    <Text style={styles.freeAvatarInitials}>{f.avatar_initials}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.freeAvatarRow}>
              {[0, 1, 2, 3].map(i => (
                <View key={i} style={styles.freeAvatarPlaceholder} />
              ))}
            </View>
          )}
        </View>

        {/* ── Suggested for today ── */}
        <Text style={[styles.sectionLabel, { color: textPrimary }]}>Suggested for today</Text>
        {SUGGESTED_PLANS.map(plan => (
          <SuggestedCard key={plan.id} plan={plan} onModalChange={onModalChange} />
        ))}

        {/* ── My Plans ── */}
        <Text style={[styles.sectionLabel, { marginTop: 8, color: textPrimary }]}>My plans</Text>
        {loadingPlans && (
          <ActivityIndicator color={Colors.navy} style={{ marginBottom: 12 }} />
        )}
        {activeMyPlans.length === 0 && !loadingPlans && (
          <Text style={[styles.emptyHint, { color: textMuted }]}>No plans yet — make one above.</Text>
        )}
        {activeMyPlans.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            currentUserId={user?.id}
            onEdit={plan.creator === 'You'
              ? () => { setEditSheetPlan(plan); setEditSheetVisible(true); onModalChange?.(true); }
              : undefined}
            onLeft={handlePlanLeft}
          />
        ))}

        {/* ── Join a plan ── */}
        {(activeJoinable.length > 0 || loadingPlans) && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 8, color: textPrimary }]}>Join a plan</Text>
            {activeJoinable.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                currentUserId={user?.id}
                onJoined={handlePlanJoined}
              />
            ))}
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <CreatePlanModal
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setEditingPlan(null); onModalChange?.(false); }}
        initialValues={editingPlan ?? undefined}
        onCreated={newPlan => {
          setMyDbPlans(prev => sortByTime([newPlan, ...prev]) as any);
        }}
      />

      {editSheetPlan && (
        <PlanEditSheet
          plan={editSheetPlan}
          visible={editSheetVisible}
          onClose={() => { setEditSheetVisible(false); onModalChange?.(false); }}
          userId={user!.id}
          onUpdated={handlePlanUpdated}
          onCancelled={handlePlanCancelled}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.lightGrey },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },

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
    color: Colors.navy,
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
  },

  emptyHint: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.gray500,
    marginBottom: 16,
  },

  // Make Plan CTA
  createCta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#001845',
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 22,
    marginBottom: 28,
  },
  ctaTitle: {
    fontSize: 22,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },

  // Section labels
  sectionLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.navy,
    marginBottom: 12,
    marginTop: 4,
  },

  // Who's free card
  whosFreeCard: {
    backgroundColor: '#E0E2E9',
    borderRadius: 16,
    padding: 18,
    marginBottom: 28,
  },
  freeAvatarRow: {
    flexDirection: 'row',
    gap: 14,
  },
  freeAvatarWrap: {
    marginRight: 14,
  },
  freeAvatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.bluePale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeAvatarInitials: {
    fontSize: 16,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
  },
  freeAvatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#C8CAD3',
  },

  // Suggested cards — centered, fully rounded, tick slightly lighter
  suggestedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  suggestedCard: {
    flex: 1,
    backgroundColor: Colors.navy,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
  },
  bookmarkTab: {
    width: 54,
    height: 54,
    backgroundColor: Colors.navy,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkTabActive: {
    backgroundColor: '#003080',
  },
  suggestedTitle: {
    fontSize: 20,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  suggestedMeta: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: Typography.weights.medium,
  },
  suggestedWeather: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.38)',
    fontWeight: Typography.weights.medium,
    marginTop: 4,
  },

  // Plan cards — dark navy
  planCard: {
    backgroundColor: Colors.navy,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  planCardOwn: {
    backgroundColor: '#002060',
  },
  planCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  planTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 3,
  },
  planMeta: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: Typography.weights.medium,
  },
  planWeather: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.38)',
    fontWeight: Typography.weights.medium,
    marginTop: 2,
  },
  visBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
    marginTop: 2,
  },
  visBadgeText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
  planFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarRow: {
    flexDirection: 'row',
    position: 'relative',
    height: 30,
    flex: 1,
  },
  avatarStack: { position: 'absolute' },
  planAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planAvatarText: {
    fontSize: 9,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
  },
  spotsText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: Typography.weights.medium,
    marginRight: 10,
  },
  joinBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  joinBtnText: {
    fontSize: 12,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
  },
  joinedBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  joinedBtnText: {
    fontSize: 12,
    fontWeight: Typography.weights.black,
    color: 'rgba(255,255,255,0.9)',
  },
  yourPlanActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  yourPlanText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
  },
  editBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
  },

  // Avatar (used in FriendInviteGrid)
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: Typography.weights.black },

  // FriendInviteGrid
  friendGridEmpty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  friendGridEmptyText: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, color: Colors.navy },
  friendGridEmptyHint: { fontSize: Typography.sizes.sm, color: Colors.gray500, textAlign: 'center', lineHeight: 20 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  legendText: { fontSize: 10, color: Colors.gray500, fontWeight: Typography.weights.medium },
  friendGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  friendCell: { alignItems: 'center', justifyContent: 'center', height: 90, gap: 4 },
  friendCellName: { fontSize: 11, fontWeight: Typography.weights.black, color: Colors.navy, textAlign: 'center' },
  friendCellNameBusy: { color: Colors.gray500 },
  friendCellNameSelected: { color: Colors.navy },
  friendCellStatus: { fontSize: 9, fontWeight: Typography.weights.medium, textAlign: 'center' },
  tickBadge: {
    position: 'absolute',
    width: 18, height: 18,
    borderRadius: 9,
    backgroundColor: Colors.navy,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickText: { fontSize: 9, color: Colors.white, fontWeight: Typography.weights.black },
  selectedSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bluePale,
    borderWidth: 1,
    borderColor: Colors.black,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  selectedSummaryText: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, color: Colors.navy },
  clearText: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.bold, color: Colors.blue },

  // Detail sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  detailSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 24,
  },
  sheetHandle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gray300,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    letterSpacing: -0.5,
  },
  sheetCloseBtn: {
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  sheetDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sheetDetailText: {
    fontSize: Typography.sizes.sm,
    color: Colors.navy,
    fontWeight: Typography.weights.medium,
  },
  sheetReason: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray500,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  sheetSectionLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
    color: Colors.gray500,
    marginBottom: 12,
  },
  sheetFriendRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  sheetFriendItem: {
    alignItems: 'center',
    gap: 6,
  },
  sheetFriendCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.bluePale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetFriendInitials: {
    fontSize: 14,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
  },
  sheetFriendName: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.navy,
  },
  addDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.navy,
    borderRadius: 12,
    paddingVertical: 15,
  },
  addDayBtnActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  addDayBtnText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    letterSpacing: 0.3,
  },
  addDayBtnTextActive: {
    color: '#FFFFFF',
  },

  // Invite cards
  inviteCard: {
    backgroundColor: Colors.navy,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  inviteTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 3,
  },
  inviteMeta: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: Typography.weights.medium,
  },
  inviteWeather: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.38)',
    fontWeight: Typography.weights.medium,
    marginTop: 2,
  },
  inviteFrom: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: Typography.weights.medium,
    marginTop: 4,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  inviteDeclineBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteDeclineBtnText: {
    fontSize: 13,
    fontWeight: Typography.weights.black,
    color: 'rgba(255,255,255,0.7)',
  },
  inviteAcceptBtn: {
    flex: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteAcceptBtnText: {
    fontSize: 13,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
  },

  // CreatePlanModal
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 8 },
  stepDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.gray100,
    borderWidth: 2, borderColor: Colors.gray300,
  },
  stepDotActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.gray100, marginHorizontal: 6 },
  stepLineActive: { backgroundColor: Colors.navy },
  inviteSubtitle: { fontSize: Typography.sizes.sm, color: Colors.gray500, marginBottom: 16, lineHeight: 20 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: Colors.black,
    padding: 24,
    maxHeight: '92%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: Typography.sizes.xl, fontWeight: Typography.weights.black, color: Colors.navy, letterSpacing: -0.5 },
  modalClose: { fontSize: Typography.sizes.lg, color: Colors.gray500, fontWeight: Typography.weights.bold },
  fieldLabel: { fontSize: Typography.sizes.xs, fontWeight: Typography.weights.black, letterSpacing: 2, color: Colors.gray500, marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.black,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: Typography.sizes.md,
    color: Colors.black,
    fontWeight: Typography.weights.medium,
    marginBottom: 18,
  },
  chipScroll: { marginBottom: 18 },
  chip: {
    borderWidth: 1,
    borderColor: Colors.black,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: Colors.white,
  },
  timeChip: {
    borderWidth: 1,
    borderColor: Colors.black,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: Colors.white,
  },
  chipActive: { backgroundColor: Colors.navy },
  chipText: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.bold, color: Colors.navy },
  chipTextActive: { color: Colors.white },
  visRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  visBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.black, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  visBtnActive: { backgroundColor: Colors.navy },
  visBtnText: { fontSize: 11, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.navy },
  visBtnTextActive: { color: Colors.white },
  publicNote: {
    backgroundColor: Colors.greenLight,
    borderWidth: 1,
    borderColor: Colors.black,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  publicNoteText: { fontSize: Typography.sizes.xs, color: Colors.green, fontWeight: Typography.weights.bold, letterSpacing: 0.5 },
  weatherPreview: {
    backgroundColor: Colors.bluePale,
    borderWidth: 1,
    borderColor: Colors.black,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  weatherPreviewLabel: { fontSize: 10, fontWeight: Typography.weights.black, letterSpacing: 2, color: Colors.blue, marginBottom: 4 },
  weatherPreviewValue: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.medium, color: Colors.navy },
  primaryBtn: {
    backgroundColor: Colors.navy,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: Colors.white, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, letterSpacing: 2 },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 8 },
  backBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.black, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  backBtnText: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, letterSpacing: 2, color: Colors.navy },
  createBtn: {
    flex: 2,
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createBtnText: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, letterSpacing: 2, color: Colors.white },
});

// ─── Modal styles (5-step wizard) ────────────────────────────────────────────
const mst = StyleSheet.create({
  // Shell
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: Colors.black,
    paddingTop: 16,
    paddingHorizontal: 24,
    maxHeight: '90%',
  },
  handle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gray300,
    alignSelf: 'center',
    marginBottom: 16,
  },

  // Step indicator
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.gray100,
    borderWidth: 1.5, borderColor: Colors.gray300,
  },
  dotActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  dotCurrent: { width: 22, height: 8, borderRadius: 4, backgroundColor: Colors.navy, borderColor: Colors.navy },
  dotLine: { flex: 1, height: 2, backgroundColor: Colors.gray100, marginHorizontal: 4 },
  dotLineActive: { backgroundColor: Colors.navy },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: Typography.weights.black, color: Colors.navy, letterSpacing: -0.5 },
  closeBtn: {
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Body
  body: { marginTop: 16 },
  hint: { fontSize: Typography.sizes.sm, color: Colors.gray500, marginBottom: 16, lineHeight: 20 },

  // Step 2 — time slots
  periodSection: { marginBottom: 20 },
  periodLabel: { fontSize: 10, fontWeight: Typography.weights.black, letterSpacing: 2.5, color: Colors.gray500, marginBottom: 10 },
  slotCard: {
    borderWidth: 1.5, borderColor: Colors.gray300,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    backgroundColor: Colors.white,
  },
  slotCardSel: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  slotTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  slotLabel: { fontSize: Typography.sizes.md, fontWeight: Typography.weights.black, color: Colors.navy, marginBottom: 2 },
  slotLabelSel: { color: '#FFFFFF' },
  slotSub: { fontSize: 11, color: Colors.gray500, fontWeight: Typography.weights.medium },
  slotSubSel: { color: 'rgba(255,255,255,0.65)' },
  slotWeatherWrap: { alignItems: 'flex-end' },
  slotEmoji: { fontSize: 18, marginBottom: 2 },
  slotTemp: { fontSize: 12, fontWeight: Typography.weights.bold, color: Colors.navy },
  slotTempSel: { color: 'rgba(255,255,255,0.9)' },
  slotFriends: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4 },
  slotAvatar: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.bluePale,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  slotAvatarTxt: { fontSize: 8, fontWeight: Typography.weights.black, color: Colors.navy },
  slotGreenDot: {
    position: 'absolute',
    bottom: -1, right: -1,
    width: 7, height: 7,
    borderRadius: 3.5,
    backgroundColor: '#4CAF50',
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  slotCount: { fontSize: 11, color: Colors.gray500, fontWeight: Typography.weights.medium, marginLeft: 4 },

  // Step 3 — location
  locCard: {
    borderWidth: 1.5, borderColor: Colors.gray300,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    backgroundColor: Colors.white,
  },
  locCardSel: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  locTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  locName: { fontSize: Typography.sizes.md, fontWeight: Typography.weights.black, color: Colors.navy },
  locNameSel: { color: '#FFFFFF' },
  locBusy: { fontSize: 11, fontWeight: Typography.weights.bold },
  barBg: { height: 5, borderRadius: 3, backgroundColor: Colors.gray100, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 3 },

  // Step 4 — activity grid
  actGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', paddingVertical: 8 },
  actBox: {
    width: ACT_BOX_W, height: ACT_BOX_W,
    borderWidth: 1.5, borderColor: Colors.gray300,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.white,
  },
  actBoxSel: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  actIcon: { fontSize: 24 },
  actLabel: { fontSize: 11, fontWeight: Typography.weights.black, color: Colors.navy, textAlign: 'center' },
  actLabelSel: { color: '#FFFFFF' },

  // Step 5 — summary
  summaryCard: {
    backgroundColor: Colors.bluePale,
    borderWidth: 1.5, borderColor: Colors.black,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  summaryKey: { fontSize: 10, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.gray500 },
  summaryVal: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, color: Colors.navy, flex: 1, textAlign: 'right' },
  summaryDivider: { height: 1, backgroundColor: Colors.gray100 },
  summaryAvatarRow: { flexDirection: 'row', gap: 4, alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  summaryAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryAvatarTxt: { fontSize: 9, fontWeight: Typography.weights.black, color: '#FFFFFF' },

  // Group chat toggle
  chatToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.gray100,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  chatToggleLeft: { flex: 1 },
  chatToggleTitle: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, color: Colors.navy, marginBottom: 3 },
  chatToggleSub: { fontSize: 11, color: Colors.gray500, lineHeight: 16 },
  toggle: {
    width: 46, height: 26,
    borderRadius: 13,
    backgroundColor: Colors.gray300,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: { backgroundColor: Colors.navy },
  toggleThumb: {
    width: 20, height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleThumbOn: { alignSelf: 'flex-end' },

  // Footer nav
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    paddingBottom: 32,
  },
  backBtn: {
    flex: 1,
    borderWidth: 1.5, borderColor: Colors.navy,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backBtnTxt: { fontSize: 12, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.navy },
  nextBtn: {
    flex: 2,
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextBtnOff: { opacity: 0.35 },
  nextBtnTxt: { fontSize: 12, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: '#FFFFFF' },

  // Day toggle (step 2)
  dayToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  dayBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.gray300,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  dayBtnActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  dayBtnText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 1.5,
    color: Colors.navy,
  },
  dayBtnTextActive: { color: '#FFFFFF' },

  // Duration slider (step 2)
  durationWrap: {
    marginTop: 20,
    marginBottom: 8,
    padding: 16,
    backgroundColor: Colors.gray100,
    borderRadius: 14,
  },
  durationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  durationHeadLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
    color: Colors.gray500,
  },
  durationValueLabel: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
  },
  durRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  durConnector: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.gray300,
  },
  durConnectorActive: {
    backgroundColor: Colors.navy,
  },
  durDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.gray300,
  },
  durDotPast: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  durDotCurrent: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.navy,
    borderWidth: 3,
    borderColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 4,
  },
  durLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  durLabelText: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    color: Colors.gray500,
    textAlign: 'center',
  },
});

// ─── Edit sheet styles ────────────────────────────────────────────────────────
const est = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 2, borderLeftWidth: 2, borderRightWidth: 2,
    borderColor: Colors.black,
    paddingTop: 16,
    paddingHorizontal: 20,
    maxHeight: '92%',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
    color: Colors.gray500,
    marginBottom: 10,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: Colors.black,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: Typography.sizes.md,
    color: Colors.navy,
    fontWeight: Typography.weights.medium,
    backgroundColor: Colors.white,
  },
  chipScroll: {
    gap: 8,
    paddingBottom: 4,
    flexDirection: 'row',
  },
  chip: {
    borderWidth: 1.5,
    borderColor: Colors.gray300,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.white,
  },
  chipActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  chipText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.navy,
  },
  chipTextActive: { color: '#FFFFFF' },
  dayToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  dayBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.gray300,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  dayBtnActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  dayBtnText: { fontSize: 9, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.navy },
  dayBtnTextActive: { color: '#FFFFFF' },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: Colors.gray300,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
    backgroundColor: Colors.white,
  },
  slotRowActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  slotLabel: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, color: Colors.navy, marginBottom: 2 },
  slotLabelActive: { color: '#FFFFFF' },
  slotSub: { fontSize: 11, color: Colors.gray500, fontWeight: Typography.weights.medium },
  slotSubActive: { color: 'rgba(255,255,255,0.7)' },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: '#CC3333',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 20,
  },
  cancelBtnConfirm: { backgroundColor: '#CC3333' },
  cancelBtnText: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, color: '#CC3333' },
  cancelBtnTextConfirm: { color: '#FFFFFF' },
  footer: {
    paddingTop: 14,
    paddingBottom: 34,
  },
  saveBtn: {
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 12, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: '#FFFFFF' },
});
