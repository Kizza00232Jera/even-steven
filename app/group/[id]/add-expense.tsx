import { useState, useRef, useEffect, useMemo } from 'react';
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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, ChevronDown, Check } from 'lucide-react-native';
import { useAuthStore } from '../../../store/auth';
import { useRatesStore } from '../../../store/rates';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { useOfflineGuard } from '../../../hooks/useOfflineGuard';
import { createExpense, fetchGroupMembers } from '../../../lib/repos/expenses';
import { detectCategory, type Category } from '../../../lib/categories';
import { calculateEqualSplit, calculateUnequalSplit, calculatePercentageSplit } from '../../../lib/splits';
import { convert, format, type Currency } from '../../../lib/currency';
import { hapticOnExpenseSaved } from '../../../lib/haptics';
import { supabase } from '../../../lib/supabase';
import type { Database } from '../../../lib/database.types';
import { Colors } from '../../../constants/colors';

type GroupMember = Database['public']['Tables']['group_members']['Row'];

const CURRENCIES: Currency[] = ['USD', 'EUR', 'DKK', 'SEK'];

const ALL_CATEGORIES: Category[] = [
  'Other',
  'Dining Out',
  'Groceries',
  'Liquor',
  'Taxi',
  'Hotel',
  'Plane',
  'Bus/Train',
  'Gas/Fuel',
  'Parking',
  'Rent',
  'Electricity',
  'Phone/Internet',
  'Insurance',
  'Gift',
  'Medical Expenses',
  'Movies / Games',
  'Furniture',
  'Household Supplies',
  'Mortgage',
  'Pets',
  'Services',
  'Cleaning',
  'Heat',
  'Trash',
  'TV',
  'Water',
  'Child Care',
  'Clothing',
  'Education',
  'Taxes',
  'Bicycle',
  'Car',
  'Other Electronics',
  'Games',
  'Movies',
  'Music',
  'Sports',
];

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function isDateInFuture(dateStr: string): boolean {
  return dateStr > today();
}

function getMemberDisplayName(
  member: GroupMember,
  currentUserId: string | undefined,
  profileDisplayName: string | null | undefined
): string {
  if (member.display_name) return member.display_name;
  if (member.user_id === currentUserId) return profileDisplayName ?? 'You';
  return member.email ?? '—';
}

