import '../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  Inter_400Regular,
  Inter_500Medium,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { configureGoogleSignIn } from '../lib/auth';
import { getProfile } from '../lib/repos/profiles';
import { useAuthStore } from '../store/auth';
import { VersionGateScreen } from '../components/VersionGateScreen';
import { useVersionGate } from '../hooks/useVersionGate';
import { useOTAUpdates } from '../hooks/useOTAUpdates';
import { ToastProvider } from '../components/ToastProvider';
import { OfflineBanner } from '../components/OfflineBanner';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

configureGoogleSignIn();

function NavigationGuard() {
  const router = useRouter();
  const segments = useSegments();
  const { session, profile, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    const inAuth   = segments[0] === '(auth)';
    const inInvite = segments[0] === 'invite';

    if (!session) {
      // Invite screen is accessible without authentication so non-members can
      // view group details before deciding to sign up and accept.
      if (!inAuth && !inInvite) router.replace('/(auth)');
      return;
    }

    // New user — signed in but no profile record yet
    if (profile === null) {
      const inOnboarding =
        segments[0] === '(auth)' && (segments as string[])[1] === 'onboarding';
      if (!inOnboarding) {
        router.replace('/(auth)/onboarding/display-name');
      }
      return;
    }

    if (!profile.onboarding_done) {
      const inOnboarding =
        segments[0] === '(auth)' && (segments as string[])[1] === 'onboarding';
      if (!inOnboarding) {
        router.replace('/(auth)/onboarding/display-name');
      }
      return;
    }

    if (inAuth) {
      router.replace('/(tabs)/groups');
    }
  }, [session, profile, isLoading, segments]);

  return null;
}

function RootContent() {
  const { colorScheme } = useColorScheme();
  const { setSession, setProfile, setIsLoading } = useAuthStore();
  const { isOnline } = useNetworkStatus();

  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
  });

  const versionGate = useVersionGate();
  useOTAUpdates();

  useEffect(() => {
    if ((fontsLoaded || fontError) && versionGate !== 'loading') {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, versionGate]);

  useEffect(() => {
    async function fetchAndSetProfile(userId: string) {
      try {
        const profile = await getProfile(supabase, userId);
        setProfile(profile);
      } catch {
        setProfile(null);
      }
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) await fetchAndSetProfile(session.user.id);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (session) {
          await fetchAndSetProfile(session.user.id);
        } else {
          setProfile(null);
        }
        if (event !== 'INITIAL_SESSION') {
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if ((!fontsLoaded && !fontError) || versionGate === 'loading') return null;

  if (versionGate === 'blocked') {
    return <VersionGateScreen />;
  }

  return (
    <>
      <NavigationGuard />
      <View style={{ flex: 1 }}>
        <OfflineBanner isOnline={isOnline} />
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <RootContent />
        </ToastProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
