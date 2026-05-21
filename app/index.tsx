import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/auth';

export default function Index() {
  const { session, profile, isLoading } = useAuthStore();

  if (isLoading) return null;
  if (!session) return <Redirect href="/(auth)" />;
  if (profile && !profile.onboarding_done) return <Redirect href="/(auth)/onboarding/display-name" />;
  return <Redirect href="/(tabs)/groups" />;
}
