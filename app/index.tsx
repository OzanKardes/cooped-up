import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, StyleSheet, Text,
  TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');
const NAVY = '#001845';
const STROKE = 'rgba(255,255,255,0.85)';
const SW = 1.5;

// ─── Scene 1: person holding phone with floating app card ────────────────────
function Scene1() {
  return (
    <Svg width={220} height={280} viewBox="0 0 220 280">
      {/* Phone body */}
      <Rect x={84} y={102} width={52} height={80} rx={6}
        stroke={STROKE} strokeWidth={2} fill="none" />
      {/* Phone screen: map dots + dashes */}
      <Circle cx={100} cy={128} r={4} stroke={STROKE} strokeWidth={1} fill="none" opacity={0.6} />
      <Circle cx={118} cy={118} r={4} stroke={STROKE} strokeWidth={1} fill="none" opacity={0.6} />
      <Circle cx={126} cy={138} r={4} stroke={STROKE} strokeWidth={1} fill="none" opacity={0.6} />
      <Line x1={100} y1={128} x2={118} y2={118} stroke={STROKE} strokeWidth={0.8} opacity={0.35} strokeDasharray="2,3" />
      <Line x1={118} y1={118} x2={126} y2={138} stroke={STROKE} strokeWidth={0.8} opacity={0.35} strokeDasharray="2,3" />
      <Line x1={91} y1={155} x2={129} y2={155} stroke={STROKE} strokeWidth={0.8} opacity={0.3} />
      <Line x1={91} y1={164} x2={118} y2={164} stroke={STROKE} strokeWidth={0.8} opacity={0.3} />

      {/* Person: head */}
      <Circle cx={110} cy={66} r={24} stroke={STROKE} strokeWidth={SW} fill="none" />
      {/* Shoulders/chest behind phone */}
      <Path d="M90 90 Q110 100 130 90 L130 105 L90 105 Z"
        stroke={STROKE} strokeWidth={SW} fill="none" />
      {/* Arms curved to hold phone sides */}
      <Path d="M90 96 Q74 122 84 140" stroke={STROKE} strokeWidth={SW} fill="none" />
      <Path d="M130 96 Q146 122 136 140" stroke={STROKE} strokeWidth={SW} fill="none" />
      {/* Hip + legs below phone */}
      <Path d="M90 182 Q110 190 130 182" stroke={STROKE} strokeWidth={SW} fill="none" />
      <Line x1={100} y1={182} x2={90} y2={248} stroke={STROKE} strokeWidth={SW} />
      <Line x1={120} y1={182} x2={130} y2={248} stroke={STROKE} strokeWidth={SW} />

      {/* Floating app card */}
      <Rect x={10} y={12} width={108} height={72} rx={10}
        stroke={STROKE} strokeWidth={SW} fill="none" opacity={0.95} />
      {/* Card: avatar circle */}
      <Circle cx={30} cy={36} r={10} stroke={STROKE} strokeWidth={1} fill="none" opacity={0.6} />
      {/* Card: text lines */}
      <Line x1={46} y1={31} x2={108} y2={31} stroke={STROKE} strokeWidth={1} opacity={0.42} />
      <Line x1={46} y1={41} x2={94} y2={41} stroke={STROKE} strokeWidth={1} opacity={0.42} />
      <Line x1={18} y1={56} x2={108} y2={56} stroke={STROKE} strokeWidth={1} opacity={0.35} />
      <Line x1={18} y1={66} x2={90} y2={66} stroke={STROKE} strokeWidth={1} opacity={0.35} />
      {/* Dashed connector card → phone */}
      <Path d="M64 84 Q75 95 86 102"
        stroke={STROKE} strokeWidth={0.8} fill="none" strokeDasharray="3,4" opacity={0.38} />
    </Svg>
  );
}

