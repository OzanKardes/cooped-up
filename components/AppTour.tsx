import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, Modal,
} from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAD   = 10; // padding around the highlighted element
const T_GAP = 14; // gap between highlight and tooltip

export interface TourStep {
  title: string;
  description: string;
  tabIndex: number;
  targetRef: React.RefObject<View>;
}

interface Rect { x: number; y: number; w: number; h: number; }

interface Props {
  steps: TourStep[];
  onComplete: () => void;
  navigateToTab: (index: number) => void;
  currentTab: number;
}

function wait(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export default function AppTour({ steps, onComplete, navigateToTab, currentTab }: Props) {
  const [stepIdx,   setStepIdx]   = useState(0);
  const [rect,      setRect]      = useState<Rect | null>(null);
  const [above,     setAbove]     = useState(false);

  const overlayOpa = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const currentTabRef = useRef(currentTab);
  const isMounted     = useRef(true);
  const pulseRef      = useRef<Animated.CompositeAnimation | null>(null);

  // Track current tab in a ref so async callbacks always see latest
  useEffect(() => { currentTabRef.current = currentTab; }, [currentTab]);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Pulse animation restarts on each step
  useEffect(() => {
    pulseRef.current?.stop();
    pulseScale.setValue(1);
    pulseRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.03, duration: 850, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1.0,  duration: 850, useNativeDriver: true }),
      ])
    );
    pulseRef.current.start();
    return () => { pulseRef.current?.stop(); };
  }, [stepIdx]);

  // Navigate + measure whenever step changes
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const step = steps[stepIdx];
      overlayOpa.setValue(0);
      setRect(null);

      // Navigate to the correct tab if needed
      if (step.tabIndex !== currentTabRef.current) {
        navigateToTab(step.tabIndex);
        await wait(480); // let spring animation finish
        if (cancelled) return;
      }

      await wait(80); // extra frame for layout pass
      if (cancelled) return;

      // Measure the target element (pageX / pageY = screen coordinates)
      await new Promise<void>(resolve => {
        const ref = step.targetRef.current;
        if (!ref) { resolve(); return; }

        ref.measure((_x, _y, w, h, pageX, pageY) => {
          if (cancelled || !isMounted.current) { resolve(); return; }

          const rx = pageX - PAD;
          const ry = pageY - PAD;
          const rw = w + PAD * 2;
          const rh = h + PAD * 2;

          // Decide whether tooltip goes above or below
          const spaceBelow = SCREEN_H - (ry + rh) - T_GAP;
          const showAbove  = spaceBelow < 200;

          setRect({ x: rx, y: ry, w: rw, h: rh });
          setAbove(showAbove);

          Animated.timing(overlayOpa, {
            toValue: 1, duration: 220, useNativeDriver: true,
          }).start();

          resolve();
        });

        // Safety timeout — if measure never fires (unmounted ref), resolve anyway
        setTimeout(resolve, 600);
      });
    })();

    return () => { cancelled = true; };
  }, [stepIdx, steps, navigateToTab]);

  const handleNext = () => {
    if (stepIdx === steps.length - 1) {
      onComplete();
    } else {
      setStepIdx(prev => prev + 1);
    }
  };

  if (!rect) return null;

  const { x, y, w, h } = rect;
  const step   = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;

  // Tooltip vertical position
  const tooltipStyle = above
    ? { bottom: SCREEN_H - y + T_GAP }
    : { top: y + h + T_GAP };

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => {}}>
      <Animated.View style={[styles.container, { opacity: overlayOpa }]} pointerEvents="box-none">

        {/* ── Backdrop — 4 rectangles simulate a transparent cutout ── */}
        {/* Top */}
        <View style={[styles.backdrop, { top: 0, left: 0, right: 0, height: Math.max(0, y) }]} />
        {/* Bottom */}
        <View style={[styles.backdrop, { top: y + h, left: 0, right: 0, bottom: 0 }]} />
        {/* Left */}
        <View style={[styles.backdrop, { top: y, left: 0, width: Math.max(0, x), height: h }]} />
        {/* Right */}
        <View style={[styles.backdrop, { top: y, left: x + w, right: 0, height: h }]} />

        {/* ── Pulsing highlight ring around the cutout ── */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { left: x, top: y, width: w, height: h, transform: [{ scale: pulseScale }] },
          ]}
        />

        {/* ── Tooltip card ── */}
        <View
          style={[
            styles.tooltip,
            tooltipStyle,
            { left: 20, right: 20 },
          ]}
          pointerEvents="box-none"
        >
          <Text style={styles.stepCount}>{stepIdx + 1} of {steps.length}</Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.desc}>{step.description}</Text>

          <View style={styles.btnRow}>
            <TouchableOpacity
              onPress={onComplete}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.skipText}>SKIP TOUR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>{isLast ? 'FINISH ✓' : 'NEXT →'}</Text>
            </TouchableOpacity>
          </View>
        </View>

      </Animated.View>
    </Modal>
  );
}

const NAVY  = '#001845';
const WHITE = '#FFFFFF';
const BLACK = '#0D0D0D';

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  backdrop: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  ring: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.75)',
    backgroundColor: 'transparent',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: WHITE,
    borderRadius: 4,
    borderWidth: 3,
    borderColor: BLACK,
    padding: 20,
    // Neobrutalist hard offset shadow
    shadowColor: BLACK,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  stepCount: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#7A7A7A',
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  desc: {
    fontSize: 13,
    color: '#3D3D3D',
    lineHeight: 19,
    fontWeight: '400',
    marginBottom: 18,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7A7A7A',
    letterSpacing: 1,
  },
  nextBtn: {
    backgroundColor: NAVY,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  nextBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: WHITE,
    letterSpacing: 1.5,
  },
});
