import { View, Text, PanResponder, Animated, Dimensions, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import BadgeToast from '../../components/BadgeToast';
import { onBadgeUnlocked } from '../../lib/badgeQueue';
import type { BadgeDef } from '../../services/badges';

import MapScreen      from './map';
import CalendarScreen from './calendar';
import HomeScreen     from './index';
import ChatScreen, { chatNavRef } from './chat';
import ProfileScreen  from './profile';
import { triggerTabReset } from '../../lib/tabResetStore';
import { onPlanInviteCount } from '../../lib/planInviteStore';
import { onChatUnreadCount } from '../../lib/chatUnreadStore';
import AppTour, { type TourStep } from '../../components/AppTour';
import { subscribeToTour } from '../../lib/tourStore';
import { checkTourCompleted, markTourComplete, resetTourForUser } from '../../services/tour';
import { supabase } from '../../lib/supabase';
import { showToast } from '../../components/Toast';

const { width } = Dimensions.get('window');
const IMPERIAL = '#001845';
const INITIAL  = 2; // start on Home

const TABS = [
  { Component: MapScreen,      icon: 'map-outline'        },
  { Component: CalendarScreen, icon: 'calendar-outline'   },
  { Component: HomeScreen,     icon: 'home',   isHome: true },
  { Component: ChatScreen,     icon: 'chatbubble-outline' },
  { Component: ProfileScreen,  icon: 'person-outline'     },
] as const;

export default function TabLayout() {
  const insets  = useSafeAreaInsets();
  const tabBarH = (Platform.OS === 'ios' ? 56 : 60) + insets.bottom;

  const [activeTab, setActiveTab] = useState(INITIAL);
  const translateX = useRef(new Animated.Value(-INITIAL * width)).current;
  const activeRef  = useRef(INITIAL);

  // Shared modal-open ref — written by every screen, read by the PanResponder.
  // A ref (not state) so the PanResponder closure can always see the latest value.
  const modalOpenRef = useRef(false);
  const handleModalChange = (open: boolean) => { modalOpenRef.current = open; };

  // ── Tour state ────────────────────────────────────────────────────────────
  const [tourActive, setTourActive] = useState(false);
  const [tourKey,    setTourKey]    = useState(0); // increment to remount = reset step
  const [tourUserId, setTourUserId] = useState<string | null>(null);

  // Tab button refs (for tour step 4-7 highlights)
  const tabRef0 = useRef<View>(null);
  const tabRef1 = useRef<View>(null);
  const tabRef2 = useRef<View>(null);
  const tabRef3 = useRef<View>(null);
  const tabRef4 = useRef<View>(null);
  const tabButtonRefs = [tabRef0, tabRef1, tabRef2, tabRef3, tabRef4];

  // Home screen tour refs (steps 1-3)
  const tourWeatherRef  = useRef<View>(null);
  const tourYourDayRef  = useRef<View>(null);
  const tourMakePlanRef = useRef<View>(null);
  const homeTourRefs = {
    weatherCard: tourWeatherRef,
    yourDay:     tourYourDayRef,
    makePlan:    tourMakePlanRef,
  };

  // Profile screen tour refs (step 8)
  const tourTrophiesRef  = useRef<View>(null);
  const profileTourRefs  = { trophies: tourTrophiesRef };

  // Tour steps — stable (refs don't change so no dep-array needed)
  const tourSteps = useRef<TourStep[]>([
    {
      title: "Today's conditions",
      description: "See the current weather and how good it is to go outside. We score it 1–10.",
      tabIndex: 2,
      targetRef: tourWeatherRef,
    },
    {
      title: 'Your day',
      description: 'Your plans for today live here. Accept a plan invite and it appears instantly.',
      tabIndex: 2,
      targetRef: tourYourDayRef,
    },
    {
      title: 'Make a plan',
      description: 'Tap here to create a plan, pick a time, invite friends and get outside.',
      tabIndex: 2,
      targetRef: tourMakePlanRef,
    },
    {
      title: 'Plans',
      description: 'See all your plans, incoming invites from friends, and suggested plans based on the weather.',
      tabIndex: 1,
      targetRef: tabRef1,
    },
    {
      title: 'Discover',
      description: 'Find what\'s happening on campus. Tap any building to see how busy it is.',
      tabIndex: 0,
      targetRef: tabRef0,
    },
    {
      title: 'Chat',
      description: 'Message friends and coordinate plans. When you create a plan a group chat is made automatically.',
      tabIndex: 3,
      targetRef: tabRef3,
    },
    {
      title: 'Your profile',
      description: 'Track your hours outside, collect trophies, and manage your settings.',
      tabIndex: 4,
      targetRef: tabRef4,
    },
    {
      title: 'Trophies',
      description: 'Unlock badges by going outside, making plans, and adding friends. Can you get them all?',
      tabIndex: 4,
      targetRef: tourTrophiesRef,
    },
  ]).current;

  // Check tour on mount (first-time user detection)
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      setTourUserId(session.user.id);
      const done = await checkTourCompleted();
      if (!done) {
        setTimeout(() => setTourActive(true), 1200);
      }
    });
  }, []);

  // Subscribe to external startTour() calls (from profile "APP GUIDE" row)
  useEffect(() => subscribeToTour(active => {
    if (active) {
      setTourKey(prev => prev + 1);
      setTourActive(true);
      goTo(2); // always start from Home tab
    }
  }), []);

  const handleTourComplete = () => {
    setTourActive(false);
    if (tourUserId) markTourComplete(tourUserId);
    goTo(2); // return to Home after tour
    setTimeout(() => showToast("You're all set! Go get outside 🐣"), 300);
  };

  // ── Plan invite badge ──────────────────────────────────────────────────────
  const [plansBadge, setPlansBadge] = useState(0);
  useEffect(() => onPlanInviteCount(setPlansBadge), []);

  // ── Chat unread badge ──────────────────────────────────────────────────────
  const [chatBadge, setChatBadge] = useState(0);
  useEffect(() => onChatUnreadCount(setChatBadge), []);

  // ── Badge unlock queue ─────────────────────────────────────────────────────
  const badgeQueue   = useRef<BadgeDef[]>([]);
  const showingBadge = useRef(false);
  const [currentBadge, setCurrentBadge] = useState<BadgeDef | null>(null);

  useEffect(() => onBadgeUnlocked(badge => {
    badgeQueue.current.push(badge);
    if (!showingBadge.current) {
      showingBadge.current = true;
      setCurrentBadge(badgeQueue.current.shift()!);
    }
  }), []);

  const dismissBadge = () => {
    if (badgeQueue.current.length > 0) {
      setCurrentBadge(badgeQueue.current.shift()!);
    } else {
      showingBadge.current = false;
      setCurrentBadge(null);
    }
  };

  const goTo = (index: number) => {
    activeRef.current = index;
    setActiveTab(index);
    Animated.spring(translateX, {
      toValue: -index * width,
      useNativeDriver: true,
      damping: 20,
      stiffness: 180,
      overshootClamping: true,
    }).start();
  };

  const swipe = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !modalOpenRef.current,
      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) => {
        // Block when any modal is open
        if (modalOpenRef.current) return false;
        // Block tab-switching swipe when a screen is in a sub-view
        if (activeRef.current === 3 && chatNavRef.inSubView) return false;
        return Math.abs(dx) > Math.abs(dy) * 3 && Math.abs(dx) > 12;
      },

      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },

      onPanResponderMove: (_, { dx }) => {
        const base = -activeRef.current * width;
        const raw  = base + dx;
        const min  = -(TABS.length - 1) * width;
        const max  = 0;
        // rubber-band past the first/last tab
        const val = raw < min ? min + (raw - min) * 0.15
                  : raw > max ? (raw)      * 0.15
                  : raw;
        translateX.setValue(val);
      },

      onPanResponderRelease: (_, { dx, vx }) => {
        const curr = activeRef.current;
        let target = curr;
        if      (dx < -width * 0.3 || vx < -0.5) target = Math.min(curr + 1, TABS.length - 1);
        else if (dx >  width * 0.3 || vx >  0.5) target = Math.max(curr - 1, 0);
        goTo(target);
      },

      onPanResponderTerminate: () => goTo(activeRef.current),
    })
  ).current;

  return (
    <View style={{ flex: 1, backgroundColor: IMPERIAL }}>

      {/* ── Pager ── */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View
          style={[styles.pager, { width: width * TABS.length, transform: [{ translateX }] }]}
          {...swipe.panHandlers}
        >
          {TABS.map(({ Component }, i) => (
            <View key={i} style={{ width, flex: 1 }}>
              {i === 2 ? (
                <HomeScreen
                  onModalChange={handleModalChange}
                  homeTourRefs={homeTourRefs}
                />
              ) : i === 4 ? (
                <ProfileScreen
                  onModalChange={handleModalChange}
                  profileTourRefs={profileTourRefs}
                  onRedoTour={() => {
                    supabase.auth.getSession().then(({ data: { session } }) => {
                      if (session?.user) {
                        resetTourForUser(session.user.id).then(() => {
                          setTourKey(prev => prev + 1);
                          setTourActive(true);
                          goTo(2);
                        });
                      }
                    });
                  }}
                />
              ) : (
                <Component onModalChange={handleModalChange} />
              )}
            </View>
          ))}
        </Animated.View>
      </View>

      {/* ── Tab bar ── */}
      <View style={[styles.tabBar, { height: tabBarH, paddingBottom: insets.bottom }]}>
        {TABS.map((tab, i) => {
          const { icon } = tab;
          const isHome = 'isHome' in tab && tab.isHome;
          const focused = activeTab === i;
          return (
            <TouchableOpacity
              key={i}
              style={styles.tabBtn}
              onPress={() => {
                if (i === activeTab) triggerTabReset(i);
                goTo(i);
              }}
              activeOpacity={0.7}
            >
              {/* ref wrapper for tour measurement */}
              <View ref={tabButtonRefs[i]} collapsable={false}>
                {isHome ? (
                  <View style={[styles.homeCircle, focused && styles.homeCircleActive]}>
                    <Ionicons name="home" size={24} color={focused ? IMPERIAL : '#FFFFFF'} />
                  </View>
                ) : (
                  <View style={{ position: 'relative' }}>
                    <Ionicons
                      name={icon as any}
                      size={24}
                      color={focused ? '#FFFFFF' : 'rgba(255,255,255,0.45)'}
                    />
                    {i === 1 && plansBadge > 0 && (
                      <View style={styles.tabBadge}>
                        <Text style={styles.tabBadgeText}>{plansBadge > 9 ? '9+' : plansBadge}</Text>
                      </View>
                    )}
                    {i === 3 && chatBadge > 0 && (
                      <View style={styles.tabBadge}>
                        <Text style={styles.tabBadgeText}>{chatBadge > 9 ? '9+' : chatBadge}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Badge toast — floats above all tabs */}
      {currentBadge && (
        <BadgeToast badge={currentBadge} onDismiss={dismissBadge} />
      )}

      {/* App tour overlay — above everything at zIndex 9999 via Modal */}
      {tourActive && (
        <AppTour
          key={tourKey}
          steps={tourSteps}
          onComplete={handleTourComplete}
          navigateToTab={goTo}
          currentTab={activeTab}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pager: {
    flexDirection: 'row',
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: IMPERIAL,
    paddingTop: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -7,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  homeCircle: {
    width: 50, height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeCircleActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
});
