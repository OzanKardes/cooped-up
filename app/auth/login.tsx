import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Modal, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Borders, Shadows } from '../../constants/theme';
import { signIn, signUp } from '../../lib/auth';
import { Toast, ToastRef, setToastRef, showToast } from '../../components/Toast';

// ─── Picker data ──────────────────────────────────────────────────────────────
const DEGREES = [
  'Aeronautics',
  'Bioengineering',
  'Biomedical Sciences',
  'Biochemistry',
  'Biology',
  'Business',
  'Chemical Engineering',
  'Chemistry',
  'Civil Engineering',
  'Computing',
  'Design Engineering',
  'Earth Science & Engineering',
  'Economics & Management',
  'EFDS',
  'Electrical & Electronic Engineering',
  'Environmental Engineering',
  'Geoscience',
  'Joint Mathematics & Computing',
  'Materials Science',
  'Mathematics',
  'Mechanical Engineering',
  'Medicine',
  'Neuroscience',
  'Physics',
  'Other',
];

const YEARS = [
  '1st Year', '2nd Year', '3rd Year', '4th Year',
  'Masters', 'PhD', 'Exchange Student',
];

// ─── Reusable input field ─────────────────────────────────────────────────────
function BrutalInput({
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
    <View style={inputStyles.wrapper}>
      <Text style={inputStyles.label}>{label}</Text>
      <TextInput
        style={[
          inputStyles.input,
          focused && inputStyles.inputFocused,
          !!error && inputStyles.inputError,
        ]}
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
      {!!error && <Text style={inputStyles.errorText}>{error}</Text>}
    </View>
  );
}

// ─── Dropdown picker ──────────────────────────────────────────────────────────
function BrutalPicker({
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
    <View style={inputStyles.wrapper}>
      <Text style={inputStyles.label}>{label}</Text>
      <TouchableOpacity
        style={[pickerStyles.trigger, !!error && inputStyles.inputError]}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
      >
        <Text style={[pickerStyles.triggerText, !value && pickerStyles.triggerPlaceholder]}>
          {value || 'Select...'}
        </Text>
        <Text style={pickerStyles.chevron}>▾</Text>
      </TouchableOpacity>
      {!!error && <Text style={inputStyles.errorText}>{error}</Text>}

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={pickerStyles.modalContainer}>
          <TouchableWithoutFeedback onPress={() => setOpen(false)}>
            <View style={pickerStyles.backdrop} />
          </TouchableWithoutFeedback>
          <View style={pickerStyles.sheet}>
            <Text style={pickerStyles.sheetTitle}>{label}</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {options.map((opt, idx) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    pickerStyles.option,
                    value === opt && pickerStyles.optionActive,
                    idx === options.length - 1 && pickerStyles.optionLast,
                  ]}
                  onPress={() => { onSelect(opt); setOpen(false); }}
                  activeOpacity={0.85}
                >
                  <Text style={[pickerStyles.optionText, value === opt && pickerStyles.optionTextActive]}>
                    {opt}
                  </Text>
                  {value === opt && <Text style={pickerStyles.optionCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  inputError: {
    borderColor: Colors.red,
  },
  errorText: {
    fontSize: Typography.sizes.xs,
    color: Colors.red,
    marginTop: 4,
    fontWeight: Typography.weights.medium,
  },
});

const pickerStyles = StyleSheet.create({
  trigger: {
    backgroundColor: Colors.white,
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerText: {
    flex: 1,
    fontSize: Typography.sizes.md,
    color: Colors.black,
    fontWeight: Typography.weights.medium,
  },
  triggerPlaceholder: {
    color: Colors.gray300,
  },
  chevron: {
    fontSize: 14,
    color: Colors.gray500,
    fontWeight: Typography.weights.bold,
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderTopWidth: Borders.widthHeavy,
    borderLeftWidth: Borders.widthHeavy,
    borderRightWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    paddingTop: 20,
    paddingBottom: 48,
    ...Shadows.md,
  },
  sheetTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 3,
    color: Colors.gray500,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.gray100,
  },
  optionLast: {
    borderBottomWidth: 0,
  },
  optionActive: {
    backgroundColor: Colors.navy,
  },
  optionText: {
    flex: 1,
    fontSize: Typography.sizes.md,
    color: Colors.black,
    fontWeight: Typography.weights.medium,
  },
  optionTextActive: {
    color: Colors.white,
    fontWeight: Typography.weights.bold,
  },
  optionCheck: {
    fontSize: Typography.sizes.md,
    color: Colors.white,
    fontWeight: Typography.weights.black,
  },
});

// ─── Login screen ─────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [degree, setDegree]     = useState('');
  const [year, setYear]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [emailError, setEmailError]   = useState('');
  const [degreeError, setDegreeError] = useState('');
  const [yearError, setYearError]     = useState('');

  const toastRef = useRef<ToastRef>(null);
  useEffect(() => { setToastRef(toastRef); }, []);

  const clearErrors = () => {
    setEmailError('');
    setDegreeError('');
    setYearError('');
  };

  const validateEmail = (v: string): boolean => {
    if (!v.includes('@') || !v.includes('.')) {
      setEmailError('Enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validateEmail(email)) return;
    if (!password) { showToast('Please enter your password'); return; }
    if (!isLogin) {
      if (!name.trim())  { showToast('Please enter your full name'); return; }
      if (!degree)       { setDegreeError('Please select your degree'); return; }
      if (!year)         { setYearError('Please select your year of study'); return; }
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, name.trim(), degree, year);
        // Explicitly sign in after account creation so navigation fires
        // regardless of whether Supabase email confirmation is enabled
        await signIn(email.trim(), password);
      }
      // _layout.tsx onAuthStateChange will navigate to /(tabs) automatically
    } catch (err: any) {
      showToast(err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
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
              onPress={() => { setIsLogin(true); clearErrors(); }}
            >
              <Text style={[styles.toggleText, isLogin && styles.toggleTextActive]}>
                SIGN IN
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, !isLogin && styles.toggleBtnActive]}
              onPress={() => { setIsLogin(false); clearErrors(); }}
            >
              <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive]}>
                SIGN UP
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {!isLogin && (
              <>
                <BrutalInput
                  label="FULL NAME"
                  placeholder="Your name"
                  value={name}
                  onChangeText={setName}
                />
                <BrutalPicker
                  label="DEGREE"
                  options={DEGREES}
                  value={degree}
                  onSelect={v => { setDegree(v); setDegreeError(''); }}
                  error={degreeError}
                />
                <BrutalPicker
                  label="YEAR OF STUDY"
                  options={YEARS}
                  value={year}
                  onSelect={v => { setYear(v); setYearError(''); }}
                  error={yearError}
                />
              </>
            )}
            <BrutalInput
              label="IMPERIAL EMAIL"
              placeholder="you@imperial.ac.uk"
              value={email}
              onChangeText={v => { setEmail(v); if (emailError) validateEmail(v); }}
              keyboardType="email-address"
              error={emailError}
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
              style={[styles.submitBtn, loading && styles.submitBtnLoading]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.submitText}>
                  {isLogin ? 'SIGN IN →' : 'CREATE ACCOUNT →'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Imperial SSO hint */}
            <TouchableOpacity
              style={styles.ssoBtn}
              onPress={() => showToast('Imperial SSO coming soon')}
            >
              <Text style={styles.ssoText}>CONTINUE WITH IMPERIAL SSO</Text>
            </TouchableOpacity>
          </View>

          {/* Switch mode */}
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
  submitBtnLoading: {
    opacity: 0.7,
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
