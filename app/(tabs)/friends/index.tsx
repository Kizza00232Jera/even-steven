import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/ErrorState';

function useFriends() {
  return useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      // Friends data fetching will be wired to Supabase here
      return [] as { id: string; name: string }[];
    },
  });
}

function SkeletonFriendRow() {
  return (
    <View className="flex-row items-center gap-3 py-3 border-b border-border">
      <Skeleton width={40} height={40} borderRadius={20} />
      <View className="flex-1 gap-2">
        <Skeleton width={130} height={14} borderRadius={6} />
        <Skeleton width={90} height={12} borderRadius={6} />
      </View>
    </View>
  );
}

export default function FriendsScreen() {
  const { isLoading, isError, refetch } = useFriends();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4">
        <Text className="text-text-primary font-bold text-2xl mt-4 mb-4">Friends</Text>
        {isLoading && (
          <View>
            <SkeletonFriendRow />
            <SkeletonFriendRow />
            <SkeletonFriendRow />
          </View>
        )}
        {isError && <ErrorState onRetry={refetch} />}
        {!isLoading && !isError && (
          <View className="flex-1 items-center justify-center">
            <Text className="text-text-secondary text-sm text-center">
              No friends added yet.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
