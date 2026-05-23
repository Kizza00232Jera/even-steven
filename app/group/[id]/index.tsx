import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useColorScheme } from 'nativewind';
import { Settings, ChevronLeft, Plus, Share2 } from 'lucide-react-native';
import { SkeletonExpenseCard } from '../../../components/SkeletonExpenseCard';
import { SkeletonBalanceRow } from '../../../components/SkeletonBalanceRow';
import { ErrorState } from '../../../components/ErrorState';
import { RemovedMemberState } from '../../../components/RemovedMemberState';
import { Colors } from '../../../constants/colors';
import { fetchGroupDetail } from '../../../lib/repos/groups';
import { getOrCreateInviteToken } from '../../../lib/repos/invites';
import { fetchGroupExpenses, type ExpenseListItem } from '../../../lib/repos/expenses';
import { fetchGroupBalances, type GroupBalanceData } from '../../../lib/repos/balances';
import { format } from '../../../lib/currency';
import type { Currency } from '../../../lib/currency';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/auth';
import { useToast } from '../../../hooks/useToast';
import { useRealtime } from '../../../hooks/useRealtime';
import { BalancesTab } from './balances';
import { SummaryTab } from './summary';
import type { GroupDetail } from '../../../lib/repos/groups';

const INVITE_BASE = 'even-steven.vercel.app/invite';

type Tab = 'expenses' | 'balances' | 'summary';

const GROUP_HEADER_GRADIENTS: Record<string, [string, string]> = {
  Trip: Colors.gradients.trip as [string, string],
  Home: Colors.gradients.home as [string, string],
  Couple: Colors.gradients.couple as [string, string],
  Utilities: Colors.gradients.utilities as [string, string],
  Family: Colors.gradients.family as [string, string],
  Other: Colors.gradients.other as [string, string],
};

function useGroupDetail(id: string, userId: string) {
  return useQuery({
    queryKey: ['group', id],
    queryFn: () => fetchGroupDetail(supabase, id, userId),
  });
}


function AddExpenseFab({ group, groupId }: { group: GroupDetail; groupId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
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
        backgroundColor: isExpiredOrArchived ? theme.textTertiary : Colors.accent,
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
  const userId = session?.user.id ?? '';

  const { data: group, isLoading, isError, refetch } = useGroupDetail(id, userId);
  useRealtime(id);
  const [isSharing, setIsSharing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('balances');

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

  const [gradientStart, gradientEnd] = GROUP_HEADER_GRADIENTS[group.type] ?? Colors.gradients.other;
  const screenWidth = Dimensions.get('window').width;
  const HEADER_HEIGHT = 200;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Full-bleed gradient header — 200px tall per spec §13 */}
      <View style={{ height: HEADER_HEIGHT, overflow: 'hidden' }}>
        <Svg
          style={{ position: 'absolute', top: 0, left: 0 }}
          width={screenWidth}
          height={HEADER_HEIGHT}
        >
          <Defs>
            <SvgLinearGradient id="hdrGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={gradientStart} stopOpacity="1" />
              <Stop offset="1" stopColor={gradientEnd} stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <Rect width={screenWidth} height={HEADER_HEIGHT} fill="url(#hdrGrad)" />
          {/* Dark overlay per spec §13 */}
          <Rect width={screenWidth} height={HEADER_HEIGHT} fill="rgba(0,0,0,0.35)" />
        </Svg>
        <View className="px-4 pt-3 pb-4 flex-1 justify-between">
          <View className="flex-row items-center justify-between">
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
                onPress={() => router.push(`/group/${id}/settings` as never)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Settings size={22} color="rgba(255,255,255,0.8)" strokeWidth={1.5} />
              </TouchableOpacity>
            </View>
          </View>
          <View>
            <Text className="text-white font-bold text-2xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
              {group.name}
            </Text>
            {group.status === 'expired' && (
              <View className="mt-1.5 px-2 py-0.5 bg-black/20 rounded-full self-start">
                <Text className="text-white/70 text-xs">Trip ended</Text>
              </View>
            )}
          </View>
        </View>
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
          <BalancesTab
            groupId={id}
            currentMemberId={group.currentMemberId}
            settlementVisibility={group.settlement_visibility}
            groupStatus={group.status}
          />
        )}
        {activeTab === 'summary' && <SummaryTab groupId={id} />}
      </View>

      <AddExpenseFab group={group} groupId={id} />
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

  const seenIdsRef = useRef<Set<string> | null>(null);
  const slideAnims = useRef(new Map<string, Animated.Value>()).current;

  const { data: expenses = [], isLoading } = useQuery<ExpenseListItem[]>({
    queryKey: ['expenses', groupId],
    queryFn: () => fetchGroupExpenses(supabase, groupId),
  });

  useEffect(() => {
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(expenses.map((e) => e.id));
      return;
    }
    for (const expense of expenses) {
      if (!seenIdsRef.current.has(expense.id) && !slideAnims.has(expense.id)) {
        const anim = new Animated.Value(-40);
        slideAnims.set(expense.id, anim);
        Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
        seenIdsRef.current.add(expense.id);
      }
    }
  }, [expenses, slideAnims]);

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
      {/* Filter chips — fixed height wrapper prevents Android flex expansion */}
      <View style={{ height: 52 }}>
        <ScrollView
          testID="filter-pill-row"
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
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
      </View>

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
            const slideAnim = slideAnims.get(expense.id);
            return (
              <Animated.View
                key={expense.id}
                style={slideAnim ? { transform: [{ translateY: slideAnim }] } : undefined}
              >
                <TouchableOpacity
                  testID={`expense-card-${expense.id}`}
                  onPress={() =>
                    router.push(
                      `/group/${groupId}/expense-detail?expenseId=${expense.id}` as never
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
                      {format(expense.amount, expense.currency as Currency)}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
