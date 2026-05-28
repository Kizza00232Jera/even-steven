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
  Image,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useColorScheme } from 'nativewind';
import { Settings, ChevronLeft, Plus, Share2, CheckCircle } from 'lucide-react-native';
import { SkeletonExpenseCard } from '../../../../components/SkeletonExpenseCard';
import { SkeletonBalanceRow } from '../../../../components/SkeletonBalanceRow';
import { ErrorState } from '../../../../components/ErrorState';
import { RemovedMemberState } from '../../../../components/RemovedMemberState';
import { Colors } from '../../../../constants/colors';
import { CATEGORY_META, DEFAULT_CATEGORY_META } from '../../../../constants/categories';
import { fetchGroupDetail, fetchGroupMemberPreviews, type GroupDetail, type MemberPreview } from '../../../../lib/repos/groups';
import { getOrCreateInviteToken } from '../../../../lib/repos/invites';
import { fetchGroupExpenses, type ExpenseListItem } from '../../../../lib/repos/expenses';
import { fetchGroupBalances, type GroupBalanceData } from '../../../../lib/repos/balances';
import { format, type Currency } from '../../../../lib/currency';
import { formatExpenseDate } from '../../../../lib/dateUtils';
import { supabase } from '../../../../lib/supabase';
import { useAuthStore } from '../../../../store/auth';
import { useToast } from '../../../../hooks/useToast';
import { useRealtime } from '../../../../hooks/useRealtime';
import { BalancesTab } from './balances';
import { SummaryTab } from './summary';

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
    router.push(`/groups/${groupId}/add-expense` as never);
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

  const { data: memberPreviewMap = {} } = useQuery({
    queryKey: ['group-member-previews', userId, id],
    queryFn: () => fetchGroupMemberPreviews(supabase, [id], userId),
    enabled: !!id && !!userId,
    staleTime: 60_000,
  });

  const { data: headerBalances } = useQuery({
    queryKey: ['group-balances', id],
    queryFn: () => fetchGroupBalances(supabase, id),
    enabled: !!id,
  });

  const headerMemberPreviews: MemberPreview[] = memberPreviewMap[id] ?? [];
  const myBalance = headerBalances?.members.find((m) => m.userId === userId)?.balance ?? null;
  const groupCurrency = (group?.base_currency ?? 'EUR') as Currency;

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
      {/* Full-bleed header — 200px tall per spec §13 */}
      <View style={{ height: HEADER_HEIGHT, overflow: 'hidden' }}>
        {group.background_image_url ? (
          <Image
            source={{ uri: group.background_image_url }}
            style={{ position: 'absolute', top: 0, left: 0, width: screenWidth, height: HEADER_HEIGHT }}
            resizeMode="cover"
          />
        ) : (
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
          </Svg>
        )}
        {/* Dark overlay per spec §13 */}
        <View style={{ position: 'absolute', top: 0, left: 0, width: screenWidth, height: HEADER_HEIGHT, backgroundColor: 'rgba(0,0,0,0.35)' }} />
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
                onPress={() => router.push(`/groups/${id}/settings` as never)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Settings size={22} color="rgba(255,255,255,0.8)" strokeWidth={1.5} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            {/* Left: group name + balance */}
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: '#ffffff' }}>
                {group.name}
              </Text>
              {group.status === 'expired' && (
                <View className="mt-1 px-2 py-0.5 bg-black/20 rounded-full self-start">
                  <Text className="text-white/70 text-xs">Trip ended</Text>
                </View>
              )}
              {myBalance !== null && (
                <View
                  style={{
                    marginTop: 4,
                    alignSelf: 'flex-start',
                    paddingHorizontal: myBalance === 0 ? 0 : 8,
                    paddingVertical: myBalance === 0 ? 0 : 3,
                    borderRadius: 8,
                    backgroundColor:
                      myBalance > 0.005
                        ? 'rgba(0,200,150,0.25)'
                        : myBalance < -0.005
                        ? 'rgba(255,68,68,0.25)'
                        : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Inter_500Medium',
                      fontSize: 14,
                      color: '#ffffff',
                    }}
                  >
                    {myBalance > 0.005
                      ? `You're owed ${format(myBalance, groupCurrency)}`
                      : myBalance < -0.005
                      ? `You owe ${format(Math.abs(myBalance), groupCurrency)}`
                      : 'Settled'}
                  </Text>
                </View>
              )}
            </View>

            {/* Right: avatar stack + member count */}
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                {headerMemberPreviews.slice(0, 3).map((p, i) => (
                  <View
                    key={p.memberId}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      borderWidth: 2,
                      borderColor: 'rgba(0,0,0,0.25)',
                      marginLeft: i === 0 ? 0 : -6,
                      zIndex: 3 - i,
                      overflow: 'hidden',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {p.avatarUrl ? (
                      <Image source={{ uri: p.avatarUrl }} style={{ width: 32, height: 32 }} />
                    ) : (
                      <Text
                        style={{
                          color: '#ffffff',
                          fontSize: 13,
                          fontFamily: 'SpaceGrotesk_500Medium',
                        }}
                      >
                        {p.name.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 12,
                  fontFamily: 'Inter_400Regular',
                }}
              >
                {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
              </Text>
            </View>
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
            const { icon: CategoryIcon, color: categoryColor } =
              CATEGORY_META[expense.category] ?? DEFAULT_CATEGORY_META;
            const isPayer = expense.payer_id === currentMemberId;
            const myParticipant = expense.participants.find(
              (p) => p.memberId === currentMemberId,
            );
            const shareText = isPayer
              ? `You paid ${format(expense.amount, expense.currency as Currency)}`
              : myParticipant && settled
              ? null
              : myParticipant
              ? `You borrowed ${format(myParticipant.shareAmount, expense.currency as Currency)}`
              : null;
            const shareColor = isPayer ? Colors.accent : Colors.destructive;

            return (
              <Animated.View
                key={expense.id}
                style={slideAnim ? { transform: [{ translateY: slideAnim }] } : undefined}
              >
                <TouchableOpacity
                  testID={`expense-card-${expense.id}`}
                  onPress={() =>
                    router.push(
                      `/groups/${groupId}/expense-detail?expenseId=${expense.id}` as never,
                    )
                  }
                  style={{
                    backgroundColor: theme.surface,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: theme.border,
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    opacity: settled ? 0.5 : 1,
                  }}
                  activeOpacity={0.75}
                >
                  {/* Category icon */}
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: `${categoryColor}26`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CategoryIcon size={18} color={categoryColor} strokeWidth={1.5} />
                  </View>

                  {/* Title + payer · date */}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      testID={`expense-title-${expense.id}`}
                      style={{
                        fontFamily: 'SpaceGrotesk_600SemiBold',
                        fontSize: 15,
                        color: settled ? theme.textSecondary : theme.textPrimary,
                      }}
                      numberOfLines={1}
                    >
                      {expense.title}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Inter_400Regular',
                        fontSize: 13,
                        color: theme.textSecondary,
                        marginTop: 2,
                      }}
                      numberOfLines={1}
                    >
                      {expense.payer_name} · {formatExpenseDate(expense.expense_date)}
                    </Text>
                  </View>

                  {/* Total + share */}
                  <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                    <Text
                      style={{
                        fontFamily: 'SpaceGrotesk_600SemiBold',
                        fontSize: 15,
                        color: settled ? theme.textSecondary : theme.textPrimary,
                      }}
                    >
                      {format(expense.amount, expense.currency as Currency)}
                    </Text>
                    {settled && !isPayer && myParticipant ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 3,
                          marginTop: 3,
                          backgroundColor: Colors.accentDim,
                          borderRadius: 6,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                        }}
                      >
                        <CheckCircle size={10} color={Colors.accent} strokeWidth={2.5} />
                        <Text
                          style={{
                            fontFamily: 'Inter_500Medium',
                            fontSize: 11,
                            color: Colors.accent,
                          }}
                        >
                          Settled
                        </Text>
                      </View>
                    ) : shareText ? (
                      <Text
                        style={{
                          fontFamily: 'Inter_500Medium',
                          fontSize: 12,
                          color: shareColor,
                          textAlign: 'right',
                          marginTop: 2,
                          maxWidth: 100,
                        }}
                      >
                        {shareText}
                      </Text>
                    ) : null}
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
