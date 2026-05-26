import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, Modal, ActivityIndicator, Image,
  ActionSheetIOS, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Colors, Typography } from '../../constants/theme';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { useFriends } from '../../hooks/useFriends';
import { updateProfile, getPlanCount, getFriendCount, uploadAvatar, getAllBadges, getUserBadges } from '../../services/users';
import { Badge } from '../../types';
import { setDark, isDark, subscribe as subscribeTheme, DarkTheme } from '../../lib/themeStore';

const DARK = '#001845';

// Badges are loaded from the backend; fallback empty list until loaded

const PAST_PLANS_FULL = [
  { title: 'Frisbee on the Lawn', date: 'May 10', attendees: 4, loc: "Queen's Lawn"    },
  { title: 'Library Study',       date: 'May 8',  attendees: 3, loc: 'Central Library' },
  { title: 'Coffee at JCR',       date: 'May 6',  attendees: 2, loc: 'JCR Bar'         },
  { title: 'Evening Walk',        date: 'May 4',  attendees: 5, loc: 'Hyde Park'        },
  { title: 'Revision Outside',    date: 'May 2',  attendees: 3, loc: 'Beit Quad'        },
  { title: 'Frisbee Practice',    date: 'Apr 30', attendees: 6, loc: "Queen's Lawn"    },
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
  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });
  return (
    <TouchableOpacity style={[styles.track, on && styles.trackOn]} onPress={onToggle} activeOpacity={0.85}>
      <Animated.View style={[styles.pill, { transform: [{ translateX: tx }] }]} />
    </TouchableOpacity>
  );
}

