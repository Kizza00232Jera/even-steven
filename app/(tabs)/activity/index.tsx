import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import {
  Filter,
  X,
  DollarSign,
  Pencil,
  Trash2,
  ArrowLeftRight,
  RotateCcw,
  UserPlus,
  UserMinus,
  LogOut,
  Users,
  Archive,
  Link,
  Clock,
} from 'lucide-react-native';
import { Skeleton } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/ErrorState';
import { Colors } from '../../../constants/colors';
import { supabase } from '../../../lib/supabase';
import { fetchActivityFeed, type ActivityEvent } from '../../../lib/repos/activity';
import { fetchGroupsWithMembership } from '../../../lib/repos/groups';
import { useAuthStore } from '../../../store/auth';
import { useActivityStore } from '../../../store/activity';
import type { Database } from '../../../lib/database.types';

type EventType = Database['public']['Tables']['activity_events']['Row']['event_type'];

const PAGE_SIZE = 10;
const ROW_CLASS = 'flex-row items-start gap-3 py-3 border-b border-border';

// ---------------------------------------------------------------------------
// Event helpers
// ---------------------------------------------------------------------------

function getEventIcons(secondary: string): Record<EventType, React.ReactElement> {
  return {
    expense_added: <DollarSign size={18} color={Colors.accent} strokeWidth={1.5} />,
    expense_edited: <Pencil size={18} color={Colors.accent} strokeWidth={1.5} />,
    expense_deleted: <Trash2 size={18} color={Colors.destructive} strokeWidth={1.5} />,
    settlement_recorded: <ArrowLeftRight size={18} color={Colors.accent} strokeWidth={1.5} />,
    settlement_voided: <RotateCcw size={18} color={secondary} strokeWidth={1.5} />,
    member_joined: <UserPlus size={18} color={Colors.accent} strokeWidth={1.5} />,
    member_removed: <UserMinus size={18} color={Colors.destructive} strokeWidth={1.5} />,
    member_left: <LogOut size={18} color={secondary} strokeWidth={1.5} />,
    group_created: <Users size={18} color={Colors.accent} strokeWidth={1.5} />,
    group_archived: <Archive size={18} color={secondary} strokeWidth={1.5} />,
    group_unarchived: <Archive size={18} color={Colors.accent} strokeWidth={1.5} />,
    invite_link_reset: <Link size={18} color={secondary} strokeWidth={1.5} />,
    trip_expired: <Clock size={18} color={Colors.destructive} strokeWidth={1.5} />,
  };
}

const EVENT_DESCRIPTIONS: Record<EventType, (actor: string) => string> = {
  expense_added: (a) => `${a} added an expense`,
  expense_edited: (a) => `${a} edited an expense`,
  expense_deleted: (a) => `${a} deleted an expense`,
  settlement_recorded: (a) => `${a} recorded a payment`,
  settlement_voided: (a) => `${a} undid a payment`,
  member_joined: (a) => `${a} joined the group`,
  member_removed: (a) => `${a} was removed from the group`,
  member_left: (a) => `${a} left the group`,
  group_created: (a) => `${a} created the group`,
  group_archived: (a) => `${a} archived the group`,
  group_unarchived: (a) => `${a} unarchived the group`,
  invite_link_reset: (a) => `${a} reset the invite link`,
  trip_expired: (a) => `${a} — trip has ended`,
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function SkeletonActivityRow() {
  return (
    <View className={ROW_CLASS}>
      <Skeleton width={36} height={36} borderRadius={18} />
      <View className="flex-1 gap-2 pt-1">
        <Skeleton width={'80%'} height={13} borderRadius={6} />
        <Skeleton width={70} height={11} borderRadius={6} />
      </View>
    </View>
  );
}

interface ActivityRowProps {
  event: ActivityEvent;
}

function ActivityRow({ event }: ActivityRowProps) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const router = useRouter();

  const icon = getEventIcons(theme.textSecondary)[event.eventType];
  const description = EVENT_DESCRIPTIONS[event.eventType]?.(event.actorName) ?? event.actorName;
  const amount =
    typeof event.metadata.amount === 'number' && event.metadata.currency
      ? ` · ${event.metadata.currency as string} ${event.metadata.amount.toFixed(2)}`
      : '';

  const isExpenseEvent =
    event.eventType === 'expense_added' || event.eventType === 'expense_edited';
  const expenseId =
    isExpenseEvent && typeof event.metadata.expense_id === 'string'
      ? event.metadata.expense_id
      : null;

  const rowContent = (
    <>
      <View
        className="w-9 h-9 rounded-full items-center justify-center"
        style={{ backgroundColor: theme.surface2 }}
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-text-primary text-sm" numberOfLines={2}>
          {description}
          {amount}
        </Text>
        {event.groupName && (
          <Text className="text-text-secondary text-xs mt-0.5">{event.groupName}</Text>
        )}
        <Text className="text-text-tertiary text-xs mt-0.5">{formatTimestamp(event.createdAt)}</Text>
      </View>
    </>
  );

  if (expenseId && event.groupId) {
    return (
      <TouchableOpacity
        testID={`activity-row-${event.id}`}
        className={ROW_CLASS}
        activeOpacity={0.7}
        onPress={() =>
          router.push(`/groups/${event.groupId}/expense-detail?expenseId=${expenseId}` as never)
        }
      >
        {rowContent}
      </TouchableOpacity>
    );
  }

  return (
    <View
      testID={`activity-row-${event.id}`}
      className={ROW_CLASS}
    >
      {rowContent}
    </View>
  );
}

