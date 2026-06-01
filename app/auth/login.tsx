import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Modal, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography } from '../../constants/theme';
import { signIn, signUp } from '../../lib/auth';
import { updateProfile } from '../../services/users';
import { Toast, ToastRef, setToastRef, showToast } from '../../components/Toast';

const BG     = '#001233';
const CARD   = '#002060';
const BORDER = 'rgba(255,255,255,0.12)';
const MUTED  = 'rgba(255,255,255,0.45)';
const IMPERIAL = '#003087';

// ─── Picker data ──────────────────────────────────────────────────────────────
const DEGREES = [
  'Aeronautics', 'Bioengineering', 'Biomedical Sciences', 'Biochemistry',
  'Biology', 'Business', 'Chemical Engineering', 'Chemistry', 'Civil Engineering',
  'Computing', 'Design Engineering', 'Earth Science & Engineering',
  'Economics & Management', 'EFDS', 'Electrical & Electronic Engineering',
  'Environmental Engineering', 'Geoscience', 'Joint Mathematics & Computing',
  'Materials Science', 'Mathematics', 'Mechanical Engineering', 'Medicine',
  'Neuroscience', 'Physics', 'Other',
];

const YEARS = [
  '1st Year', '2nd Year', '3rd Year', '4th Year',
  'Masters', 'PhD', 'Exchange Student',
];

// ─── Input field ──────────────────────────────────────────────────────────────
function NavyInput({
  label, placeholder, value, onChangeText, secureTextEntry = false,
  keyboardType, error,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address' | 'default';
  error?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={ist.wrapper}>
      <Text style={ist.label}>{label}</Text>
      <TextInput
        style={[
          ist.input,
          focused && ist.inputFocused,
          !!error && ist.inputError,
        ]}
        placeholder={placeholder}
        placeholderTextColor={MUTED}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {!!error && <Text style={ist.errorText}>{error}</Text>}
    </View>
  );
}

