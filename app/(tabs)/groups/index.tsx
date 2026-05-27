import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
  Image,
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
  X,
  Link,
} from 'lucide-react-native';
import { SkeletonGroupCard } from '../../../components/SkeletonGroupCard';
import { ErrorState } from '../../../components/ErrorState';
import { TripExpiredModal } from '../../../components/TripExpiredModal';
import { Colors } from '../../../constants/colors';
import {
  fetchGroupsWithMembership,
  fetchGroupMemberPreviews,
  pinGroup,
  unpinGroup,
  muteGroup,
  unmuteGroup,
} from '../../../lib/repos/groups';
import type { MemberPreview } from '../../../lib/repos/groups';
import { updateProfile } from '../../../lib/repos/profiles';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/auth';
import { hapticOnGroupPin, hapticOnToggle } from '../../../lib/haptics';
import { useTripExpiry } from '../../../hooks/useTripExpiry';
import { useRealtimeGroups } from '../../../hooks/useRealtime';
import { format } from '../../../lib/currency';
import type { Currency } from '../../../lib/currency';
import type { GroupWithMembership } from '../../../lib/groupFilters';

function balanceDisplay(
  balance: number,
  currency: Currency,
  theme: typeof Colors.dark | typeof Colors.light,
): { text: string; color: string } {
  if (balance === 0) return { text: 'Settled', color: theme.textSecondary };
  if (balance > 0) return { text: `You're owed ${format(balance, currency)}`, color: Colors.accent };
  return { text: `You owe ${format(Math.abs(balance), currency)}`, color: Colors.destructive };
}

function AvatarCircle({
  preview,
  size = 40,
  borderColor,
}: {
  preview: MemberPreview;
  size?: number;
  borderColor: string;
}) {
  const initials = preview.name.charAt(0).toUpperCase();

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: preview.avatarUrl ? 'transparent' : Colors.accentDim,
        borderWidth: 2,
        borderColor,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {preview.avatarUrl ? (
        <Image source={{ uri: preview.avatarUrl }} style={{ width: size, height: size }} />
      ) : (
        <Text
          style={{
            color: '#ffffff',
            fontSize: size * 0.38,
            fontFamily: 'SpaceGrotesk_500Medium',
          }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

function AvatarStack({
  previews,
  background,
}: {
  previews: MemberPreview[];
  background: string;
}) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const shown = previews.slice(0, 3);
  const overflow = previews.length - 3;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((p, i) => (
        <View key={p.memberId} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: shown.length - i }}>
          <AvatarCircle preview={p} size={40} borderColor={background} />
        </View>
      ))}
      {overflow > 0 && (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.surface2,
            borderWidth: 2,
            borderColor: background,
            marginLeft: -10,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 0,
          }}
        >
          <Text
            style={{
              color: theme.textSecondary,
              fontSize: 13,
              fontFamily: 'Inter_500Medium',
            }}
          >
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}

interface GroupCardProps {
  group: GroupWithMembership;
  memberPreviews?: MemberPreview[];
  onPress: () => void;
  onMenuPress: () => void;
}

