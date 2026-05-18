import WheelNav, { NAV_ITEMS } from '../../components/WheelNav';
import PlansScreen, { CreatePlanModal, Avatar, EXISTING_PLANS } from './plans';
import DiscoverScreen from './discover';
import ChatScreen from './chat';
import ProfileScreen from './profile';
import { Toast, ToastRef, setToastRef, showToast } from '../../components/Toast';
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, PanResponder, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Borders, Shadows } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { getPlansForToday, formatPlanTime } from '../../services/plans';
import { getOnlineFriends } from '../../services/friends';
import { setOnlineStatus } from '../../services/users';
import type { User } from '../../types';

const SCREEN_W = Dimensions.get('window').width;

// ─── Hardcoded data ───────────────────────────────────────────────────────────
const WEATHER = {
  temp: 18, condition: 'Partly Cloudy', feelsLike: 16,
  wind: 12, humidity: 58, icon: '⛅', score: 8,
};

const HOURLY_FORECAST = [
  { hour: '12pm', emoji: '⛅', temp: 18, score: 7 },
  { hour: '1pm',  emoji: '🌤', temp: 19, score: 8 },
  { hour: '2pm',  emoji: '☀️', temp: 20, score: 9 },
  { hour: '3pm',  emoji: '☀️', temp: 20, score: 9 },
  { hour: '4pm',  emoji: '🌥', temp: 17, score: 6 },
  { hour: '5pm',  emoji: '🌧', temp: 14, score: 3 },
];

const ACTIVITIES = [
  {
    id: '1', title: "Queen's Lawn", status: 'BUSY', tag: 'OUTDOOR',
    desc: '20+ students out. Frisbee, revision, good energy.',
    bg: Colors.bluePale,
  },
  {
    id: '2', title: 'Beit Quad', status: 'QUIET', tag: 'OUTDOOR',
    desc: 'A handful of people. Good for a quiet sit-down.',
    bg: Colors.cream,
  },
  {
    id: '3', title: 'SAF Terrace', status: 'EMPTY', tag: 'HIDDEN GEM',
    desc: 'Rare — nearly empty with great views today.',
    bg: Colors.accent,
  },
];


// ─── Weather banner (expandable) ─────────────────────────────────────────────
function WeatherBanner() {
  const [expanded, setExpanded] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    Animated.spring(anim, {
      toValue: next ? 1 : 0,
      useNativeDriver: false,
      damping: 22,
      stiffness: 160,
    }).start();
  };

  const expandedMaxH = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 260] });

  return (
    <View style={styles.weatherCard}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.92}>
        <View style={styles.weatherTop}>
          <View>
            <Text style={styles.weatherTemp}>{WEATHER.temp}°C</Text>
            <Text style={styles.weatherCondition}>{WEATHER.condition}</Text>
          </View>
          <Text style={styles.weatherIcon}>{WEATHER.icon}</Text>
          <View style={styles.scorePill}>
            <Text style={styles.scoreText}>{WEATHER.score}/10</Text>
          </View>
        </View>
        <View style={styles.weatherDivider} />
        <Text style={styles.nudgeText}>
          {WEATHER.score >= 7
            ? "Conditions are good. Stop being cooped up. 🐣"
            : "Not ideal outside — warm spots available on campus."}
        </Text>
        <View style={styles.weatherStats}>
          <Text style={styles.weatherStat}>💨 {WEATHER.wind}km/h</Text>
          <Text style={styles.weatherStat}>💧 {WEATHER.humidity}%</Text>
          <Text style={styles.weatherStat}>Feels {WEATHER.feelsLike}°C</Text>
        </View>
        <Text style={styles.weatherExpandHint}>
          {expanded ? '▲ HIDE FORECAST' : '▼ HOURLY FORECAST'}
        </Text>
      </TouchableOpacity>

      <Animated.View style={{ maxHeight: expandedMaxH, overflow: 'hidden' }}>
        <View style={styles.hourlyDivider} />
        <Text style={styles.hourlyTitle}>NEXT 6 HOURS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourlyScroll}>
          {HOURLY_FORECAST.map((h, idx) => (
            <View key={idx} style={styles.hourlyCol}>
              <Text style={styles.hourlyTime}>{h.hour}</Text>
              <Text style={styles.hourlyEmoji}>{h.emoji}</Text>
              <Text style={styles.hourlyTemp}>{h.temp}°C</Text>
              <View style={styles.scoreBarTrack}>
                <View style={[styles.scoreBarFill, { height: Math.round(h.score * 2.4) }]} />
              </View>
              <Text style={styles.hourlyScore}>{h.score}</Text>
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ─── Space card (expandable) ──────────────────────────────────────────────────
function SpaceCard({
  item, isExpanded, onToggle, onInvite,
}: {
  item: typeof ACTIVITIES[0];
  isExpanded: boolean;
  onToggle: () => void;
  onInvite: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: isExpanded ? 1 : 0,
      useNativeDriver: false,
      damping: 22,
      stiffness: 160,
    }).start();
  }, [isExpanded]);

  const expandedMaxH = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 300] });

  return (
    <View style={[styles.spaceCard, { backgroundColor: item.bg }]}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.85}>
        <View style={styles.spaceCardTop}>
          <Text style={styles.spaceTitle}>{item.title}</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.spaceDesc}>{item.desc}</Text>
        <View style={styles.spaceCardBottom}>
          <View style={styles.tagPill}>
            <Text style={styles.tagPillText}>{item.tag}</Text>
          </View>
          <Text style={styles.spaceExpandHint}>{isExpanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      <Animated.View style={{ maxHeight: expandedMaxH, overflow: 'hidden' }}>
        <View style={styles.spaceExpandedInner}>
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPin}>📍</Text>
            <Text style={styles.mapLocationName}>{item.title}</Text>
          </View>

          <View style={styles.expandedBtnRow}>
            <TouchableOpacity style={styles.inviteBtn} onPress={onInvite} activeOpacity={0.85}>
              <Text style={styles.inviteBtnText}>INVITE FRIENDS</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => showToast(`Shared ${item.title} to chat`)}
              activeOpacity={0.85}
            >
              <Text style={styles.shareBtnText}>SHARE IN CHAT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

