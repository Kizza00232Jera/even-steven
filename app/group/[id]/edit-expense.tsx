import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/auth';
import { logActivityEvent } from '../../../lib/repos/activity';
import { sendGroupNotification } from '../../../lib/notifications';
import { X, ChevronDown, Check, Trash2, AlertCircle, Paperclip, Lock } from 'lucide-react-native';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { useOfflineGuard } from '../../../hooks/useOfflineGuard';
import { useToast } from '../../../hooks/useToast';
import { useReceiptPicker } from '../../../hooks/useReceiptPicker';
import {
  fetchGroupExpenses,
  fetchGroupMembers,
  fetchExpenseParticipants,
  hasGroupSettlements,
  updateExpenseMetadata,
  updateExpenseFinancial,
  uploadReceipt,
  deleteExpense,
  type ExpenseListItem,
} from '../../../lib/repos/expenses';
import { calculateEqualSplit, calculateUnequalSplit, calculatePercentageSplit } from '../../../lib/splits';
import { type Category } from '../../../lib/categories';
import { supabase } from '../../../lib/supabase';
import { Colors } from '../../../constants/colors';
import type { Database } from '../../../lib/database.types';

type GroupMember = Database['public']['Tables']['group_members']['Row'];

const ALL_CATEGORIES: Category[] = [
  'Other', 'Dining Out', 'Groceries', 'Liquor', 'Taxi', 'Hotel', 'Plane',
  'Bus/Train', 'Gas/Fuel', 'Parking', 'Rent', 'Electricity', 'Phone/Internet',
  'Insurance', 'Gift', 'Medical Expenses', 'Movies / Games', 'Furniture',
  'Household Supplies', 'Mortgage', 'Pets', 'Services', 'Cleaning', 'Heat',
  'Trash', 'TV', 'Water', 'Child Care', 'Clothing', 'Education', 'Taxes',
  'Bicycle', 'Car', 'Other Electronics', 'Games', 'Movies', 'Music', 'Sports',
];

const SPLIT_MODE_TAB_LABELS: Record<'equal' | 'unequal' | 'percentage', string> = {
  equal: 'Equal',
  unequal: 'Unequal',
  percentage: '%',
};

const SPLIT_SECTION_LABELS: Record<'equal' | 'unequal' | 'percentage', string> = {
  equal: 'Split equally between',
  unequal: 'Split unequally between',
  percentage: 'Split by percentage between',
};

