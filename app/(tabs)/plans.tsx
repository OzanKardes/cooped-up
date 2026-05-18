import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Borders, Shadows } from '../../constants/theme';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { getMyPlans, getPublicPlans, createPlan as createPlanInDB, joinPlan, leavePlan, formatPlanTime } from '../../services/plans';
import type { Plan } from '../../types';
import { useFriends } from '../../hooks/useFriends';

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
  },
  {
    id: 's2',
    title: 'Revision outside',
    location: 'Beit Quad',
    time: 'Today, 2pm',
    weather: '⛅ 18°C — good',
    reason: 'Light cloud cover — ideal for outdoor studying.',
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

const VISIBILITY_OPTIONS = ['PUBLIC', 'FRIENDS', 'INVITE'];
const LOCATIONS = ["Queen's Lawn", 'Beit Quad', 'SAF Terrace', 'JCR', 'Library', 'Hyde Park', 'Other'];
const DATE_OPTIONS = ['Today', 'Tomorrow', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'];
const TIME_OPTIONS = [
  '8:00am', '8:30am', '9:00am', '9:30am', '10:00am', '10:30am',
  '11:00am', '11:30am', '12:00pm', '12:30pm', '1:00pm', '1:30pm',
  '2:00pm', '2:30pm', '3:00pm', '3:30pm', '4:00pm', '4:30pm',
  '5:00pm', '5:30pm', '6:00pm', '6:30pm', '7:00pm', '7:30pm',
  '8:00pm', '8:30pm', '9:00pm',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sortByTime(plans: any[]) {
  return [...plans].sort((a, b) => {
    if (!a.rawTime && !b.rawTime) return 0;
    if (!a.rawTime) return 1;
    if (!b.rawTime) return -1;
    return new Date(a.rawTime).getTime() - new Date(b.rawTime).getTime();
  });
}

function visibilityColor(v: string) {
  switch (v) {
    case 'PUBLIC':  return { bg: Colors.greenLight,  text: Colors.green };
    case 'FRIENDS': return { bg: Colors.bluePale,    text: Colors.blue };
    case 'INVITE':  return { bg: Colors.cream,       text: Colors.navy };
    default:        return { bg: Colors.gray100,     text: Colors.gray700 };
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
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.bluePale, borderColor: Colors.black }]} />
          <Text style={styles.legendText}>Online now</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.gray100, borderColor: Colors.gray300 }]} />
          <Text style={styles.legendText}>Offline</Text>
        </View>
      </View>

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
                <Avatar initials={friend.avatar_initials} size={42} selected={isSelected} free={friend.is_online} />
                {isSelected && (
                  <View style={[styles.tickBadge, { top: -2, right: -2 }]}>
                    <Text style={styles.tickText}>✓</Text>
                  </View>
                )}
              </View>
              <Text style={[
                styles.friendCellName,
                !friend.is_online && styles.friendCellNameBusy,
                isSelected && styles.friendCellNameSelected,
              ]}>
                {friend.full_name.split(' ')[0]}
              </Text>
              <Text style={[styles.friendCellStatus, { color: friend.is_online ? Colors.green : Colors.gray500 }]}>
                {friend.is_online ? 'Online now' : 'Offline'}
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

