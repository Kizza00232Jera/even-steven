import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  Alert,
  Share,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useColorScheme } from 'nativewind';
import { Settings, ChevronLeft, LogOut, Users, BellOff, Bell, X, ChevronRight, Plus, Share2 } from 'lucide-react-native';
import { SkeletonExpenseCard } from '../../../components/SkeletonExpenseCard';
import { SkeletonBalanceRow } from '../../../components/SkeletonBalanceRow';
import { ErrorState } from '../../../components/ErrorState';
import { RemovedMemberState } from '../../../components/RemovedMemberState';
import { Colors } from '../../../constants/colors';
import { fetchGroupDetail, leaveGroup } from '../../../lib/repos/groups';
import { getOrCreateInviteToken } from '../../../lib/repos/invites';
import { fetchGroupExpenses, type ExpenseListItem } from '../../../lib/repos/expenses';
import { fetchGroupBalances, type GroupBalanceData } from '../../../lib/repos/balances';
import { format } from '../../../lib/currency';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/auth';
import { useToast } from '../../../hooks/useToast';
import { BalancesTab } from './balances';
import type { GroupDetail } from '../../../lib/repos/groups';

const INVITE_BASE = 'even-steven.vercel.app/invite';

type Tab = 'expenses' | 'balances' | 'summary';

const GROUP_HEADER_COLORS: Record<string, string> = {
  Trip: Colors.gradients.trip[0],
  Home: Colors.gradients.home[0],
  Couple: Colors.gradients.couple[0],
  Utilities: Colors.gradients.utilities[0],
  Family: Colors.gradients.family[0],
  Other: Colors.gradients.other[0],
};

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