// ─── Scene 2: central person + friends fade in + event card ─────────────────
function Scene2() {
  const f1Anim = useRef(new Animated.Value(0)).current;
  const f2Anim = useRef(new Animated.Value(0)).current;
  const [f1Op, setF1Op] = useState(0);
  const [f2Op, setF2Op] = useState(0);

  useEffect(() => {
    const id1 = f1Anim.addListener(({ value }) => setF1Op(value));
    const id2 = f2Anim.addListener(({ value }) => setF2Op(value));
    const seq = Animated.sequence([
      Animated.delay(500),
      Animated.timing(f1Anim, { toValue: 1, duration: 650, useNativeDriver: false }),
      Animated.delay(350),
      Animated.timing(f2Anim, { toValue: 1, duration: 650, useNativeDriver: false }),
    ]);
    seq.start();
    return () => {
      seq.stop();
      f1Anim.removeListener(id1);
      f2Anim.removeListener(id2);
    };
  }, []);

  return (
    <Svg width={220} height={280} viewBox="0 0 220 280">
      {/* Event card floating above */}
      <Rect x={62} y={8} width={96} height={58} rx={8}
        stroke={STROKE} strokeWidth={SW} fill="none" opacity={0.95} />
      <Line x1={72} y1={24} x2={148} y2={24} stroke={STROKE} strokeWidth={1} opacity={0.5} />
      <Line x1={72} y1={34} x2={138} y2={34} stroke={STROKE} strokeWidth={1} opacity={0.5} />
      <Line x1={72} y1={46} x2={146} y2={46} stroke={STROKE} strokeWidth={1} opacity={0.38} />
      <Line x1={72} y1={56} x2={126} y2={56} stroke={STROKE} strokeWidth={1} opacity={0.38} />
      <Line x1={110} y1={66} x2={110} y2={86} stroke={STROKE} strokeWidth={1} strokeDasharray="3,3" opacity={0.38} />

      {/* Central person */}
      <Circle cx={110} cy={88} r={22} stroke={STROKE} strokeWidth={SW} fill="none" />
      <Path d="M92 110 Q110 118 128 110 L124 172 L96 172 Z"
        stroke={STROKE} strokeWidth={SW} fill="none" />
      <Line x1={92} y1={126} x2={74} y2={158} stroke={STROKE} strokeWidth={SW} />
      <Line x1={128} y1={126} x2={146} y2={158} stroke={STROKE} strokeWidth={SW} />
      <Line x1={101} y1={172} x2={92} y2={228} stroke={STROKE} strokeWidth={SW} />
      <Line x1={119} y1={172} x2={128} y2={228} stroke={STROKE} strokeWidth={SW} />

      {/* Left friend — fades in */}
      <G opacity={f1Op}>
        <Circle cx={36} cy={100} r={18} stroke={STROKE} strokeWidth={SW} fill="none" />
        <Path d="M21 118 Q36 125 51 118 L48 168 L24 168 Z"
          stroke={STROKE} strokeWidth={SW} fill="none" />
        <Line x1={21} y1={130} x2={12} y2={156} stroke={STROKE} strokeWidth={SW} />
        <Line x1={51} y1={130} x2={60} y2={154} stroke={STROKE} strokeWidth={SW} />
        <Line x1={30} y1={168} x2={24} y2={212} stroke={STROKE} strokeWidth={SW} />
        <Line x1={42} y1={168} x2={48} y2={212} stroke={STROKE} strokeWidth={SW} />
        <Line x1={54} y1={134} x2={90} y2={128}
          stroke={STROKE} strokeWidth={1} strokeDasharray="4,4" opacity={0.5} />
      </G>

      {/* Right friend — fades in later */}
      <G opacity={f2Op}>
        <Circle cx={184} cy={100} r={18} stroke={STROKE} strokeWidth={SW} fill="none" />
        <Path d="M169 118 Q184 125 199 118 L196 168 L172 168 Z"
          stroke={STROKE} strokeWidth={SW} fill="none" />
        <Line x1={169} y1={130} x2={160} y2={154} stroke={STROKE} strokeWidth={SW} />
        <Line x1={199} y1={130} x2={208} y2={156} stroke={STROKE} strokeWidth={SW} />
        <Line x1={178} y1={168} x2={172} y2={212} stroke={STROKE} strokeWidth={SW} />
        <Line x1={190} y1={168} x2={196} y2={212} stroke={STROKE} strokeWidth={SW} />
        <Line x1={130} y1={128} x2={166} y2={134}
          stroke={STROKE} strokeWidth={1} strokeDasharray="4,4" opacity={0.5} />
      </G>
    </Svg>
  );
}