// ─── Dropdown picker ──────────────────────────────────────────────────────────
function NavyPicker({
  label, options, value, onSelect, error,
}: {
  label: string;
  options: string[];
  value: string;
  onSelect: (v: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={ist.wrapper}>
      <Text style={ist.label}>{label}</Text>
      <TouchableOpacity
        style={[pst.trigger, !!error && { borderColor: Colors.red }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
      >
        <Text style={[pst.triggerText, !value && { color: MUTED }]}>
          {value || 'Select...'}
        </Text>
        <Text style={pst.chevron}>▾</Text>
      </TouchableOpacity>
      {!!error && <Text style={ist.errorText}>{error}</Text>}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={pst.modalContainer}>
          <TouchableWithoutFeedback onPress={() => setOpen(false)}>
            <View style={pst.backdrop} />
          </TouchableWithoutFeedback>
          <View style={pst.sheet}>
            <View style={pst.sheetHandle} />
            <Text style={pst.sheetTitle}>{label}</Text>
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {options.map((opt, idx) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    pst.option,
                    value === opt && pst.optionActive,
                    idx === options.length - 1 && pst.optionLast,
                  ]}
                  onPress={() => { onSelect(opt); setOpen(false); }}
                  activeOpacity={0.85}
                >
                  <Text style={[pst.optionText, value === opt && pst.optionTextActive]}>
                    {opt}
                  </Text>
                  {value === opt && <Text style={pst.optionCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles for inputs / picker ───────────────────────────────────────────────
const ist = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  label: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.5,
    color: MUTED,
    marginBottom: 7,
  },
  input: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: Typography.sizes.md,
    color: '#FFFFFF',
    fontWeight: Typography.weights.medium,
  },
  inputFocused: {
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: '#002a7a',
  },
  inputError: { borderColor: Colors.red },
  errorText: {
    fontSize: Typography.sizes.xs,
    color: Colors.red,
    marginTop: 4,
    fontWeight: Typography.weights.medium,
  },
});

const pst = StyleSheet.create({
  trigger: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerText: {
    flex: 1,
    fontSize: Typography.sizes.md,
    color: '#FFFFFF',
    fontWeight: Typography.weights.medium,
  },
  chevron: { fontSize: 14, color: MUTED, marginLeft: 8 },
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#001845',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 48,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 11,
    fontWeight: Typography.weights.black,
    letterSpacing: 2.5,
    color: MUTED,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  optionLast: { borderBottomWidth: 0 },
  optionActive: { backgroundColor: 'rgba(255,255,255,0.08)' },
  optionText: {
    flex: 1,
    fontSize: Typography.sizes.md,
    color: '#FFFFFF',
    fontWeight: Typography.weights.medium,
  },
  optionTextActive: { fontWeight: Typography.weights.bold, color: '#FFFFFF' },
  optionCheck: { fontSize: Typography.sizes.md, color: Colors.blue, fontWeight: Typography.weights.black },
});

// ─── Login screen ─────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const [isLogin, setIsLogin]         = useState(true);
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [firstName, setFirstName]     = useState('');
  const [surname, setSurname]         = useState('');
  const [degree, setDegree]           = useState('');
  const [year, setYear]               = useState('');
  const [loading, setLoading]         = useState(false);
  const [emailError, setEmailError]   = useState('');
  const [degreeError, setDegreeError] = useState('');
  const [yearError, setYearError]     = useState('');

  const toastRef = useRef<ToastRef>(null);
  useEffect(() => { setToastRef(toastRef); }, []);

  const clearErrors = () => { setEmailError(''); setDegreeError(''); setYearError(''); };

  const validateEmail = (v: string): boolean => {
    if (!v.includes('@') || !v.includes('.')) {
      setEmailError('Enter a valid email address'); return false;
    }
    setEmailError(''); return true;
  };

  const handleSubmit = async () => {
    if (!validateEmail(email)) return;
    if (!password) { showToast('Please enter your password'); return; }
    if (!isLogin) {
      if (!firstName.trim()) { showToast('Please enter your first name'); return; }
      if (!surname.trim())   { showToast('Please enter your surname'); return; }
      if (!degree)           { setDegreeError('Please select your degree'); return; }
      if (!year)             { setYearError('Please select your year of study'); return; }
    }
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email.trim(), password);
      } else {
        const fullName       = `${firstName.trim()} ${surname.trim()}`;
        const avatarInitials = (firstName.trim()[0] ?? '').toUpperCase() +
                               (surname.trim()[0]  ?? '').toUpperCase();
        await signUp(email.trim(), password, fullName, degree, year, avatarInitials);
        const res = await signIn(email.trim(), password);
        if (res?.session?.user?.id) {
          try { await updateProfile(res.session.user.id, { full_name: fullName, avatar_initials: avatarInitials }); } catch {}
        }
      }
    } catch (err: any) {
      showToast(err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.logoText}>COOPED <Text style={styles.logoAccent}>UP</Text></Text>
            <Text style={styles.tagline}>Imperial College London</Text>
          </View>

          {/* ── Sign In / Sign Up pill toggle ── */}
          <View style={styles.toggle}>
            {(['SIGN IN', 'SIGN UP'] as const).map((lbl, i) => {
              const active = i === 0 ? isLogin : !isLogin;
              return (
                <TouchableOpacity
                  key={lbl}
                  style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                  onPress={() => { setIsLogin(i === 0); clearErrors(); }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{lbl}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Form ── */}
          {!isLogin && (
            <>
              <NavyInput label="FIRST NAME(S)" placeholder="e.g. John"  value={firstName} onChangeText={setFirstName} />
              <NavyInput label="SURNAME"        placeholder="e.g. Smith" value={surname}   onChangeText={setSurname} />
              <NavyPicker label="DEGREE"        options={DEGREES} value={degree} onSelect={v => { setDegree(v); setDegreeError(''); }} error={degreeError} />
              <NavyPicker label="YEAR OF STUDY" options={YEARS}   value={year}   onSelect={v => { setYear(v);   setYearError(''); }}   error={yearError} />
            </>
          )}

          <NavyInput
            label="IMPERIAL EMAIL"
            placeholder="you@imperial.ac.uk"
            value={email}
            onChangeText={v => { setEmail(v); if (emailError) validateEmail(v); }}
            keyboardType="email-address"
            error={emailError}
          />
          <NavyInput
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

          {/* ── Submit ── */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            activeOpacity={0.88}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#001233" size="small" />
              : <Text style={styles.submitText}>{isLogin ? 'SIGN IN →' : 'CREATE ACCOUNT →'}</Text>
            }
          </TouchableOpacity>

          {/* ── Divider ── */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── SSO ── */}
          <TouchableOpacity
            style={styles.ssoBtn}
            onPress={() => showToast('Imperial SSO coming soon')}
            activeOpacity={0.85}
          >
            <Text style={styles.ssoText}>CONTINUE WITH IMPERIAL SSO</Text>
          </TouchableOpacity>

          {/* ── Switch mode ── */}
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
            </Text>
            <TouchableOpacity onPress={() => { setIsLogin(!isLogin); clearErrors(); }}>
              <Text style={styles.switchLink}>{isLogin ? 'Sign up' : 'Sign in'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Toast ref={toastRef} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 48 },

  // Header
  header: { marginBottom: 36 },
  logoText: {
    fontSize: 38,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 6,
  },
  logoAccent: { color: Colors.blue },
  tagline: {
    fontSize: Typography.sizes.sm,
    color: MUTED,
    fontWeight: Typography.weights.medium,
    letterSpacing: 0.5,
  },

  // Toggle pill
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#001845',
    borderRadius: 14,
    padding: 4,
    marginBottom: 28,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleBtnActive: { backgroundColor: CARD },
  toggleText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.5,
    color: MUTED,
  },
  toggleTextActive: { color: '#FFFFFF' },

  // Forgot
  forgotRow: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -6 },
  forgot: { fontSize: Typography.sizes.sm, color: Colors.blue, fontWeight: Typography.weights.medium },

  // Submit — white button, navy text (high contrast on dark bg)
  submitBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: {
    color: '#001233',
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    letterSpacing: 1.5,
  },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText: { fontSize: Typography.sizes.sm, color: MUTED },

  // SSO
  ssoBtn: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ssoText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.7)',
  },

  // Switch row
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  switchText: { fontSize: Typography.sizes.sm, color: MUTED },
  switchLink: { fontSize: Typography.sizes.sm, color: Colors.blue, fontWeight: Typography.weights.bold },
});
