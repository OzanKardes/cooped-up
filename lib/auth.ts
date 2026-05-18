import { supabase } from './supabase';

// Auth error messages mapped to user-friendly strings
function friendlyAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Wrong email or password';
  if (message.includes('Email not confirmed')) return 'Please confirm your email first';
  if (message.includes('User already registered')) return 'Email already in use';
  if (message.includes('Password should be')) return 'Password must be at least 6 characters';
  if (message.includes('Unable to validate')) return 'Email not found';
  return message;
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  degree: string,
  yearOfStudy: string,
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        degree,
        year_of_study: yearOfStudy,
      },
    },
  });
  if (error) throw new Error(friendlyAuthError(error.message));
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendlyAuthError(error.message));
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback);
}