// ─── Scene 3: group at bar, pulsing notification ─────────────────────────────
function Scene3() {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const [pulseVal, setPulseVal] = useState(0);

  useEffect(() => {
    const id = pulseAnim.addListener(({ value }) => setPulseVal(value));
    const loop = Animated.loop(
      Animated.timing(pulseAnim, { toValue: 1, duration: 1800, useNativeDriver: false })
    );
    loop.start();
    return () => {
      loop.stop();
      pulseAnim.removeListener(id);
    };
  }, []);

  const pulseR = 22 + pulseVal * 22;
  const pulseOp = 0.38 * (1 - pulseVal);

  return (
    <Svg width={220} height={280} viewBox="0 0 220 280">
      {/* Table */}
      <Rect x={16} y={193} width={188} height={10} rx={4}
        stroke={STROKE} strokeWidth={SW} fill="none" />
      <Line x1={26} y1={203} x2={26} y2={240} stroke={STROKE} strokeWidth={SW} />
      <Line x1={194} y1={203} x2={194} y2={240} stroke={STROKE} strokeWidth={SW} />

      {/* Pint glass 1 */}
      <Path d="M44 163 L38 193 L54 193 L48 163 Z" stroke={STROKE} strokeWidth={SW} fill="none" />
      <Line x1={39} y1={174} x2={53} y2={174} stroke={STROKE} strokeWidth={0.8} opacity={0.38} />
      {/* Pint glass 2 */}
      <Path d="M108 160 L102 193 L118 193 L112 160 Z" stroke={STROKE} strokeWidth={SW} fill="none" />
      <Line x1={103} y1={171} x2={117} y2={171} stroke={STROKE} strokeWidth={0.8} opacity={0.38} />
      {/* Pint glass 3 */}
      <Path d="M168 165 L162 193 L178 193 L172 165 Z" stroke={STROKE} strokeWidth={SW} fill="none" />
      <Line x1={163} y1={176} x2={177} y2={176} stroke={STROKE} strokeWidth={0.8} opacity={0.38} />

      {/* Person 1 */}
      <Circle cx={34} cy={95} r={16} stroke={STROKE} strokeWidth={SW} fill="none" />
      <Path d="M20 111 Q34 118 48 111 L46 165 L24 165 Z" stroke={STROKE} strokeWidth={SW} fill="none" />
      <Line x1={20} y1={123} x2={10} y2={150} stroke={STROKE} strokeWidth={SW} />
      <Line x1={48} y1={123} x2={58} y2={148} stroke={STROKE} strokeWidth={SW} />

      {/* Person 2 */}
      <Circle cx={84} cy={90} r={16} stroke={STROKE} strokeWidth={SW} fill="none" />
      <Path d="M70 106 Q84 113 98 106 L96 165 L74 165 Z" stroke={STROKE} strokeWidth={SW} fill="none" />
      <Line x1={70} y1={118} x2={60} y2={145} stroke={STROKE} strokeWidth={SW} />
      <Line x1={98} y1={118} x2={108} y2={143} stroke={STROKE} strokeWidth={SW} />

      {/* Person 3 — arm raised with phone */}
      <Circle cx={140} cy={90} r={16} stroke={STROKE} strokeWidth={SW} fill="none" />
      <Path d="M126 106 Q140 113 154 106 L152 165 L130 165 Z" stroke={STROKE} strokeWidth={SW} fill="none" />
      <Line x1={126} y1={118} x2={116} y2={144} stroke={STROKE} strokeWidth={SW} />
      <Line x1={154} y1={114} x2={165} y2={95} stroke={STROKE} strokeWidth={SW} />
      <Rect x={161} y={80} width={18} height={30} rx={3} stroke={STROKE} strokeWidth={SW} fill="none" />

      {/* Person 4 */}
      <Circle cx={192} cy={95} r={16} stroke={STROKE} strokeWidth={SW} fill="none" />
      <Path d="M178 111 Q192 118 206 111 L204 165 L182 165 Z" stroke={STROKE} strokeWidth={SW} fill="none" />
      <Line x1={178} y1={123} x2={168} y2={148} stroke={STROKE} strokeWidth={SW} />
      <Line x1={206} y1={123} x2={214} y2={148} stroke={STROKE} strokeWidth={SW} />

      {/* Notification card */}
      <Rect x={116} y={42} width={86} height={34} rx={7}
        stroke={STROKE} strokeWidth={SW} fill="none" opacity={0.95} />
      <Line x1={126} y1={55} x2={192} y2={55} stroke={STROKE} strokeWidth={1} opacity={0.5} />
      <Line x1={126} y1={65} x2={178} y2={65} stroke={STROKE} strokeWidth={1} opacity={0.5} />
      <Line x1={159} y1={76} x2={164} y2={82}
        stroke={STROKE} strokeWidth={1} strokeDasharray="2,3" opacity={0.38} />

      {/* Pulse ring */}
      <Circle
        cx={159} cy={59}
        r={pulseR}
        stroke={STROKE}
        strokeWidth={1}
        fill="none"
        opacity={pulseOp}
      />
    </Svg>
  );
}

