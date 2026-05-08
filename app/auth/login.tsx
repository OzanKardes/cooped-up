import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Typography, Borders, Shadows } from '../../constants/theme';

// ─── Reusable input field ─────────────────────────────────────────────────────
function BrutalInput({
  label, placeholder, value, onChangeText, secureTextEntry = false, keyboardType,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address' | 'default';
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={inputStyles.wrapper}>
      <Text style={inputStyles.label}>{label}</Text>
      <TextInput
        style={[inputStyles.input, focused && inputStyles.inputFocused]}
        placeholder={placeholder}
        placeholderTextColor={Colors.gray300}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

const inputStyles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.5,
    color: Colors.gray700,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: Typography.sizes.md,
    color: Colors.black,
    fontWeight: Typography.weights.medium,
  },
  inputFocused: {
    borderColor: Colors.blue,
    backgroundColor: Colors.accent,
    ...Shadows.sm,
  },
});

// ─── Login screen ─────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = () => {
    // TODO: hook up to Supabase auth
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoBlock}>
              <Text style={styles.logoText}>COOPED</Text>
              <Text style={styles.logoSub}>UP</Text>
            </View>
            <Text style={styles.tagline}>Imperial College London</Text>
          </View>

          {/* Tab toggle — Login / Sign up */}
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, isLogin && styles.toggleBtnActive]}
              onPress={() => setIsLogin(true)}
            >
              <Text style={[styles.toggleText, isLogin && styles.toggleTextActive]}>
                SIGN IN
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, !isLogin && styles.toggleBtnActive]}
              onPress={() => setIsLogin(false)}
            >
              <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive]}>
                SIGN UP
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {!isLogin && (
              <BrutalInput
                label="FULL NAME"
                placeholder="Your name"
                value={name}
                onChangeText={setName}
              />
            )}
            <BrutalInput
              label="IMPERIAL EMAIL"
              placeholder="you@imperial.ac.uk"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <BrutalInput
              label="PASSWORD"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {isLogin && (
              <TouchableOpacity style={styles.forgotRow}>
                <Text style={styles.forgot}>forgot password?</Text>
              </TouchableOpacity>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              activeOpacity={0.85}
            >
              <Text style={styles.submitText}>
                {isLogin ? 'SIGN IN →' : 'CREATE ACCOUNT →'}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Imperial SSO hint */}
            <TouchableOpacity style={styles.ssoBtn}>
              <Text style={styles.ssoText}>CONTINUE WITH IMPERIAL SSO</Text>
            </TouchableOpacity>
          </View>

          {/* Switch mode */}
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
            </Text>
            <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
              <Text style={styles.switchLink}>{isLogin ? 'Sign up' : 'Sign in'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  logoBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 4,
  },
  logoText: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    letterSpacing: -1,
  },
  logoSub: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.black,
    color: Colors.blue,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
    letterSpacing: 0.5,
  },
  toggle: {
    flexDirection: 'row',
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    marginBottom: 28,
    overflow: 'hidden',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  toggleBtnActive: {
    backgroundColor: Colors.navy,
  },
  toggleText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    letterSpacing: 2,
    color: Colors.gray500,
  },
  toggleTextActive: {
    color: Colors.white,
  },
  form: {
    gap: 0,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -8,
  },
  forgot: {
    fontSize: Typography.sizes.sm,
    color: Colors.blue,
    fontWeight: Typography.weights.medium,
  },
  submitBtn: {
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    ...Shadows.md,
  },
  submitText: {
    color: Colors.white,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: Colors.gray100,
  },
  dividerText: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray500,
  },
  ssoBtn: {
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: Colors.accent,
    ...Shadows.sm,
  },
  ssoText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.5,
    color: Colors.navy,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  switchText: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray500,
  },
  switchLink: {
    fontSize: Typography.sizes.sm,
    color: Colors.blue,
    fontWeight: Typography.weights.bold,
  },
});