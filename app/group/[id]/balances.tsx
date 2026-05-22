import React, { useState, useMemo } from 'react';
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
import { User, Check, RotateCcw } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { simplifyDebts, type Settlement } from '../../../lib/debt';
import { fetchGroupBalances } from '../../../lib/repos/balances';
import { logActivityEvent } from '../../../lib/repos/activity';
import { sendGroupNotification } from '../../../lib/notifications';
import {
  recordSettlement,
  fetchGroupSettlements,
  voidSettlement,
  type SettlementRecord,
} from '../../../lib/repos/settlements';
import { supabase } from '../../../lib/supabase';
import { format, type Currency } from '../../../lib/currency';
import { useAuthStore } from '../../../store/auth';
import { hapticOnSettlementRecorded } from '../../../lib/haptics';
import { useToast } from '../../../hooks/useToast';
import { SkeletonBalanceRow } from '../../../components/SkeletonBalanceRow';
import { Colors } from '../../../constants/colors';

interface SettleUpTarget {
  debtorMemberId: string;
  creditorMemberId: string;
  debtorName: string;
  creditorName: string;
  maxAmount: number;
  currency: Currency;
}

interface BalancesTabProps {
  groupId: string;
  currentMemberId: string;
  settlementVisibility?: 'public' | 'private';
}

export function BalancesTab({ groupId, currentMemberId, settlementVisibility }: BalancesTabProps) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const queryClient = useQueryClient();
  const toast = useToast();
  const { session } = useAuthStore();

  const [settleUpTarget, setSettleUpTarget] = useState<SettleUpTarget | null>(null);
  const [amountText, setAmountText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['group-balances', groupId],
    queryFn: () => fetchGroupBalances(supabase, groupId),
  });

  const { data: settlements = [] } = useQuery({
    queryKey: ['group-settlements', groupId],
    queryFn: () => fetchGroupSettlements(supabase, groupId),
  });

  const simplifiedDebts = useMemo(() => {
    if (!data) return [];
    const all = simplifyDebts(data.members.map((m) => ({ memberId: m.memberId, balance: m.balance })));
    // When settlement_visibility is private, non-parties see only debts they're involved in
    if (settlementVisibility === 'private') {
      return all.filter((d) => d.from === currentMemberId || d.to === currentMemberId);
    }
    return all;
  }, [data, settlementVisibility, currentMemberId]);

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
      logActivityEvent(supabase, {
        groupId,
        actorId: session!.user.id,
        eventType: 'settlement_recorded',
        metadata: { amount: parsed, currency: settleUpTarget.currency },
      }).catch(() => {});
      // Notify the group (payment_in_group) and the payee specifically (payment_received)
      sendGroupNotification({
        eventType: 'settlement_recorded',
        groupId,
        actorMemberId: currentMemberId,
        metadata: { amount: parsed, currency: settleUpTarget.currency },
      });
      sendGroupNotification({
        eventType: 'payment_received',
        groupId,
        actorMemberId: currentMemberId,
        payeeMemberId: settleUpTarget.creditorMemberId,
        metadata: { amount: parsed, currency: settleUpTarget.currency },
      });
      toast.success('Settlement recorded');
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['group-balances', groupId] });
      queryClient.invalidateQueries({ queryKey: ['group-settlements', groupId] });
    } catch {
      toast.error('Failed to record settlement');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVoid(settlementId: string) {
    try {
      await voidSettlement(supabase, settlementId, currentMemberId);
      logActivityEvent(supabase, {
        groupId,
        actorId: session!.user.id,
        eventType: 'settlement_voided',
      }).catch(() => {});
      hapticOnSettlementRecorded();
      toast.success('Settlement undone');
      queryClient.invalidateQueries({ queryKey: ['group-balances', groupId] });
      queryClient.invalidateQueries({ queryKey: ['group-settlements', groupId] });
    } catch {
      toast.error('Failed to undo settlement');
    }
  }

  function getSettlementLabel(s: SettlementRecord): string {
    const payerName = memberMap.get(s.payerMemberId)?.name ?? 'Unknown';
    const payeeName = memberMap.get(s.payeeMemberId)?.name ?? 'Unknown';
    if (s.payerMemberId === currentMemberId) return `You paid ${payeeName}`;
    if (s.payeeMemberId === currentMemberId) return `${payerName} paid you`;
    return `${payerName} paid ${payeeName}`;
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

        {settlements.length > 0 && (
          <>
            <Text
              className="text-xs font-semibold uppercase tracking-wider px-1 pt-4 pb-1"
              style={{ color: theme.textSecondary }}
            >
              Settlements
            </Text>
            {settlements.map((s) => (
              <SettlementRow
                key={s.id}
                label={getSettlementLabel(s)}
                amount={format(s.amount, s.currency)}
                canUndo={s.recordedBy === currentMemberId}
                onUndo={() => handleVoid(s.id)}
                theme={theme}
              />
            ))}
          </>
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
                  {settleUpTarget.debtorMemberId === currentMemberId
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

interface SettlementRowProps {
  label: string;
  amount: string;
  canUndo: boolean;
  onUndo: () => void;
  theme: typeof Colors.dark | typeof Colors.light;
}

function SettlementRow({ label, amount, canUndo, onUndo, theme }: SettlementRowProps) {
  return (
    <View
      className="flex-row items-center gap-3 rounded-2xl border border-border p-4"
      style={{ backgroundColor: theme.surface }}
    >
      <View
        className="w-10 h-10 rounded-full items-center justify-center"
        style={{ backgroundColor: Colors.accentDim }}
      >
        <Check size={20} color={Colors.accent} strokeWidth={1.5} />
      </View>
      <View className="flex-1">
        <Text className="text-text-primary font-medium text-sm">{label}</Text>
        <Text className="text-xs mt-0.5 font-semibold" style={{ color: Colors.accent }}>
          {amount}
        </Text>
      </View>
      {canUndo && (
        <TouchableOpacity
          onPress={onUndo}
          className="rounded-full px-4 py-2 flex-row items-center gap-1"
          style={{ backgroundColor: theme.surface2 }}
        >
          <RotateCcw size={12} color={theme.textSecondary} strokeWidth={2} />
          <Text className="font-semibold text-xs" style={{ color: theme.textSecondary }}>
            Undo
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