function sumOthers(
  participantIds: Set<string>,
  payerId: string,
  values: Record<string, string>,
): number {
  return Array.from(participantIds)
    .filter((id) => id !== payerId)
    .reduce((sum, id) => {
      const val = parseFloat(values[id] ?? '0');
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
}

function hasNegativeEntry(
  values: Record<string, string>,
  payerId: string,
  participantIds: Set<string>,
): boolean {
  return Object.entries(values).some(([id, val]) => {
    if (id === payerId || !participantIds.has(id)) return false;
    const num = parseFloat(val);
    return !isNaN(num) && num < 0;
  });
}

function getMemberDisplayName(
  member: GroupMember,
  currentUserId: string | undefined,
  profileDisplayName: string | null | undefined,
): string {
  if (member.display_name) return member.display_name;
  if (member.user_id === currentUserId) return profileDisplayName ?? 'You';
  return member.email ?? '—';
}

export default function EditExpenseScreen() {
  const router = useRouter();
  const { id: groupId, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isOnline } = useNetworkStatus();
  const { writesDisabled } = useOfflineGuard(isOnline);
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const placeholderColor = theme.textTertiary;
  const { session, profile } = useAuthStore();
  const currentUserId = session?.user.id;

  const [expense, setExpense] = useState<ExpenseListItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [groupHasSettlements, setGroupHasSettlements] = useState(false);

  // Metadata state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Other');
  const [receiptChanged, setReceiptChanged] = useState(false);
  const { receiptUri, setReceiptUri, handleAttachReceipt } = useReceiptPicker(() => setReceiptChanged(true));
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isSavingRef = useRef(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Financial state (payer/admin only)
  const [amountText, setAmountText] = useState('');
  const [payerId, setPayerId] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState<'equal' | 'unequal' | 'percentage'>('equal');
  const [participantIds, setParticipantIds] = useState<Set<string>>(new Set());
  const [memberAmounts, setMemberAmounts] = useState<Record<string, string>>({});
  const [memberPercentages, setMemberPercentages] = useState<Record<string, string>>({});
  const [payerModalVisible, setPayerModalVisible] = useState(false);
  const [financialDirty, setFinancialDirty] = useState(false);

  const { data: members = [] } = useQuery<GroupMember[]>({
    queryKey: ['group-members-raw', groupId],
    queryFn: () => fetchGroupMembers(supabase, groupId),
  });

  useEffect(() => {
    async function load() {
      try {
        const [expenses, settled, participantDetails] = await Promise.all([
          fetchGroupExpenses(supabase, groupId),
          hasGroupSettlements(supabase, groupId),
          fetchExpenseParticipants(supabase, expenseId),
        ]);
        const found = expenses.find((e) => e.id === expenseId);
        if (found) {
          setExpense(found);
          setTitle(found.title);
          setDescription(found.description ?? '');
          setAmountText(String(found.amount));
          setCategory(found.category as Category);
          setReceiptUri(found.receipt_url ?? null);
          setPayerId(found.payer_id);
          setSplitMode(found.split_method);
          setParticipantIds(new Set(found.participant_member_ids));

          // Pre-fill share amounts for unequal/percentage modes
          if (found.split_method === 'unequal') {
            const amounts: Record<string, string> = {};
            for (const p of participantDetails) {
              if (p.memberId !== found.payer_id) {
                amounts[p.memberId] = String(p.shareAmount);
              }
            }
            setMemberAmounts(amounts);
          } else if (found.split_method === 'percentage') {
            const totalAmount = found.amount;
            const percs: Record<string, string> = {};
            for (const p of participantDetails) {
              if (p.memberId !== found.payer_id && totalAmount > 0) {
                percs[p.memberId] = ((p.shareAmount / totalAmount) * 100).toFixed(2);
              }
            }
            setMemberPercentages(percs);
          }
        }
        setGroupHasSettlements(settled);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [groupId, expenseId]);

  // Realtime: refresh if another user edits this expense
  useEffect(() => {
    const channel = supabase
      .channel(`expense-detail-${expenseId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'expenses', filter: `id=eq.${expenseId}` },
        async () => {
          if (isSavingRef.current) return;
          const expenses = await fetchGroupExpenses(supabase, groupId);
          const found = expenses.find((e) => e.id === expenseId);
          if (found) {
            setExpense(found);
            setTitle(found.title);
            setDescription(found.description ?? '');
            setAmountText(String(found.amount));
            setCategory(found.category as Category);
            setReceiptUri(found.receipt_url ?? null);
            queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
            const editorName = found.last_edited_by_name;
            toastRef.current.info(
              editorName
                ? `This expense was just edited by ${editorName}.`
                : 'This expense was just edited.'
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, expenseId, queryClient]);

  const myMember = members.find((m) => m.user_id === currentUserId);
  const isAdmin = myMember?.role === 'admin';
  const isFinancialEditor = expense !== null && (
    expense.payer_user_id === currentUserId || isAdmin
  );

  // Payer remainder memos
  const amount = parseFloat(amountText) || 0;

  const payerRemainder = useMemo(() => {
    if (!payerId || splitMode !== 'unequal') return amount;
    const othersTotal = sumOthers(participantIds, payerId, memberAmounts);
    return Math.round((amount - othersTotal) * 100) / 100;
  }, [amount, payerId, splitMode, memberAmounts, participantIds]);

  const payerPercentageRemainder = useMemo(() => {
    if (!payerId || splitMode !== 'percentage') return 100;
    const othersTotal = sumOthers(participantIds, payerId, memberPercentages);
    return Math.round((100 - othersTotal) * 100) / 100;
  }, [payerId, splitMode, memberPercentages, participantIds]);

  const payerMember = members.find((m) => m.id === payerId);
  const payerDisplayName = payerMember
    ? getMemberDisplayName(payerMember, currentUserId, profile?.display_name)
    : '—';

  function handleManualCategorySelect(cat: Category) {
    setCategory(cat);
    setCategoryModalVisible(false);
  }

  function handleRemoveReceipt() {
    setReceiptUri(null);
    setReceiptChanged(true);
  }

  function handleSplitModeChange(mode: 'equal' | 'unequal' | 'percentage') {
    setSplitMode(mode);
    setMemberAmounts({});
    setMemberPercentages({});
    setFinancialDirty(true);
  }

  function toggleParticipant(memberId: string) {
    setParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
    setFinancialDirty(true);
  }

  const canSave = useMemo(() => {
    if (!expense || title.trim().length === 0 || writesDisabled || isSaving) return false;
    if (isFinancialEditor && financialDirty) {
      if (participantIds.size === 0 || !payerId) return false;
      if (splitMode === 'unequal') {
        if (hasNegativeEntry(memberAmounts, payerId, participantIds) || payerRemainder < 0) return false;
      }
      if (splitMode === 'percentage') {
        if (hasNegativeEntry(memberPercentages, payerId, participantIds) || payerPercentageRemainder < 0) return false;
      }
    }
    return true;
  }, [expense, title, writesDisabled, isSaving, isFinancialEditor, financialDirty, participantIds, payerId, splitMode, memberAmounts, memberPercentages, payerRemainder, payerPercentageRemainder]);

  async function handleSave() {
    if (!canSave || !expense) return;
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      let updatedReceiptUrl: string | null | undefined;
      if (receiptChanged) {
        updatedReceiptUrl = receiptUri
          ? await uploadReceipt(supabase, `${expense.id}.jpg`, receiptUri)
          : null;
      }

      await updateExpenseMetadata(supabase, expense.id, {
        title: title.trim(),
        description: description.trim() || null,
        category,
        currentMemberId: myMember?.id,
        ...(receiptChanged ? { receipt_url: updatedReceiptUrl } : {}),
      });

      if (isFinancialEditor && financialDirty && payerId) {
        const participantList = Array.from(participantIds);
        const effectiveAmount = groupHasSettlements ? expense.amount : (parseFloat(amountText) || expense.amount);
        let splits;
        if (splitMode === 'equal') {
          splits = calculateEqualSplit(effectiveAmount, participantList, payerId);
        } else if (splitMode === 'unequal') {
          splits = calculateUnequalSplit(
            effectiveAmount,
            participantList.map((id) => ({
              memberId: id,
              amount: id === payerId ? 0 : parseFloat(memberAmounts[id] ?? '0') || 0,
            })),
            payerId,
          );
        } else {
          splits = calculatePercentageSplit(
            effectiveAmount,
            participantList.map((id) => ({
              memberId: id,
              percentage: id === payerId ? 0 : parseFloat(memberPercentages[id] ?? '0') || 0,
            })),
            payerId,
          );
        }
        await updateExpenseFinancial(supabase, expense.id, {
          amount: effectiveAmount,
          payerId,
          splitMethod: splitMode,
          splits,
          currentMemberId: myMember?.id,
        });
      }

      logActivityEvent(supabase, {
        groupId,
        actorId: session!.user.id,
        eventType: 'expense_edited',
        metadata: { title: title.trim() },
      }).catch(() => {});
      if (myMember?.id) {
        sendGroupNotification({
          eventType: 'expense_edited',
          groupId,
          actorMemberId: myMember.id,
          metadata: { title: title.trim() },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }

  function handleDeletePress() {
    if (!expense || groupHasSettlements) return;
    Alert.alert(
      'Delete expense',
      'This expense will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteExpense(supabase, expense.id);
              logActivityEvent(supabase, {
                groupId,
                actorId: session!.user.id,
                eventType: 'expense_deleted',
                metadata: { title: expense.title },
              }).catch(() => {});
              if (myMember?.id) {
                sendGroupNotification({
                  eventType: 'expense_deleted',
                  groupId,
                  actorMemberId: myMember.id,
                  metadata: { title: expense.title },
                });
              }
              queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
              router.back();
            } catch {
              Alert.alert('Error', 'Could not delete this expense. Please try again.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  if (!expense) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-4">
        <Text className="text-text-secondary text-base text-center font-body">Expense not found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-accent font-body">Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <TouchableOpacity
            testID="close-button"
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center"
          >
            <X size={20} color={theme.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <Text className="font-display text-text-primary font-semibold text-base">Edit Expense</Text>
          <TouchableOpacity
            testID="save-button"
            onPress={handleSave}
            disabled={!canSave}
            accessibilityState={{ disabled: !canSave }}
            className="px-4 h-8 rounded-full bg-accent items-center justify-center"
            style={{ opacity: canSave ? 1 : 0.4 }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text className="font-body text-white font-semibold text-sm">Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 20 }}>
          {/* ── Metadata (editable by all participants) ── */}

          {/* Title */}
          <View>
            <Text className="font-body text-text-secondary text-xs mb-1 uppercase tracking-wider">Title</Text>
            <TextInput
              testID="title-input"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Dinner at Konoba"
              placeholderTextColor={placeholderColor}
              maxLength={60}
              className="bg-surface-2 rounded-xl px-4 py-3 text-text-primary font-body text-base"
            />
          </View>

          {/* Description */}
          <View>
            <Text className="font-body text-text-secondary text-xs mb-1 uppercase tracking-wider">
              Description (optional)
            </Text>
            <TextInput
              testID="description-input"
              value={description}
              onChangeText={setDescription}
              placeholder="Add more details about this expense…"
              placeholderTextColor={placeholderColor}
              maxLength={500}
              multiline
              numberOfLines={3}
              className="bg-surface-2 rounded-xl px-4 py-3 text-text-primary font-body text-base"
            />
          </View>

          {/* Receipt */}
          <View>
            <Text className="font-body text-text-secondary text-xs mb-1 uppercase tracking-wider">
              Receipt (optional)
            </Text>
            {receiptUri ? (
              <View className="relative">
                <Image
                  testID="receipt-thumbnail"
                  source={{ uri: receiptUri }}
                  className="w-full h-40 rounded-xl"
                  resizeMode="cover"
                />
                <TouchableOpacity
                  testID="receipt-remove-button"
                  onPress={handleRemoveReceipt}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 items-center justify-center"
                >
                  <X size={16} color="#ffffff" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                testID="receipt-attach-button"
                onPress={handleAttachReceipt}
                className="bg-surface-2 rounded-xl px-4 py-3 flex-row items-center gap-3"
              >
                <Paperclip size={18} color={theme.textSecondary} strokeWidth={1.5} />
                <Text className="font-body text-text-secondary text-base">Attach receipt</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Category */}
          <View>
            <Text className="font-body text-text-secondary text-xs mb-1 uppercase tracking-wider">Category</Text>
            <TouchableOpacity
              testID="category-selector"
              onPress={() => setCategoryModalVisible(true)}
              className="bg-surface-2 rounded-xl px-4 py-3 flex-row items-center justify-between"
            >
              <Text testID="category-display" className="text-text-primary font-body text-base">
                {category}
              </Text>
              <ChevronDown size={14} color={theme.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* ── Financial section (payer / admin only) ── */}
          {isFinancialEditor ? (
            <>
              {/* Amount */}
              <View>
                <Text className="font-body text-text-secondary text-xs mb-1 uppercase tracking-wider">Amount</Text>
                <View className="flex-row gap-3">
                  <View className="bg-surface-2 rounded-xl px-4 py-3 items-center justify-center">
                    <Text className="text-text-primary font-body text-base font-semibold">
                      {expense.currency}
                    </Text>
                  </View>
                  <TextInput
                    testID="amount-input"
                    value={amountText}
                    onChangeText={(val) => { setAmountText(val); setFinancialDirty(true); }}
                    keyboardType="decimal-pad"
                    editable={!groupHasSettlements}
                    className="flex-1 bg-surface-2 rounded-xl px-4 py-3 text-text-primary font-body text-base"
                    style={{ opacity: groupHasSettlements ? 0.5 : 1 }}
                    placeholder="0.00"
                    placeholderTextColor={placeholderColor}
                  />
                </View>
                {groupHasSettlements && (
                  <View testID="amount-locked-notice" className="flex-row items-center gap-1.5 mt-2">
                    <Lock size={12} color={theme.textTertiary} strokeWidth={1.5} />
                    <Text className="font-body text-text-tertiary text-xs">
                      Amount is locked because settlements have been recorded.
                    </Text>
                  </View>
                )}
              </View>

              {/* Paid by */}
              <View>
                <Text className="font-body text-text-secondary text-xs mb-1 uppercase tracking-wider">Paid by</Text>
                <TouchableOpacity
                  testID="payer-selector"
                  onPress={() => setPayerModalVisible(true)}
                  className="bg-surface-2 rounded-xl px-4 py-3 flex-row items-center justify-between"
                >
                  <Text testID="payer-display" className="text-text-primary font-body text-base">
                    {payerDisplayName}
                  </Text>
                  <ChevronDown size={14} color={theme.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              {/* Split method */}
              <View>
                <Text className="font-body text-text-secondary text-xs mb-2 uppercase tracking-wider">
                  Split method
                </Text>
                <View className="flex-row bg-surface-2 rounded-xl overflow-hidden">
                  {(['equal', 'unequal', 'percentage'] as const).map((mode) => {
                    const isActive = splitMode === mode;
                    return (
                      <TouchableOpacity
                        key={mode}
                        testID={`split-mode-${mode}`}
                        onPress={() => handleSplitModeChange(mode)}
                        accessibilityState={{ selected: isActive }}
                        className={`flex-1 py-2.5 items-center ${isActive ? 'bg-accent' : ''}`}
                      >
                        <Text className={`font-body text-sm font-semibold ${isActive ? 'text-white' : 'text-text-secondary'}`}>
                          {SPLIT_MODE_TAB_LABELS[mode]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Participants */}
              <View>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="font-body text-text-secondary text-xs uppercase tracking-wider">
                    {SPLIT_SECTION_LABELS[splitMode]}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setParticipantIds(new Set(members.map((m) => m.id)));
                      setFinancialDirty(true);
                    }}
                  >
                    <Text className="font-body text-accent text-xs">Select All</Text>
                  </TouchableOpacity>
                </View>
                <View className="bg-surface-2 rounded-xl overflow-hidden">
                  {members.map((member, idx) => {
                    const name = getMemberDisplayName(member, currentUserId, profile?.display_name);
                    const isSelected = participantIds.has(member.id);
                    const isPayer = member.id === payerId;
                    const isPayerLocked = isPayer && splitMode !== 'equal';
                    return (
                      <View
                        key={member.id}
                        className={`flex-row items-center px-4 py-3 ${idx < members.length - 1 ? 'border-b border-border' : ''}`}
                      >
                        <Switch
                          testID={`participant-checkbox-${member.id}`}
                          value={isSelected}
                          onValueChange={() => { if (!isPayerLocked) toggleParticipant(member.id); }}
                          disabled={isPayerLocked}
                          trackColor={{ true: Colors.accent }}
                        />
                        <Text className="text-text-primary font-body text-base ml-3 flex-1">{name}</Text>
                        {splitMode === 'unequal' && isSelected && (
                          isPayer ? (
                            <Text
                              testID="payer-remainder-display"
                              className="text-text-secondary font-body text-base w-20 text-right"
                            >
                              {payerRemainder.toFixed(2)}
                            </Text>
                          ) : (
                            <TextInput
                              testID={`member-amount-${member.id}`}
                              value={memberAmounts[member.id] ?? ''}
                              onChangeText={(val) => {
                                setMemberAmounts((prev) => ({ ...prev, [member.id]: val }));
                                setFinancialDirty(true);
                              }}
                              placeholder="0.00"
                              placeholderTextColor={placeholderColor}
                              keyboardType="decimal-pad"
                              className="bg-surface rounded-lg px-3 py-1.5 text-text-primary font-body text-base w-20 text-right"
                            />
                          )
                        )}
                        {splitMode === 'percentage' && isSelected && (
                          isPayer ? (
                            <Text
                              testID="payer-percentage-display"
                              className="text-text-secondary font-body text-base w-20 text-right"
                            >
                              {`${payerPercentageRemainder.toFixed(2)}%`}
                            </Text>
                          ) : (
                            <TextInput
                              testID={`member-percentage-${member.id}`}
                              value={memberPercentages[member.id] ?? ''}
                              onChangeText={(val) => {
                                setMemberPercentages((prev) => ({ ...prev, [member.id]: val }));
                                setFinancialDirty(true);
                              }}
                              placeholder="0"
                              placeholderTextColor={placeholderColor}
                              keyboardType="decimal-pad"
                              className="bg-surface rounded-lg px-3 py-1.5 text-text-primary font-body text-base w-20 text-right"
                            />
                          )
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            </>
          ) : (
            /* Non-editor: show locked financial summary */
            <View testID="financial-locked-notice" className="flex-row items-start gap-2 p-3 rounded-xl bg-surface-2">
              <Lock size={16} color={theme.textTertiary} strokeWidth={1.5} />
              <Text className="flex-1 font-body text-text-secondary text-sm">
                Financial details can only be changed by the payer or group admin.
              </Text>
            </View>
          )}

          {/* Delete */}
          <View className="mt-4 pt-4 border-t border-border">
            {groupHasSettlements && (
              <View
                testID="delete-blocked-notice"
                className="flex-row items-start gap-2 mb-3 p-3 rounded-xl bg-surface-2"
              >
                <AlertCircle size={16} color={theme.textTertiary} strokeWidth={1.5} />
                <Text className="flex-1 font-body text-text-secondary text-sm">
                  This expense cannot be deleted because settlements have been recorded in this group.
                </Text>
              </View>
            )}
            <TouchableOpacity
              testID="delete-button"
              onPress={handleDeletePress}
              disabled={groupHasSettlements || isDeleting}
              accessibilityState={{ disabled: groupHasSettlements || isDeleting }}
              className="flex-row items-center justify-center gap-2 py-3 rounded-xl"
              style={{
                backgroundColor: groupHasSettlements ? theme.surface2 : 'rgba(239,68,68,0.1)',
                opacity: groupHasSettlements ? 0.5 : 1,
              }}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={Colors.destructive} />
              ) : (
                <>
                  <Trash2
                    size={16}
                    color={groupHasSettlements ? theme.textTertiary : Colors.destructive}
                    strokeWidth={1.5}
                  />
                  <Text
                    className="font-body font-medium text-sm"
                    style={{ color: groupHasSettlements ? theme.textTertiary : Colors.destructive }}
                  >
                    Delete expense
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Category picker modal */}
      <Modal
        visible={categoryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => setCategoryModalVisible(false)}
        >
          <View className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-3xl pb-10 max-h-96">
            <View className="p-4 border-b border-border">
              <Text className="font-display text-text-primary font-semibold text-base text-center">Category</Text>
            </View>
            <ScrollView>
              {ALL_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  testID={`category-option-${cat}`}
                  onPress={() => handleManualCategorySelect(cat)}
                  className="flex-row items-center justify-between px-6 py-4 border-b border-border"
                >
                  <Text className="font-body text-text-primary text-base">{cat}</Text>
                  {cat === category && <Check size={18} color={Colors.accent} strokeWidth={2.5} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Payer picker modal */}
      <Modal
        visible={payerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPayerModalVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => setPayerModalVisible(false)}
        >
          <View className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-3xl pb-10">
            <View className="p-4 border-b border-border">
              <Text className="font-display text-text-primary font-semibold text-base text-center">Paid by</Text>
            </View>
            {members.map((member) => {
              const name = getMemberDisplayName(member, currentUserId, profile?.display_name);
              return (
                <TouchableOpacity
                  key={member.id}
                  testID={`payer-option-${member.id}`}
                  onPress={() => {
                    setPayerId(member.id);
                    setPayerModalVisible(false);
                    setFinancialDirty(true);
                  }}
                  className="flex-row items-center justify-between px-6 py-4 border-b border-border"
                >
                  <Text className="font-body text-text-primary text-base">{name}</Text>
                  {member.id === payerId && <Check size={18} color={Colors.accent} strokeWidth={2.5} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
