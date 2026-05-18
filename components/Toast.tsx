import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { Colors, Typography, Borders } from '../constants/theme';

export interface ToastRef { show: (msg: string) => void; }

let _ref: React.RefObject<ToastRef | null> | null = null;
export function setToastRef(r: React.RefObject<ToastRef | null>) { _ref = r; }
export function showToast(msg: string) { _ref?.current?.show(msg); }

export const Toast = forwardRef<ToastRef>((_, ref) => {
  const ty = useRef(new Animated.Value(-120)).current;
  const [msg, setMsg] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    show(m: string) {
      setMsg(m);
      if (timer.current) clearTimeout(timer.current);
      ty.setValue(-120);
      Animated.spring(ty, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 220 }).start();
      timer.current = setTimeout(() => {
        Animated.timing(ty, { toValue: -120, duration: 280, useNativeDriver: true }).start();
      }, 2500);
    },
  }));

  return (
    <Animated.View style={[styles.toast, { transform: [{ translateY: ty }] }]} pointerEvents="none">
      <Text style={styles.text}>{msg}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 9999,
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: Colors.black,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 12,
  },
  text: {
    color: Colors.white,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