// ─── Suggested card ───────────────────────────────────────────────────────────
function SuggestedCard({ plan, onUse }: { plan: typeof SUGGESTED_PLANS[0]; onUse: () => void }) {
  return (
    <View style={styles.suggestedCard}>
      <View style={styles.suggestedTop}>
        <View style={styles.aiTag}>
          <Text style={styles.aiTagText}>AI SUGGESTED</Text>
        </View>
        <Text style={styles.suggestedWeather}>{plan.weather}</Text>
      </View>
      <Text style={styles.suggestedTitle}>{plan.title}</Text>
      <Text style={styles.suggestedMeta}>{plan.location} · {plan.time}</Text>
      <Text style={styles.suggestedReason}>{plan.reason}</Text>
      <TouchableOpacity style={styles.useBtn} onPress={onUse} activeOpacity={0.85}>
        <Text style={styles.useBtnText}>USE THIS →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Plan card ────────────────────────────────────────────────────────────────
function PlanCard({
  plan, currentUserId, onEdit,
}: {
  plan: typeof EXISTING_PLANS[0];
  currentUserId?: string;
  onEdit?: () => void;
}) {
  const [joined, setJoined] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const vc = visibilityColor(plan.visibility);
  const isYours = plan.creator === 'You';

  const handleJoin = async () => {
    if (loadingJoin) return;
    setLoadingJoin(true);
    try {
      if (currentUserId && (plan as any).dbId) {
        await joinPlan((plan as any).dbId, currentUserId);
      }
      setJoined(true);
      showToast(`Joined "${plan.title}"! 🎉`);
    } catch {
      showToast(`Joined "${plan.title}"! 🎉`);
      setJoined(true);
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
      }
      setJoined(false);
      showToast(`Left "${plan.title}"`);
    } catch {
      setJoined(false);
      showToast(`Left "${plan.title}"`);
    } finally {
      setLoadingJoin(false);
    }
  };

  return (
    <View style={[styles.planCard, isYours && styles.planCardOwn]}>
      <View style={styles.planCardTop}>
        <Text style={styles.planTitle}>{plan.title}</Text>
        <View style={[styles.visBadge, { backgroundColor: vc.bg }]}>
          <Text style={[styles.visBadgeText, { color: vc.text }]}>{plan.visibility}</Text>
        </View>
      </View>
      <Text style={styles.planMeta}>{plan.location}  ·  {plan.time}</Text>
      <Text style={styles.planWeather}>{plan.weather}</Text>
      <View style={styles.planFooter}>
        <View style={styles.avatarRow}>
          {plan.attendees.map((init, idx) => (
            <View key={idx} style={[styles.avatarStack, { left: idx * 20 }]}>
              <Avatar initials={init} size={28} />
            </View>
          ))}
        </View>
        <Text style={styles.spotsText}>{plan.spots} spots</Text>
        {!isYours ? (
          joined ? (
            <TouchableOpacity style={styles.joinedBtn} onPress={handleLeave} disabled={loadingJoin}>
              {loadingJoin
                ? <ActivityIndicator size="small" color={Colors.green} />
                : <Text style={styles.joinedBtnText}>✓ JOINED</Text>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.joinBtn} onPress={handleJoin} disabled={loadingJoin}>
              {loadingJoin
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.joinBtnText}>JOIN</Text>}
            </TouchableOpacity>
          )
        ) : (
          <View style={styles.yourPlanActions}>
            <View style={styles.yourPlanTag}>
              <Text style={styles.yourPlanText}>YOUR PLAN</Text>
            </View>
            {onEdit && (
              <TouchableOpacity style={styles.editBtn} onPress={onEdit} activeOpacity={0.85}>
                <Text style={styles.editBtnText}>EDIT</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Create plan modal ────────────────────────────────────────────────────────
export function CreatePlanModal({
  visible, onClose, onCreate, onCreated, initialValues,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate?: (plan: { id: string; title: string; location: string; time: string; weather: string }) => void;
  onCreated?: (plan: any) => void;
  initialValues?: { title?: string; location?: string };
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [location, setLocation] = useState(initialValues?.location ?? '');
  const [selectedDate, setSelectedDate] = useState('Today');
  const [selectedTime, setSelectedTime] = useState('3:00pm');
  const [visibility, setVisibility] = useState('FRIENDS');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(initialValues?.title ?? '');
      setLocation(initialValues?.location ?? '');
    }
  }, [visible]);

  const toggleFriend = (id: string) => {
    setSelectedFriends(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (creating) return;
    const friendMsg = selectedFriends.length > 0
      ? ` ${selectedFriends.length} friend${selectedFriends.length > 1 ? 's' : ''} invited.`
      : '';
    const localPlan = {
      id: `u_${Date.now()}`,
      title,
      location,
      time: `${selectedDate}, ${selectedTime}`,
      weather: '⛅ 18°C',
    };
    const savedTitle = title;
    const savedSelectedFriends = [...selectedFriends];

    // Reset form immediately so modal can close responsively
    onClose();
    setTitle(''); setLocation('');
    setSelectedDate('Today'); setSelectedTime('3:00pm');
    setVisibility('FRIENDS'); setSelectedFriends([]); setStep(1);

    // Call legacy callback (home screen / discover)
    onCreate?.(localPlan);
    showToast(`Plan created! "${savedTitle}"${friendMsg} 🎉`);

    // Persist to Supabase in background if user is logged in
    if (user) {
      setCreating(true);
      try {
        const dateMap: Record<string, number> = {
          Today: 0, Tomorrow: 1, Thu: 2, Fri: 3, Sat: 4, Sun: 5, Mon: 6,
        };
        const daysAhead = dateMap[selectedDate] ?? 0;
        const d = new Date();
        d.setDate(d.getDate() + daysAhead);
        const [timePart, ampm] = selectedTime.split(/(am|pm)/i).filter(Boolean);
        const [hr, min = '0'] = timePart.split(':').map(Number);
        d.setHours(ampm?.toLowerCase() === 'pm' && hr !== 12 ? hr + 12 : hr, min, 0, 0);

        const dbPlan = await createPlanInDB(
          {
            creator_id: user.id,
            title: savedTitle,
            location,
            time: d.toISOString(),
            visibility: visibility.toLowerCase() as 'public' | 'friends' | 'invite',
            weather_snapshot: { emoji: '⛅', temp: 18, condition: 'Partly Cloudy' },
          },
          savedSelectedFriends
        );
        onCreated?.({
          ...localPlan,
          id: dbPlan.id,
          dbId: dbPlan.id,
          rawTime: d.toISOString(),
          creator: 'You',
          visibility: visibility,
          attendees: [],
          spots: 5,
        });
      } catch {
        // DB call failed — local state was already updated optimistically
      } finally {
        setCreating(false);
      }
    }
  };

  const handleNext = () => {
    if (visibility === 'PUBLIC') {
      handleCreate();
    } else {
      setStep(2);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {step === 1 ? (initialValues?.title ? 'EDIT PLAN' : 'NEW PLAN') : 'INVITE FRIENDS'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {visibility !== 'PUBLIC' && (
            <View style={styles.stepRow}>
              <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
              <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
              <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
            </View>
          )}

          {step === 1 && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>PLAN NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Frisbee on the lawn"
                placeholderTextColor={Colors.gray300}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.fieldLabel}>LOCATION</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {LOCATIONS.map(loc => (
                  <TouchableOpacity
                    key={loc}
                    style={[styles.chip, location === loc && styles.chipActive]}
                    onPress={() => setLocation(loc)}
                  >
                    <Text style={[styles.chipText, location === loc && styles.chipTextActive]}>{loc}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>DATE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {DATE_OPTIONS.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, selectedDate === d && styles.chipActive]}
                    onPress={() => setSelectedDate(d)}
                  >
                    <Text style={[styles.chipText, selectedDate === d && styles.chipTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>TIME</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {TIME_OPTIONS.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.timeChip, selectedTime === t && styles.chipActive]}
                    onPress={() => setSelectedTime(t)}
                  >
                    <Text style={[styles.chipText, selectedTime === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>VISIBILITY</Text>
              <View style={styles.visRow}>
                {VISIBILITY_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.visBtn, visibility === opt && styles.visBtnActive]}
                    onPress={() => setVisibility(opt)}
                  >
                    <Text style={[styles.visBtnText, visibility === opt && styles.visBtnTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {visibility === 'PUBLIC' && (
                <View style={styles.publicNote}>
                  <Text style={styles.publicNoteText}>PUBLIC plans skip friend invites — anyone can join.</Text>
                </View>
              )}

              <View style={styles.weatherPreview}>
                <Text style={styles.weatherPreviewLabel}>FORECAST FOR THIS TIME</Text>
                <Text style={styles.weatherPreviewValue}>⛅ 18°C — Partly Cloudy · Good conditions</Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, (!title || !location) && styles.primaryBtnDisabled]}
                onPress={handleNext}
                disabled={!title || !location}
              >
                <Text style={styles.primaryBtnText}>
                  {visibility === 'PUBLIC' ? 'CREATE PLAN' : 'NEXT: INVITE FRIENDS →'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {step === 2 && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inviteSubtitle}>
                Tap friends to invite them to this plan.
              </Text>
              <FriendInviteGrid selected={selectedFriends} onToggle={toggleFriend} />
              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                  <Text style={styles.backBtnText}>← BACK</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={creating}>
                  {creating
                    ? <ActivityIndicator size="small" color={Colors.white} />
                    : <Text style={styles.createBtnText}>CREATE PLAN</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Plans screen ─────────────────────────────────────────────────────────────
export default function PlansScreen() {
  const { user } = useAuth();
  const { friends: allFriends, loading: friendsLoading } = useFriends();
  const onlineFriends = allFriends.filter(f => f.is_online);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState<{ title: string; location: string } | null>(null);
  const [dbPlans, setDbPlans] = useState<typeof EXISTING_PLANS>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadingPlans(true);
    Promise.all([getMyPlans(user.id), getPublicPlans()])
      .then(([mine, pub]) => {
        const seen = new Set<string>();
        const merged = [...mine, ...pub].filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
        setDbPlans(sortByTime(merged.map(p => ({
          id: p.id,
          dbId: p.id,
          rawTime: p.time,
          title: p.title,
          creator: (p as any).creator_id === user.id ? 'You' : ((p as any).creator?.full_name ?? 'Unknown'),
          location: p.location,
          time: formatPlanTime(p.time),
          visibility: p.visibility.toUpperCase(),
          attendees: (p.attendees ?? []).map((a: any) => a.user?.avatar_initials ?? '??').slice(0, 4),
          spots: 5,
          weather: p.weather_snapshot
            ? `${(p.weather_snapshot as any).emoji} ${(p.weather_snapshot as any).temp}°C`
            : '⛅ —',
        }))) as any);
      })
      .finally(() => setLoadingPlans(false));
  }, [user?.id]);

  // Merge real plans with hardcoded, showing real plans first when available
  const activePlans = dbPlans.length > 0 ? dbPlans : EXISTING_PLANS;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>PLANS</Text>
          <TouchableOpacity style={styles.newPlanBtn} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
            <Text style={styles.newPlanBtnText}>+ NEW</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.createCta} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
          <Text style={styles.ctaTitle}>MAKE A PLAN</Text>
          <Text style={styles.ctaArrow}>→</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>WHO'S FREE NOW</Text>
        {friendsLoading ? (
          <ActivityIndicator color={Colors.navy} style={{ marginBottom: 28 }} />
        ) : onlineFriends.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.friendStrip}>
            {onlineFriends.map(f => (
              <View key={f.id} style={styles.freeChip}>
                <Avatar initials={f.avatar_initials} size={36} free />
                <Text style={styles.freeChipName}>{f.full_name.split(' ')[0]}</Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.whosFreeEmpty}>
            <Text style={styles.whosFreeEmptyText}>No friends online right now.</Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>SUGGESTED FOR TODAY</Text>
        {SUGGESTED_PLANS.map(plan => (
          <SuggestedCard key={plan.id} plan={plan} onUse={() => setModalVisible(true)} />
        ))}

        <Text style={styles.sectionLabel}>UPCOMING PLANS</Text>
        {loadingPlans && (
          <ActivityIndicator color={Colors.navy} style={{ marginBottom: 12 }} />
        )}
        {activePlans.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            currentUserId={user?.id}
            onEdit={plan.creator === 'You'
              ? () => { setEditingPlan({ title: plan.title, location: plan.location }); setModalVisible(true); }
              : undefined}
          />
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>

      <CreatePlanModal
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setEditingPlan(null); }}
        initialValues={editingPlan ?? undefined}
        onCreated={newPlan => {
          setDbPlans(prev => sortByTime([newPlan, ...prev]) as any);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    letterSpacing: -1,
  },
  newPlanBtn: {
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...Shadows.sm,
  },
  newPlanBtnText: {
    color: Colors.white,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
  },
  createCta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 24,
    ...Shadows.md,
  },
  ctaTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.white,
    letterSpacing: 1,
  },
  ctaArrow: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.black,
    color: Colors.white,
  },
  sectionLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 3,
    color: Colors.gray500,
    marginBottom: 12,
    marginTop: 4,
  },

  friendStrip: { marginBottom: 28 },
  freeChip: { alignItems: 'center', marginRight: 16, gap: 6 },
  freeChipName: { fontSize: 11, fontWeight: Typography.weights.bold, color: Colors.navy },
  whosFreeEmpty: {
    backgroundColor: Colors.gray100,
    borderWidth: Borders.width,
    borderColor: Colors.gray300,
    borderRadius: Borders.radius,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  whosFreeEmptyText: { fontSize: Typography.sizes.sm, color: Colors.gray500, fontWeight: Typography.weights.medium },
  friendGridEmpty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  friendGridEmptyText: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, color: Colors.navy },
  friendGridEmptyHint: { fontSize: Typography.sizes.sm, color: Colors.gray500, textAlign: 'center', lineHeight: 20 },

  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: Typography.weights.black },

  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  legendText: { fontSize: 10, color: Colors.gray500, fontWeight: Typography.weights.medium },
  frequencyBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  frequencyLabel: { fontSize: 9, color: Colors.gray300, fontWeight: Typography.weights.bold, letterSpacing: 0.5 },
  friendGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  friendCell: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 90,
    gap: 4,
  },
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
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  selectedSummaryText: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, color: Colors.navy },
  clearText: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.bold, color: Colors.blue },

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

  suggestedCard: {
    backgroundColor: Colors.bluePale,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    padding: 16,
    marginBottom: 12,
    ...Shadows.sm,
  },
  suggestedTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  aiTag: {
    backgroundColor: Colors.navy,
    borderRadius: Borders.radiusSm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  aiTagText: { fontSize: 9, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.white },
  suggestedWeather: { fontSize: Typography.sizes.sm, color: Colors.navy, fontWeight: Typography.weights.medium },
  suggestedTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  suggestedMeta: { fontSize: Typography.sizes.sm, color: Colors.blue, fontWeight: Typography.weights.medium, marginBottom: 6 },
  suggestedReason: { fontSize: Typography.sizes.sm, color: Colors.gray700, lineHeight: 20, marginBottom: 14 },
  useBtn: {
    alignSelf: 'flex-start',
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  useBtnText: { fontSize: Typography.sizes.xs, fontWeight: Typography.weights.black, letterSpacing: 2, color: Colors.navy },

  planCard: {
    backgroundColor: Colors.white,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    padding: 16,
    marginBottom: 12,
    ...Shadows.sm,
  },
  planCardOwn: { backgroundColor: Colors.cream },
  planCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  planTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    letterSpacing: -0.5,
    flex: 1,
  },
  visBadge: { borderRadius: Borders.radiusSm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.black },
  visBadgeText: { fontSize: 9, fontWeight: Typography.weights.black, letterSpacing: 1 },
  planMeta: { fontSize: Typography.sizes.sm, color: Colors.gray500, marginBottom: 2 },
  planWeather: { fontSize: Typography.sizes.sm, color: Colors.gray700, fontWeight: Typography.weights.medium, marginBottom: 12 },
  planFooter: { flexDirection: 'row', alignItems: 'center' },
  avatarRow: { flexDirection: 'row', position: 'relative', height: 32, flex: 1 },
  avatarStack: { position: 'absolute' },
  spotsText: { fontSize: 11, color: Colors.gray500, fontWeight: Typography.weights.medium, marginRight: 10 },
  joinBtn: {
    backgroundColor: Colors.navy,
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  joinBtnText: { fontSize: 11, fontWeight: Typography.weights.black, letterSpacing: 2, color: Colors.white },
  joinedBtn: {
    backgroundColor: Colors.greenLight,
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  joinedBtnText: { fontSize: 11, fontWeight: Typography.weights.black, letterSpacing: 1, color: Colors.green },
  yourPlanActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  yourPlanTag: { borderWidth: 1.5, borderColor: Colors.navy, borderRadius: Borders.radiusSm, paddingHorizontal: 10, paddingVertical: 4 },
  yourPlanText: { fontSize: 9, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.navy },
  editBtn: {
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 4,
    ...Shadows.sm,
  },
  editBtnText: { fontSize: 9, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.white },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: Borders.widthHeavy,
    borderLeftWidth: Borders.widthHeavy,
    borderRightWidth: Borders.widthHeavy,
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
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: Typography.sizes.md,
    color: Colors.black,
    fontWeight: Typography.weights.medium,
    marginBottom: 18,
  },
  chipScroll: { marginBottom: 18 },
  chip: {
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: Colors.white,
  },
  timeChip: {
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: Colors.white,
  },
  chipActive: { backgroundColor: Colors.navy },
  chipText: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.bold, color: Colors.navy },
  chipTextActive: { color: Colors.white },
  visRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  visBtn: { flex: 1, borderWidth: Borders.width, borderColor: Colors.black, borderRadius: Borders.radius, paddingVertical: 10, alignItems: 'center' },
  visBtnActive: { backgroundColor: Colors.navy },
  visBtnText: { fontSize: 11, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.navy },
  visBtnTextActive: { color: Colors.white },
  publicNote: {
    backgroundColor: Colors.greenLight,
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    padding: 12,
    marginBottom: 16,
  },
  publicNoteText: { fontSize: Typography.sizes.xs, color: Colors.green, fontWeight: Typography.weights.bold, letterSpacing: 0.5 },
  weatherPreview: {
    backgroundColor: Colors.bluePale,
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    padding: 14,
    marginBottom: 20,
  },
  weatherPreviewLabel: { fontSize: 10, fontWeight: Typography.weights.black, letterSpacing: 2, color: Colors.blue, marginBottom: 4 },
  weatherPreviewValue: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.medium, color: Colors.navy },
  primaryBtn: {
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
    ...Shadows.md,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: Colors.white, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, letterSpacing: 2 },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 8 },
  backBtn: { flex: 1, borderWidth: Borders.width, borderColor: Colors.black, borderRadius: Borders.radius, paddingVertical: 14, alignItems: 'center' },
  backBtnText: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, letterSpacing: 2, color: Colors.navy },
  createBtn: {
    flex: 2,
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingVertical: 14,
    alignItems: 'center',
    ...Shadows.sm,
  },
  createBtnText: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, letterSpacing: 2, color: Colors.white },
});