// ─── Slide data ───────────────────────────────────────────────────────────────
const SLIDES = [
  { Scene: Scene1, tagline: 'Know where your friends\nare drinking tonight.' },
  { Scene: Scene2, tagline: 'Plan the night.\nInvite the crew.' },
  { Scene: Scene3, tagline: "Everyone's already there.\nDon't miss it." },
] as const;

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const [slideIndex, setSlideIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animatingRef = useRef(false);

  const advance = useCallback(() => {
    if (animatingRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const next = indexRef.current + 1;
    if (next >= SLIDES.length) {
      router.replace('/auth/login');
      return;
    }
    animatingRef.current = true;
    Animated.timing(fadeAnim, { toValue: 0, duration: 320, useNativeDriver: true }).start(() => {
      indexRef.current = next;
      setSlideIndex(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 420, useNativeDriver: true }).start(() => {
        animatingRef.current = false;
      });
    });
  }, [fadeAnim]);

  useEffect(() => {
    timerRef.current = setTimeout(advance, 3600);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [slideIndex, advance]);

  const { Scene, tagline } = SLIDES[slideIndex];

  return (
    <TouchableWithoutFeedback onPress={advance}>
      <View style={styles.container}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.safe}>
          {/* Skip */}
          <TouchableOpacity
            onPress={() => router.replace('/auth/login')}
            style={styles.skipBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.skipText}>skip</Text>
          </TouchableOpacity>

          {/* Illustration + tagline fade together */}
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            <View style={styles.illustrationWrap}>
              <Scene key={slideIndex} />
            </View>
            <Text style={styles.tagline}>{tagline}</Text>
          </Animated.View>

          {/* 3-dot progress */}
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === slideIndex && styles.dotActive]} />
            ))}
          </View>
        </SafeAreaView>
      </View>
    </TouchableWithoutFeedback>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
  },
  safe: {
    flex: 1,
    alignItems: 'center',
  },
  skipBtn: {
    alignSelf: 'flex-end',
    marginRight: 28,
    marginTop: 8,
    paddingVertical: 4,
  },
  skipText: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 32,
    paddingBottom: 16,
  },
  illustrationWrap: {
    marginBottom: 44,
  },
  tagline: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '300',
    lineHeight: 36,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 40,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  dotActive: {
    width: 22,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
});
