import { ScrollView, View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useColorScheme } from 'nativewind';
import { ChevronLeft, Pencil, Receipt, CheckCircle } from 'lucide-react-native';
import { supabase } from '../../../../lib/supabase';
import { fetchGroupExpenses, fetchExpenseParticipants } from '../../../../lib/repos/expenses';
import { fetchGroupMembers } from '../../../../lib/repos/groups';
import { fetchGroupBalances } from '../../../../lib/repos/balances';
import { format, type Currency } from '../../../../lib/currency';
import { useAuthStore } from '../../../../store/auth';
import { Colors } from '../../../../constants/colors';

export default function ExpenseDetailScreen() {
  const { id: groupId, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { session } = useAuthStore();

  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', groupId],
    queryFn: () => fetchGroupExpenses(supabase, groupId),
  });

  const expense = expenses.find((e) => e.id === expenseId);

  const { data: participants = [] } = useQuery({
    queryKey: ['expense-participants', expenseId],
    queryFn: () => fetchExpenseParticipants(supabase, expenseId),
    enabled: !!expenseId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => fetchGroupMembers(supabase, groupId),
  });

  const { data: groupBalances } = useQuery({
    queryKey: ['group-balances', groupId],
    queryFn: () => fetchGroupBalances(supabase, groupId),
    enabled: !!groupId,
  });

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const currentMemberId = members.find((m) => m.user_id === session?.user.id)?.id;

  const isNonPayerParticipant =
    !!currentMemberId &&
    !!expense &&
    expense.payer_id !== currentMemberId &&
    participants.some((p) => p.memberId === currentMemberId);

  const myParticipant = isNonPayerParticipant
    ? participants.find((p) => p.memberId === currentMemberId)
    : undefined;

  const myBalance = groupBalances?.members.find((m) => m.memberId === currentMemberId)?.balance ?? null;
  const isSettled = isNonPayerParticipant && myBalance !== null && myBalance >= 0;
  const baseCurrency = groupBalances?.currency;

  if (expensesLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={Colors.accent} />
      </SafeAreaView>
    );
  }

  if (!expense) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="px-4 py-3 flex-row items-center border-b border-border">
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <ChevronLeft size={24} color={Colors.accent} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-secondary">Expense not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View
        className="px-4 py-3 flex-row items-center justify-between border-b border-border"
        style={{ backgroundColor: theme.surface }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} className="flex-row items-center">
          <ChevronLeft size={24} color={Colors.accent} strokeWidth={2} />
        </TouchableOpacity>
        <Text className="font-display font-semibold text-text-primary text-base">Expense</Text>
        <TouchableOpacity
          testID="edit-expense-button"
          onPress={() =>
            router.push(`/groups/${groupId}/edit-expense?expenseId=${expenseId}` as never)
          }
          hitSlop={8}
        >
          <Pencil size={20} color={Colors.accent} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Title + Amount */}
        <View
          className="rounded-2xl p-5 border border-border"
          style={{ backgroundColor: theme.surface }}
        >
          <View className="flex-row items-start justify-between gap-3 mb-3">
            <Text className="font-display font-bold text-text-primary text-2xl flex-1">
              {expense.title}
            </Text>
            <Text className="font-display font-bold text-text-primary text-2xl">
              {format(expense.amount, expense.currency as Currency)}
            </Text>
          </View>
          <View className="flex-row items-center gap-2 flex-wrap">
            <View
              className="px-2 py-0.5 rounded"
              style={{ backgroundColor: theme.surface2 }}
            >
              <Text className="font-body text-xs text-text-secondary">{expense.category}</Text>
            </View>
            <Text className="font-body text-text-tertiary text-xs">·</Text>
            <Text className="font-body text-text-secondary text-xs">{expense.expense_date}</Text>
          </View>
        </View>

        {/* Payer */}
        <View
          className="rounded-2xl p-4 border border-border"
          style={{ backgroundColor: theme.surface }}
        >
          <Text className="font-body text-text-tertiary text-xs uppercase tracking-wider mb-2">
            Paid by
          </Text>
          <Text className="font-body text-text-primary text-base font-medium">
            {expense.payer_name}
          </Text>
        </View>

        {/* Description */}
        {expense.description ? (
          <View
            className="rounded-2xl p-4 border border-border"
            style={{ backgroundColor: theme.surface }}
          >
            <Text className="font-body text-text-tertiary text-xs uppercase tracking-wider mb-2">
              Note
            </Text>
            <Text className="font-body text-text-primary text-sm leading-5">
              {expense.description}
            </Text>
          </View>
        ) : null}

        {/* Split breakdown */}
        <View
          className="rounded-2xl p-4 border border-border"
          style={{ backgroundColor: theme.surface }}
        >
          <Text className="font-body text-text-tertiary text-xs uppercase tracking-wider mb-3">
            Split ({expense.split_method})
          </Text>
          {participants.map((p) => {
            const member = memberMap.get(p.memberId);
            const name = member?.display_name ?? member?.email ?? 'Unknown';
            const isMe = p.memberId === currentMemberId;
            return (
              <View key={p.memberId} className="flex-row items-center justify-between py-2 border-b border-border last:border-b-0">
                <Text
                  className="font-body text-sm"
                  style={{ color: isMe ? Colors.accent : theme.textPrimary }}
                >
                  {isMe ? `${name} (you)` : name}
                </Text>
                <Text
                  className="font-body text-sm font-medium"
                  style={{ color: isMe ? Colors.accent : theme.textPrimary }}
                >
                  {format(p.shareAmount, expense.currency as Currency)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Receipt */}
        {expense.receipt_url ? (
          <View
            className="rounded-2xl border border-border overflow-hidden"
            style={{ backgroundColor: theme.surface }}
          >
            <View className="flex-row items-center gap-2 p-4 border-b border-border">
              <Receipt size={16} color={theme.textSecondary} strokeWidth={1.5} />
              <Text className="font-body text-text-secondary text-xs uppercase tracking-wider">
                Receipt
              </Text>
            </View>
            <Image
              source={{ uri: expense.receipt_url }}
              style={{ width: '100%', height: 200 }}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {/* Settle Up / Settled — non-payer participants only */}
        {isNonPayerParticipant && myParticipant && (
          <View
            className="rounded-2xl p-4 border border-border"
            style={{ backgroundColor: theme.surface }}
          >
            <Text className="font-body text-text-tertiary text-xs uppercase tracking-wider mb-3">
              Your share
            </Text>
            <View className="flex-row items-center justify-between">
              <Text
                testID="my-share-amount"
                className="font-display font-bold text-xl"
                style={{ color: isSettled ? theme.textSecondary : Colors.destructive }}
              >
                {format(
                  myParticipant.baseShareAmount ?? myParticipant.shareAmount,
                  (baseCurrency ?? expense.currency) as Currency
                )}
              </Text>
              {isSettled ? (
                <View
                  testID="settled-badge"
                  className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: Colors.accentDim }}
                >
                  <CheckCircle size={14} color={Colors.accent} strokeWidth={2} />
                  <Text className="font-body text-xs font-medium" style={{ color: Colors.accent }}>
                    Settled
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  testID="settle-up-button"
                  onPress={() => router.replace(`/groups/${groupId}` as never)}
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: Colors.accent }}
                >
                  <Text className="font-body text-sm font-semibold" style={{ color: '#0b0b0b' }}>
                    Settle Up
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Edited badge */}
        {expense.is_edited && (
          <Text className="font-body text-text-tertiary text-xs text-center">
            {expense.last_edited_by_name
              ? `Edited by ${expense.last_edited_by_name}`
              : 'Edited'}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