interface FilterSheetProps {
  visible: boolean;
  groups: { id: string; name: string }[];
  selectedGroupId: string | null;
  onSelect: (groupId: string | null) => void;
  onClose: () => void;
}

function FilterSheet({ visible, groups, selectedGroupId, onSelect, onClose }: FilterSheetProps) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        className="flex-1"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPress={onClose}
      >
        <View
          className="absolute bottom-0 left-0 right-0 rounded-t-2xl p-4 pb-8"
          style={{ backgroundColor: theme.surface }}
          onStartShouldSetResponder={() => true}
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-display text-text-primary font-semibold text-base">
              Filter by group
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={theme.textSecondary} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            testID="filter-all-groups"
            className="flex-row items-center justify-between py-3 border-b border-border"
            onPress={() => { onSelect(null); onClose(); }}
          >
            <Text className="font-body text-text-primary text-base">All groups</Text>
            {selectedGroupId === null && (
              <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: Colors.accent }}>
                <View className="w-2 h-2 rounded-full bg-white" />
              </View>
            )}
          </TouchableOpacity>

          {groups.map((g) => (
            <TouchableOpacity
              key={g.id}
              testID={`filter-group-${g.id}`}
              className="flex-row items-center justify-between py-3 border-b border-border"
              onPress={() => { onSelect(g.id); onClose(); }}
            >
              <Text className="font-body text-text-primary text-base" numberOfLines={1}>
                {g.name}
              </Text>
              {selectedGroupId === g.id && (
                <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: Colors.accent }}>
                  <View className="w-2 h-2 rounded-full bg-white" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ActivityScreen() {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { session } = useAuthStore();
  const markSeen = useActivityStore((s) => s.markSeen);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      markSeen();
    }, [markSeen])
  );

  const userId = session?.user.id ?? '';

  const { data: groupsData } = useQuery({
    queryKey: ['groups-for-filter', userId],
    queryFn: () => fetchGroupsWithMembership(supabase, userId),
    enabled: !!userId,
    staleTime: 60_000,
  });
  const groups = (groupsData ?? []).map((g) => ({ id: g.id, name: g.name }));

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['activity', selectedGroupId],
    queryFn: ({ pageParam }: { pageParam: number }) =>
      fetchActivityFeed(supabase, {
        groupId: selectedGroupId,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage: ActivityEvent[], allPages: ActivityEvent[][]) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
  });

  const events = data?.pages.flat() ?? [];
  const selectedGroupName = selectedGroupId
    ? groups.find((g) => g.id === selectedGroupId)?.name ?? null
    : null;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mt-4 mb-2">
          <Text className="text-text-primary font-bold text-2xl font-display">Activity</Text>
          <TouchableOpacity
            testID="filter-button"
            onPress={() => setFilterVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Filter
              size={20}
              color={selectedGroupId ? Colors.accent : theme.textSecondary}
              strokeWidth={1.5}
            />
          </TouchableOpacity>
        </View>

        {/* Active filter chip */}
        {selectedGroupName && (
          <View className="flex-row mb-3">
            <TouchableOpacity
              testID="filter-chip"
              className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 border"
              style={{ backgroundColor: Colors.accentDim, borderColor: Colors.accent }}
              onPress={() => setSelectedGroupId(null)}
            >
              <Text className="text-xs font-medium" style={{ color: Colors.accent }}>
                {selectedGroupName}
              </Text>
              <X size={12} color={Colors.accent} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}

        {/* Content */}
        {isLoading && (
          <View testID="activity-loading">
            <SkeletonActivityRow />
            <SkeletonActivityRow />
            <SkeletonActivityRow />
            <SkeletonActivityRow />
          </View>
        )}

        {isError && <ErrorState onRetry={refetch} />}

        {!isLoading && !isError && (
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ActivityRow event={item} />}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center py-16">
                <Text className="text-text-secondary text-sm text-center">
                  No activity yet.
                </Text>
              </View>
            }
            ListFooterComponent={
              isFetchingNextPage ? (
                <View className="py-4 items-center">
                  <ActivityIndicator size="small" color={Colors.accent} />
                </View>
              ) : null
            }
          />
        )}
      </View>

      <FilterSheet
        visible={filterVisible}
        groups={groups}
        selectedGroupId={selectedGroupId}
        onSelect={setSelectedGroupId}
        onClose={() => setFilterVisible(false)}
      />
    </SafeAreaView>
  );
}
