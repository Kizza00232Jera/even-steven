import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MoreHorizontal, User, Users } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Colors } from '../../../constants/colors';
import { Skeleton } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/ErrorState';
import { format } from '../../../lib/currency';
import type { Currency } from '../../../lib/currency';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/auth';
import { getFriendDetail, removeFriendship } from '../../../lib/repos/friends';

function BalanceBadge({ balance, groupCount }: { balance: number; groupCount: number }) {
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
  const bgColor = isPositive ? Colors.accentDim : Colors.destructiveDim;
  const textColor = isPositive ? Colors.accent : Colors.destructive;
  const groupSuffix = groupCount > 1 ? ` across ${groupCount} groups` : '';
  const label = isPositive
    ? `Owes you${groupSuffix}`
    : `You owe${groupSuffix}`;

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
  const [showAddExpenseSheet, setShowAddExpenseSheet] = useState(false);

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
          <BalanceBadge balance={friend.totalBalance} groupCount={friend.sharedGroups.filter(g => g.balance !== 0).length} />
        </View>

        <View className="px-4 gap-3">
          {friend.totalBalance !== 0 && (
            <TouchableOpacity
              className="rounded-full py-3.5 items-center border border-border"
              style={{ backgroundColor: theme.surface }}
              activeOpacity={0.8}
              onPress={() => {
                const groupsWithBalance = friend.sharedGroups.filter(g => g.balance !== 0);
                if (groupsWithBalance.length === 1) {
                  router.push(`/groups/${groupsWithBalance[0].groupId}` as never);
                } else if (groupsWithBalance.length > 1) {
                  Alert.alert(
                    'Settle up in which group?',
                    undefined,
                    [
                      ...groupsWithBalance.map(g => ({
                        text: g.groupName,
                        onPress: () => router.push(`/groups/${g.groupId}` as never),
                      })),
                      { text: 'Cancel', style: 'cancel' as const },
                    ]
                  );
                }
              }}
            >
              <Text className="text-text-primary font-semibold text-base">Settle Up</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            className="rounded-full py-3.5 items-center"
            style={{ backgroundColor: Colors.accent }}
            activeOpacity={0.8}
            onPress={() => {
              const uid = friend.friendId;
              if (friend.sharedGroups.length === 1) {
                router.push(`/groups/${friend.sharedGroups[0].groupId}/add-expense?prefillUserId=${uid}` as never);
              } else if (friend.sharedGroups.length > 1) {
                setShowAddExpenseSheet(true);
              } else {
                Alert.alert('No shared groups', 'You have no active shared groups with this person.');
              }
            }}
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
                  onPress={() => router.push(`/groups/${group.groupId}` as never)}
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
                      testID={`group-balance-${group.groupId}`}
                    >
                      {group.balance > 0
                        ? `+${format(group.balance, group.currency as Currency)}`
                        : `-${format(Math.abs(group.balance), group.currency as Currency)}`}
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
      {/* Add Expense group picker */}
      <Modal
        visible={showAddExpenseSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddExpenseSheet(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={() => setShowAddExpenseSheet(false)}
        />
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: theme.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: 32,
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
          </View>
          <Text
            style={{
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 18,
              color: theme.textPrimary,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 8,
            }}
          >
            Add expense to...
          </Text>
          {friend.sharedGroups.map((g) => (
            <TouchableOpacity
              key={g.groupId}
              onPress={() => {
                setShowAddExpenseSheet(false);
                router.push(`/groups/${g.groupId}/add-expense?prefillUserId=${friend.friendId}` as never);
              }}
              style={{
                height: 60,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
              }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 15,
                  color: theme.textPrimary,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {g.groupName}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setShowAddExpenseSheet(false)}
            style={{
              alignItems: 'center',
              paddingVertical: 16,
              marginTop: 4,
            }}
          >
            <Text
              style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 15,
                color: Colors.destructive,
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
