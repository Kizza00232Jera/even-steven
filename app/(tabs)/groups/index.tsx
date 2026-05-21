import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { SkeletonGroupCard } from '../../../components/SkeletonGroupCard';
import { ErrorState } from '../../../components/ErrorState';
import { Colors } from '../../../constants/colors';
import { fetchGroups } from '../../../lib/repos/groups';
import { supabase } from '../../../lib/supabase';
import type { Database } from '../../../lib/database.types';

type Group = Database['public']['Tables']['groups']['Row'];

function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: () => fetchGroups(supabase),
  });
}

function GroupCard({ group }: { group: Group }) {
  const router = useRouter();
  const gradientKey = group.type.toLowerCase() as keyof typeof Colors.gradients;
  const [fromColor] = Colors.gradients[gradientKey];

  return (
    <TouchableOpacity
      onPress={() => router.push(`/group/${group.id}`)}
      className="bg-surface rounded-2xl border border-border overflow-hidden"
      activeOpacity={0.8}
    >
      <View
        style={{ backgroundColor: fromColor, height: 4 }}
      />
      <View className="p-4">
        <Text className="font-display text-base font-semibold text-text-primary mb-1">
          {group.name}
        </Text>
        <Text className="font-body text-xs text-text-secondary capitalize">
          {group.type}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function GroupsScreen() {
  const router = useRouter();
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
        <View className="flex-1 items-center justify-center pt-20">
          <Text className="font-body text-text-secondary text-sm text-center mb-2">
            No groups yet.
          </Text>
          <Text className="font-body text-text-tertiary text-xs text-center">
            Tap + to create your first group.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <GroupCard group={item} />}
        contentContainerStyle={{ gap: 12 }}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4">
        <View className="flex-row items-center justify-between mt-4 mb-4">
          <Text className="font-display text-text-primary font-bold text-2xl">Groups</Text>
          <TouchableOpacity
            onPress={() => router.push('/group/create')}
            testID="create-group-fab"
            className="w-10 h-10 rounded-full bg-accent items-center justify-center"
          >
            <Plus size={20} color="#ffffff" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}
