import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, PanResponder, Dimensions, TouchableWithoutFeedback,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../constants/theme';

const { width, height } = Dimensions.get('window');

export const NAV_ITEMS = [
  { id: 'home',     label: 'HOME' },
  { id: 'plans',    label: 'PLANS' },
  { id: 'discover', label: 'DISCOVER' },
  { id: 'chat',     label: 'CHAT' },
  { id: 'profile',  label: 'PROFILE' },
];

// ─── Expanded dome geometry (unchanged) ───────────────────────────────────────
const DOME_HEIGHT = height * 0.44;
const R = (width * width / 4 + DOME_HEIGHT * DOME_HEIGHT) / (2 * DOME_HEIGHT);
const CX = width / 2;
const CY = DOME_HEIGHT;

const A_START = 148;
const A_END   = 32;

function toRad(d: number) { return (d * Math.PI) / 180; }

function itemPos(i: number, total: number, rot: number) {
  const t   = i / (total - 1);
  const deg = A_START + t * (A_END - A_START) + rot;
  const rad = toRad(deg);
  const lr  = R - 44;
  return { x: CX + lr * Math.cos(rad), y: CY - lr * Math.sin(rad), deg };
}

function textRotation(angleDeg: number) {
  let rot = 90 - angleDeg;
  if (rot < -90) rot += 180;
  if (rot > 90) rot -= 180;
  return rot;
}

