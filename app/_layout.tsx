// app/_layout.tsx
// Root layout — Expo Router entry point
// Handles the top-level navigation stack: onboarding → auth → main app

import { Stack } from 'expo-router';
import { Colors } from '../constants/theme';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      {/* Onboarding — shown first time only */}
      <Stack.Screen name="index" />

      {/* Auth flow */}
      <Stack.Screen name="auth/login" />

      {/* Main app — single screen with wheel nav built in */}
      <Stack.Screen name="(tabs)/index" />
    </Stack>
  );
}