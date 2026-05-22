import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import {
  Plus,
  Pin,
  BellOff,
  MoreHorizontal,
  Filter,
  X,
  Link,
} from 'lucide-react-native';
import { SkeletonGroupCard } from '../../../components/SkeletonGroupCard';
import { ErrorState } from '../../../components/ErrorState';
import { TripExpiredModal } from '../../../components/TripExpiredModal';
import { Colors } from '../../../constants/colors';
import {
  fetchGroupsWithMembership,
  pinGroup,
  unpinGroup,
  muteGroup,
  unmuteGroup,
} from '../../../lib/repos/groups';
import { updateProfile } from '../../../lib/repos/profiles';
import { filterGroups } from '../../../lib/groupFilters';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/auth';
import { hapticOnGroupPin, hapticOnToggle } from '../../../lib/haptics';
import { useTripExpiry } from '../../../hooks/useTripExpiry';
import { format } from '../../../lib/currency';
import type { Currency } from '../../../lib/currency';
import type { GroupWithMembership, GroupFilters } from '../../../lib/groupFilters';
import type { Database } from '../../../lib/database.types';

type GroupType = Database['public']['Tables']['groups']['Row']['type'];
type GroupStatus = Database['public']['Tables']['groups']['Row']['status'];

const GROUP_TYPES: GroupType[] = ['Trip', 'Home', 'Couple', 'Utilities', 'Family', 'Other'];

const EMPTY_FILTERS: GroupFilters = {
  status: null,
  types: [],
  balance: null,
  tripTiming: null,
};

const BALANCE_CHIP_LABELS: Record<NonNullable<GroupFilters['balance']>, string> = {
  owe: 'You owe',
  owed: 'You are owed',
  settled: 'Settled',
};

const ACTIVE_CHIP_STYLE = {
  backgroundColor: Colors.accentDim,
  borderColor: Colors.accent,
  borderWidth: 1,
} as const;

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endStr}`;
  }
  return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${endStr}`;
}

function balanceDisplay(balance: number, currency: Currency): { text: string; color: string } {
  if (balance === 0) return { text: 'Settled', color: Colors.dark.textSecondary };
  if (balance > 0) return { text: `You're owed ${format(balance, currency)}`, color: Colors.accent };
  return { text: `You owe ${format(Math.abs(balance), currency)}`, color: Colors.destructive };
}

interface GroupCardProps {
  group: GroupWithMembership;
  onPress: () => void;
  onMenuPress: () => void;
}

