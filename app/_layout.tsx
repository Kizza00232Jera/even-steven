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
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { View, Platform, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { configureGoogleSignIn } from '../lib/auth';
import { getProfile } from '../lib/repos/profiles';
import { upsertPushToken } from '../lib/repos/pushTokens';
import { useAuthStore } from '../store/auth';
import { useRatesStore } from '../store/rates';
import { VersionGateScreen } from '../components/VersionGateScreen';
import { useVersionGate } from '../hooks/useVersionGate';
import { useOTAUpdates } from '../hooks/useOTAUpdates';
import { ToastProvider } from '../components/ToastProvider';
import { OfflineBanner } from '../components/OfflineBanner';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

configureGoogleSignIn();

function NavigationGuard() {
  const router = useRouter();
  const segments = useSegments();
  const { session, profile, isLoading, pendingInviteToken, setPendingInviteToken } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    const inAuth   = segments[0] === '(auth)';
    const inInvite = segments[0] === 'invite';

    if (!session) {
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
      if (pendingInviteToken) {
        const t = pendingInviteToken;
        setPendingInviteToken(null);
        router.replace(`/invite/${t}` as never);
      } else {
        router.replace('/(tabs)/groups');
      }
    }
  }, [session, profile, isLoading, segments]);

  return null;
}

function RootContent() {
  const { colorScheme } = useColorScheme();
  const { session, setSession, setProfile, setIsLoading } = useAuthStore();
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
  const { fetchRates } = useRatesStore();
  useEffect(() => { fetchRates(); }, []);

  // Re-register push token on every app open (handles token rotation)
  useEffect(() => {
    if (!session) return;
    async function registerToken() {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;
      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      if (!projectId) return;
      try {
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        await upsertPushToken(supabase, session!.user.id, token, Platform.OS);
      } catch { /* non-critical */ }
    }
    registerToken();
  }, [session?.user.id]);

  // Clear badge when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') Notifications.setBadgeCountAsync(0);
    });
    return () => sub.remove();
  }, []);

  // Deep-link routing on notification tap
  const router = useRouter();
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (data?.route) router.push(data.route as never);
    });
    return () => sub.remove();
  }, []);

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