// ─── Bar chart ────────────────────────────────────────────────────────────────
function BarChart({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  const [dark, setDarkMode] = useState(isDark());
  useEffect(() => subscribeTheme(() => setDarkMode(isDark())), []);
  const max = Math.max(...data, 1);
  return (
    <View style={styles.barChart}>
      {data.map((val, i) => (
        <View key={i} style={styles.barCol}>
          <View style={[styles.barTrack, dark && { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
            <View style={[styles.barFill, { height: `${Math.round((val / max) * 100)}%` as any, backgroundColor: color }]} />
          </View>
          <Text style={[styles.barValue, dark && { color: '#FFF' }]}>{val}</Text>
          <Text style={styles.barLabel}>{labels[i]}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Stats detail view ────────────────────────────────────────────────────────
function StatDetail({ stat, onBack }: { stat: 'plans' | 'friends' | 'hours'; onBack: () => void }) {
  const [dark, setDarkMode] = useState(isDark());
  useEffect(() => subscribeTheme(() => setDarkMode(isDark())), []);

  const { friends, loading: friendsLoading } = useFriends();
  const titles = { plans: 'My Plans', friends: 'Friends', hours: 'Outdoor Hours' };
  const maxFriendPlanCount = Math.max(...friends.map(f => (f as any).plan_count ?? 0), 1);

  const bg = dark ? DarkTheme.bg : Colors.lightGrey;
  const surface = dark ? DarkTheme.surface : '#ECEEF3';
  const textPrimary = dark ? DarkTheme.text : DARK;
  const textMuted = dark ? DarkTheme.textMuted : Colors.gray500;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
      <View style={[styles.detailHeader, { backgroundColor: bg, borderBottomColor: dark ? DarkTheme.border : 'rgba(0,0,0,0.1)' }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: surface }]} onPress={onBack} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={20} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.detailTitle, { color: textPrimary }]}>{titles[stat]}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {stat === 'plans' && (
          <>
            <Text style={[styles.detailSectionLabel, { color: textMuted }]}>PLANS PER WEEK</Text>
            <View style={[styles.chartCard, { backgroundColor: surface }]}>
              <BarChart data={WEEK_PLANS} labels={WEEK_LABELS} color={DARK} />
            </View>
            <Text style={[styles.detailSectionLabel, { marginTop: 24, color: textMuted }]}>ALL PAST PLANS</Text>
            {PAST_PLANS_FULL.map((p, i) => (
              <View key={i} style={[styles.detailRow, { borderBottomColor: dark ? DarkTheme.border : 'rgba(0,0,0,0.08)' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailRowTitle, { color: textPrimary }]}>{p.title}</Text>
                  <Text style={[styles.detailRowSub, { color: textMuted }]}>{p.loc}  ·  {p.date}</Text>
                </View>
                <Text style={[styles.detailRowBadge, { color: textPrimary }]}>👥 {p.attendees}</Text>
              </View>
            ))}
          </>
        )}

        {stat === 'friends' && (
          <>
            <Text style={[styles.detailSectionLabel, { color: textMuted }]}>FRIENDS BY PLANS TOGETHER</Text>
            {friendsLoading ? (
              <ActivityIndicator color={DARK} style={{ marginTop: 20 }} />
            ) : friends.length === 0 ? (
              <Text style={[styles.detailRowSub, { color: textMuted }]}>No friends yet — add some in Chat.</Text>
            ) : (
              friends.map(f => (
                <View key={f.id} style={styles.friendDetailRow}>
                  <View style={[styles.friendDetailAvatar, { opacity: f.is_online ? 1 : 0.55 }]}>
                    <Text style={[styles.friendDetailInitials, { color: textPrimary }]}>{f.avatar_initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.friendDetailName, { color: textPrimary }]}>{f.full_name}</Text>
                    <View style={[styles.friendBar, { backgroundColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
                      <View style={[styles.friendBarFill, { width: `${Math.round(((f as any).plan_count ?? 0) / maxFriendPlanCount * 100)}%` as any }]} />
                    </View>
                  </View>
                  <Text style={[styles.friendDetailCount, { color: textPrimary }]}>{(f as any).plan_count ?? 0}</Text>
                </View>
              ))
            )}
          </>
        )}

        {stat === 'hours' && (
          <>
            <Text style={[styles.detailSectionLabel, { color: textMuted }]}>OUTDOOR HOURS PER WEEK</Text>
            <View style={[styles.chartCard, { backgroundColor: surface }]}>
              <BarChart data={WEEK_HOURS} labels={WEEK_LABELS} color={Colors.blueLight} />
            </View>
            <View style={styles.hoursTotal}>
              <Text style={styles.hoursTotalLabel}>TOTAL THIS TERM</Text>
              <Text style={styles.hoursTotalValue}>47 hrs</Text>
            </View>
            <View style={[styles.hoursBreakdown, { backgroundColor: surface }]}>
              {[
                { label: "Queen's Lawn", hours: 18 },
                { label: 'Beit Quad',    hours: 12 },
                { label: 'SAF Terrace',  hours: 9  },
                { label: 'Hyde Park',    hours: 8  },
              ].map((b, i, arr) => (
                <View key={i} style={[
                  styles.hoursRow,
                  i === arr.length - 1 && { borderBottomWidth: 0 },
                  { borderBottomColor: dark ? DarkTheme.border : 'rgba(0,0,0,0.08)' },
                ]}>
                  <Text style={[styles.hoursLoc, { color: textPrimary }]}>{b.label}</Text>
                  <View style={[styles.hoursBarTrack, { backgroundColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
                    <View style={[styles.hoursBarFill, { width: `${Math.round((b.hours / 18) * 100)}%` as any }]} />
                  </View>
                  <Text style={[styles.hoursHrs, { color: textPrimary }]}>{b.hours}h</Text>
                </View>
              ))}
            </View>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Profile screen ───────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const [dark, setDarkMode] = useState(isDark());
  useEffect(() => subscribeTheme(() => setDarkMode(isDark())), []);

  const [_viewStack, _setViewStack] = useState<string[]>(['main']);
  const currentView = _viewStack[_viewStack.length - 1];
  const pushView = (view: string) => _setViewStack(p => [...p, view]);
  const popView  = () => _setViewStack(p => (p.length > 1 ? p.slice(0, -1) : p));

  const { user, profile, signOut } = useAuth();
  const [name,   setName]   = useState(profile?.full_name      ?? '');
  const [degree, setDegree] = useState(profile?.degree          ?? '');
  const [year,   setYear]   = useState(profile?.year_of_study   ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [planCount,   setPlanCount]   = useState(12);
  const [friendCount, setFriendCount] = useState(24);
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const profileInitialized = useRef(false);

  const [badges, setBadges] = useState<Badge[]>([]);
  const [earnedMap, setEarnedMap] = useState<Record<string, boolean>>({});

  // Only sync from profile on first load — never let a background re-fetch overwrite local edits
  useEffect(() => {
    if (!profile || profileInitialized.current) return;
    profileInitialized.current = true;
    setName(profile.full_name ?? '');
    setDegree(profile.degree ?? '');
    setYear(profile.year_of_study ?? '');
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    getPlanCount(user.id).then(setPlanCount).catch(() => {});
    getFriendCount(user.id).then(setFriendCount).catch(() => {});

    // Load badges and which ones the user has earned
    (async () => {
      try {
        const all = await getAllBadges();
        const userBadges = await getUserBadges(user.id);
        setBadges(all);
        const map: Record<string, boolean> = {};
        userBadges.forEach(ub => { if (ub.badge && ub.badge.id) map[ub.badge.id] = true; });
        setEarnedMap(map);
      } catch {
        // ignore — badges will remain empty
      }
    })();
  }, [user?.id]);

  const [notifOn,    setNotifOn]    = useState(true);
  const [pushOn,     setPushOn]     = useState(true);
  const [calendarOn, setCalendarOn] = useState(true);
  const [visPublic,  setVisPublic]  = useState(false);
  const [locationOn, setLocationOn] = useState(true);
  const [weatherOn,  setWeatherOn]  = useState(true);
  const [darkOn,     setDarkOn]     = useState(isDark());

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const avatarInitials = profile?.avatar_initials
    ?? (name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?');

  // Theme-derived colours
  const bg           = dark ? DarkTheme.bg       : Colors.lightGrey;
  const surface      = dark ? DarkTheme.surface  : '#ECEEF3';
  const surfaceAlt   = dark ? DarkTheme.surfaceAlt : '#E8EAF0';
  const textPrimary  = dark ? DarkTheme.text      : DARK;
  const textMuted    = dark ? DarkTheme.textMuted : Colors.gray500;
  const divider      = dark ? DarkTheme.border    : 'rgba(0,0,0,0.08)';

  async function handleSaveProfile() {
    if (!user) return;
    // Exit editing immediately so the new name shows right away
    setEditing(false);
    setSaving(true);
    try {
      const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      await updateProfile(user.id, {
        full_name: name,
        degree,
        year_of_study: year,
        avatar_initials: initials,
      });
      showToast('Profile updated');
    } catch {
      showToast('Could not save — check your connection');
    } finally {
      setSaving(false);
    }
  }

  async function pickImage(source: 'library' | 'camera') {
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow camera access in Settings to take a photo.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access in Settings to choose a profile picture.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    }
    if (result.canceled || !result.assets[0]) return;
    if (!user) return;

    let uri = result.assets[0].uri;

    // Front-camera photos appear mirrored — flip horizontally to correct this
    if (source === 'camera') {
      const flipped = await ImageManipulator.manipulateAsync(
        uri,
        [{ flip: ImageManipulator.FlipType.Horizontal }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );
      uri = flipped.uri;
    }

    // Show the photo immediately — don't wait for the upload
    setAvatarUrl(uri);
    setUploadingAvatar(true);
    try {
      const remoteUrl = await uploadAvatar(user.id, uri);
      setAvatarUrl(remoteUrl);
      showToast('Profile picture updated');
    } catch {
      // Keep showing the local photo even if upload fails
      showToast('Could not save to cloud — photo shown locally only');
    } finally {
      setUploadingAvatar(false);
    }
  }

  function handleAvatarPress() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        (idx) => { if (idx === 1) pickImage('camera'); else if (idx === 2) pickImage('library'); }
      );
    } else {
      Alert.alert('Profile picture', 'Choose a source', [
        { text: 'Camera',          onPress: () => pickImage('camera')  },
        { text: 'Photo Library',   onPress: () => pickImage('library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  const TOGGLES: { label: string; on: boolean; set: (v: boolean) => void }[] = [
    { label: 'Notifications',   on: notifOn,    set: setNotifOn    },
    { label: 'Push alerts',     on: pushOn,     set: setPushOn     },
    { label: 'Calendar sync',   on: calendarOn, set: setCalendarOn },
    { label: 'Public profile',  on: visPublic,  set: setVisPublic  },
    { label: 'Share location',  on: locationOn, set: setLocationOn },
    { label: 'Weather updates', on: weatherOn,  set: setWeatherOn  },
    {
      label: 'Dark mode',
      on: darkOn,
      set: (v) => { setDarkOn(v); setDark(v); },
    },
  ];

  if (currentView !== 'main') {
    return <StatDetail stat={currentView as 'plans' | 'friends' | 'hours'} onBack={popView} />;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Avatar + info ── */}
        <View style={styles.profileRow}>
          <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.85} style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarCircle} />
            ) : (
              <View style={[styles.avatarCircle, { backgroundColor: dark ? '#2A3D5E' : '#D8DAE0' }]}>
                <Text style={[styles.avatarText, { color: dark ? 'rgba(255,255,255,0.7)' : '#9098A8' }]}>
                  {avatarInitials}
                </Text>
              </View>
            )}
            <View style={styles.cameraOverlay}>
              {uploadingAvatar
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Ionicons name="camera" size={14} color="#FFF" />}
            </View>
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            {editing ? (
              <>
                <TextInput
                  style={[styles.editInput, { color: textPrimary, borderColor: divider, backgroundColor: surface }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Full name"
                  placeholderTextColor={textMuted}
                  autoCapitalize="words"
                />
                <TextInput
                  style={[styles.editInput, { color: textPrimary, borderColor: divider, backgroundColor: surface }]}
                  value={degree}
                  onChangeText={setDegree}
                  placeholder="Degree / course"
                  placeholderTextColor={textMuted}
                />
                <TextInput
                  style={[styles.editInput, { color: textPrimary, borderColor: divider, backgroundColor: surface }]}
                  value={year}
                  onChangeText={setYear}
                  placeholder="Year (e.g. Year 2)"
                  placeholderTextColor={textMuted}
                />
              </>
            ) : (
              <>
                <Text style={[styles.profileName, { color: textPrimary }]}>{name || 'Your Name'}</Text>
                <Text style={[styles.profileDegree, { color: textPrimary }]}>{degree || 'Degree'}</Text>
                <Text style={[styles.profileYear,   { color: textPrimary }]}>{year   || 'Year'}</Text>
              </>
            )}
          </View>

          <TouchableOpacity
            style={[styles.editIconBtn, { backgroundColor: surface }]}
            onPress={() => editing ? handleSaveProfile() : setEditing(true)}
            activeOpacity={0.75}
          >
            {saving
              ? <ActivityIndicator size="small" color={DARK} />
              : <Ionicons name={editing ? 'checkmark' : 'pencil'} size={18} color={textPrimary} />}
          </TouchableOpacity>
        </View>

        {/* ── Action buttons ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => pushView('plans')} activeOpacity={0.85}>
            <Text style={styles.actionBtnText}>My Plans</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => pushView('friends')} activeOpacity={0.85}>
            <Text style={styles.actionBtnText}>Friends</Text>
          </TouchableOpacity>
        </View>

        {/* ── Badges ── */}
        <Text style={[styles.sectionHeader, { color: textPrimary }]}>Badges</Text>
        <View style={styles.badgeRow}>
          {badges.map(badge => {
            const earned = !!earnedMap[badge.id];
            return (
              <View key={badge.id} style={[styles.badgeTile, { backgroundColor: surfaceAlt, opacity: earned ? 1 : 0.38 }]}>
                <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                <Text style={[styles.badgeLabel, { color: textPrimary }]}>{badge.label}</Text>
                {earned && badge.description ? (
                  <Text style={[styles.badgeDesc, { color: textMuted }]}>{badge.description}</Text>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* ── Settings ── */}
        <View style={styles.settingsHeaderRow}>
          <Text style={[styles.sectionHeader, { color: textPrimary }]}>Settings</Text>
          <Ionicons name="settings-outline" size={22} color={textMuted} />
        </View>

        <View style={[styles.toggleList, { backgroundColor: surface }]}>
          {TOGGLES.map((t, idx) => (
            <View key={t.label} style={[
              styles.toggleRow,
              idx === TOGGLES.length - 1 && styles.toggleRowLast,
              { borderBottomColor: divider },
            ]}>
              <Text style={[styles.toggleLabel, { color: textPrimary }]}>{t.label}</Text>
              <ToggleSwitch on={t.on} onToggle={() => t.set(!t.on)} />
            </View>
          ))}
        </View>

        {/* ── Sign out ── */}
        <TouchableOpacity style={[styles.signOutBtn, { backgroundColor: surface }]} onPress={() => signOut()} activeOpacity={0.85}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={() => setShowDeleteConfirm(true)}>
          <Text style={[styles.deleteBtnText, { color: textMuted }]}>Delete account</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Delete confirmation modal */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={styles.deleteOverlay}>
          <View style={[styles.deleteSheet, { backgroundColor: dark ? DarkTheme.surface : '#FFFFFF' }]}>
            <Text style={styles.deleteSheetTitle}>Delete account?</Text>
            <Text style={[styles.deleteSheetBody, { color: textMuted }]}>
              This will permanently remove your profile, plans, and friend connections. This cannot be undone.
            </Text>
            <TouchableOpacity
              style={styles.deleteConfirmBtn}
              onPress={() => { setShowDeleteConfirm(false); showToast('Account deletion requested'); }}
              activeOpacity={0.85}
            >
              <Text style={styles.deleteConfirmText}>Yes, delete my account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.deleteCancelBtn, { backgroundColor: surface }]} onPress={() => setShowDeleteConfirm(false)} activeOpacity={0.85}>
              <Text style={[styles.deleteCancelText, { color: textPrimary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 20 },

  // Profile row
  profileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 28,
  },
  avatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: Typography.weights.black,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: DARK,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.lightGrey,
  },
  profileInfo: {
    flex: 1,
    gap: 4,
    paddingTop: 4,
  },
  profileName: {
    fontSize: 22,
    fontWeight: Typography.weights.black,
    letterSpacing: -0.3,
  },
  profileDegree: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.medium,
    opacity: 0.75,
  },
  profileYear: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.medium,
    opacity: 0.75,
  },
  editInput: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 4,
  },
  editIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 4,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 36,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: DARK,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Section header
  sectionHeader: {
    fontSize: 22,
    fontWeight: Typography.weights.black,
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  settingsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
  },

  // Badges
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 36,
  },
  badgeTile: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 5,
    minWidth: 80,
  },
  badgeEmoji: { fontSize: 22 },
  badgeLabel: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    textAlign: 'center',
  },
  badgeDesc: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 6,
  },

  // Settings toggles
  toggleList: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleRowLast: { borderBottomWidth: 0 },
  toggleLabel: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.medium,
  },

  // Toggle switch
  track: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.gray300,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: DARK },
  pill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },

  // Sign out / delete
  signOutBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  signOutText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.red,
  },
  deleteBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
  },

  // Delete modal
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  deleteSheet: {
    borderRadius: 20,
    padding: 28,
    width: '100%',
  },
  deleteSheetTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.black,
    color: Colors.red,
    marginBottom: 12,
  },
  deleteSheetBody: {
    fontSize: Typography.sizes.sm,
    lineHeight: 22,
    marginBottom: 24,
  },
  deleteConfirmBtn: {
    backgroundColor: Colors.red,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  deleteConfirmText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
  },
  deleteCancelBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteCancelText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
  },

  // Stats detail view
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: Typography.weights.black,
    letterSpacing: -0.3,
  },
  detailSectionLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 2.5,
    marginBottom: 14,
    marginTop: 20,
  },
  chartCard: {
    borderRadius: 14,
    padding: 16,
  },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 100 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: {
    width: '100%',
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: { width: '100%', borderRadius: 4 },
  barValue: { fontSize: 11, fontWeight: Typography.weights.black },
  barLabel: { fontSize: 9, color: Colors.gray500, fontWeight: Typography.weights.medium },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    gap: 10,
  },
  detailRowTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    marginBottom: 2,
  },
  detailRowSub: { fontSize: 11, fontWeight: Typography.weights.medium },
  detailRowBadge: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.medium },

  friendDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  friendDetailAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bluePale,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  friendDetailInitials: { fontSize: 13, fontWeight: Typography.weights.black },
  friendDetailName: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.black, marginBottom: 5 },
  friendBar: { height: 7, borderRadius: 4, overflow: 'hidden' },
  friendBarFill: { height: '100%', backgroundColor: DARK, borderRadius: 4 },
  friendDetailCount: { fontSize: 13, fontWeight: Typography.weights.black, width: 28, textAlign: 'right' },

  hoursTotal: {
    backgroundColor: DARK,
    borderRadius: 14,
    padding: 18,
    marginTop: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hoursTotalLabel: { fontSize: 10, fontWeight: Typography.weights.black, letterSpacing: 2, color: 'rgba(255,255,255,0.55)' },
  hoursTotalValue: { fontSize: Typography.sizes.xxl, fontWeight: Typography.weights.black, color: '#FFFFFF', letterSpacing: -1 },
  hoursBreakdown: { borderRadius: 14, overflow: 'hidden' },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hoursLoc: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.bold, width: 110 },
  hoursBarTrack: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  hoursBarFill: { height: '100%', backgroundColor: Colors.blueLight, borderRadius: 4 },
  hoursHrs: { fontSize: 12, fontWeight: Typography.weights.black, width: 28, textAlign: 'right' },
});