function GroupCard({ group, onPress, onMenuPress }: GroupCardProps) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const gradientKey = group.type.toLowerCase() as keyof typeof Colors.gradients;
  const [accentColor] = Colors.gradients[gradientKey];
  const { text: balanceText, color: balanceColor } = balanceDisplay(
    group.balance,
    group.base_currency as Currency,
  );

  return (
    <TouchableOpacity
      testID={`group-card-${group.id}`}
      onPress={onPress}
      className="bg-surface rounded-2xl border border-border overflow-hidden"
      activeOpacity={0.8}
    >
      <View style={{ backgroundColor: accentColor, height: 4 }} />
      <View className="p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-2">
            <Text
              className="font-display text-base font-semibold text-text-primary mb-1"
              numberOfLines={2}
            >
              {group.name}
            </Text>
            <View className="flex-row items-center gap-2 flex-wrap">
              <View
                className="rounded px-2 py-0.5"
                style={{ backgroundColor: theme.surface2 }}
              >
                <Text className="font-body text-xs text-text-secondary">{group.type}</Text>
              </View>
              {group.type === 'Trip' && group.start_date && group.end_date && (
                <Text className="font-body text-xs text-text-tertiary">
                  {formatDateRange(group.start_date, group.end_date)}
                </Text>
              )}
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            {group.is_pinned && (
              <View testID={`pin-icon-${group.id}`}>
                <Pin size={14} color={Colors.accent} strokeWidth={2} />
              </View>
            )}
            {group.is_muted && (
              <View testID={`mute-icon-${group.id}`}>
                <BellOff size={14} color={theme.textTertiary} strokeWidth={2} />
              </View>
            )}
            <TouchableOpacity
              testID={`menu-button-${group.id}`}
              onPress={onMenuPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MoreHorizontal size={18} color={theme.textSecondary} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
        </View>
        <Text className="font-body text-sm mt-3" style={{ color: balanceColor }}>
          {balanceText}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

interface ContextMenuProps {
  visible: boolean;
  group: GroupWithMembership | null;
  onClose: () => void;
  onPin: () => void;
  onMute: () => void;
}

function GroupContextMenu({ visible, group, onClose, onPin, onMute }: ContextMenuProps) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  if (!group) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPress={onClose}
      >
        <View
          className="absolute bottom-0 left-0 right-0 rounded-t-2xl p-4"
          style={{ backgroundColor: theme.surface }}
        >
          <Text className="font-display text-text-primary font-semibold text-base mb-4">
            {group.name}
          </Text>
          <TouchableOpacity
            className="flex-row items-center gap-3 py-3"
            onPress={onPin}
          >
            <Pin size={20} color={Colors.accent} strokeWidth={1.5} />
            <Text className="font-body text-text-primary text-base">
              {group.is_pinned ? 'Unpin from top' : 'Pin to top'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center gap-3 py-3"
            onPress={onMute}
          >
            <BellOff size={20} color={theme.textSecondary} strokeWidth={1.5} />
            <Text className="font-body text-text-primary text-base">
              {group.is_muted ? 'Unmute notifications' : 'Mute notifications'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center justify-center mt-2 py-3 rounded-xl border border-border"
            onPress={onClose}
          >
            <Text className="font-body text-text-secondary text-base">Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

function BalanceNudgeModal({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/60 items-center justify-end pb-8 px-4">
        <View className="bg-surface rounded-2xl border border-border p-6 w-full">
          <Text className="font-display text-text-primary text-lg font-bold mb-2">
            Welcome back!
          </Text>
          <Text className="font-body text-text-secondary text-sm mb-6 leading-5">
            While you were away, you were added to some expenses. Open a group to view your balance.
          </Text>
          <TouchableOpacity
            onPress={onDismiss}
            className="bg-accent rounded-full py-4 items-center"
          >
            <Text className="font-display text-white font-semibold text-base">
              View balances
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface FilterSheetProps {
  visible: boolean;
  filters: GroupFilters;
  onClose: () => void;
  onApply: (filters: GroupFilters) => void;
}

function FilterSheet({ visible, filters, onClose, onApply }: FilterSheetProps) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const [draft, setDraft] = useState<GroupFilters>(filters);

  function toggleType(type: GroupType) {
    setDraft((prev) => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type],
    }));
  }

  function setStatus(status: GroupStatus | null) {
    setDraft((prev) => ({ ...prev, status: prev.status === status ? null : status }));
  }

  function setBalance(balance: GroupFilters['balance']) {
    setDraft((prev) => ({ ...prev, balance: prev.balance === balance ? null : balance }));
  }

  function setTripTiming(timing: GroupFilters['tripTiming']) {
    setDraft((prev) => ({ ...prev, tripTiming: prev.tripTiming === timing ? null : timing }));
  }

  function chipStyle(active: boolean) {
    return {
      backgroundColor: active ? Colors.accentDim : theme.surface2,
      borderColor: active ? Colors.accent : 'transparent',
      borderWidth: 1,
    };
  }

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
              Filter groups
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={theme.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <Text className="font-body text-text-secondary text-xs uppercase mb-2">Status</Text>
          <View className="flex-row gap-2 mb-4 flex-wrap">
            {(['active', 'archived'] as GroupStatus[]).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setStatus(s)}
                className="px-3 py-1.5 rounded-full"
                style={chipStyle(draft.status === s)}
              >
                <Text
                  className="font-body text-sm capitalize"
                  style={{ color: draft.status === s ? Colors.accent : theme.textPrimary }}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="font-body text-text-secondary text-xs uppercase mb-2">Group type</Text>
          <View className="flex-row gap-2 mb-4 flex-wrap">
            {GROUP_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => toggleType(t)}
                className="px-3 py-1.5 rounded-full"
                style={chipStyle(draft.types.includes(t))}
              >
                <Text
                  className="font-body text-sm"
                  style={{ color: draft.types.includes(t) ? Colors.accent : theme.textPrimary }}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="font-body text-text-secondary text-xs uppercase mb-2">Balance</Text>
          <View className="flex-row gap-2 mb-4 flex-wrap">
            {[
              { key: 'owe' as const, label: 'You owe money' },
              { key: 'owed' as const, label: 'You are owed' },
              { key: 'settled' as const, label: 'Fully settled' },
            ].map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                onPress={() => setBalance(key)}
                className="px-3 py-1.5 rounded-full"
                style={chipStyle(draft.balance === key)}
              >
                <Text
                  className="font-body text-sm"
                  style={{ color: draft.balance === key ? Colors.accent : theme.textPrimary }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {(draft.types.includes('Trip') || draft.types.length === 0) && (
            <>
              <Text className="font-body text-text-secondary text-xs uppercase mb-2">
                Trip timing
              </Text>
              <View className="flex-row gap-2 mb-6 flex-wrap">
                {[
                  { key: 'upcoming' as const, label: 'Upcoming' },
                  { key: 'ongoing' as const, label: 'Ongoing' },
                  { key: 'past' as const, label: 'Past' },
                ].map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setTripTiming(key)}
                    className="px-3 py-1.5 rounded-full"
                    style={chipStyle(draft.tripTiming === key)}
                  >
                    <Text
                      className="font-body text-sm"
                      style={{ color: draft.tripTiming === key ? Colors.accent : theme.textPrimary }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity
            className="w-full py-4 rounded-full items-center"
            style={{ backgroundColor: Colors.accent }}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          >
            <Text className="font-display font-semibold text-base" style={{ color: '#fff' }}>
              Apply filters
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function hasActiveFilters(filters: GroupFilters): boolean {
  return (
    filters.status !== null ||
    filters.types.length > 0 ||
    filters.balance !== null ||
    filters.tripTiming !== null
  );
}

function useGroups(userId: string) {
  return useQuery({
    queryKey: ['groups', userId],
    queryFn: () => fetchGroupsWithMembership(supabase, userId),
  });
}

export default function GroupsScreen() {
  const router = useRouter();
  const { session, profile, setProfile } = useAuthStore();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? '';

  const { data: groups, isLoading, isError, refetch } = useGroups(userId);
  const { popupGroup, dismissPopup } = useTripExpiry(groups);

  const [filters, setFilters] = useState<GroupFilters>(EMPTY_FILTERS);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [contextGroup, setContextGroup] = useState<GroupWithMembership | null>(null);

  const pinMutation = useMutation({
    mutationFn: ({ memberId, pin }: { memberId: string; pin: boolean }) =>
      pin ? pinGroup(supabase, memberId) : unpinGroup(supabase, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups'] }),
  });

  const muteMutation = useMutation({
    mutationFn: ({ memberId, mute }: { memberId: string; mute: boolean }) =>
      mute ? muteGroup(supabase, memberId) : unmuteGroup(supabase, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups'] }),
  });

  function handleMenuPress(group: GroupWithMembership) {
    setContextGroup(group);
  }

  function handlePin() {
    if (!contextGroup) return;
    hapticOnGroupPin();
    pinMutation.mutate({ memberId: contextGroup.member_id, pin: !contextGroup.is_pinned });
    setContextGroup(null);
  }

  function handleMute() {
    if (!contextGroup) return;
    hapticOnToggle();
    muteMutation.mutate({ memberId: contextGroup.member_id, mute: !contextGroup.is_muted });
    setContextGroup(null);
  }

  const filteredGroups = groups ? filterGroups(groups, filters) : [];
  const activeFilterCount =
    (filters.status ? 1 : 0) +
    filters.types.length +
    (filters.balance ? 1 : 0) +
    (filters.tripTiming ? 1 : 0);

  const [showNudge, setShowNudge] = useState(false);

  useEffect(() => {
    if (profile?.show_balance_nudge) {
      setShowNudge(true);
    }
  }, [profile?.show_balance_nudge]);

  async function handleDismissNudge() {
    setShowNudge(false);
    if (!session) return;
    try {
      const updated = await updateProfile(supabase, session.user.id, {
        show_balance_nudge: false,
      });
      setProfile(updated);
    } catch {
      // Non-critical — nudge will reappear next open but that's acceptable
    }
  }

  function renderContent() {
    if (isLoading) {
      return (
        <View className="gap-3">
          <SkeletonGroupCard />
          <SkeletonGroupCard />
          <SkeletonGroupCard />
        </View>
      );
    }

    if (isError) {
      return <ErrorState onRetry={refetch} />;
    }

    if (!filteredGroups.length) {
      return (
        <View className="flex-1 items-center justify-center pt-20">
          <Text className="font-body text-text-secondary text-sm text-center mb-2">
            {hasActiveFilters(filters) ? 'No groups match your filters.' : 'No groups yet.'}
          </Text>
          {!hasActiveFilters(filters) && (
            <>
              <Text className="font-body text-text-tertiary text-xs text-center mb-6">
                Tap + to create your first group.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/invite' as never)}
                className="flex-row items-center gap-2 px-5 py-3 rounded-full border border-border"
              >
                <Link size={16} color={Colors.accent} />
                <Text className="font-body text-text-secondary text-sm">Join with a link</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      );
    }

    return (
      <FlatList
        data={filteredGroups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GroupCard
            group={item}
            onPress={() => router.push(`/group/${item.id}`)}
            onMenuPress={() => handleMenuPress(item)}
          />
        )}
        contentContainerStyle={{ gap: 12 }}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4">
        <View className="flex-row items-center justify-between mt-4 mb-3">
          <Text className="font-display text-text-primary font-bold text-2xl">Groups</Text>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              testID="filter-button"
              onPress={() => setShowFilterSheet(true)}
              className="w-9 h-9 rounded-full items-center justify-center"
              style={activeFilterCount > 0 ? { backgroundColor: Colors.accentDim } : undefined}
            >
              <Filter
                size={18}
                color={activeFilterCount > 0 ? Colors.accent : Colors.dark.textSecondary}
                strokeWidth={1.5}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/group/create')}
              testID="create-group-fab"
              className="w-9 h-9 rounded-full bg-accent items-center justify-center"
            >
              <Plus size={18} color="#ffffff" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>

        {hasActiveFilters(filters) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-3"
            contentContainerStyle={{ gap: 8 }}
          >
            {filters.status && (
              <TouchableOpacity
                onPress={() => setFilters((f) => ({ ...f, status: null }))}
                className="flex-row items-center gap-1 px-3 py-1.5 rounded-full"
                style={ACTIVE_CHIP_STYLE}
              >
                <Text className="font-body text-xs capitalize" style={{ color: Colors.accent }}>
                  {filters.status}
                </Text>
                <X size={12} color={Colors.accent} strokeWidth={2} />
              </TouchableOpacity>
            )}
            {filters.types.map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() =>
                  setFilters((f) => ({ ...f, types: f.types.filter((x) => x !== t) }))
                }
                className="flex-row items-center gap-1 px-3 py-1.5 rounded-full"
                style={ACTIVE_CHIP_STYLE}
              >
                <Text className="font-body text-xs" style={{ color: Colors.accent }}>
                  {t}
                </Text>
                <X size={12} color={Colors.accent} strokeWidth={2} />
              </TouchableOpacity>
            ))}
            {filters.balance && (
              <TouchableOpacity
                onPress={() => setFilters((f) => ({ ...f, balance: null }))}
                className="flex-row items-center gap-1 px-3 py-1.5 rounded-full"
                style={ACTIVE_CHIP_STYLE}
              >
                <Text className="font-body text-xs" style={{ color: Colors.accent }}>
                  {BALANCE_CHIP_LABELS[filters.balance!]}
                </Text>
                <X size={12} color={Colors.accent} strokeWidth={2} />
              </TouchableOpacity>
            )}
            {filters.tripTiming && (
              <TouchableOpacity
                onPress={() => setFilters((f) => ({ ...f, tripTiming: null }))}
                className="flex-row items-center gap-1 px-3 py-1.5 rounded-full"
                style={ACTIVE_CHIP_STYLE}
              >
                <Text className="font-body text-xs capitalize" style={{ color: Colors.accent }}>
                  {filters.tripTiming}
                </Text>
                <X size={12} color={Colors.accent} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        {renderContent()}
      </View>

      <GroupContextMenu
        visible={contextGroup !== null}
        group={contextGroup}
        onClose={() => setContextGroup(null)}
        onPin={handlePin}
        onMute={handleMute}
      />

      <FilterSheet
        visible={showFilterSheet}
        filters={filters}
        onClose={() => setShowFilterSheet(false)}
        onApply={setFilters}
      />

      <TripExpiredModal
        groupName={popupGroup?.name ?? ''}
        visible={popupGroup !== null}
        onDismiss={dismissPopup}
      />

      <BalanceNudgeModal visible={showNudge} onDismiss={handleDismissNudge} />
    </SafeAreaView>
  );
}
