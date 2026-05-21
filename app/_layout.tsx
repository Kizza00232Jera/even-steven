import '../global.css';
import { Stack } from 'expo-router';
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
import { VersionGateScreen } from '../components/VersionGateScreen';
import { useVersionGate } from '../hooks/useVersionGate';
import { useOTAUpdates } from '../hooks/useOTAUpdates';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  const [fontsLoaded] = useFonts({
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
    if (fontsLoaded && versionGate !== 'loading') {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, versionGate]);

  if (!fontsLoaded || versionGate === 'loading') return null;

  if (versionGate === 'blocked') {
    return <VersionGateScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </QueryClientProvider>
  );
}