interface ActivityItem {
  id: string; name: string; initials: string;
  activity: string; detail: string; free: boolean;
  location: string; time: string;
}

// ─── Friend activity card ─────────────────────────────────────────────────────
function FriendActivityCard({
  activity, joined, onJoin, onLeave,
}: {
  activity: ActivityItem;
  joined: boolean;
  onJoin: () => void;
  onLeave: () => void;
}) {
  return (
    <View style={styles.friendActivityCard}>
      <Avatar initials={activity.initials} size={42} free={activity.free} />
      <View style={styles.friendActivityInfo}>
        <Text style={styles.friendActivityName}>{activity.name}</Text>
        <Text style={styles.friendActivityAction}>{activity.activity}</Text>
        <Text style={styles.friendActivityDetail}>{activity.detail}</Text>
      </View>
      {joined ? (
        <View style={styles.joinedWrap}>
          <View style={styles.joinedBadge}>
            <Text style={styles.joinedBadgeText}>✓ JOINED</Text>
          </View>
          <TouchableOpacity onPress={onLeave} activeOpacity={0.7}>
            <Text style={styles.leaveText}>LEAVE</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.joinBtn} onPress={onJoin} activeOpacity={0.85}>
          <Text style={styles.joinBtnText}>JOIN</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Compact plan card ────────────────────────────────────────────────────────
function CompactPlanCard({
  plan, joined,
}: {
  plan: { id: string; title: string; location: string; time: string; weather?: string; via?: string };
  joined?: boolean;
}) {
  return (
    <View style={[styles.compactPlanCard, joined && styles.compactPlanCardJoined]}>
      <Text style={styles.compactPlanTime}>{plan.time}</Text>
      <View style={styles.compactPlanBody}>
        <Text style={styles.compactPlanTitle}>{plan.title}</Text>
        <Text style={styles.compactPlanLocation}>
          {plan.location}{plan.via ? `  ·  via ${plan.via}` : ''}
        </Text>
      </View>
      {plan.weather ? (
        <Text style={styles.compactPlanWeather}>{plan.weather}</Text>
      ) : null}
    </View>
  );
}

// ─── Home content ─────────────────────────────────────────────────────────────
function HomeContent() {
  const { user, profile } = useAuth();
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [notifOn, setNotifOn] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [joinedActivities, setJoinedActivities] = useState<Set<string>>(new Set());
  const [userCreatedPlans, setUserCreatedPlans] = useState<
    { id: string; title: string; location: string; time: string; weather: string }[]
  >([]);
  const [dbTodayPlans, setDbTodayPlans] = useState<
    { id: string; title: string; location: string; time: string; weather: string }[]
  >([]);
  const [onlineFriends, setOnlineFriends] = useState<User[]>([]);

  // Fetch today's plans and online friends on mount / when user changes
  useEffect(() => {
    if (!user) return;
    setOnlineStatus(user.id, true);
    getPlansForToday(user.id).then(plans => {
      setDbTodayPlans(plans.map(p => ({
        id: p.id,
        title: p.title,
        location: p.location,
        time: formatPlanTime(p.time),
        weather: p.weather_snapshot
          ? `${(p.weather_snapshot as any).emoji} ${(p.weather_snapshot as any).temp}°C`
          : '⛅ —',
      })));
    });
    getOnlineFriends(user.id).then(setOnlineFriends);
    return () => { if (user) setOnlineStatus(user.id, false); };
  }, [user?.id]);

  const toggleCard = (id: string) => setExpandedCardId(prev => (prev === id ? null : id));

  const joinActivity = (act: ActivityItem) => {
    setJoinedActivities(prev => new Set([...prev, act.id]));
    showToast(`Joined ${act.name}'s activity — added to Your Day`);
  };

  const leaveActivity = (id: string) => {
    setJoinedActivities(prev => { const s = new Set(prev); s.delete(id); return s; });
    showToast('Left activity');
  };

  // Today's plans: real DB data takes priority over hardcoded fallback
  const hardcodedMyPlans = EXISTING_PLANS.filter(p => p.creator === 'You');
  const joinedPlans = onlineFriends
    .filter(f => joinedActivities.has(f.id))
    .map(f => ({ id: `joined_${f.id}`, title: 'Online now', location: 'Campus', time: 'Now', via: f.full_name }));

  const basePlans = dbTodayPlans.length > 0
    ? dbTodayPlans
    : hardcodedMyPlans.map(p => ({ id: p.id, title: p.title, location: p.location, time: p.time, weather: p.weather }));

  const allDayPlans = [
    ...basePlans,
    ...userCreatedPlans,
    ...joinedPlans,
  ];

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.homeContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.homeHeader}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {`GOOD ${new Date().getHours() < 12 ? 'MORNING' : new Date().getHours() < 17 ? 'AFTERNOON' : 'EVENING'}`}
              {profile?.full_name ? `, ${profile.full_name.split(' ')[0].toUpperCase()}` : ''}
            </Text>
            <Text style={styles.campus} numberOfLines={1}>Imperial College London</Text>
          </View>
          <TouchableOpacity
            style={[styles.notifBtn, !notifOn && styles.notifBtnOff]}
            onPress={() => setNotifOn(v => !v)}
          >
            <Text style={styles.notifIcon}>{notifOn ? '🔔' : '🔕'}</Text>
          </TouchableOpacity>
        </View>

        {/* YOUR DAY — before weather */}
        <Text style={styles.sectionTitle}>YOUR DAY</Text>
        {allDayPlans.length > 0 ? (
          <>
            {allDayPlans.map(plan => (
              <CompactPlanCard key={plan.id} plan={plan} joined={'via' in plan} />
            ))}
            <TouchableOpacity
              style={styles.addPlanBtn}
              onPress={() => setCreateModalVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.addPlanBtnText}>+ ADD PLAN</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyDayCard}>
            <Text style={styles.emptyDayText}>Nothing planned — add one?</Text>
            <TouchableOpacity
              style={styles.addPlanBtn}
              onPress={() => setCreateModalVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.addPlanBtnText}>+ ADD PLAN</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Weather */}
        <View style={{ marginTop: 24 }}>
          <WeatherBanner />
        </View>

        {/* Friends right now — real online friends */}
        <Text style={styles.sectionTitle}>FRIENDS RIGHT NOW</Text>
        {onlineFriends.length > 0
          ? onlineFriends.map(f => {
              const fakeActivity = {
                id: f.id,
                name: f.full_name,
                initials: f.avatar_initials,
                activity: 'Online now',
                detail: 'Active on Cooped Up',
                free: true,
                location: 'Campus',
                time: 'Now',
              };
              return (
                <FriendActivityCard
                  key={f.id}
                  activity={fakeActivity}
                  joined={joinedActivities.has(f.id)}
                  onJoin={() => joinActivity(fakeActivity)}
                  onLeave={() => leaveActivity(f.id)}
                />
              );
            })
          : (
            <View style={styles.emptyFriendsCard}>
              <Text style={styles.emptyFriendsText}>No friends online right now.</Text>
              <Text style={styles.emptyFriendsHint}>
                Add friends in the Chat tab to see when they're free and plan things together.
              </Text>
              <TouchableOpacity
                style={styles.emptyFriendsBtn}
                onPress={() => showToast('Head to the Chat tab to add friends')}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyFriendsBtnText}>+ ADD FRIENDS IN CHAT</Text>
              </TouchableOpacity>
            </View>
          )}

        {/* On campus now */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>ON CAMPUS NOW</Text>
        {ACTIVITIES.map(item => (
          <SpaceCard
            key={item.id}
            item={item}
            isExpanded={expandedCardId === item.id}
            onToggle={() => toggleCard(item.id)}
            onInvite={() => setInviteModalVisible(true)}
          />
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>

      <CreatePlanModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreate={plan => setUserCreatedPlans(prev => [...prev, plan])}
      />
      <CreatePlanModal
        visible={inviteModalVisible}
        onClose={() => setInviteModalVisible(false)}
        onCreate={plan => setUserCreatedPlans(prev => [...prev, plan])}
      />
    </>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
const TABS = ['home', 'plans', 'discover', 'chat', 'profile'] as const;
type TabId = typeof TABS[number];

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const toastRef = useRef<ToastRef>(null);

  const [tabStacks, setTabStacks] = useState<Record<TabId, string[]>>({
    home: ['main'], plans: ['main'], discover: ['main'], chat: ['main'], profile: ['main'],
  });

  const activeTabRef     = useRef<TabId>('home');
  const pendingTabRef    = useRef<TabId | null>(null);
  const transitioningRef = useRef(false);
  const swipeDirRef      = useRef(0); // -1 = left swipe (next tab), +1 = right (prev tab)
  const wheelDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stackDepthRef    = useRef<Record<TabId, number>>({
    home: 1, plans: 1, discover: 1, chat: 1, profile: 1,
  });

  // Per-screen translateX. Home starts visible at 0, others parked off-screen.
  const screenAnims = useRef<Record<TabId, Animated.Value>>(
    Object.fromEntries(
      TABS.map(tab => [tab, new Animated.Value(tab === 'home' ? 0 : SCREEN_W * 2)])
    ) as Record<TabId, Animated.Value>
  ).current;

  useEffect(() => { setToastRef(toastRef); }, []);

  const navigateTo = (tabId: TabId) => {
    if (tabId === activeTabRef.current || transitioningRef.current) return;

    const fromId  = activeTabRef.current;
    const fromIdx = NAV_ITEMS.findIndex(n => n.id === fromId);
    const toIdx   = NAV_ITEMS.findIndex(n => n.id === tabId);
    const dir     = toIdx > fromIdx ? -1 : 1; // -1 = slide left, +1 = slide right

    screenAnims[tabId].setValue(dir > 0 ? -SCREEN_W : SCREEN_W);
    transitioningRef.current = true;
    activeTabRef.current = tabId;

    Animated.parallel([
      Animated.spring(screenAnims[fromId], {
        toValue: dir * SCREEN_W, useNativeDriver: true, tension: 68, friction: 12,
      }),
      Animated.spring(screenAnims[tabId], {
        toValue: 0, useNativeDriver: true, tension: 68, friction: 12,
      }),
    ]).start(({ finished }) => {
      screenAnims[fromId].setValue(SCREEN_W * 2);
      if (finished) {
        setActiveTab(tabId);
        transitioningRef.current = false;
      }
    });
  };

  // WheelNav fires onTabChange on every frame during drag — debounce so we only
  // animate once the wheel has settled (80ms of silence).
  // Block tab switches when the active tab has a sub-view open.
  const handleWheelTabChange = (tabId: string) => {
    if (stackDepthRef.current[activeTabRef.current] > 1) return;
    if (wheelDebounceRef.current) clearTimeout(wheelDebounceRef.current);
    wheelDebounceRef.current = setTimeout(() => navigateTo(tabId as TabId), 80);
  };

  // Per-tab push/pop nav — used by screens that have sub-views
  const makeNavProps = (tab: TabId) => ({
    pushView: (view: string) => {
      setTabStacks(prev => ({ ...prev, [tab]: [...prev[tab], view] }));
      stackDepthRef.current[tab]++;
    },
    popView: () => {
      setTabStacks(prev => ({
        ...prev,
        [tab]: prev[tab].length > 1 ? prev[tab].slice(0, -1) : prev[tab],
      }));
      if (stackDepthRef.current[tab] > 1) stackDepthRef.current[tab]--;
    },
    currentView: tabStacks[tab][tabStacks[tab].length - 1] ?? 'main',
  });

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 14 && Math.abs(g.dx) > 2.5 * Math.abs(g.dy),

    onPanResponderMove: (_, g) => {
      if (transitioningRef.current) return;
      if ((stackDepthRef.current[activeTabRef.current] ?? 1) > 1) return;
      if (wheelDebounceRef.current) { clearTimeout(wheelDebounceRef.current); wheelDebounceRef.current = null; }

      const dx      = g.dx;
      const fromIdx = NAV_ITEMS.findIndex(n => n.id === activeTabRef.current);

      if (!pendingTabRef.current) {
        if (dx < 0 && fromIdx < NAV_ITEMS.length - 1) {
          const toId = NAV_ITEMS[fromIdx + 1].id as TabId;
          pendingTabRef.current = toId;
          swipeDirRef.current   = -1;
          screenAnims[toId].setValue(SCREEN_W);
        } else if (dx > 0 && fromIdx > 0) {
          const toId = NAV_ITEMS[fromIdx - 1].id as TabId;
          pendingTabRef.current = toId;
          swipeDirRef.current   = 1;
          screenAnims[toId].setValue(-SCREEN_W);
        } else {
          return;
        }
      }

      const fromId  = activeTabRef.current;
      const pending = pendingTabRef.current!;
      const offset  = swipeDirRef.current > 0 ? -SCREEN_W : SCREEN_W;

      screenAnims[fromId].setValue(dx);
      screenAnims[pending].setValue(dx + offset);
    },

    onPanResponderRelease: (_, g) => {
      const depth = stackDepthRef.current[activeTabRef.current] ?? 1;
      if (depth > 1) {
        if (g.dx > SCREEN_W * 0.15 || g.vx > 0.3) {
          setTabStacks(prev => ({
            ...prev,
            [activeTabRef.current]: prev[activeTabRef.current].slice(0, -1),
          }));
          stackDepthRef.current[activeTabRef.current]--;
        }
        return;
      }

      const pending = pendingTabRef.current;
      if (!pending) return;

      const fromId   = activeTabRef.current;
      const dir      = swipeDirRef.current;
      const offset   = dir > 0 ? -SCREEN_W : SCREEN_W;
      const complete = Math.abs(g.dx) > SCREEN_W * 0.4 || Math.abs(g.vx) > 0.3;

      if (complete) {
        transitioningRef.current = true;
        activeTabRef.current     = pending;

        Animated.parallel([
          Animated.spring(screenAnims[fromId], {
            toValue: dir * SCREEN_W, useNativeDriver: true, tension: 68, friction: 12,
          }),
          Animated.spring(screenAnims[pending], {
            toValue: 0, useNativeDriver: true, tension: 68, friction: 12,
          }),
        ]).start(({ finished }) => {
          screenAnims[fromId].setValue(SCREEN_W * 2);
          pendingTabRef.current = null;
          swipeDirRef.current   = 0;
          if (finished) {
            setActiveTab(pending);
            transitioningRef.current = false;
          }
        });
      } else {
        Animated.parallel([
          Animated.spring(screenAnims[fromId], {
            toValue: 0, useNativeDriver: true, tension: 68, friction: 12,
          }),
          Animated.spring(screenAnims[pending], {
            toValue: offset, useNativeDriver: true, tension: 68, friction: 12,
          }),
        ]).start(({ finished }) => {
          if (finished) screenAnims[pending].setValue(SCREEN_W * 2);
          pendingTabRef.current = null;
          swipeDirRef.current   = 0;
        });
      }
    },

    onPanResponderTerminate: () => {
      const pending = pendingTabRef.current;
      const fromId  = activeTabRef.current;
      const springs: Animated.CompositeAnimation[] = [
        Animated.spring(screenAnims[fromId], {
          toValue: 0, useNativeDriver: true, tension: 68, friction: 12,
        }),
      ];
      if (pending) {
        const offset = swipeDirRef.current > 0 ? -SCREEN_W : SCREEN_W;
        springs.push(Animated.spring(screenAnims[pending], {
          toValue: offset, useNativeDriver: true, tension: 68, friction: 12,
        }));
      }
      Animated.parallel(springs).start(() => {
        if (pending) screenAnims[pending].setValue(SCREEN_W * 2);
        pendingTabRef.current    = null;
        swipeDirRef.current      = 0;
        transitioningRef.current = false;
      });
    },
  })).current;

  const screens: Record<TabId, React.ReactElement> = {
    home:     <HomeContent />,
    plans:    <PlansScreen />,
    discover: <DiscoverScreen />,
    chat:     <ChatScreen    {...makeNavProps('chat')} />,
    profile:  <ProfileScreen {...makeNavProps('profile')} />,
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.white }}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.content, { overflow: 'hidden' }]} {...panResponder.panHandlers}>
          {TABS.map(tab => (
            <Animated.View
              key={tab}
              style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: screenAnims[tab] }] }]}
              pointerEvents={tab === activeTab ? 'auto' : 'none'}
            >
              {screens[tab]}
            </Animated.View>
          ))}
        </View>
      </SafeAreaView>
      <WheelNav activeTab={activeTab} onTabChange={handleWheelTabChange} />
      <Toast ref={toastRef} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  content: { flex: 1 },
  homeContent: { paddingHorizontal: 20, paddingTop: 20 },

  homeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 3,
    color: Colors.gray500,
  },
  campus: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    letterSpacing: -0.5,
  },
  notifBtn: {
    width: 44, height: 44,
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  notifBtnOff: { opacity: 0.5 },
  notifIcon: { fontSize: 18 },

  sectionTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 3,
    color: Colors.gray500,
    marginBottom: 12,
  },

  // Weather card
  weatherCard: {
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    padding: 20,
    marginBottom: 28,
    ...Shadows.md,
  },
  weatherTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  weatherTemp: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.black,
    color: Colors.white,
    letterSpacing: -1,
  },
  weatherCondition: {
    fontSize: Typography.sizes.sm,
    color: Colors.blueMuted,
    fontWeight: Typography.weights.medium,
  },
  weatherIcon: {
    fontSize: 40,
    marginLeft: 'auto',
    marginRight: 12,
  },
  scorePill: {
    backgroundColor: Colors.bluePale,
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scoreText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
  },
  weatherDivider: {
    height: 2,
    backgroundColor: Colors.blueLight,
    marginBottom: 14,
  },
  nudgeText: {
    fontSize: Typography.sizes.md,
    color: Colors.white,
    lineHeight: 22,
    marginBottom: 14,
    fontWeight: Typography.weights.medium,
  },
  weatherStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  weatherStat: {
    fontSize: Typography.sizes.xs,
    color: Colors.blueMuted,
    fontWeight: Typography.weights.medium,
  },
  weatherExpandHint: {
    fontSize: 9,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
    color: Colors.blueMuted,
    textAlign: 'center',
  },

  hourlyDivider: {
    height: 2,
    backgroundColor: Colors.blueLight,
    marginTop: 14,
    marginBottom: 14,
  },
  hourlyTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 3,
    color: Colors.blueMuted,
    marginBottom: 12,
  },
  hourlyScroll: { marginBottom: 8 },
  hourlyCol: { alignItems: 'center', marginRight: 18, gap: 4 },
  hourlyTime: { fontSize: 10, color: Colors.blueMuted, fontWeight: Typography.weights.bold },
  hourlyEmoji: { fontSize: 20 },
  hourlyTemp: { fontSize: 11, color: Colors.white, fontWeight: Typography.weights.black },
  scoreBarTrack: {
    width: 16, height: 24,
    backgroundColor: Colors.blueLight,
    borderRadius: 2,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  scoreBarFill: { width: '100%', backgroundColor: Colors.bluePale, borderRadius: 2 },
  hourlyScore: { fontSize: 9, color: Colors.blueMuted, fontWeight: Typography.weights.bold },

  // Space card
  spaceCard: {
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    padding: 16,
    marginBottom: 12,
    ...Shadows.sm,
  },
  spaceCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  spaceTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    letterSpacing: -0.5,
  },
  statusPill: {
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radiusSm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.white,
  },
  statusText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 1,
    color: Colors.navy,
  },
  spaceDesc: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray700,
    lineHeight: 20,
    marginBottom: 10,
  },
  spaceCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagPill: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: Colors.navy,
    borderRadius: Borders.radiusSm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagPillText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.5,
    color: Colors.navy,
  },
  spaceExpandHint: {
    fontSize: 12,
    color: Colors.navy,
    fontWeight: Typography.weights.black,
  },

  spaceExpandedInner: { paddingTop: 14 },
  mapPlaceholder: {
    backgroundColor: Colors.navy,
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    gap: 4,
  },
  mapPin: { fontSize: 24 },
  mapLocationName: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: Colors.white,
    letterSpacing: 1,
  },
  expandedLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
    color: Colors.gray500,
    marginBottom: 8,
  },
  friendAvatarStrip: { marginBottom: 14 },
  avatarChip: { alignItems: 'center', marginRight: 14, gap: 5 },
  avatarChipName: { fontSize: 10, fontWeight: Typography.weights.black, color: Colors.navy },
  expandedBtnRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  inviteBtn: {
    flex: 1,
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingVertical: 10,
    alignItems: 'center',
    ...Shadows.sm,
  },
  inviteBtnText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 1.5,
    color: Colors.white,
  },
  shareBtn: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingVertical: 10,
    alignItems: 'center',
    ...Shadows.sm,
  },
  shareBtnText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 1.5,
    color: Colors.navy,
  },

  // Friend activity cards
  friendActivityCard: {
    backgroundColor: Colors.white,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Shadows.sm,
  },
  friendActivityInfo: { flex: 1 },
  friendActivityName: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    marginBottom: 2,
  },
  friendActivityAction: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray700,
    fontWeight: Typography.weights.medium,
    marginBottom: 2,
  },
  friendActivityDetail: {
    fontSize: 11,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
  },
  joinBtn: {
    backgroundColor: Colors.navy,
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  joinBtnText: {
    fontSize: 11,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
    color: Colors.white,
  },
  joinedWrap: { alignItems: 'center', gap: 4 },
  joinedBadge: {
    backgroundColor: Colors.greenLight,
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  joinedBadgeText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 1,
    color: Colors.green,
  },
  leaveText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.gray500,
    letterSpacing: 1,
  },

  // Compact plan card
  compactPlanCard: {
    backgroundColor: Colors.cream,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Shadows.sm,
  },
  compactPlanCardJoined: { backgroundColor: Colors.bluePale },
  compactPlanTime: {
    fontSize: 11,
    fontWeight: Typography.weights.black,
    color: Colors.gray500,
    letterSpacing: 0.5,
    width: 72,
  },
  compactPlanBody: { flex: 1 },
  compactPlanTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  compactPlanLocation: {
    fontSize: Typography.sizes.xs,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
  },
  compactPlanWeather: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray700,
    fontWeight: Typography.weights.medium,
  },

  emptyFriendsCard: {
    backgroundColor: Colors.gray100,
    borderWidth: Borders.width,
    borderColor: Colors.gray300,
    borderRadius: Borders.radius,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  emptyFriendsText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
  },
  emptyFriendsHint: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
    textAlign: 'center',
  },
  emptyFriendsBtn: {
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
    ...Shadows.sm,
  },
  emptyFriendsBtnText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 1.5,
    color: Colors.white,
  },
  emptyDayCard: {
    backgroundColor: Colors.gray100,
    borderWidth: Borders.width,
    borderColor: Colors.gray300,
    borderRadius: Borders.radius,
    padding: 20,
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  emptyDayText: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
  },
  addPlanBtn: {
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 10,
    ...Shadows.sm,
  },
  addPlanBtnText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
    color: Colors.white,
  },
});
