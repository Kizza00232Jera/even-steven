import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { X, UserPlus } from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { format, type Currency } from '../lib/currency';
import { Colors } from '../constants/colors';
import { addFriend, listFriendships } from '../lib/repos/friends';
import { useAuthStore } from '../store/auth';

export interface MemberProfileTarget {
  memberId: string;
  userId: string | null;
  name: string;
  balance: number;
  currency: Currency;
}

interface Props {
  visible: boolean;
  target: MemberProfileTarget | null;
  currentMemberId: string;
  onClose: () => void;
  onSettleUp: () => void;
}

export function MemberProfileSheet({ visible, target, currentMemberId, onClose, onSettleUp }: Props) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { session, profile } = useAuthStore();
  const queryClient = useQueryClient();

  const userId = session?.user.id ?? '';

  const { data: friendships } = useQuery({
    queryKey: ['friends', userId],
    queryFn: () => listFriendships(supabase, userId),
    enabled: !!userId && visible,
  });

  const isAlreadyFriend = !!target?.userId && (friendships?.active ?? []).some(
    (f) => f.friendId === target.userId,
  );

  const addFriendMutation = useMutation({
    mutationFn: (friendUserId: string) => {
      const friendEmail = friendships?.active.find((f) => f.friendId === friendUserId)?.email
        ?? '';
      return addFriend(supabase, userId, friendEmail);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends', userId] });
    },
  });

  // For "Add Friend" we need the friend's email — fetch it separately if needed
  const { data: memberEmails } = useQuery({
    queryKey: ['member-email', target?.memberId],
    queryFn: async () => {
      if (!target?.memberId) return null;
      const { data } = await supabase
        .from('group_members')
        .select('email')
        .eq('id', target.memberId)
        .single();
      return data?.email ?? null;
    },
    enabled: !!target?.memberId && visible && !isAlreadyFriend && !!target?.userId,
  });

  if (!target) return null;

  const balanceAbs = Math.abs(target.balance);
  const balanceLabel =
    target.balance === 0
      ? 'All settled'
      : target.balance > 0
      ? `Owes you ${format(balanceAbs, target.currency)}`
      : `You owe ${format(balanceAbs, target.currency)}`;
  const balanceColor =
    target.balance === 0
      ? theme.textSecondary
      : target.balance > 0
      ? Colors.accent
      : Colors.destructive;

  const canSettleUp = target.balance !== 0;
  const showAddFriend = !!target.userId && target.userId !== userId && !isAlreadyFriend;

  async function handleAddFriend() {
    if (!memberEmails) return;
    try {
      await addFriend(supabase, userId, memberEmails);
      queryClient.invalidateQueries({ queryKey: ['friends', userId] });
    } catch { /* non-critical */ }
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPress={onClose}
      />
      <View
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl px-6 pt-6 pb-10"
        style={{ backgroundColor: theme.surface }}
      >
        <View className="flex-row items-center justify-between mb-5">
          <View
            className="w-12 h-12 rounded-full items-center justify-center"
            style={{ backgroundColor: theme.surface2 }}
          >
            <Text
              style={{ fontSize: 20, color: theme.textSecondary, fontFamily: 'SpaceGrotesk_600SemiBold' }}
            >
              {target.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1 ml-3">
            <Text className="font-display font-semibold text-text-primary text-lg" numberOfLines={1}>
              {target.name}
            </Text>
            <Text className="font-body text-sm" style={{ color: balanceColor }}>
              {balanceLabel}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <X size={20} color={theme.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {canSettleUp && (
          <TouchableOpacity
            onPress={() => { onSettleUp(); onClose(); }}
            className="rounded-full py-4 items-center mb-3"
            style={{ backgroundColor: Colors.accent }}
            activeOpacity={0.85}
          >
            <Text className="font-display font-semibold text-base" style={{ color: '#fff' }}>
              Settle Up
            </Text>
          </TouchableOpacity>
        )}

        {showAddFriend && (
          <TouchableOpacity
            onPress={handleAddFriend}
            disabled={addFriendMutation.isPending}
            className="rounded-full py-4 items-center flex-row justify-center gap-2 border border-border"
            style={{ backgroundColor: theme.surface2 }}
            activeOpacity={0.85}
          >
            {addFriendMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <>
                <UserPlus size={18} color={Colors.accent} strokeWidth={2} />
                <Text className="font-body font-semibold text-base" style={{ color: Colors.accent }}>
                  Add Friend
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}