export default function AddExpenseScreen() {
  const router = useRouter();
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { session, profile } = useAuthStore();
  const { rates, fetchRates } = useRatesStore();
  const { isOnline } = useNetworkStatus();
  const { writesDisabled } = useOfflineGuard(isOnline);

  const preferredCurrency = (profile?.preferred_currency ?? 'USD') as Currency;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today());
  const [amountText, setAmountText] = useState('');
  const [currency, setCurrency] = useState<Currency>(preferredCurrency);
  const [category, setCategory] = useState<Category>('Other');
  const [isCategoryAutoDetected, setIsCategoryAutoDetected] = useState(false);
  const [manualCategory, setManualCategory] = useState(false);
  const [payerId, setPayerId] = useState<string | null>(null);
  const [participantIds, setParticipantIds] = useState<Set<string>>(new Set());
  const [splitMode, setSplitMode] = useState<'equal' | 'unequal' | 'percentage'>('equal');
  const [memberAmounts, setMemberAmounts] = useState<Record<string, string>>({});
  const [memberPercentages, setMemberPercentages] = useState<Record<string, string>>({});

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [payerModalVisible, setPayerModalVisible] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const titleRef = useRef<TextInput>(null);

  // ── Fetch exchange rates ────────────────────────────────────────────────────
  useEffect(() => {
    fetchRates();
  }, []);

  // ── Auto-focus title ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  // ── Fetch group members ─────────────────────────────────────────────────────
  const { data: members = [] } = useQuery<GroupMember[]>({
    queryKey: ['group-members', groupId],
    queryFn: () => fetchGroupMembers(supabase, groupId),
  });

  // ── Initialise payer + participants once members load ───────────────────────
  useEffect(() => {
    if (members.length === 0) return;
    const myMember = members.find((m) => m.user_id === session?.user.id);
    if (myMember && payerId === null) {
      setPayerId(myMember.id);
    }
    if (participantIds.size === 0) {
      setParticipantIds(new Set(members.map((m) => m.id)));
    }
  }, [members]);

  // ── Category auto-detection ─────────────────────────────────────────────────
  function handleTitleChange(text: string) {
    setTitle(text);
    if (!manualCategory) {
      const detected = detectCategory(text);
      if (detected) {
        setCategory(detected);
        setIsCategoryAutoDetected(true);
      } else {
        setCategory('Other');
        setIsCategoryAutoDetected(false);
      }
    }
  }

  function handleManualCategorySelect(cat: Category) {
    setCategory(cat);
    setManualCategory(true);
    setIsCategoryAutoDetected(false);
    setCategoryModalVisible(false);
  }

  // ── Date validation ─────────────────────────────────────────────────────────
  function handleDateBlur() {
    if (isDateInFuture(date)) {
      setDate(today());
    }
  }

  // ── Live conversion ─────────────────────────────────────────────────────────
  const amount = parseFloat(amountText) || 0;

  function liveConversion(): string | null {
    if (!rates || amount <= 0 || currency === preferredCurrency) return null;
    try {
      const converted = convert(amount, currency, preferredCurrency, rates);
      return `≈ ${format(converted, preferredCurrency)}`;
    } catch {
      return null;
    }
  }

  const conversionText = liveConversion();

  // ── Participant toggle ──────────────────────────────────────────────────────
  function toggleParticipant(memberId: string) {
    setParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }

  // ── Split mode switch ───────────────────────────────────────────────────────
  function handleSplitModeChange(mode: 'equal' | 'unequal' | 'percentage') {
    setSplitMode(mode);
    setMemberAmounts({});
    setMemberPercentages({});
  }

  // ── Payer remainder (unequal) ───────────────────────────────────────────────
  const payerRemainder = useMemo(() => {
    if (!payerId || splitMode !== 'unequal') return amount;
    const othersTotal = Array.from(participantIds)
      .filter((id) => id !== payerId)
      .reduce((sum, id) => {
        const val = parseFloat(memberAmounts[id] ?? '0');
        return sum + (isNaN(val) ? 0 : val);
      }, 0);
    return Math.round((amount - othersTotal) * 100) / 100;
  }, [amount, payerId, splitMode, memberAmounts, participantIds]);

  // ── Payer percentage remainder ──────────────────────────────────────────────
  const payerPercentageRemainder = useMemo(() => {
    if (!payerId || splitMode !== 'percentage') return 100;
    const othersTotal = Array.from(participantIds)
      .filter((id) => id !== payerId)
      .reduce((sum, id) => {
        const val = parseFloat(memberPercentages[id] ?? '0');
        return sum + (isNaN(val) ? 0 : val);
      }, 0);
    return Math.round((100 - othersTotal) * 100) / 100;
  }, [payerId, splitMode, memberPercentages, participantIds]);

  // ── Dirty check ────────────────────────────────────────────────────────────
  const isDirty = title.trim().length > 0 || description.trim().length > 0 || amountText.length > 0;

  function handleClose() {
    if (!isDirty) {
      router.back();
      return;
    }
    Alert.alert(
      'Discard this expense?',
      'Your changes will be lost.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]
    );
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  const canSave = useMemo(() => {
    if (title.trim().length === 0 || amount <= 0 || payerId === null || participantIds.size === 0 || writesDisabled) return false;
    if (splitMode === 'unequal') {
      for (const [id, val] of Object.entries(memberAmounts)) {
        if (id !== payerId && participantIds.has(id)) {
          const num = parseFloat(val);
          if (!isNaN(num) && num < 0) return false;
        }
      }
      if (payerRemainder < 0) return false;
    }
    if (splitMode === 'percentage') {
      for (const [id, val] of Object.entries(memberPercentages)) {
        if (id !== payerId && participantIds.has(id)) {
          const num = parseFloat(val);
          if (!isNaN(num) && num < 0) return false;
        }
      }
      if (payerPercentageRemainder < 0) return false;
    }
    return true;
  }, [title, amount, payerId, participantIds, writesDisabled, splitMode, memberAmounts, memberPercentages, payerRemainder, payerPercentageRemainder]);

  async function handleSave() {
    if (!canSave || isSaving) return;

    const participantList = Array.from(participantIds);
    let splits;
    if (splitMode === 'equal') {
      splits = calculateEqualSplit(amount, participantList, payerId!);
    } else if (splitMode === 'unequal') {
      splits = calculateUnequalSplit(
        amount,
        participantList.map((id) => ({
          memberId: id,
          amount: id === payerId ? 0 : parseFloat(memberAmounts[id] ?? '0') || 0,
        })),
        payerId!
      );
    } else {
      splits = calculatePercentageSplit(
        amount,
        participantList.map((id) => ({
          memberId: id,
          percentage: id === payerId ? 0 : parseFloat(memberPercentages[id] ?? '0') || 0,
        })),
        payerId!
      );
    }

    setIsSaving(true);
    try {
      await createExpense(
        supabase,
        {
          group_id: groupId,
          title: title.trim(),
          description: description.trim() || null,
          amount,
          currency,
          category,
          payer_id: payerId!,
          split_method: splitMode,
          expense_date: date,
        },
        splits
      );
      hapticOnExpenseSaved();
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save the expense. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  // ── Payer display name ──────────────────────────────────────────────────────
  const payerMember = members.find((m) => m.id === payerId);
  const payerDisplayName = payerMember
    ? getMemberDisplayName(payerMember, session?.user.id, profile?.display_name)
    : '—';

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
            onPress={handleClose}
            className="w-10 h-10 items-center justify-center"
          >
            <X size={20} color={Colors.dark.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <Text className="font-display text-text-primary font-semibold text-base">
            Add Expense
          </Text>
          <TouchableOpacity
            testID="save-button"
            onPress={handleSave}
            disabled={!canSave || isSaving}
            accessibilityState={{ disabled: !canSave || isSaving }}
            className="px-4 h-8 rounded-full bg-accent items-center justify-center disabled:opacity-40"
            style={{ opacity: canSave && !isSaving ? 1 : 0.4 }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text className="font-body text-white font-semibold text-sm">Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 20 }}>
          {/* Title */}
          <View>
            <Text className="font-body text-text-secondary text-xs mb-1 uppercase tracking-wider">
              Title
            </Text>
            <TextInput
              ref={titleRef}
              testID="title-input"
              value={title}
              onChangeText={handleTitleChange}
              placeholder="e.g. Dinner at Konoba"
              placeholderTextColor={Colors.dark.textTertiary}
              maxLength={60}
              autoFocus
              className="bg-surface-2 rounded-xl px-4 py-3 text-text-primary font-body text-base"
            />
            {title.length >= 45 && (
              <Text className="font-body text-text-tertiary text-xs text-right mt-1">
                {title.length}/60
              </Text>
            )}
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
              placeholderTextColor={Colors.dark.textTertiary}
              maxLength={500}
              multiline
              numberOfLines={3}
              className="bg-surface-2 rounded-xl px-4 py-3 text-text-primary font-body text-base"
            />
          </View>

          {/* Date */}
          <View>
            <Text className="font-body text-text-secondary text-xs mb-1 uppercase tracking-wider">
              Date
            </Text>
            <TextInput
              testID="date-input"
              value={date}
              onChangeText={setDate}
              onBlur={handleDateBlur}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.dark.textTertiary}
              className="bg-surface-2 rounded-xl px-4 py-3 text-text-primary font-body text-base"
            />
          </View>

          {/* Amount + Currency */}
          <View>
            <Text className="font-body text-text-secondary text-xs mb-1 uppercase tracking-wider">
              Amount
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                testID="currency-selector"
                onPress={() => setCurrencyModalVisible(true)}
                className="bg-surface-2 rounded-xl px-4 py-3 items-center justify-center flex-row gap-2"
              >
                <Text testID="currency-display" className="text-text-primary font-body text-base font-semibold">
                  {currency}
                </Text>
                <ChevronDown size={14} color={Colors.dark.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
              <TextInput
                testID="amount-input"
                value={amountText}
                onChangeText={setAmountText}
                placeholder="0.00"
                placeholderTextColor={Colors.dark.textTertiary}
                keyboardType="decimal-pad"
                className="flex-1 bg-surface-2 rounded-xl px-4 py-3 text-text-primary font-body text-base"
              />
            </View>
            {conversionText && (
              <Text className="font-body text-text-secondary text-xs mt-1 pl-1">
                {conversionText}
              </Text>
            )}
          </View>

          {/* Category */}
          <View>
            <Text className="font-body text-text-secondary text-xs mb-1 uppercase tracking-wider">
              Category
            </Text>
            <TouchableOpacity
              testID="category-selector"
              onPress={() => setCategoryModalVisible(true)}
              className="bg-surface-2 rounded-xl px-4 py-3 flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-2">
                <Text testID="category-display" className="text-text-primary font-body text-base">
                  {category}
                </Text>
                {isCategoryAutoDetected && (
                  <View className="bg-accent-dim rounded px-2 py-0.5">
                    <Text className="text-accent text-xs font-body">suggested</Text>
                  </View>
                )}
              </View>
              <ChevronDown size={14} color={Colors.dark.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Payer */}
          <View>
            <Text className="font-body text-text-secondary text-xs mb-1 uppercase tracking-wider">
              Paid by
            </Text>
            <TouchableOpacity
              testID="payer-selector"
              onPress={() => setPayerModalVisible(true)}
              className="bg-surface-2 rounded-xl px-4 py-3 flex-row items-center justify-between"
            >
              <Text testID="payer-display" className="text-text-primary font-body text-base">
                {payerDisplayName}
              </Text>
              <ChevronDown size={14} color={Colors.dark.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Split method selector */}
          <View>
            <Text className="font-body text-text-secondary text-xs mb-2 uppercase tracking-wider">
              Split method
            </Text>
            <View className="flex-row bg-surface-2 rounded-xl overflow-hidden">
              {(['equal', 'unequal', 'percentage'] as const).map((mode) => {
                const label = mode === 'equal' ? 'Equal' : mode === 'unequal' ? 'Unequal' : '%';
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
                      {label}
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
                {splitMode === 'equal' ? 'Split equally between' : splitMode === 'unequal' ? 'Split unequally between' : 'Split by percentage between'}
              </Text>
              <TouchableOpacity
                onPress={() => setParticipantIds(new Set(members.map((m) => m.id)))}
              >
                <Text className="font-body text-accent text-xs">Select All</Text>
              </TouchableOpacity>
            </View>
            <View className="bg-surface-2 rounded-xl overflow-hidden">
              {members.map((member, idx) => {
                const name = getMemberDisplayName(member, session?.user.id, profile?.display_name);
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
                          onChangeText={(val) => setMemberAmounts((prev) => ({ ...prev, [member.id]: val }))}
                          placeholder="0.00"
                          placeholderTextColor={Colors.dark.textTertiary}
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
                          onChangeText={(val) => setMemberPercentages((prev) => ({ ...prev, [member.id]: val }))}
                          placeholder="0"
                          placeholderTextColor={Colors.dark.textTertiary}
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
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Currency picker modal */}
      <Modal
        visible={currencyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => setCurrencyModalVisible(false)}
        >
          <View className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-3xl pb-10">
            <View className="p-4 border-b border-border">
              <Text className="font-display text-text-primary font-semibold text-base text-center">
                Currency
              </Text>
            </View>
            {CURRENCIES.map((c) => (
              <TouchableOpacity
                key={c}
                testID={`currency-option-${c}`}
                onPress={() => {
                  setCurrency(c);
                  setCurrencyModalVisible(false);
                }}
                className="flex-row items-center justify-between px-6 py-4 border-b border-border"
              >
                <Text className="font-body text-text-primary text-base">{c}</Text>
                {c === currency && (
                  <Check size={18} color={Colors.accent} strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

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
              <Text className="font-display text-text-primary font-semibold text-base text-center">
                Category
              </Text>
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
                  {cat === category && (
                    <Check size={18} color={Colors.accent} strokeWidth={2.5} />
                  )}
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
              <Text className="font-display text-text-primary font-semibold text-base text-center">
                Paid by
              </Text>
            </View>
            {members.map((member) => {
              const name = getMemberDisplayName(member, session?.user.id, profile?.display_name);
              return (
                <TouchableOpacity
                  key={member.id}
                  testID={`payer-option-${member.id}`}
                  onPress={() => {
                    setPayerId(member.id);
                    setPayerModalVisible(false);
                  }}
                  className="flex-row items-center justify-between px-6 py-4 border-b border-border"
                >
                  <Text className="font-body text-text-primary text-base">{name}</Text>
                  {member.id === payerId && (
                    <Check size={18} color={Colors.accent} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
