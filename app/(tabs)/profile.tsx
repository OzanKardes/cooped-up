import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TouchableWithoutFeedback,
  TextInput, Animated, Modal, ActivityIndicator, Image, RefreshControl,
  ActionSheetIOS, Platform, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Colors, Typography, Shadows } from '../../constants/theme';

const DARK = '#001845';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { useFriends } from '../../hooks/useFriends';
import { updateProfile, uploadAvatar, getFriendCount, getPlanCount } from '../../services/users';
import { getMessagesCount } from '../../services/messages';
import { setDark, isDark, subscribe as subscribeTheme, DarkTheme } from '../../lib/themeStore';
import {
  ALL_BADGES, getUserBadges, TIER_COLORS, TIER_LABELS,
  type BadgeDef, type BadgeTier,
} from '../../services/badges';
import { onBadgeUnlocked } from '../../lib/badgeQueue';
import { supabase } from '../../lib/supabase';


const { width } = Dimensions.get('window');
const GRID_GAP = 8;
const COLS = 4;
const CARD_W = Math.floor((width - 40 - GRID_GAP * (COLS - 1)) / COLS);
const LOCKED_BG = '#1A1A2E';
const TIER_ORDER: Record<string, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3 };
const FILTER_OPTIONS = ['ALL', 'bronze', 'silver', 'gold', 'platinum'] as const;

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
  const surface = dark ? DarkTheme.surface : Colors.white;
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
              <BarChart data={WEEK_PLANS} labels={WEEK_LABELS} color={Colors.navy} />
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
              <ActivityIndicator color={Colors.navy} style={{ marginTop: 20 }} />
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

