import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Borders, Shadows } from '../../constants/theme';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { useFriends } from '../../hooks/useFriends';
import { updateProfile, getPlanCount, getFriendCount } from '../../services/users';

// ─── Hardcoded data ───────────────────────────────────────────────────────────
const BADGES = [
  { id: '1', emoji: '🌞', label: 'SUNSHINE\nCHASER',    desc: '10+ outdoor plans' },
  { id: '2', emoji: '👥', label: 'SOCIAL\nBUTTERFLY',   desc: '20+ friends' },
  { id: '3', emoji: '🌧', label: 'RAIN\nWARRIOR',       desc: 'Planned in bad weather' },
  { id: '4', emoji: '🎯', label: '5 WEEK\nSTREAK',      desc: 'Consistent planner' },
  { id: '5', emoji: '🏆', label: 'TOP\nPLANNER',        desc: 'Created 10+ plans' },
  { id: '6', emoji: '🧭', label: 'EXPLORER',             desc: '5+ different spaces' },
];

const RECENT_PLANS = [
  { id: 'r1', title: 'Frisbee on the Lawn', location: "Queen's Lawn",   date: 'Yesterday', attendees: 4 },
  { id: 'r2', title: 'Revision outside',    location: 'Beit Quad',      date: 'Mon',       attendees: 3 },
  { id: 'r3', title: 'Coffee at JCR',       location: 'JCR Bar',        date: 'Last Fri',  attendees: 2 },
];

const PAST_PLANS_FULL = [
  { title: 'Frisbee on the Lawn', date: 'May 10', attendees: 4, loc: "Queen's Lawn" },
  { title: 'Library Study',       date: 'May 8',  attendees: 3, loc: 'Central Library' },
  { title: 'Coffee at JCR',       date: 'May 6',  attendees: 2, loc: 'JCR Bar' },
  { title: 'Evening Walk',        date: 'May 4',  attendees: 5, loc: 'Hyde Park' },
  { title: 'Revision Outside',    date: 'May 2',  attendees: 3, loc: 'Beit Quad' },
  { title: 'Frisbee Practice',    date: 'Apr 30', attendees: 6, loc: "Queen's Lawn" },
  { title: 'Study Group',         date: 'Apr 28', attendees: 4, loc: 'Central Library' },
];

const WEEK_PLANS  = [2, 3, 1, 4, 2];
const WEEK_HOURS  = [8, 12, 9, 11, 7];
const WEEK_LABELS = ['Wk1', 'Wk2', 'Wk3', 'Wk4', 'This'];

// ─── Toggle switch ────────────────────────────────────────────────────────────
function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const anim = useRef(new Animated.Value(on ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: on ? 1 : 0, useNativeDriver: true, damping: 22, stiffness: 260 }).start();
  }, [on]);

  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 20] });

  return (
    <TouchableOpacity
      style={[styles.track, on && styles.trackOn]}
      onPress={onToggle}
      activeOpacity={0.85}
    >
      <Animated.View style={[styles.pill, { transform: [{ translateX: tx }] }]} />
    </TouchableOpacity>
  );
}