function GroupCard({ group, memberPreviews, onPress, onMenuPress }: GroupCardProps) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const previews = memberPreviews ?? [];
  const { text: balanceText, color: balanceColor } = balanceDisplay(
    group.balance,
    group.base_currency as Currency,
    theme,
  );

  return (
    <TouchableOpacity
      testID={`group-card-${group.id}`}
      onPress={onPress}
      style={{
        backgroundColor: theme.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 72,
      }}
      activeOpacity={0.8}
    >
      {previews.length > 0 && (
        <AvatarStack previews={previews} background={theme.surface} />
      )}
      <View style={{ flex: 1, marginLeft: previews.length > 0 ? 12 : 0 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text
            style={{
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 16,
              color: theme.textPrimary,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {group.name}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginLeft: 8,
            }}
          >
            {group.is_pinned && (
              <View testID={`pin-icon-${group.id}`}>
                <Pin size={13} color={Colors.accent} strokeWidth={2} />
              </View>
            )}
            {group.is_muted && (
              <View testID={`mute-icon-${group.id}`}>
                <BellOff size={13} color={theme.textTertiary} strokeWidth={2} />
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
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            color: theme.textSecondary,
            marginTop: 2,
          }}
        >
          {group.type}
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 14,
            color: balanceColor,
            marginTop: 3,
          }}
        >
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
          <TouchableOpacity className="flex-row items-center gap-3 py-3" onPress={onPin}>
            <Pin size={20} color={Colors.accent} strokeWidth={1.5} />
            <Text className="font-body text-text-primary text-base">
              {group.is_pinned ? 'Unpin from top' : 'Pin to top'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center gap-3 py-3" onPress={onMute}>
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
            <Text className="font-display text-white font-semibold text-base">View balances</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { session, profile, setProfile } = useAuthStore();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? '';

  const { data: groups, isLoading, isError, refetch } = useGroups(userId);
  useRealtimeGroups(userId);
  const { popupGroup, dismissPopup } = useTripExpiry(groups);

  const groupIds = (groups ?? []).map((g) => g.id);
  const { data: memberPreviews = {} } = useQuery({
    queryKey: ['group-member-previews', userId, groupIds.join(',')],
    queryFn: () => fetchGroupMemberPreviews(supabase, groupIds, userId),
    enabled: groupIds.length > 0,
    staleTime: 60_000,
  });

  const [contextGroup, setContextGroup] = useState<GroupWithMembership | null>(null);
  const [showExpensePicker, setShowExpensePicker] = useState(false);
  const [showNudge, setShowNudge] = useState(false);

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
      // Non-critical
    }
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

  const overallBalance = useMemo(() => {
    if (!groups) return null;
    const active = groups.filter((g) => g.status === 'active');
    if (active.length === 0) return null;

    const totals: Record<string, number> = {};
    for (const g of active) {
      totals[g.base_currency] = (totals[g.base_currency] ?? 0) + g.balance;
    }

    const preferred = (profile?.preferred_currency ?? 'EUR') as Currency;
    if (preferred in totals) {
      return { balance: totals[preferred], currency: preferred };
    }
    const entries = Object.entries(totals);
    const [currency, balance] = entries.reduce(
      (best, [c, b]) => (Math.abs(b) > Math.abs(best[1]) ? [c, b] : best),
      entries[0],
    );
    return { balance, currency: currency as Currency };
  }, [groups, profile?.preferred_currency]);

  const summaryLine = useMemo(() => {
    if (!overallBalance || Math.abs(overallBalance.balance) < 0.005) {
      return { text: "You're all settled", color: theme.textSecondary };
    }
    if (overallBalance.balance > 0) {
      return {
        text: `Overall, you are owed ${format(overallBalance.balance, overallBalance.currency)}`,
        color: Colors.accent,
      };
    }
    return {
      text: `Overall, you owe ${format(Math.abs(overallBalance.balance), overallBalance.currency)}`,
      color: Colors.destructive,
    };
  }, [overallBalance, theme.textSecondary]);

  function renderContent() {
    if (isLoading) {
      return (
        <View style={{ gap: 10 }}>
          <SkeletonGroupCard />
          <SkeletonGroupCard />
          <SkeletonGroupCard />
        </View>
      );
    }

    if (isError) {
      return <ErrorState onRetry={refetch} />;
    }

    if (!groups || groups.length === 0) {
      return (
        <View className="flex-1 items-center justify-center pt-20">
          <Text className="font-body text-text-secondary text-sm text-center mb-2">
            No groups yet.
          </Text>
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
        </View>
      );
    }

    return (
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GroupCard
            group={item}
            memberPreviews={memberPreviews[item.id]}
            onPress={() => router.push(`/groups/${item.id}` as never)}
            onMenuPress={() => setContextGroup(item)}
          />
        )}
        contentContainerStyle={{ gap: 10, paddingBottom: 88 }}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4">
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 16,
            marginBottom: 4,
          }}
        >
          <Text
            style={{
              fontFamily: 'SpaceGrotesk_700Bold',
              fontSize: 28,
              color: theme.textPrimary,
            }}
          >
            Groups
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/group/create')}
            testID="create-group-fab"
            style={{
              height: 36,
              paddingHorizontal: 16,
              borderRadius: 18,
              backgroundColor: theme.surface2,
              borderWidth: 1,
              borderColor: theme.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Plus size={14} color={theme.textPrimary} strokeWidth={2} />
            <Text
              style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: theme.textPrimary,
              }}
            >
              New Group
            </Text>
          </TouchableOpacity>
        </View>

        {/* Net balance summary */}
        {groups !== undefined && (
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 15,
              color: summaryLine.color,
              marginBottom: 16,
            }}
          >
            {summaryLine.text}
          </Text>
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

      <TripExpiredModal
        groupName={popupGroup?.name ?? ''}
        visible={popupGroup !== null}
        onDismiss={dismissPopup}
      />

      <BalanceNudgeModal visible={showNudge} onDismiss={handleDismissNudge} />

      {/* FAB */}
      <TouchableOpacity
        testID="global-add-expense-fab"
        onPress={() => setShowExpensePicker(true)}
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: Colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        activeOpacity={0.85}
      >
        <Plus size={24} color="#ffffff" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Group picker for Add Expense from Groups tab */}
      <Modal
        visible={showExpensePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExpensePicker(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={() => setShowExpensePicker(false)}
        />
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: theme.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: 32,
          }}
        >
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
          </View>

          <Text
            style={{
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 18,
              color: theme.textPrimary,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 8,
            }}
          >
            Add expense to...
          </Text>

          {(() => {
            const activeGroups = (groups ?? []).filter((g) => g.status === 'active');
            if (activeGroups.length === 0) {
              return (
                <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingVertical: 32, gap: 16 }}>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: theme.textSecondary, textAlign: 'center' }}>
                    No active groups. Create a group to start adding expenses.
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowExpensePicker(false);
                      router.push('/group/create');
                    }}
                    style={{ backgroundColor: Colors.accent, borderRadius: 99, paddingHorizontal: 24, paddingVertical: 12 }}
                  >
                    <Text style={{ fontFamily: 'Inter_500Medium', color: '#ffffff', fontSize: 14 }}>
                      Create a group
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }
            return (
              <FlatList
                data={activeGroups}
                keyExtractor={(g) => g.id}
                scrollEnabled={activeGroups.length > 6}
                style={{ maxHeight: 360 }}
                renderItem={({ item: g }) => {
                  const previews = (memberPreviews[g.id] ?? []).slice(0, 2);
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        setShowExpensePicker(false);
                        router.push(`/groups/${g.id}/add-expense` as never);
                      }}
                      style={{
                        height: 60,
                        paddingHorizontal: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderBottomWidth: 1,
                        borderBottomColor: theme.border,
                        gap: 12,
                      }}
                      activeOpacity={0.7}
                    >
                      {/* Small avatar stack */}
                      <View style={{ flexDirection: 'row' }}>
                        {previews.map((p, i) => (
                          <View key={p.memberId} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 2 - i }}>
                            <AvatarCircle preview={p} size={32} borderColor={theme.surface} />
                          </View>
                        ))}
                      </View>

                      {/* Group name */}
                      <Text
                        style={{
                          fontFamily: 'Inter_500Medium',
                          fontSize: 15,
                          color: theme.textPrimary,
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {g.name}
                      </Text>

                      {/* Type badge */}
                      <View
                        style={{
                          backgroundColor: theme.surface2,
                          borderRadius: 99,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: 'Inter_400Regular',
                            fontSize: 12,
                            color: theme.textSecondary,
                            textTransform: 'capitalize',
                          }}
                        >
                          {g.type}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            );
          })()}

          <TouchableOpacity
            onPress={() => setShowExpensePicker(false)}
            style={{ alignItems: 'center', paddingVertical: 16, marginTop: 4 }}
          >
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.destructive }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