function AddExpenseFab({ group, groupId }: { group: GroupDetail; groupId: string }) {
  const router = useRouter();
  const toast = useToast();
  const isExpiredOrArchived = group.status === 'expired' || group.status === 'archived';

  function handlePress() {
    if (isExpiredOrArchived) {
      toast.info('This trip has ended. Extend the trip in settings to add new expenses.');
      return;
    }
    router.push(`/group/${groupId}/add-expense` as never);
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
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { session } = useAuthStore();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? '';

  const { data: group, isLoading, isError, refetch } = useGroupDetail(id, userId);
  const [showSettings, setShowSettings] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('balances');

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

  async function handleShareInviteLink() {
    if (!session || !id || !group?.memberId) return;
    setIsSharing(true);
    try {
      const token = await getOrCreateInviteToken(supabase, id, group.memberId);
      const url = `https://${INVITE_BASE}/${token}`;
      await Share.share({
        message: `Join my group on Even Steven: ${url}`,
        url,
      });
    } catch {
      // Share cancelled or error — no action needed
    } finally {
      setIsSharing(false);
    }
  }

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

  const headerColor = GROUP_HEADER_COLORS[group.type] ?? Colors.gradients.other[0];

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Colored header with group name and action buttons */}
      <View className="px-4 pt-3 pb-4" style={{ backgroundColor: headerColor }}>
        <View className="flex-row items-center justify-between mb-2">
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="flex-row items-center"
          >
            <ChevronLeft size={22} color="rgba(255,255,255,0.8)" strokeWidth={2} />
            <Text className="text-sm ml-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
              Back
            </Text>
          </TouchableOpacity>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              testID="share-invite-button"
              onPress={handleShareInviteLink}
              disabled={isSharing}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
              ) : (
                <Share2 size={20} color="rgba(255,255,255,0.8)" strokeWidth={1.5} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              testID="settings-button"
              onPress={() => setShowSettings(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Settings size={22} color="rgba(255,255,255,0.8)" strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
        </View>
        <Text className="text-white font-bold text-2xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
          {group.name}
        </Text>
        {group.status === 'expired' && (
          <View className="mt-1.5 px-2 py-0.5 bg-black/20 rounded-full self-start">
            <Text className="text-white/70 text-xs">Trip ended</Text>
          </View>
        )}
      </View>

      {/* Tab bar */}
      <View
        className="flex-row border-b border-border"
        style={{ backgroundColor: theme.surface }}
      >
        {(['expenses', 'balances', 'summary'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            testID={`tab-${tab}`}
            onPress={() => setActiveTab(tab)}
            className="flex-1 py-3 items-center"
          >
            <Text
              className="text-sm font-medium capitalize"
              style={{
                color: activeTab === tab ? Colors.accent : theme.textSecondary,
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
            {activeTab === tab && (
              <View
                className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                style={{ backgroundColor: Colors.accent }}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View className="flex-1">
        {activeTab === 'expenses' && (
          <ExpensesTab
            groupId={id}
            currentMemberId={group.currentMemberId ?? ''}
          />
        )}
        {activeTab === 'balances' && group.currentMemberId && (
          <BalancesTab groupId={id} currentMemberId={group.currentMemberId} />
        )}
        {activeTab === 'summary' && <SummaryTabStub />}
      </View>

      <AddExpenseFab group={group} groupId={id} />

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

type ExpenseFilter = 'all' | 'unsettled' | 'mine' | 'i-paid';

interface ExpensesTabProps {
  groupId: string;
  currentMemberId: string;
}

function isExpenseSettled(
  participantIds: string[],
  memberBalances: Map<string, number>
): boolean {
  return participantIds.every((id) => (memberBalances.get(id) ?? 1) === 0);
}

function ExpensesTab({ groupId, currentMemberId }: ExpensesTabProps) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const [activeFilter, setActiveFilter] = useState<ExpenseFilter>('all');

  const { data: expenses = [], isLoading } = useQuery<ExpenseListItem[]>({
    queryKey: ['expenses', groupId],
    queryFn: () => fetchGroupExpenses(supabase, groupId),
  });

  const { data: balancesData } = useQuery<GroupBalanceData>({
    queryKey: ['group-balances', groupId],
    queryFn: () => fetchGroupBalances(supabase, groupId),
  });

  const memberBalances = new Map<string, number>(
    (balancesData?.members ?? []).map((m) => [m.memberId, m.balance])
  );

  const filteredExpenses = expenses.filter((exp) => {
    switch (activeFilter) {
      case 'unsettled':
        return !isExpenseSettled(exp.participant_member_ids, memberBalances);
      case 'mine':
        return exp.participant_member_ids.includes(currentMemberId);
      case 'i-paid':
        return exp.payer_id === currentMemberId;
      default:
        return true;
    }
  });

  const filters: { key: ExpenseFilter; label: string; testID: string }[] = [
    { key: 'all', label: 'All', testID: 'filter-all' },
    { key: 'unsettled', label: 'Unsettled', testID: 'filter-unsettled' },
    { key: 'mine', label: 'Mine', testID: 'filter-mine' },
    { key: 'i-paid', label: 'I paid', testID: 'filter-i-paid' },
  ];

  if (isLoading) {
    return (
      <View className="flex-1 px-4 pt-4 gap-3">
        <SkeletonExpenseCard />
        <SkeletonExpenseCard />
        <SkeletonExpenseCard />
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
      >
        {filters.map((f) => {
          const isActive = activeFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              testID={f.testID}
              accessibilityState={{ selected: isActive }}
              onPress={() => setActiveFilter(f.key)}
              className="px-4 py-1.5 rounded-full border"
              style={{
                backgroundColor: isActive ? Colors.accent : 'transparent',
                borderColor: isActive ? Colors.accent : theme.border,
              }}
            >
              <Text
                className="font-body text-sm font-medium"
                style={{ color: isActive ? '#ffffff' : theme.textSecondary }}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Expense list */}
      {filteredExpenses.length === 0 ? (
        <View testID="expenses-empty-state" className="flex-1 items-center justify-center px-4">
          <Text className="text-text-secondary text-base text-center">
            {activeFilter === 'all' ? 'No expenses yet.' : 'No expenses match this filter.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, gap: 12 }}
        >
          {filteredExpenses.map((expense) => {
            const settled = isExpenseSettled(expense.participant_member_ids, memberBalances);
            return (
              <TouchableOpacity
                key={expense.id}
                testID={`expense-card-${expense.id}`}
                onPress={() =>
                  router.push(
                    `/group/${groupId}/edit-expense?expenseId=${expense.id}` as never
                  )
                }
                className="rounded-2xl p-4"
                style={{
                  backgroundColor: theme.surface,
                  opacity: settled ? 0.5 : 1,
                }}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 mr-3">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text
                        testID={`expense-title-${expense.id}`}
                        className="font-display font-semibold text-text-primary text-base"
                        style={{ color: settled ? theme.textSecondary : theme.textPrimary }}
                      >
                        {expense.title}
                      </Text>
                      {expense.is_edited && (
                        <View
                          testID={`edited-badge-${expense.id}`}
                          className="px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: theme.surface2 }}
                        >
                          <Text className="text-text-tertiary text-xs font-body">edited</Text>
                        </View>
                      )}
                    </View>
                    <Text className="font-body text-text-secondary text-sm mt-0.5">
                      {expense.category} · {expense.payer_name} paid · {expense.expense_date}
                    </Text>
                  </View>
                  <Text className="font-display font-semibold text-text-primary text-base">
                    {format(expense.amount, expense.currency)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function SummaryTabStub() {
  return (
    <View className="flex-1 items-center justify-center px-4">
      <Text className="text-text-secondary text-base">Summary coming soon</Text>
    </View>
  );
}
