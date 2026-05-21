import { View, Text, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { SkeletonGroupCard } from '../../../components/SkeletonGroupCard';
import { ErrorState } from '../../../components/ErrorState';

function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      // Groups data fetching will be wired to Supabase here
      return [] as { id: string; name: string }[];
    },
  });
}

export default function GroupsScreen() {
  const { data: groups, isLoading, isError, refetch } = useGroups();

  function renderContent() {
    if (isLoading) {
      return (
        <View className="gap-3">
          <SkeletonGroupCard />
          <SkeletonGroupCard />
          <SkeletonGroupCard />
        </View>
      );
    }

    if (isError) {
      return <ErrorState onRetry={refetch} />;
    }

    if (!groups?.length) {
      return (
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-secondary text-sm text-center">
            No groups yet. Create one to get started.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="bg-surface rounded-2xl border border-border p-4">
            <Text className="text-text-primary">{item.name}</Text>
          </View>
        )}
        contentContainerStyle={{ gap: 12 }}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4">
        <Text className="text-text-primary font-bold text-2xl mt-4 mb-4">Groups</Text>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}
