import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/ErrorState';

function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      // Profile data will be fetched from Supabase here
      return null as { id: string; name: string; email: string } | null;
    },
  });
}

function SkeletonProfile() {
  return (
    <View className="items-center gap-3 py-6">
      <Skeleton width={72} height={72} borderRadius={36} />
      <Skeleton width={140} height={18} borderRadius={6} />
      <Skeleton width={180} height={14} borderRadius={6} />
    </View>
  );
}

export default function AccountScreen() {
  const { isLoading, isError, refetch } = useProfile();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4">
        <Text className="text-text-primary font-bold text-2xl mt-4 mb-4">Account</Text>
        {isLoading && <SkeletonProfile />}
        {isError && <ErrorState onRetry={refetch} />}
        {!isLoading && !isError && (
          <View className="flex-1 items-center justify-center">
            <Text className="text-text-secondary text-sm text-center">
              Sign in to view your account.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
