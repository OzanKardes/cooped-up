// app/_layout.tsx
// Root layout — Expo Router entry point.
// Checks for an existing Supabase session on launch and redirects appropriately.
// Listens to auth state changes so a sign-out anywhere redirects to login.

import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  useEffect(() => {
    // Restore session from AsyncStorage — redirect if already signed in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/(tabs)');
      }
    });

    // React to live auth changes (sign-in from login screen, sign-out from profile)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace('/(tabs)');
      } else if (event === 'SIGNED_OUT') {
        router.replace('/auth/login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
