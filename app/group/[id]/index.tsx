import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useColorScheme } from 'nativewind';
import { Settings, ChevronLeft, LogOut, Users, BellOff, Bell, X, ChevronRight, Plus } from 'lucide-react-native';
import { SkeletonExpenseCard } from '../../../components/SkeletonExpenseCard';
import { SkeletonBalanceRow } from '../../../components/SkeletonBalanceRow';
import { ErrorState } from '../../../components/ErrorState';
import { RemovedMemberState } from '../../../components/RemovedMemberState';
import { Colors } from '../../../constants/colors';
import { fetchGroupDetail, leaveGroup } from '../../../lib/repos/groups';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/auth';
import { useToast } from '../../../hooks/useToast';
import type { GroupDetail } from '../../../lib/repos/groups';

function useGroupDetail(id: string, userId: string) {
  return useQuery({
    queryKey: ['group', id],
    queryFn: () => fetchGroupDetail(supabase, id, userId),
  });
}

interface SettingsSheetProps {
  visible: boolean;
  group: GroupDetail;
  onClose: () => void;
  onLeave: () => void;
  onViewMembers: () => void;
}

function SettingsSheet({ visible, group, onClose, onLeave, onViewMembers }: SettingsSheetProps) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        className="flex-1"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPress={onClose}
      >
        <Pressable
          className="absolute bottom-0 left-0 right-0 rounded-t-2xl p-6"
          style={{ backgroundColor: theme.surface }}
        >
          <View className="flex-row items-center justify-between mb-5">
            <Text className="font-display text-text-primary font-semibold text-lg">
              {group.name}
            </Text>
            <TouchableOpacity testID="close-settings" onPress={onClose}>
              <X size={20} color={theme.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            className="flex-row items-center justify-between py-4 border-b border-border"
            onPress={onViewMembers}
          >
            <View className="flex-row items-center gap-3">
              <Users size={20} color={theme.textSecondary} strokeWidth={1.5} />
              <Text className="font-body text-text-primary text-base">
                Members ({group.memberCount})
              </Text>
            </View>
            <ChevronRight size={18} color={theme.textTertiary} strokeWidth={1.5} />
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center gap-3 py-4 border-b border-border"
          >
            {group.isMuted ? (
              <Bell size={20} color={theme.textSecondary} strokeWidth={1.5} />
            ) : (
              <BellOff size={20} color={theme.textSecondary} strokeWidth={1.5} />
            )}
            <Text className="font-body text-text-primary text-base">
              {group.isMuted ? 'Unmute notifications' : 'Mute notifications'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center gap-3 py-4"
            onPress={onLeave}
          >
            <LogOut size={20} color={Colors.destructive} strokeWidth={1.5} />
            <Text className="font-body text-base" style={{ color: Colors.destructive }}>
              Leave group
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AddExpenseFab({ group }: { group: GroupDetail }) {
  const toast = useToast();
  const isExpiredOrArchived = group.status === 'expired' || group.status === 'archived';

  function handlePress() {
    if (isExpiredOrArchived) {
      toast.info('This trip has ended. Extend the trip in settings to add new expenses.');
      return;
    }
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      testID="add-expense-fab"
      style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: isExpiredOrArchived ? Colors.dark.textTertiary : Colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isExpiredOrArchived ? 0.6 : 1,
      }}
      activeOpacity={0.8}
    >
      <Plus size={24} color="#ffffff" strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuthStore();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? '';

  const { data: group, isLoading, isError, refetch } = useGroupDetail(id, userId);
  const [showSettings, setShowSettings] = useState(false);

  const leaveMutation = useMutation({
    mutationFn: ({ memberId, isAdmin }: { memberId: string; isAdmin: boolean }) =>
      leaveGroup(supabase, id, memberId, isAdmin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      router.back();
    },
    onError: () => {
      Alert.alert('Error', 'Could not leave the group. Please try again.');
    },
  });

  function handleLeave() {
    if (!group) return;

    const isLastMember = group.memberCount <= 1;
    const memberId = group.currentMemberId;
    const isAdmin = group.isAdmin;

    if (isLastMember) {
      Alert.alert(
        "You're the last member",
        'Leaving will permanently delete this group and all its history.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete group',
            style: 'destructive',
            onPress: () => {
              setShowSettings(false);
              leaveMutation.mutate({ memberId, isAdmin });
            },
          },
        ],
      );
    } else if (group.balance !== 0) {
      const balanceStr = Math.abs(group.balance).toFixed(2);
      Alert.alert(
        'Outstanding balance',
        `You have an outstanding balance of ${balanceStr}. You can still leave — expense history will remain intact.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave anyway',
            style: 'destructive',
            onPress: () => {
              setShowSettings(false);
              leaveMutation.mutate({ memberId, isAdmin });
            },
          },
        ],
      );
    } else {
      Alert.alert('Leave group', 'Are you sure you want to leave this group?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            setShowSettings(false);
            leaveMutation.mutate({ memberId, isAdmin });
          },
        },
      ]);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 px-4">
          <View className="h-8 w-48 bg-surface-2 rounded-lg mt-4 mb-6" />
          <View className="gap-3 mb-6">
            <SkeletonExpenseCard />
            <SkeletonExpenseCard />
            <SkeletonExpenseCard />
          </View>
          <View className="gap-3">
            <SkeletonBalanceRow />
            <SkeletonBalanceRow />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 px-4 pt-4">
          <ErrorState onRetry={refetch} />
        </View>
      </SafeAreaView>
    );
  }

  if (!group || !group.isMember) {
    return <RemovedMemberState />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mr-3"
        >
          <ChevronLeft size={24} color={Colors.accent} strokeWidth={2} />
        </TouchableOpacity>
        <Text className="font-display text-text-primary font-semibold text-lg flex-1" numberOfLines={1}>
          {group.name}
        </Text>
        <TouchableOpacity
          testID="settings-button"
          onPress={() => setShowSettings(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Settings size={22} color={Colors.dark.textSecondary} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      <View className="flex-1 px-4 pt-4">
        {group.status === 'expired' && (
          <View className="mb-3 px-3 py-1.5 bg-surface rounded-xl self-start">
            <Text className="font-body text-xs text-text-secondary">Trip ended</Text>
          </View>
        )}
        <Text className="font-body text-text-secondary text-sm text-center mt-20">
          Group detail — expenses and balances coming soon.
        </Text>
      </View>

      <AddExpenseFab group={group} />

      {showSettings && (
        <SettingsSheet
          visible={showSettings}
          group={group}
          onClose={() => setShowSettings(false)}
          onLeave={handleLeave}
          onViewMembers={() => {
            setShowSettings(false);
            router.push(`/group/${id}/members` as never);
          }}
        />
      )}
    </SafeAreaView>
  );
}
