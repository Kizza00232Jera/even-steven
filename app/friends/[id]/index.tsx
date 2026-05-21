import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MoreHorizontal, User, Users } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Colors } from '../../../constants/colors';
import { Skeleton } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/ErrorState';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/auth';
import { getFriendDetail, removeFriendship } from '../../../lib/repos/friends';

function BalanceBadge({ balance }: { balance: number }) {
  if (balance === 0) {
    return (
      <View className="px-4 py-2 rounded-full" style={{ backgroundColor: Colors.accentDim }}>
        <Text style={{ color: Colors.accent }} className="text-sm font-medium">
          All settled
        </Text>
      </View>
    );
  }

  const isPositive = balance > 0;
  const bgColor = isPositive ? Colors.balance.positiveFrom : Colors.balance.negativeFrom;
  const textColor = isPositive ? Colors.accent : Colors.destructive;
  const label = isPositive
    ? `Owes you $${balance.toFixed(2)}`
    : `You owe $${Math.abs(balance).toFixed(2)}`;

  return (
    <View className="px-4 py-2 rounded-full" style={{ backgroundColor: bgColor }}>
      <Text style={{ color: textColor }} className="text-sm font-medium">
        {label}
      </Text>
    </View>
  );
}

export default function FriendDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const { data: friend, isLoading, isError, refetch } = useQuery({
    queryKey: ['friend-detail', profile?.id, id],
    queryFn: () => getFriendDetail(supabase, profile!.id, id),
    enabled: !!profile && !!id,
  });

  const removeMutation = useMutation({
    mutationFn: () => removeFriendship(supabase, friend!.friendshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends', profile?.id] });
      router.back();
    },
    onError: (err: Error) => {
      Alert.alert('Could not remove friend', err.message);
    },
  });

  function handleRemove() {
    Alert.alert(
      'Remove friend',
      `Remove ${friend?.name ?? 'this person'} from your friends list? This won't affect any shared groups or expense history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeMutation.mutate(),
        },
      ]
    );
  }

  function handleMoreMenu() {
    Alert.alert(friend?.name ?? 'Friend', undefined, [
      { text: 'Remove friend', style: 'destructive', onPress: handleRemove },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="px-4 pt-4">
          <View className="flex-row items-center gap-3 mb-8">
            <Skeleton width={36} height={36} borderRadius={18} />
            <Skeleton width={140} height={20} borderRadius={8} />
          </View>
          <View className="items-center gap-4 mb-8">
            <Skeleton width={80} height={80} borderRadius={40} />
            <Skeleton width={160} height={22} borderRadius={8} />
            <Skeleton width={100} height={30} borderRadius={15} />
          </View>
          <Skeleton width="100%" height={56} borderRadius={16} />
          <View className="mt-4">
            <Skeleton width={120} height={14} borderRadius={6} />
            <View className="mt-2 gap-2">
              <Skeleton width="100%" height={48} borderRadius={12} />
              <Skeleton width="100%" height={48} borderRadius={12} />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="px-4 pt-16">
          <ErrorState onRetry={refetch} />
        </View>
      </SafeAreaView>
    );
  }

  if (!friend) return null;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between px-4 pt-4 mb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-9 h-9 rounded-full items-center justify-center"
            style={{ backgroundColor: theme.surface2 }}
            activeOpacity={0.7}
          >
            <ArrowLeft size={18} color={theme.textPrimary} strokeWidth={1.5} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleMoreMenu}
            className="w-9 h-9 rounded-full items-center justify-center"
            style={{ backgroundColor: theme.surface2 }}
            activeOpacity={0.7}
          >
            <MoreHorizontal size={18} color={theme.textPrimary} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>

        <View className="items-center px-4 mb-8">
          <View
            className="w-20 h-20 rounded-full items-center justify-center mb-3"
            style={{ backgroundColor: theme.surface2 }}
          >
            <User size={36} color={theme.textSecondary} strokeWidth={1.5} />
          </View>
          <Text
            className="text-text-primary font-bold text-xl mb-1"
            style={{ fontFamily: 'SpaceGrotesk_700Bold' }}
          >
            {friend.name}
          </Text>
          <Text className="text-text-secondary text-sm mb-4">{friend.email}</Text>
          <BalanceBadge balance={friend.totalBalance} />
        </View>

        <View className="px-4 gap-3">
          {friend.totalBalance !== 0 && (
            <TouchableOpacity
              className="rounded-full py-3.5 items-center border border-border"
              style={{ backgroundColor: theme.surface }}
              activeOpacity={0.8}
            >
              <Text className="text-text-primary font-semibold text-base">Settle Up</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            className="rounded-full py-3.5 items-center"
            style={{ backgroundColor: Colors.accent }}
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-base">Add Expense</Text>
          </TouchableOpacity>

          {friend.sharedGroups.length > 0 ? (
            <View className="mt-4">
              <Text className="text-text-secondary text-xs font-semibold uppercase tracking-widest mb-2">
                Shared Groups
              </Text>
              {friend.sharedGroups.map((group) => (
                <TouchableOpacity
                  key={group.groupId}
                  onPress={() => router.push(`/group/${group.groupId}`)}
                  className="flex-row items-center justify-between py-3.5 px-4 bg-surface rounded-2xl border border-border mb-2"
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className="w-9 h-9 rounded-full items-center justify-center"
                      style={{ backgroundColor: theme.surface2 }}
                    >
                      <Users size={16} color={theme.textSecondary} strokeWidth={1.5} />
                    </View>
                    <Text className="text-text-primary font-medium">{group.groupName}</Text>
                  </View>
                  {group.balance !== 0 && (
                    <Text
                      style={{
                        color: group.balance > 0 ? Colors.accent : Colors.destructive,
                      }}
                      className="text-sm font-medium"
                    >
                      {group.balance > 0
                        ? `+$${group.balance.toFixed(2)}`
                        : `-$${Math.abs(group.balance).toFixed(2)}`}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View className="mt-4 items-center py-6">
              <Text className="text-text-secondary text-sm text-center">
                No shared groups yet.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