// ─── Badge card ───────────────────────────────────────────────────────────────
function BadgeCard({
  badge, unlocked, onPress,
}: {
  badge: BadgeDef;
  unlocked: boolean;
  onPress: () => void;
}) {
  const isPlatinum = badge.tier === 'platinum';
  const tierC = TIER_COLORS[badge.tier];
  const cardH = isPlatinum ? CARD_W + 10 : CARD_W;

  return (
    <TouchableOpacity
      style={[
        bst.card,
        { width: CARD_W, height: cardH },
        unlocked
          ? { backgroundColor: tierC.bg, borderColor: tierC.bg }
          : { backgroundColor: LOCKED_BG, borderColor: '#3A3A3A' },
        isPlatinum && unlocked && Shadows.sm,
      ]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={bst.emojiWrap}>
        <Text style={[bst.emoji, !unlocked && { opacity: 0.2 }]}>{badge.emoji}</Text>
        {!unlocked && (
          <View style={bst.lockOverlay}>
            <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.6)" />
          </View>
        )}
      </View>
      <Text
        style={[bst.label, { color: unlocked ? tierC.text : 'rgba(255,255,255,0.35)' }]}
        numberOfLines={2}
      >
        {badge.name}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Badge detail modal ────────────────────────────────────────────────────────
function BadgeModal({
  badge, unlocked, unlockedAt, onClose,
}: {
  badge: BadgeDef | null;
  unlocked: boolean;
  unlockedAt: string | null;
  onClose: () => void;
}) {
  if (!badge) return null;
  const tierC = TIER_COLORS[badge.tier];

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <Modal visible={!!badge} transparent animationType="fade" onRequestClose={onClose}>
      <View style={bst.modalOverlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} pointerEvents="box-only" />
        </TouchableWithoutFeedback>
        <TouchableWithoutFeedback onPress={() => {}}>
          <View style={[bst.modalCard, { borderColor: unlocked ? tierC.bg : '#3A3A3A' }]}>
            {/* Tier pill */}
            <View style={[bst.modalTierPill, { backgroundColor: unlocked ? tierC.bg : LOCKED_BG }]}>
              <Text style={[bst.modalTierText, { color: unlocked ? tierC.text : 'rgba(255,255,255,0.5)' }]}>
                {TIER_LABELS[badge.tier].toUpperCase()}
              </Text>
            </View>

            {/* Emoji */}
            <Text style={[bst.modalEmoji, !unlocked && { opacity: 0.25 }]}>{badge.emoji}</Text>

            {/* Name */}
            <Text style={bst.modalName}>{badge.name}</Text>

            {/* Desc / condition */}
            <Text style={bst.modalDesc}>{badge.desc}</Text>

            {/* Status */}
            {unlocked ? (
              <View style={[bst.modalStatusRow, { backgroundColor: tierC.bg }]}>
                <Text style={[bst.modalStatusText, { color: tierC.text }]}>
                  Unlocked {unlockedAt ? formatDate(unlockedAt) : ''}
                </Text>
              </View>
            ) : (
              <View style={bst.modalLockedRow}>
                <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.5)" />
                <Text style={bst.modalLockedText}>{badge.condition}</Text>
              </View>
            )}

            <TouchableOpacity style={bst.modalCloseBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={bst.modalCloseBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
}

// ─── Trophy section ────────────────────────────────────────────────────────────
function TrophySection({
  unlockedMap, dark, textPrimary, textMuted, surface, onModalChange, trophyRef,
}: {
  unlockedMap: Map<string, string>;
  dark: boolean;
  textPrimary: string;
  textMuted: string;
  surface: string;
  onModalChange?: (open: boolean) => void;
  trophyRef?: React.RefObject<View>;
}) {
  const [filter, setFilter] = useState<'ALL' | BadgeTier>('ALL');
  const [modalBadge, setModalBadge] = useState<BadgeDef | null>(null);

  const filtered = ALL_BADGES
    .filter(b => filter === 'ALL' || b.tier === filter)
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
  const unlockedCount = ALL_BADGES.filter(b => unlockedMap.has(b.id)).length;

  return (
    <View ref={trophyRef} collapsable={false}>
      {/* Section header */}
      <View style={tst.headerRow}>
        <Text style={[styles.sectionHeader, { color: textPrimary, marginBottom: 0 }]}>TROPHIES</Text>
        <Text style={[tst.count, { color: textMuted }]}>{unlockedCount} / {ALL_BADGES.length}</Text>
      </View>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={tst.pillScroll}
        contentContainerStyle={tst.pillRow}
      >
        {FILTER_OPTIONS.map(opt => {
          const active = filter === opt;
          const pillBg = active
            ? (opt === 'ALL' ? '#001845' : TIER_COLORS[opt as BadgeTier].bg)
            : (dark ? '#1A2F50' : '#E0E2E8');
          const pillText = active
            ? (opt === 'ALL' ? '#FFFFFF' : TIER_COLORS[opt as BadgeTier].text)
            : textMuted;
          return (
            <TouchableOpacity
              key={opt}
              style={[tst.pill, { backgroundColor: pillBg, borderColor: active ? pillBg : (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') }]}
              onPress={() => setFilter(opt)}
              activeOpacity={0.8}
            >
              <Text style={[tst.pillText, { color: pillText }]}>
                {opt === 'ALL' ? 'ALL' : TIER_LABELS[opt as BadgeTier].toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Grid */}
      <View style={tst.grid}>
        {filtered.map(badge => (
          <BadgeCard
            key={badge.id}
            badge={badge}
            unlocked={unlockedMap.has(badge.id)}
            onPress={() => { setModalBadge(badge); onModalChange?.(true); }}
          />
        ))}
      </View>

      {/* Modal */}
      <BadgeModal
        badge={modalBadge}
        unlocked={modalBadge ? unlockedMap.has(modalBadge.id) : false}
        unlockedAt={modalBadge ? (unlockedMap.get(modalBadge.id) ?? null) : null}
        onClose={() => { setModalBadge(null); onModalChange?.(false); }}
      />
    </View>
  );
}

// ─── Profile screen ───────────────────────────────────────────────────────────
export interface ProfileTourRefs {
  trophies: React.RefObject<View>;
}

export default function ProfileScreen({
  onModalChange, profileTourRefs, onRedoTour,
}: {
  onModalChange?: (open: boolean) => void;
  profileTourRefs?: ProfileTourRefs;
  onRedoTour?: () => void;
}) {
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
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const profileInitialized = useRef(false);


  // Only sync from profile on first load — never let a background re-fetch overwrite local edits
  useEffect(() => {
    if (!profile || profileInitialized.current) return;
    profileInitialized.current = true;
    setName(profile.full_name ?? '');
    setDegree(profile.degree ?? '');
    setYear(profile.year_of_study ?? '');
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile]);


  const [unlockedMap, setUnlockedMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!user) return;
    getUserBadges(user.id).then(list =>
      setUnlockedMap(new Map(list.map(b => [b.badgeId, b.unlockedAt])))
    ).catch(() => {});
  }, [user?.id]);

  // Keep the trophy grid in sync when badges are unlocked from any screen
  useEffect(() => onBadgeUnlocked(badge => {
    setUnlockedMap(prev => {
      const next = new Map(prev);
      next.set(badge.id, new Date().toISOString());
      return next;
    });
  }), []);

  const [notifOn,    setNotifOn]    = useState(true);
  const [pushOn,     setPushOn]     = useState(true);
  const [calendarOn, setCalendarOn] = useState(true);
  const [visPublic,  setVisPublic]  = useState(false);
  const [locationOn, setLocationOn] = useState(true);
  const [weatherOn,  setWeatherOn]  = useState(true);
  const [darkOn,     setDarkOn]     = useState(isDark());

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Debug panel (DEV only)
  const [debugExpanded, setDebugExpanded] = useState(false);
  const [debugRefreshing, setDebugRefreshing] = useState(false);
  const [debugSessionToken, setDebugSessionToken] = useState<string>('—');
  const [debugFriendsCount, setDebugFriendsCount] = useState<number | null>(null);
  const [debugPlansCount, setDebugPlansCount] = useState<number | null>(null);
  const [debugMessagesCount, setDebugMessagesCount] = useState<number | null>(null);

  async function loadDebugData() {
    if (!user) return;
    setDebugRefreshing(true);
    try {
      const [sessionResult, friends, plans, msgs] = await Promise.all([
        supabase.auth.getSession(),
        getFriendCount(user.id),
        getPlanCount(user.id),
        getMessagesCount(user.id),
      ]);
      const token = sessionResult.data.session?.access_token ?? '';
      setDebugSessionToken(token ? token.slice(0, 20) + '…' : '(none)');
      setDebugFriendsCount(friends);
      setDebugPlansCount(plans);
      setDebugMessagesCount(msgs);
    } catch (err: any) {
      console.error('debug panel loadDebugData error:', err);
      showToast('Debug fetch failed');
    } finally {
      setDebugRefreshing(false);
    }
  }

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const list = await getUserBadges(user.id);
      setUnlockedMap(new Map(list.map(b => [b.badgeId, b.unlockedAt])));
    } catch { /* silent */ }
    setRefreshing(false);
  }, [user?.id]);

  const avatarInitials = profile?.avatar_initials
    ?? (name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?');

  // Theme-derived colours
  const bg           = dark ? DarkTheme.bg       : Colors.lightGrey;
  const surface      = dark ? DarkTheme.surface  : Colors.white;
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={dark ? '#FFFFFF' : DARK}
            colors={[DARK]}
          />
        }
      >

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
              ? <ActivityIndicator size="small" color={Colors.navy} />
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

        {/* ── Trophies ── */}
        <TrophySection
          unlockedMap={unlockedMap}
          dark={dark}
          textPrimary={textPrimary}
          textMuted={textMuted}
          surface={surface}
          onModalChange={onModalChange}
          trophyRef={profileTourRefs?.trophies}
        />

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

        {/* ── APP GUIDE ── */}
        <TouchableOpacity
          style={[styles.appGuideRow, { backgroundColor: surface }]}
          onPress={onRedoTour}
          activeOpacity={0.85}
        >
          <Text style={styles.appGuideEmoji}>🧭</Text>
          <Text style={[styles.appGuideLabel, { color: textPrimary }]}>App Guide</Text>
          <Text style={[styles.appGuideArrow, { color: textMuted }]}>→</Text>
        </TouchableOpacity>

        {/* ── Sign out ── */}
        <TouchableOpacity style={[styles.signOutBtn, { backgroundColor: surface }]} onPress={() => signOut()} activeOpacity={0.85}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={() => { setShowDeleteConfirm(true); onModalChange?.(true); }}>
          <Text style={[styles.deleteBtnText, { color: textMuted }]}>Delete account</Text>
        </TouchableOpacity>

        {/* ── DEBUG PANEL (DEV only) ── */}
        {__DEV__ && (
          <View style={[dst.container, { borderColor: debugExpanded ? '#FF3B30' : (dark ? '#3A3A3A' : '#CCCCCC') }]}>
            <TouchableOpacity
              style={dst.header}
              onPress={() => { setDebugExpanded(v => !v); if (!debugExpanded) loadDebugData(); }}
              activeOpacity={0.8}
            >
              <Text style={dst.headerText}>DEBUG</Text>
              <Ionicons name={debugExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="#FF3B30" />
            </TouchableOpacity>

            {debugExpanded && (
              <View style={dst.body}>
                <View style={dst.row}>
                  <Text style={dst.label}>USER ID</Text>
                  <Text style={dst.value} numberOfLines={1}>{user?.id ?? '—'}</Text>
                </View>
                <View style={[dst.row, dst.rowBorder]}>
                  <Text style={dst.label}>SESSION TOKEN</Text>
                  <Text style={dst.value}>{debugSessionToken}</Text>
                </View>
                <View style={[dst.row, dst.rowBorder]}>
                  <Text style={dst.label}>FRIENDS (DB)</Text>
                  <Text style={dst.value}>{debugFriendsCount ?? '…'}</Text>
                </View>
                <View style={[dst.row, dst.rowBorder]}>
                  <Text style={dst.label}>PLANS (DB)</Text>
                  <Text style={dst.value}>{debugPlansCount ?? '…'}</Text>
                </View>
                <View style={[dst.row, dst.rowBorder]}>
                  <Text style={dst.label}>MESSAGES (DB)</Text>
                  <Text style={dst.value}>{debugMessagesCount ?? '…'}</Text>
                </View>
                <TouchableOpacity
                  style={dst.refreshBtn}
                  onPress={loadDebugData}
                  disabled={debugRefreshing}
                  activeOpacity={0.8}
                >
                  {debugRefreshing
                    ? <ActivityIndicator size="small" color="#000" />
                    : <Text style={dst.refreshBtnText}>REFRESH ALL DATA</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Delete confirmation modal */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => { setShowDeleteConfirm(false); onModalChange?.(false); }}>
        <View style={styles.deleteOverlay}>
          <TouchableWithoutFeedback onPress={() => { setShowDeleteConfirm(false); onModalChange?.(false); }}>
            <View style={StyleSheet.absoluteFill} pointerEvents="box-only" />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.deleteSheet, { backgroundColor: dark ? DarkTheme.surface : '#FFFFFF' }]}>
              <Text style={styles.deleteSheetTitle}>Delete account?</Text>
              <Text style={[styles.deleteSheetBody, { color: textMuted }]}>
                This will permanently remove your profile, plans, and friend connections. This cannot be undone.
              </Text>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={() => { setShowDeleteConfirm(false); onModalChange?.(false); showToast('Account deletion requested'); }}
                activeOpacity={0.85}
              >
                <Text style={styles.deleteConfirmText}>Yes, delete my account</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteCancelBtn, { backgroundColor: surface }]} onPress={() => { setShowDeleteConfirm(false); onModalChange?.(false); }} activeOpacity={0.85}>
                <Text style={[styles.deleteCancelText, { color: textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
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
  trackOn: { backgroundColor: Colors.navy },
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

  // App guide row
  appGuideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
    gap: 12,
  },
  appGuideEmoji: { fontSize: 18 },
  appGuideLabel: {
    flex: 1,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
  },
  appGuideArrow: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
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
  friendBarFill: { height: '100%', backgroundColor: Colors.navy, borderRadius: 4 },
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

// ─── Badge card styles ────────────────────────────────────────────────────────
const bst = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    gap: 4,
    marginBottom: GRID_GAP,
  },
  emojiWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 26 },
  lockOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -4,
  },
  label: {
    fontSize: 9,
    fontWeight: Typography.weights.black,
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 12,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#001845',
    borderRadius: 20,
    borderWidth: 3,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
    gap: 10,
    ...Shadows.lg,
  },
  modalTierPill: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  modalTierText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 2.5,
  },
  modalEmoji: { fontSize: 72, marginVertical: 6 },
  modalName: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  modalDesc: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalStatusRow: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  modalStatusText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 0.5,
  },
  modalLockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  modalLockedText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  modalCloseBtn: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  modalCloseBtnText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 2,
  },
});

// ─── Debug panel styles ───────────────────────────────────────────────────────
const dst = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderRadius: 0,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#000000',
  },
  headerText: {
    fontSize: 11,
    fontWeight: '900' as any,
    color: '#FF3B30',
    letterSpacing: 3,
  },
  body: {
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#1F1F1F',
  },
  label: {
    fontSize: 9,
    fontWeight: '900' as any,
    color: '#666666',
    letterSpacing: 1.5,
    flex: 1,
  },
  value: {
    fontSize: 11,
    fontWeight: '700' as any,
    color: '#00FF41',
    fontVariant: ['tabular-nums'],
    maxWidth: '60%',
    textAlign: 'right',
  },
  refreshBtn: {
    marginTop: 10,
    marginBottom: 4,
    borderWidth: 2,
    borderColor: '#FF3B30',
    borderRadius: 0,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  refreshBtnText: {
    fontSize: 11,
    fontWeight: '900' as any,
    color: '#FF3B30',
    letterSpacing: 2,
  },
});

// ─── Trophy section styles ────────────────────────────────────────────────────
const tst = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  count: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
  },
  pillScroll: { marginBottom: 14 },
  pillRow: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  pill: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 11,
    fontWeight: Typography.weights.black,
    letterSpacing: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginBottom: 36,
  },
});
