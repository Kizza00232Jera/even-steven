import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';
import type { QueryClient } from '@tanstack/react-query';

export function configureGoogleSignIn(): void {
  GoogleSignin.configure({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    scopes: ['profile', 'email'],
  });
}

export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  const idToken = response.data?.idToken;
  if (!idToken) throw new Error('Google Sign-In did not return an ID token');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  return data.session;
}

export async function signOut(queryClient: QueryClient): Promise<void> {
  queryClient.clear();
  await supabase.auth.signOut();
}