function nearestIdx(rot: number, total: number) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < total; i++) {
    const t    = i / (total - 1);
    const deg  = A_START + t * (A_END - A_START) + rot;
    const norm = ((deg % 360) + 360) % 360;
    const d    = Math.abs(norm - 90);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function rotForIdx(i: number, total: number) {
  const t = i / (total - 1);
  return 90 - (A_START + t * (A_END - A_START));
}

function domeSvgPath(safeBottom: number) {
  const lx = CX - R;
  const rx = CX + R;
  return `M ${lx} ${CY} A ${R} ${R} 0 0 1 ${rx} ${CY} L ${rx} ${CY + safeBottom + 80} L ${lx} ${CY + safeBottom + 80} Z`;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  activeTab: string;
  onTabChange: (id: string) => void;
}

export default function WheelNav({ activeTab, onTabChange }: Props) {
  const insets = useSafeAreaInsets();
  const SAFE   = insets.bottom;

  const ARCH_VIS  = 52;
  const COLL_H    = Math.max(56, SAFE + ARCH_VIS);
  const ARCH_TOP  = 12;
  const ARCH_CTRL = 2 * ARCH_TOP - COLL_H;

  const archFill   = `M -2 ${COLL_H} Q ${CX} ${ARCH_CTRL} ${width + 2} ${COLL_H} L ${width + 2} ${COLL_H + 12} L -2 ${COLL_H + 12} Z`;
  const archStroke = `M 0 ${COLL_H} Q ${CX} ${ARCH_CTRL} ${width} ${COLL_H}`;

  const initIdx = Math.max(0, NAV_ITEMS.findIndex(n => n.id === activeTab));
  const [expanded,  setExpanded]  = useState(false);
  const [activeIdx, setActiveIdx] = useState(initIdx);
  const [rot, setRot]             = useState(rotForIdx(initIdx, NAV_ITEMS.length));

  const rotRef       = useRef(rotForIdx(initIdx, NAV_ITEMS.length));
  const activeIdxRef = useRef(initIdx);
  const expandAnim   = useRef(new Animated.Value(0)).current;

  // ── Per-item label opacity (fade on expand/collapse) ──────────────────────
  const labelAnims = useRef(NAV_ITEMS.map(() => new Animated.Value(0))).current;

  // ── Per-item scale (1.15 active, 1.0 inactive) ────────────────────────────
  const scaleAnims = useRef(
    NAV_ITEMS.map((_, i) => new Animated.Value(i === initIdx ? 1.15 : 1.0))
  ).current;

  // ── Momentum / velocity tracking ──────────────────────────────────────────
  const velocityWindow = useRef<number[]>([]);
  const rafRef         = useRef<number | null>(null);
  const lastX          = useRef(0);

  // Stable ref so the PanResponder closure (created once) always calls the
  // latest snapToIndex even as closures re-form across renders
  const snapToIndexRef = useRef<(ni: number) => void>(() => {});

  const containerH = expandAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [COLL_H, DOME_HEIGHT + SAFE + 8],
  });

  // Cancel any running RAF momentum loop
  const cancelMomentum = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  // Cleanup on unmount — prevents memory leak from orphaned RAF loop
  useEffect(() => { return cancelMomentum; }, []);

  // Sync active tab when changed externally (e.g. screen swipe in a future task)
  useEffect(() => {
    const i = NAV_ITEMS.findIndex(n => n.id === activeTab);
    if (i !== -1 && i !== activeIdxRef.current) {
      Animated.spring(scaleAnims[activeIdxRef.current], {
        toValue: 1.0, useNativeDriver: true, tension: 120, friction: 14,
      }).start();
      Animated.spring(scaleAnims[i], {
        toValue: 1.15, useNativeDriver: true, tension: 120, friction: 14,
      }).start();
      const r = rotForIdx(i, NAV_ITEMS.length);
      rotRef.current = r;
      activeIdxRef.current = i;
      setRot(r);
      setActiveIdx(i);
    }
  }, [activeTab]);

  // ── Spring-snap wheel to a specific index ─────────────────────────────────
  const snapToIndex = (ni: number) => {
    const snapped = rotForIdx(ni, NAV_ITEMS.length);
    if (ni !== activeIdxRef.current) {
      Animated.spring(scaleAnims[activeIdxRef.current], {
        toValue: 1.0, useNativeDriver: true, tension: 120, friction: 14,
      }).start();
      Animated.spring(scaleAnims[ni], {
        toValue: 1.15, useNativeDriver: true, tension: 120, friction: 14,
      }).start();
      activeIdxRef.current = ni;
      setActiveIdx(ni);
      onTabChange(NAV_ITEMS[ni].id);
    }
    // Animate the rotation value via a listener-driven spring (layout prop
    // must stay off the native driver, but the spring itself feels physical)
    const anim = new Animated.Value(rotRef.current);
    anim.addListener(({ value }) => { rotRef.current = value; setRot(value); });
    Animated.spring(anim, {
      toValue: snapped,
      useNativeDriver: false,
      tension: 90,
      friction: 16,
    }).start(() => {
      anim.removeAllListeners();
      rotRef.current = snapped;
      setRot(snapped);
    });
  };
  // Updated every render so the PanResponder closure always gets latest version
  snapToIndexRef.current = snapToIndex;

  // ── Expand ─────────────────────────────────────────────────────────────────
  const openWheel = () => {
    cancelMomentum();
    // Reset all labels to invisible before fading in
    labelAnims.forEach(a => a.setValue(0));
    setExpanded(true);
    Animated.spring(expandAnim, {
      toValue: 1, useNativeDriver: false, tension: 45, friction: 13,
    }).start();
    // Staggered fade-in: first label at 100ms, each subsequent +60ms
    labelAnims.forEach((a, i) => {
      Animated.timing(a, {
        toValue: 1, duration: 200, delay: 100 + i * 60, useNativeDriver: true,
      }).start();
    });
  };

  // ── Collapse ───────────────────────────────────────────────────────────────
  const closeWheel = () => {
    cancelMomentum();
    // All labels fade out together in 100ms
    Animated.parallel(
      labelAnims.map(a =>
        Animated.timing(a, { toValue: 0, duration: 100, useNativeDriver: true })
      )
    ).start();
    Animated.spring(expandAnim, {
      toValue: 0, useNativeDriver: false, tension: 60, friction: 14,
    }).start(({ finished }) => { if (finished) setExpanded(false); });
  };

  const pickIndex = (i: number) => {
    snapToIndex(i);
    closeWheel();
  };

  // ── Pan responder (rebuilt: velocity tracking + momentum RAF loop) ─────────
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dx) > 5,

    onPanResponderGrant: (e) => {
      // Cancel any ongoing momentum so the finger takes immediate control
      if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      velocityWindow.current = [];
      lastX.current = e.nativeEvent.pageX;
    },

    onPanResponderMove: (e) => {
      const dx = e.nativeEvent.pageX - lastX.current;
      lastX.current = e.nativeEvent.pageX;

      // Maintain rolling average of last 5 deltas for velocity estimation
      velocityWindow.current.push(dx);
      if (velocityWindow.current.length > 5) velocityWindow.current.shift();

      // Zero-lag rotation: sensitivity 0.18 deg/px
      const newRot = rotRef.current - dx * 0.18;
      rotRef.current = newRot;
      setRot(newRot);  // only setState allowed per-frame

      // Update active item when nearest changes — animates scale
      const ni = nearestIdx(newRot, NAV_ITEMS.length);
      if (ni !== activeIdxRef.current) {
        Animated.spring(scaleAnims[activeIdxRef.current], {
          toValue: 1.0, useNativeDriver: true, tension: 120, friction: 14,
        }).start();
        Animated.spring(scaleAnims[ni], {
          toValue: 1.15, useNativeDriver: true, tension: 120, friction: 14,
        }).start();
        activeIdxRef.current = ni;
        setActiveIdx(ni);
        onTabChange(NAV_ITEMS[ni].id);
      }
    },

    onPanResponderRelease: () => {
      // Compute average pixel velocity from rolling window
      const win = velocityWindow.current;
      const avgDx = win.length > 0 ? win.reduce((s, v) => s + v, 0) / win.length : 0;
      velocityWindow.current = [];

      // Convert to rotation-space velocity (same sensitivity as drag)
      let vel = -avgDx * 0.18;

      // Not enough momentum — snap immediately
      if (Math.abs(vel) < 0.5) {
        snapToIndexRef.current(nearestIdx(rotRef.current, NAV_ITEMS.length));
        return;
      }

      // Momentum deceleration: multiply by 0.92 per frame, stop at 0.5
      const step = () => {
        vel *= 0.92;
        if (Math.abs(vel) < 0.5) {
          snapToIndexRef.current(nearestIdx(rotRef.current, NAV_ITEMS.length));
          return;
        }
        rotRef.current += vel;
        setRot(rotRef.current);

        const ni = nearestIdx(rotRef.current, NAV_ITEMS.length);
        if (ni !== activeIdxRef.current) {
          Animated.spring(scaleAnims[activeIdxRef.current], {
            toValue: 1.0, useNativeDriver: true, tension: 120, friction: 14,
          }).start();
          Animated.spring(scaleAnims[ni], {
            toValue: 1.15, useNativeDriver: true, tension: 120, friction: 14,
          }).start();
          activeIdxRef.current = ni;
          setActiveIdx(ni);
          onTabChange(NAV_ITEMS[ni].id);
        }

        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
  })).current;

  const active = NAV_ITEMS[activeIdx];

  return (
    <>
      {expanded && (
        <TouchableWithoutFeedback onPress={closeWheel}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
      )}

      <Animated.View style={[styles.container, { height: containerH }]}>

        {/* ── COLLAPSED: bezier arch ─────────────────────────────────────── */}
        {!expanded && (
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={openWheel}
            activeOpacity={1}
          >
            {/* Arch SVG taller than container so fill bleeds to screen bottom */}
            <Svg
              width={width}
              height={COLL_H + 14}
              style={{ position: 'absolute', top: 0, left: 0 }}
            >
              <Path d={archFill}   fill={Colors.navy} />
              <Path d={archStroke} fill="none" stroke={Colors.black} strokeWidth="3" />
            </Svg>

            {/* Label sits just below arch peak, well above home indicator */}
            <View style={[styles.collapsedLabel, { top: ARCH_TOP + 6 }]}>
              <Text style={styles.collapsedText}>{active.label}</Text>
              <Text style={styles.collapsedChevron}>▴</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── EXPANDED: full dome ────────────────────────────────────────── */}
        {expanded && (
          <>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg width={width} height={DOME_HEIGHT + SAFE + 80}>
                <Path d={domeSvgPath(SAFE)} fill={Colors.navy} />
                <Path
                  d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
                  fill="none" stroke={Colors.black} strokeWidth="4"
                />
                <Circle cx={CX} cy={CY} r={7} fill={Colors.blueLight} />
              </Svg>
            </View>

            <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
              {NAV_ITEMS.map((item, i) => {
                const pos      = itemPos(i, NAV_ITEMS.length, rot);
                const isActive = i === activeIdx;
                if (pos.y < 0 || pos.y > DOME_HEIGHT) return null;
                const textRot  = textRotation(pos.deg);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.labelWrap,
                      { left: pos.x - 52, top: pos.y - 16, transform: [{ rotate: `${textRot}deg` }] },
                    ]}
                    onPress={() => pickIndex(i)}
                    activeOpacity={0.7}
                  >
                    {/* opacity + scale run on native thread */}
                    <Animated.View style={{
                      opacity: labelAnims[i],
                      transform: [{ scale: scaleAnims[i] }],
                    }}>
                      <Text style={[styles.labelText, isActive && styles.labelTextActive]}>
                        {item.label}
                      </Text>
                    </Animated.View>
                  </TouchableOpacity>
                );
              })}

              <View style={[styles.closeHandle, { bottom: SAFE + 10 }]}>
                <Text style={styles.closeHandleText}>▾  {active.label}</Text>
              </View>
            </View>
          </>
        )}

      </Animated.View>
    </>
  );
}

// ─── Styles (unchanged) ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 998, backgroundColor: 'rgba(0,0,0,0.001)',
  },
  container: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    overflow: 'hidden', backgroundColor: 'transparent',
    zIndex: 999, elevation: 999,
  },

  // Collapsed
  collapsedLabel: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', flexDirection: 'row',
    justifyContent: 'center', gap: 6,
  },
  collapsedText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    letterSpacing: 3,
    color: Colors.white,
  },
  collapsedChevron: {
    fontSize: 10,
    color: Colors.white,
  },

  // Expanded labels on arc
  labelWrap: {
    position: 'absolute', width: 104, height: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  labelText: {
    fontSize: 12, fontWeight: '900',
    letterSpacing: 2, color: Colors.blueMuted, textAlign: 'center',
  },
  labelTextActive: {
    color: Colors.white, fontSize: 14,
  },

  // Bottom handle in expanded state
  closeHandle: {
    position: 'absolute', left: 0, right: 0, alignItems: 'center',
  },
  closeHandleText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 3, color: Colors.white, opacity: 0.6,
  },
});
