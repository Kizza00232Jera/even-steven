import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { simplifyDebts, type Settlement } from '../../../lib/debt';
import { fetchGroupBalances } from '../../../lib/repos/balances';
import { recordSettlement } from '../../../lib/repos/settlements';
import { supabase } from '../../../lib/supabase';
import { format, type Currency } from '../../../lib/currency';
import { hapticOnSettlementRecorded } from '../../../lib/haptics';
import { useToast } from '../../../hooks/useToast';
import { SkeletonBalanceRow } from '../../../components/SkeletonBalanceRow';
import { Colors } from '../../../constants/colors';

interface BalancesTabProps {
  groupId: string;
  currentMemberId: string;
}

interface SettleUpTarget {
  debtorMemberId: string;
  creditorMemberId: string;
  debtorName: string;
  creditorName: string;
  maxAmount: number;
  currency: Currency;
}

export function BalancesTab({ groupId, currentMemberId }: BalancesTabProps) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const queryClient = useQueryClient();
  const toast = useToast();

  const [settleUpTarget, setSettleUpTarget] = useState<SettleUpTarget | null>(null);
  const [amountText, setAmountText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['group-balances', groupId],
    queryFn: () => fetchGroupBalances(supabase, groupId),
  });

  // Realtime: invalidate on expense or settlement changes
  useEffect(() => {
    const channel = supabase
      .channel(`balances-${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${groupId}` },
        () => queryClient.invalidateQueries({ queryKey: ['group-balances', groupId] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settlements', filter: `group_id=eq.${groupId}` },
        () => queryClient.invalidateQueries({ queryKey: ['group-balances', groupId] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);

  const simplifiedDebts = useMemo(() => {
    if (!data) return [];
    return simplifyDebts(data.members.map((m) => ({ memberId: m.memberId, balance: m.balance })));
  }, [data]);

  const memberMap = useMemo(() => {
    if (!data) return new Map<string, { name: string; avatarUrl: string | null }>();
    return new Map(data.members.map((m) => [m.memberId, { name: m.name, avatarUrl: m.avatarUrl }]));
  }, [data]);

  function getDebtLabel(debt: Settlement): string {
    const debtorName = memberMap.get(debt.from)?.name ?? 'Unknown';
    const creditorName = memberMap.get(debt.to)?.name ?? 'Unknown';
    if (debt.from === currentMemberId) return `You owe ${creditorName}`;
    if (debt.to === currentMemberId) return `${debtorName} owes you`;
    return `${debtorName} owes ${creditorName}`;
  }

  function openSettleUp(debt: Settlement) {
    const debtorName = memberMap.get(debt.from)?.name ?? 'Unknown';
    const creditorName = memberMap.get(debt.to)?.name ?? 'Unknown';
    setSettleUpTarget({
      debtorMemberId: debt.from,
      creditorMemberId: debt.to,
      debtorName,
      creditorName,
      maxAmount: debt.amount,
      currency: data!.currency,
    });
    setAmountText(debt.amount.toFixed(2));
  }

  function closeModal() {
    setSettleUpTarget(null);
    setAmountText('');
  }

  async function handleRecord() {
    if (!settleUpTarget || isSubmitting) return;
    const parsed = parseFloat(amountText);
    if (isNaN(parsed) || parsed <= 0) return;

    setIsSubmitting(true);
    try {
      await recordSettlement(supabase, {
        groupId,
        payerMemberId: settleUpTarget.debtorMemberId,
        payeeMemberId: settleUpTarget.creditorMemberId,
        amount: parsed,
        currency: settleUpTarget.currency,
        recordedBy: currentMemberId,
      });
      hapticOnSettlementRecorded();
      toast.success('Settlement recorded');
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['group-balances', groupId] });
    } catch {
      toast.error('Failed to record settlement');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <View className="flex-1 px-4 pt-4 gap-3">
        <SkeletonBalanceRow testID="skeleton-balance-row" />
        <SkeletonBalanceRow testID="skeleton-balance-row" />
        <SkeletonBalanceRow testID="skeleton-balance-row" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-text-secondary text-base mb-4">Failed to load balances.</Text>
        <TouchableOpacity
          onPress={() => refetch()}
          className="bg-surface-2 rounded-xl px-6 py-3"
        >
          <Text className="text-text-primary font-medium">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 12 }}>
        {simplifiedDebts.length === 0 ? (
          <View className="flex-1 items-center justify-center py-16">
            <View
              className="w-16 h-16 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: Colors.accentDim }}
            >
              <User size={28} color={Colors.accent} strokeWidth={1.5} />
            </View>
            <Text className="text-text-primary font-semibold text-lg">All settled</Text>
            <Text className="text-text-secondary text-sm mt-1 text-center">
              Everyone is square — no outstanding balances.
            </Text>
          </View>
        ) : (
          simplifiedDebts.map((debt, idx) => (
            <DebtRow
              key={`${debt.from}-${debt.to}-${idx}`}
              label={getDebtLabel(debt)}
              amount={format(debt.amount, data!.currency)}
              isYouInvolved={debt.from === currentMemberId || debt.to === currentMemberId}
              onSettleUp={() => openSettleUp(debt)}
              theme={theme}
            />
          ))
        )}
      </ScrollView>

      <Modal
        visible={settleUpTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-end"
        >
          <View
            className="rounded-t-3xl px-6 pt-6 pb-10 gap-5"
            style={{ backgroundColor: theme.surface }}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-text-primary font-semibold text-lg">Settle Up</Text>
              <TouchableOpacity onPress={closeModal} hitSlop={8}>
                <Text className="text-text-secondary text-base">Cancel</Text>
              </TouchableOpacity>
            </View>

            {settleUpTarget && (
              <>
                <Text className="text-text-secondary text-sm">
                  {settleUpTarget.debtorName === 'You' || settleUpTarget.debtorMemberId === currentMemberId
                    ? `You owe ${settleUpTarget.creditorName}`
                    : `${settleUpTarget.debtorName} owes ${settleUpTarget.creditorName}`}
                  {' · '}
                  Max{' '}
                  {format(settleUpTarget.maxAmount, settleUpTarget.currency)}
                </Text>
                <TextInput
                  placeholder="Amount"
                  placeholderTextColor={theme.textTertiary}
                  keyboardType="decimal-pad"
                  value={amountText}
                  onChangeText={setAmountText}
                  className="bg-surface-2 rounded-xl px-4 py-3 text-text-primary text-base"
                  style={{ color: theme.textPrimary }}
                  selectTextOnFocus
                />
                <TouchableOpacity
                  onPress={handleRecord}
                  disabled={isSubmitting}
                  className="rounded-full py-4 items-center"
                  style={{ backgroundColor: Colors.accent, opacity: isSubmitting ? 0.6 : 1 }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="font-semibold text-base" style={{ color: '#fff' }}>
                      Record Settlement
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

interface DebtRowProps {
  label: string;
  amount: string;
  isYouInvolved: boolean;
  onSettleUp: () => void;
  theme: typeof Colors.dark | typeof Colors.light;
}

function DebtRow({ label, amount, isYouInvolved, onSettleUp, theme }: DebtRowProps) {
  return (
    <View
      className="flex-row items-center gap-3 rounded-2xl border border-border p-4"
      style={{ backgroundColor: theme.surface }}
    >
      <View
        className="w-10 h-10 rounded-full items-center justify-center"
        style={{ backgroundColor: theme.surface2 }}
      >
        <User size={20} color={theme.textSecondary} strokeWidth={1.5} />
      </View>
      <View className="flex-1">
        <Text className="text-text-primary font-medium text-sm">{label}</Text>
        <Text
          className="text-xs mt-0.5 font-semibold"
          style={{ color: isYouInvolved ? Colors.destructive : theme.textSecondary }}
        >
          {amount}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onSettleUp}
        className="rounded-full px-4 py-2"
        style={{ backgroundColor: Colors.accent }}
      >
        <Text className="font-semibold text-xs" style={{ color: '#fff' }}>
          Settle Up
        </Text>
      </TouchableOpacity>
    </View>
  );
}