// ─── Bar chart ────────────────────────────────────────────────────────────────
function BarChart({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <View style={styles.barChart}>
      {data.map((val, i) => (
        <View key={i} style={styles.barCol}>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { height: `${Math.round((val / max) * 100)}%` as any, backgroundColor: color }]} />
          </View>
          <Text style={styles.barValue}>{val}</Text>
          <Text style={styles.barLabel}>{labels[i]}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Stats detail view ────────────────────────────────────────────────────────
function StatDetail({ stat, onBack }: { stat: 'plans' | 'friends' | 'hours'; onBack: () => void }) {
  const { friends, loading: friendsLoading } = useFriends();
  const titles = { plans: 'YOUR PLANS', friends: 'YOUR FRIENDS', hours: 'OUTDOOR HOURS' };
  const maxFriendPlanCount = Math.max(...friends.map(f => (f as any).plan_count ?? 0), 1);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.detailHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.detailTitle}>{titles[stat]}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {stat === 'plans' && (
          <>
            <Text style={styles.detailSectionLabel}>PLANS PER WEEK</Text>
            <View style={styles.chartCard}>
              <BarChart data={WEEK_PLANS} labels={WEEK_LABELS} color={Colors.navy} />
            </View>
            <Text style={[styles.detailSectionLabel, { marginTop: 24 }]}>ALL PAST PLANS</Text>
            {PAST_PLANS_FULL.map((p, i) => (
              <View key={i} style={styles.detailRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailRowTitle}>{p.title}</Text>
                  <Text style={styles.detailRowSub}>{p.loc}  ·  {p.date}</Text>
                </View>
                <Text style={styles.detailRowBadge}>👥 {p.attendees}</Text>
              </View>
            ))}
          </>
        )}

        {stat === 'friends' && (
          <>
            <Text style={styles.detailSectionLabel}>FRIENDS BY PLANS TOGETHER</Text>
            {friendsLoading ? (
              <ActivityIndicator color={Colors.navy} style={{ marginTop: 20 }} />
            ) : friends.length === 0 ? (
              <Text style={styles.detailRowSub}>No friends yet — add some in Chat.</Text>
            ) : (
              friends.map(f => (
                <View key={f.id} style={styles.friendDetailRow}>
                  <View style={[styles.friendDetailAvatar, { opacity: f.is_online ? 1 : 0.55 }]}>
                    <Text style={styles.friendDetailInitials}>{f.avatar_initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.friendDetailName}>{f.full_name}</Text>
                    <View style={styles.friendBar}>
                      <View style={[styles.friendBarFill, { width: `${Math.round(((f as any).plan_count ?? 0) / maxFriendPlanCount * 100)}%` as any }]} />
                    </View>
                  </View>
                  <Text style={styles.friendDetailCount}>{(f as any).plan_count ?? 0}</Text>
                </View>
              ))
            )}
          </>
        )}

        {stat === 'hours' && (
          <>
            <Text style={styles.detailSectionLabel}>OUTDOOR HOURS PER WEEK</Text>
            <View style={styles.chartCard}>
              <BarChart data={WEEK_HOURS} labels={WEEK_LABELS} color={Colors.blueLight} />
            </View>
            <View style={styles.hoursTotal}>
              <Text style={styles.hoursTotalLabel}>TOTAL THIS TERM</Text>
              <Text style={styles.hoursTotalValue}>47 hrs</Text>
            </View>
            <View style={styles.hoursBreakdown}>
              {[
                { label: 'Queen\'s Lawn', hours: 18 },
                { label: 'Beit Quad',     hours: 12 },
                { label: 'SAF Terrace',   hours: 9  },
                { label: 'Hyde Park',     hours: 8  },
              ].map((b, i, arr) => (
                <View key={i} style={[styles.hoursRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={styles.hoursLoc}>{b.label}</Text>
                  <View style={styles.hoursBarTrack}>
                    <View style={[styles.hoursBarFill, { width: `${Math.round((b.hours / 18) * 100)}%` as any }]} />
                  </View>
                  <Text style={styles.hoursHrs}>{b.hours}h</Text>
                </View>
              ))}
            </View>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Inline editable field ───────────────────────────────────────────────────
function EditableField({
  value, onSave, style, large,
}: {
  value: string; onSave: (v: string) => void; style?: any; large?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <TextInput
        style={[styles.editInput, large && styles.editInputLarge, style]}
        value={draft}
        onChangeText={setDraft}
        autoFocus
        onBlur={() => { setEditing(false); onSave(draft); }}
        onSubmitEditing={() => { setEditing(false); onSave(draft); }}
      />
    );
  }
  return (
    <TouchableOpacity onPress={() => { setDraft(value); setEditing(true); }} activeOpacity={0.7}>
      <Text style={[style, styles.editableText]}>{value}</Text>
    </TouchableOpacity>
  );
}

// ─── Profile screen ───────────────────────────────────────────────────────────
export default function ProfileScreen({
  pushView = () => {},
  popView  = () => {},
  currentView = 'main',
}: {
  pushView?: (view: string) => void;
  popView?: () => void;
  currentView?: string;
} = {}) {
  const { user, profile, signOut } = useAuth();
  const [name, setName]     = useState(profile?.full_name ?? '');
  const [degree, setDegree] = useState(profile?.degree ?? '');
  const [year, setYear]     = useState(profile?.year_of_study ?? '');
  const [planCount, setPlanCount]     = useState(12);
  const [friendCount, setFriendCount] = useState(24);

  // Sync real profile data when it loads
  useEffect(() => {
    if (!profile) return;
    if (profile.full_name) setName(profile.full_name);
    if (profile.degree) setDegree(profile.degree);
    if (profile.year_of_study) setYear(profile.year_of_study);
  }, [profile]);
  useEffect(() => {
    if (!user) return;
    getPlanCount(user.id).then(setPlanCount).catch(() => {});
    getFriendCount(user.id).then(setFriendCount).catch(() => {});
  }, [user?.id]);

  // Toggles
  const [notifOn, setNotifOn]       = useState(true);
  const [pushOn, setPushOn]         = useState(true);
  const [calendarOn, setCalendarOn] = useState(true);
  const [visPublic, setVisPublic]   = useState(false);
  const [locationOn, setLocationOn] = useState(true);
  const [weatherOn, setWeatherOn]   = useState(true);
  const [activityOn, setActivityOn] = useState(true);
  const [darkOn, setDarkOn]         = useState(false);

  // Delete confirm modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const hoursOutside = profile?.hours_outside ?? 47;
  const avatarInitials = profile?.avatar_initials ?? (name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?');

  const STATS = [
    { key: 'plans' as const,   label: 'PLANS',       value: planCount },
    { key: 'friends' as const, label: 'FRIENDS',     value: friendCount },
    { key: 'hours' as const,   label: 'HRS OUTSIDE', value: hoursOutside },
  ];

  const TOGGLES = [
    { label: 'NOTIFICATIONS',   icon: '🔔', on: notifOn,    set: setNotifOn    },
    { label: 'PUSH ALERTS',     icon: '📳', on: pushOn,     set: setPushOn     },
    { label: 'CALENDAR SYNC',   icon: '📅', on: calendarOn, set: setCalendarOn },
    { label: 'PUBLIC PROFILE',  icon: '👁', on: visPublic,  set: setVisPublic  },
    { label: 'SHARE LOCATION',  icon: '📍', on: locationOn, set: setLocationOn },
    { label: 'WEATHER UPDATES', icon: '⛅', on: weatherOn,  set: setWeatherOn  },
    { label: 'FRIEND ACTIVITY', icon: '👥', on: activityOn, set: setActivityOn },
    { label: 'DARK MODE',       icon: '🌙', on: darkOn,     set: setDarkOn     },
  ];

  if (currentView !== 'main') {
    return <StatDetail stat={currentView as 'plans' | 'friends' | 'hours'} onBack={popView} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>PROFILE</Text>
        </View>

        {/* User card with inline edit */}
        <View style={[styles.userCard, Shadows.md]}>
          <View style={styles.userCardTop}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>{avatarInitials}</Text>
            </View>
            <View style={styles.userInfo}>
              <EditableField
                value={name || 'You'}
                onSave={v => {
                  const trimmed = v.trim();
                  setName(trimmed);
                  showToast('Name updated');
                  if (user && trimmed && trimmed !== 'You') updateProfile(user.id, { full_name: trimmed }).catch(() => {});
                }}
                style={styles.userName}
                large
              />
              <EditableField
                value={degree || 'Add degree'}
                onSave={v => {
                  const val = v === 'Add degree' ? '' : v.trim();
                  setDegree(val);
                  showToast('Degree updated');
                  if (user) updateProfile(user.id, { degree: val }).catch(() => {});
                }}
                style={styles.userDegree}
              />
              <EditableField
                value={year || 'Add year'}
                onSave={v => {
                  const val = v === 'Add year' ? '' : v.trim();
                  setYear(val);
                  showToast('Year updated');
                  if (user) updateProfile(user.id, { year_of_study: val }).catch(() => {});
                }}
                style={styles.userYear}
              />
              <View style={styles.imperialTag}>
                <Text style={styles.imperialTagText}>🎓 IMPERIAL COLLEGE</Text>
              </View>
            </View>
          </View>
          <Text style={styles.editHint}>TAP ANY FIELD TO EDIT</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {STATS.map(s => (
            <TouchableOpacity
              key={s.key}
              style={[styles.statBox, Shadows.sm]}
              onPress={() => pushView(s.key)}
              activeOpacity={0.85}
            >
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Badges */}
        <Text style={styles.sectionLabel}>BADGES</Text>
        <View style={styles.badgeGrid}>
          {BADGES.map(badge => (
            <View key={badge.id} style={styles.badgeTile}>
              <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
              <Text style={styles.badgeLabel}>{badge.label}</Text>
              <Text style={styles.badgeDesc}>{badge.desc}</Text>
            </View>
          ))}
        </View>

        {/* Recent plans */}
        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>YOUR RECENT PLANS</Text>
        <View style={[styles.groupedList, Shadows.sm]}>
          {RECENT_PLANS.map((plan, idx) => (
            <View key={plan.id} style={[styles.recentRow, idx === RECENT_PLANS.length - 1 && styles.recentRowLast]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recentTitle}>{plan.title}</Text>
                <Text style={styles.recentMeta}>{plan.location}  ·  {plan.date}</Text>
              </View>
              <Text style={styles.recentAttendees}>👥 {plan.attendees}</Text>
            </View>
          ))}
        </View>

        {/* Settings with toggles */}
        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>SETTINGS</Text>
        <View style={[styles.groupedList, Shadows.sm]}>
          {TOGGLES.map((t, idx) => (
            <View key={t.label} style={[styles.settingRow, idx === TOGGLES.length - 1 && styles.settingRowLast]}>
              <Text style={styles.settingIcon}>{t.icon}</Text>
              <Text style={styles.settingLabel}>{t.label}</Text>
              <Text style={[styles.settingValue, { color: t.on ? Colors.green : Colors.gray500 }]}>
                {t.on ? 'On' : 'Off'}
              </Text>
              <ToggleSwitch on={t.on} onToggle={() => t.set(v => !v)} />
            </View>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={[styles.signOutBtn, Shadows.sm]}
          onPress={() => signOut()}
        >
          <Text style={styles.signOutText}>SIGN OUT</Text>
        </TouchableOpacity>

        {/* Delete account */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => setShowDeleteConfirm(true)}
        >
          <Text style={styles.deleteBtnText}>DELETE ACCOUNT</Text>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Delete confirmation modal */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteSheet}>
            <Text style={styles.deleteSheetTitle}>DELETE ACCOUNT?</Text>
            <Text style={styles.deleteSheetBody}>
              This will permanently remove your profile, plans, and friend connections. This cannot be undone.
            </Text>
            <TouchableOpacity
              style={styles.deleteConfirmBtn}
              onPress={() => { setShowDeleteConfirm(false); showToast('Account deletion requested'); }}
              activeOpacity={0.85}
            >
              <Text style={styles.deleteConfirmText}>YES, DELETE MY ACCOUNT</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteCancelBtn}
              onPress={() => setShowDeleteConfirm(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.deleteCancelText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },

  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: Typography.sizes.xxl, fontWeight: Typography.weights.black, color: Colors.navy, letterSpacing: -1 },

  // User card
  userCard: {
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy, borderColor: Colors.black,
    borderRadius: Borders.radius, padding: 20, marginBottom: 16,
  },
  userCardTop: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  avatarLarge: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.blueLight,
    borderWidth: 3, borderColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarLargeText: { fontSize: 26, fontWeight: Typography.weights.black, color: Colors.white },
  userInfo: { flex: 1, gap: 3 },
  userName: { fontSize: Typography.sizes.xl, fontWeight: Typography.weights.black, color: Colors.white, letterSpacing: -0.5 },
  userDegree: { fontSize: Typography.sizes.sm, color: Colors.blueMuted, fontWeight: Typography.weights.medium },
  userYear: { fontSize: Typography.sizes.sm, color: Colors.blueMuted, fontWeight: Typography.weights.medium },
  editableText: { textDecorationLine: 'underline', textDecorationColor: 'rgba(255,255,255,0.3)', textDecorationStyle: 'dotted' },
  editInput: {
    color: Colors.white, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.medium,
    borderBottomWidth: 1.5, borderBottomColor: Colors.blueMuted, paddingVertical: 2,
  },
  editInputLarge: { fontSize: Typography.sizes.xl, fontWeight: Typography.weights.black },
  editHint: { fontSize: 9, color: Colors.blueMuted, letterSpacing: 1.5, textAlign: 'right', marginTop: 12 },
  imperialTag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.blueLight,
    borderRadius: Borders.radiusSm,
    paddingHorizontal: 8, paddingVertical: 3,
    marginTop: 4,
    borderWidth: 1, borderColor: Colors.black,
  },
  imperialTagText: { fontSize: 9, fontWeight: Typography.weights.black, letterSpacing: 1, color: Colors.white },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  statBox: {
    flex: 1,
    borderWidth: Borders.widthHeavy, borderColor: Colors.black,
    borderRadius: Borders.radius, padding: 14,
    alignItems: 'center', backgroundColor: Colors.cream,
  },
  statValue: { fontSize: Typography.sizes.xl, fontWeight: Typography.weights.black, color: Colors.navy, letterSpacing: -1 },
  statLabel: { fontSize: 9, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.gray500, marginTop: 2, textAlign: 'center' },
  statArrow: { fontSize: 14, color: Colors.gray300, marginTop: 4 },

  sectionLabel: { fontSize: Typography.sizes.xs, fontWeight: Typography.weights.black, letterSpacing: 3, color: Colors.gray500, marginBottom: 12 },

  // Badges
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  badgeTile: {
    width: '30.5%',
    borderWidth: Borders.width, borderColor: Colors.black,
    borderRadius: Borders.radius, padding: 12,
    alignItems: 'center', backgroundColor: Colors.bluePale, gap: 4, ...Shadows.sm,
  },
  badgeEmoji: { fontSize: 24 },
  badgeLabel: { fontSize: 9, fontWeight: Typography.weights.black, letterSpacing: 1, color: Colors.navy, textAlign: 'center', lineHeight: 13 },
  badgeDesc: { fontSize: 8, color: Colors.gray500, textAlign: 'center', fontWeight: Typography.weights.medium },

  // Grouped list
  groupedList: {
    borderWidth: Borders.widthHeavy, borderColor: Colors.black,
    borderRadius: Borders.radius, overflow: 'hidden', marginBottom: 8,
  },
  recentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: Colors.black,
    backgroundColor: Colors.white,
  },
  recentRowLast: { borderBottomWidth: 0 },
  recentTitle: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, color: Colors.navy, marginBottom: 2 },
  recentMeta: { fontSize: 11, color: Colors.gray500, fontWeight: Typography.weights.medium },
  recentAttendees: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.bold, color: Colors.navy },

  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: Colors.black,
    backgroundColor: Colors.white, gap: 12,
  },
  settingRowLast: { borderBottomWidth: 0 },
  settingIcon: { fontSize: 16 },
  settingLabel: { fontSize: Typography.sizes.xs, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.navy, flex: 1 },
  settingValue: { fontSize: 11, fontWeight: Typography.weights.medium, width: 24 },

  // Toggle switch
  track: {
    width: 44, height: 24,
    borderRadius: 12,
    backgroundColor: Colors.gray100,
    borderWidth: Borders.width, borderColor: Colors.black,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: Colors.navy },
  pill: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.white,
    borderWidth: 1.5, borderColor: Colors.black,
    shadowColor: Colors.black,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },

  // Sign out / delete
  signOutBtn: {
    marginTop: 8,
    borderWidth: Borders.widthHeavy, borderColor: Colors.black,
    borderRadius: Borders.radius, paddingVertical: 14,
    alignItems: 'center', backgroundColor: Colors.white, marginBottom: 8,
  },
  signOutText: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, letterSpacing: 2, color: Colors.red },
  deleteBtn: {
    paddingVertical: 10, alignItems: 'center', marginBottom: 8,
  },
  deleteBtnText: { fontSize: Typography.sizes.xs, fontWeight: Typography.weights.bold, letterSpacing: 1.5, color: Colors.gray300 },

  // Delete modal
  deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  deleteSheet: {
    backgroundColor: Colors.white,
    borderWidth: Borders.widthHeavy, borderColor: Colors.black,
    borderRadius: Borders.radius, padding: 24,
    ...Shadows.md,
  },
  deleteSheetTitle: { fontSize: Typography.sizes.xl, fontWeight: Typography.weights.black, color: Colors.red, letterSpacing: -0.5, marginBottom: 12 },
  deleteSheetBody: { fontSize: Typography.sizes.sm, color: Colors.gray700, lineHeight: 22, marginBottom: 24 },
  deleteConfirmBtn: {
    backgroundColor: Colors.red,
    borderWidth: Borders.widthHeavy, borderColor: Colors.black,
    borderRadius: Borders.radius, paddingVertical: 14,
    alignItems: 'center', marginBottom: 10, ...Shadows.sm,
  },
  deleteConfirmText: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.white },
  deleteCancelBtn: {
    borderWidth: Borders.width, borderColor: Colors.black,
    borderRadius: Borders.radius, paddingVertical: 14, alignItems: 'center',
  },
  deleteCancelText: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.navy },

  // Stats detail view
  detailHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: Borders.widthHeavy, borderBottomColor: Colors.black,
    backgroundColor: Colors.white, gap: 14,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 3,
  },
  backBtn: {
    width: 40, height: 40,
    borderWidth: Borders.width, borderColor: Colors.black,
    borderRadius: Borders.radius, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white, flexShrink: 0, ...Shadows.sm,
  },
  backArrow: { fontSize: 18, fontWeight: Typography.weights.black, color: Colors.navy },
  detailTitle: { fontSize: Typography.sizes.xl, fontWeight: Typography.weights.black, color: Colors.navy, letterSpacing: -0.5 },
  detailSectionLabel: { fontSize: Typography.sizes.xs, fontWeight: Typography.weights.black, letterSpacing: 3, color: Colors.gray500, marginBottom: 14 },

  chartCard: {
    backgroundColor: Colors.cream,
    borderWidth: Borders.widthHeavy, borderColor: Colors.black,
    borderRadius: Borders.radius, padding: 16, ...Shadows.sm,
  },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 100 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { width: '100%', flex: 1, backgroundColor: Colors.gray100, borderRadius: 2, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 2 },
  barValue: { fontSize: 11, fontWeight: Typography.weights.black, color: Colors.navy },
  barLabel: { fontSize: 9, color: Colors.gray500, fontWeight: Typography.weights.medium },

  detailRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: Colors.gray100,
    paddingVertical: 12, gap: 10,
  },
  detailRowTitle: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, color: Colors.navy, marginBottom: 2 },
  detailRowSub: { fontSize: 11, color: Colors.gray500, fontWeight: Typography.weights.medium },
  detailRowBadge: { fontSize: Typography.sizes.sm, color: Colors.navy, fontWeight: Typography.weights.medium },

  friendDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  friendDetailAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bluePale,
    borderWidth: 2, borderColor: Colors.black,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  friendDetailInitials: { fontSize: 13, fontWeight: Typography.weights.black, color: Colors.navy },
  friendDetailName: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, color: Colors.navy, marginBottom: 5 },
  friendBar: { height: 8, backgroundColor: Colors.gray100, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: Colors.black },
  friendBarFill: { height: '100%', backgroundColor: Colors.navy, borderRadius: 3 },
  friendDetailCount: { fontSize: 13, fontWeight: Typography.weights.black, color: Colors.navy, width: 28, textAlign: 'right' },

  hoursTotal: {
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy, borderColor: Colors.black,
    borderRadius: Borders.radius, padding: 16, marginTop: 16, marginBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  hoursTotalLabel: { fontSize: Typography.sizes.xs, fontWeight: Typography.weights.black, letterSpacing: 2, color: Colors.blueMuted },
  hoursTotalValue: { fontSize: Typography.sizes.xxl, fontWeight: Typography.weights.black, color: Colors.white, letterSpacing: -1 },
  hoursBreakdown: {
    borderWidth: Borders.widthHeavy, borderColor: Colors.black,
    borderRadius: Borders.radius, overflow: 'hidden', ...Shadows.sm,
  },
  hoursRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: Colors.black,
    backgroundColor: Colors.white,
  },
  hoursLoc: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, color: Colors.navy, width: 110 },
  hoursBarTrack: {
    flex: 1, height: 8,
    backgroundColor: Colors.gray100,
    borderRadius: 4, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.black,
  },
  hoursBarFill: { height: '100%', backgroundColor: Colors.blueLight, borderRadius: 3 },
  hoursHrs: { fontSize: 12, fontWeight: Typography.weights.black, color: Colors.navy, width: 28, textAlign: 'right' },
});
