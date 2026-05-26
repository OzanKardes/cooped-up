import { View, PanResponder, Animated, Dimensions, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';

import MapScreen      from './map';
import CalendarScreen from './calendar';
import HomeScreen     from './index';
import ChatScreen     from './chat';
import ProfileScreen  from './profile';

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
      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) * 3 && Math.abs(dx) > 12,

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
              <Component />
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
            <TouchableOpacity key={i} style={styles.tabBtn} onPress={() => goTo(i)} activeOpacity={0.7}>
              {isHome ? (
                <View style={[styles.homeCircle, focused && styles.homeCircleActive]}>
                  <Ionicons name="home" size={24} color={focused ? IMPERIAL : '#FFFFFF'} />
                </View>
              ) : (
                <Ionicons
                  name={icon as any}
                  size={24}
                  color={focused ? '#FFFFFF' : 'rgba(255,255,255,0.45)'}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

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
