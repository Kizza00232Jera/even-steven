import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Share,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useColorScheme } from 'nativewind';
import { ChevronLeft, Shield, UserMinus, Clock, UserPlus, Share2, X } from 'lucide-react-native';
import { ErrorState } from '../../../components/ErrorState';
import { Colors } from '../../../constants/colors';
import { fetchGroupMembers, removeMember } from '../../../lib/repos/groups';
import { addInvitedMember, getOrCreateInviteToken } from '../../../lib/repos/invites';
import { resolveDisplayName } from '../../../lib/displayName';
import { logActivityEvent } from '../../../lib/repos/activity';
import { sendGroupNotification } from '../../../lib/notifications';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/auth';
import type { GroupMemberWithProfile } from '../../../lib/repos/groups';

const INVITE_BASE_URL = 'https://even-steven-five.vercel.app/invite';

function AvatarPlaceholder({
  name,
  size = 40,
}: {
  name: string | null;
  size?: number;
}) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.surface2 }}
      className="items-center justify-center"
    >
      <Text className="font-display font-semibold" style={{ color: theme.textSecondary, fontSize: size * 0.4 }}>
        {initial}
      </Text>
    </View>
  );
}

interface AddMemberSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (email: string) => void;
  isLoading: boolean;
}

function AddMemberSheet({ visible, onClose, onAdd, isLoading }: AddMemberSheetProps) {
  const [email, setEmail] = useState('');
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  function handleAdd() {
    const trimmed = email.trim();
    if (!trimmed.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    onAdd(trimmed);
  }

  function handleClose() {
    setEmail('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end"
      >
        <TouchableOpacity className="flex-1" onPress={handleClose} />
        <View
          className="rounded-t-3xl p-6 pb-10"
          style={{ backgroundColor: theme.surface }}
        >
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-text-primary font-bold text-lg font-display">Add Member</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={22} color={theme.textSecondary} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
          <TextInput
            className="bg-background border border-border rounded-xl px-4 py-3 text-text-primary mb-4 font-body"
            placeholder="Email address"
            placeholderTextColor={theme.textTertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoFocus
            onSubmitEditing={handleAdd}
          />
          <TouchableOpacity
            className="rounded-full py-3.5 items-center"
            style={{ backgroundColor: Colors.accent }}
            onPress={handleAdd}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-base font-body">
              {isLoading ? 'Adding…' : 'Send Invite'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface MemberRowProps {
  member: GroupMemberWithProfile;
  isCurrentUser: boolean;
  isCurrentUserAdmin: boolean;
  onRemove: () => void;
}

function MemberRow({ member, isCurrentUser, isCurrentUserAdmin, onRemove }: MemberRowProps) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const displayName = resolveDisplayName(member.display_name, member.profile_display_name, member.google_name, member.email);
  const isPending = member.status === 'invited';

  return (
    <View className="flex-row items-center py-3 border-b border-border">
      <AvatarPlaceholder name={member.display_name} />
      <View className="flex-1 ml-3">
        <View className="flex-row items-center gap-2">
          <Text className="font-body text-text-primary font-medium text-base" numberOfLines={1}>
            {displayName}
          </Text>
          {member.role === 'admin' && (
            <View
              testID={`admin-badge-${member.id}`}
              className="flex-row items-center gap-1 px-2 py-0.5 rounded"
              style={{ backgroundColor: Colors.accentDim }}
            >
              <Shield size={10} color={Colors.accent} strokeWidth={2} />
              <Text className="font-body text-xs" style={{ color: Colors.accent }}>
                Admin
              </Text>
            </View>
          )}
          {isPending && (
            <View
              className="flex-row items-center gap-1 px-2 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(245,158,11,0.15)' }}
            >
              <Clock size={10} color={Colors.warning} strokeWidth={2} />
              <Text className="font-body text-xs" style={{ color: Colors.warning }}>
                Pending
              </Text>
            </View>
          )}
        </View>
        {member.display_name && (
          <Text className="font-body text-text-secondary text-xs mt-0.5" numberOfLines={1}>
            {member.email}
          </Text>
        )}
      </View>
      {isCurrentUserAdmin && !isCurrentUser && (
        <TouchableOpacity
          testID={`remove-member-${member.id}`}
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="ml-2"
        >
          <UserMinus size={18} color={Colors.destructive} strokeWidth={1.5} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => fetchGroupMembers(supabase, groupId),
  });
}

export default function MembersScreen() {
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuthStore();
  const queryClient = useQueryClient();
  const currentUserId = session?.user.id ?? '';
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const [isAddSheetVisible, setIsAddSheetVisible] = useState(false);
  const [isSharingLink, setIsSharingLink] = useState(false);

  const { data: members, isLoading, isError, refetch } = useGroupMembers(groupId);

  const currentMember = members?.find((m) => m.user_id === currentUserId);
  const isAdmin = currentMember?.role === 'admin';

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeMember(supabase, memberId),
    onSuccess: () => {
      logActivityEvent(supabase, {
        groupId,
        actorId: currentUserId,
        eventType: 'member_removed',
      }).catch(() => {});
      if (currentMember?.id) {
        sendGroupNotification({
          eventType: 'member_removed',
          groupId,
          actorMemberId: currentMember.id,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (email: string) => addInvitedMember(supabase, groupId, email, currentMember?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
      setIsAddSheetVisible(false);
    },
    onError: () => {
      Alert.alert('Error', 'Could not add member. Please try again.');
    },
  });

  async function handleShareLink() {
    const memberId = currentMember?.id;
    if (!memberId) return;
    setIsSharingLink(true);
    try {
      const token = await getOrCreateInviteToken(supabase, groupId, memberId);
      const url = `${INVITE_BASE_URL}/${token}`;
      await Share.share({ message: url, url });
    } catch {
      Alert.alert('Error', 'Could not generate invite link. Please try again.');
    } finally {
      setIsSharingLink(false);
    }
  }

  function confirmRemove(member: GroupMemberWithProfile) {
    const name = member.display_name ?? member.email;
    const hasBalance = member.balance !== 0;
    const balanceNote = hasBalance
      ? ` This member has an outstanding balance of ${member.balance > 0 ? '+' : ''}${member.balance.toFixed(2)}.`
      : '';
    Alert.alert(
      'Remove member',
      `Remove ${name} from this group?${balanceNote} Their expense history will remain intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeMutation.mutate(member.id),
        },
      ],
    );
  }

  const count = members?.length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <TouchableOpacity
          testID="back-button"
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mr-3"
        >
          <ChevronLeft size={24} color={Colors.accent} strokeWidth={2} />
        </TouchableOpacity>
        <Text className="font-display text-text-primary font-semibold text-lg">
          Members ({count})
        </Text>
      </View>

      <View className="flex-1 px-4">
        {/* Add member + Invite via link — visible to all members */}
        <View className="flex-row gap-3 py-4">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-full border border-border"
            style={{ backgroundColor: theme.surface2 }}
            onPress={() => setIsAddSheetVisible(true)}
            activeOpacity={0.7}
          >
            <UserPlus size={16} color={Colors.accent} strokeWidth={2} />
            <Text className="font-body font-medium text-text-primary text-sm">Add member</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-full border border-border"
            style={{ backgroundColor: theme.surface2 }}
            onPress={handleShareLink}
            disabled={isSharingLink}
            activeOpacity={0.7}
          >
            {isSharingLink ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <Share2 size={16} color={Colors.accent} strokeWidth={2} />
            )}
            <Text className="font-body font-medium text-text-primary text-sm">
              {isSharingLink ? 'Generating…' : 'Invite via link'}
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading && (
          <View className="gap-3 pt-4">
            {[1, 2, 3].map((i) => (
              <View key={i} className="flex-row items-center gap-3 py-3">
                <View className="w-10 h-10 rounded-full bg-surface-2" />
                <View className="flex-1 gap-2">
                  <View className="h-4 w-32 bg-surface-2 rounded" />
                  <View className="h-3 w-48 bg-surface-2 rounded" />
                </View>
              </View>
            ))}
          </View>
        )}

        {isError && (
          <View className="pt-4">
            <ErrorState onRetry={refetch} />
          </View>
        )}

        {!isLoading && !isError && (
          <FlatList
            data={members}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MemberRow
                member={item}
                isCurrentUser={item.user_id === currentUserId}
                isCurrentUserAdmin={isAdmin}
                onRemove={() => confirmRemove(item)}
              />
            )}
          />
        )}
      </View>

      <AddMemberSheet
        visible={isAddSheetVisible}
        onClose={() => setIsAddSheetVisible(false)}
        onAdd={(email) => addMemberMutation.mutate(email)}
        isLoading={addMemberMutation.isPending}
      />
    </SafeAreaView>
  );
}
