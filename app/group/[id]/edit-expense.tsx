import { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { X, ChevronDown, Check, Trash2, AlertCircle } from 'lucide-react-native';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { useOfflineGuard } from '../../../hooks/useOfflineGuard';
import { useToast } from '../../../hooks/useToast';
import {
  fetchGroupExpenses,
  hasGroupSettlements,
  updateExpenseMetadata,
  deleteExpense,
  type ExpenseListItem,
} from '../../../lib/repos/expenses';
import { type Category } from '../../../lib/categories';
import { supabase } from '../../../lib/supabase';
import { Colors } from '../../../constants/colors';

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

export default function EditExpenseScreen() {
  const router = useRouter();
  const { id: groupId, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isOnline } = useNetworkStatus();
  const { writesDisabled } = useOfflineGuard(isOnline);

  const [expense, setExpense] = useState<ExpenseListItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [groupHasSettlements, setGroupHasSettlements] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<Category>('Other');

  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isSavingRef = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        const [expenses, settled] = await Promise.all([
          fetchGroupExpenses(supabase, groupId),
          hasGroupSettlements(supabase, groupId),
        ]);
        const found = expenses.find((e) => e.id === expenseId);
        if (found) {
          setExpense(found);
          setTitle(found.title);
          setDescription(found.description ?? '');
          setAmountText(String(found.amount));
          setCategory(found.category as Category);
        }
        setGroupHasSettlements(settled);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [groupId, expenseId]);

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
            queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
            toast.info('This expense was just edited.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, expenseId, queryClient, toast]);

  function handleManualCategorySelect(cat: Category) {
    setCategory(cat);
    setCategoryModalVisible(false);
  }

  const canSave =
    title.trim().length > 0 && !writesDisabled && !isSaving && expense !== null;

  async function handleSave() {
    if (!canSave || !expense) return;
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      await updateExpenseMetadata(supabase, expense.id, {
        title: title.trim(),
        description: description.trim() || null,
        category,
      });
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
              queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
              router.back();
            } catch {
              Alert.alert('Error', 'Could not delete this expense. Please try again.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
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
        <Text className="text-text-secondary text-base text-center">
          Expense not found.
        </Text>
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
            <X size={20} color={Colors.dark.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <Text className="font-display text-text-primary font-semibold text-base">
            Edit Expense
          </Text>
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
          {/* Title */}
          <View>
            <Text className="font-body text-text-secondary text-xs mb-1 uppercase tracking-wider">
              Title
            </Text>
            <TextInput
              testID="title-input"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Dinner at Konoba"
              placeholderTextColor={Colors.dark.textTertiary}
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
              placeholderTextColor={Colors.dark.textTertiary}
              maxLength={500}
              multiline
              numberOfLines={3}
              className="bg-surface-2 rounded-xl px-4 py-3 text-text-primary font-body text-base"
            />
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
              <Text testID="category-display" className="text-text-primary font-body text-base">
                {category}
              </Text>
              <ChevronDown size={14} color={Colors.dark.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Amount (read-only if group has settlements) */}
          <View>
            <Text className="font-body text-text-secondary text-xs mb-1 uppercase tracking-wider">
              Amount
            </Text>
            <View className="flex-row gap-3">
              <View className="bg-surface-2 rounded-xl px-4 py-3 items-center justify-center">
                <Text className="text-text-primary font-body text-base font-semibold">
                  {expense.currency}
                </Text>
              </View>
              <TextInput
                testID="amount-input"
                value={amountText}
                editable={!groupHasSettlements}
                className="flex-1 bg-surface-2 rounded-xl px-4 py-3 text-text-primary font-body text-base"
                style={{ opacity: groupHasSettlements ? 0.5 : 1 }}
              />
            </View>
            {groupHasSettlements && (
              <View testID="amount-locked-notice" className="flex-row items-center gap-1.5 mt-2">
                <AlertCircle size={14} color={Colors.dark.textTertiary} strokeWidth={1.5} />
                <Text className="font-body text-text-tertiary text-xs">
                  Amount is locked because settlements have been recorded in this group.
                </Text>
              </View>
            )}
          </View>

          {/* Delete section */}
          <View className="mt-4 pt-4 border-t border-border">
            {groupHasSettlements && (
              <View
                testID="delete-blocked-notice"
                className="flex-row items-start gap-2 mb-3 p-3 rounded-xl bg-surface-2"
              >
                <AlertCircle size={16} color={Colors.dark.textTertiary} strokeWidth={1.5} />
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
                backgroundColor: groupHasSettlements ? Colors.dark.surface2 : 'rgba(239,68,68,0.1)',
                opacity: groupHasSettlements ? 0.5 : 1,
              }}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={Colors.destructive} />
              ) : (
                <>
                  <Trash2
                    size={16}
                    color={groupHasSettlements ? Colors.dark.textTertiary : Colors.destructive}
                    strokeWidth={1.5}
                  />
                  <Text
                    className="font-body font-medium text-sm"
                    style={{
                      color: groupHasSettlements ? Colors.dark.textTertiary : Colors.destructive,
                    }}
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
    </SafeAreaView>
  );
}
