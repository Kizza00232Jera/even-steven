import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Shield, UserX } from 'lucide-react-native';
import { useAuthStore } from '../../../store/auth';
import { supabase } from '../../../lib/supabase';
import { Colors } from '../../../constants/colors';
import { fetchGroupDetail, fetchGroupMembers, removeMember } from '../../../lib/repos/groups';
import type { GroupMemberRow } from '../../../lib/repos/groups';

function getDisplayName(member: GroupMemberRow): string {
  return member.display_name ?? member.profile_display_name ?? member.email;
}

function MemberRow({
  member,
  isCurrentUser,
  isAdmin,
  groupName,
  onRemove,
}: {
  member: GroupMemberRow;
  isCurrentUser: boolean;
  isAdmin: boolean;
  groupName: string;
  onRemove: (member: GroupMemberRow) => void;
}) {
  const name = getDisplayName(member);
  const initials = name.charAt(0).toUpperCase();

  return (
    <View className="flex-row items-center px-4 py-3 border-b border-border">
      <View className="w-10 h-10 rounded-full bg-surface-2 border border-border items-center justify-center mr-3">
        <Text className="font-display text-base font-semibold text-text-secondary">{initials}</Text>
      </View>

      <View className="flex-1 mr-2">
        <View className="flex-row items-center gap-2">
          <Text className="font-body text-base text-text-primary" numberOfLines={1}>
            {name}
          </Text>
          {member.role === 'admin' && (
            <View testID={`admin-badge-${member.id}`} className="flex-row items-center bg-accent/15 rounded px-1.5 py-0.5">
              <Shield size={10} color={Colors.accent} />
              <Text className="font-body text-xs ml-0.5" style={{ color: Colors.accent }}>
                Admin
              </Text>
            </View>
          )}
          {member.status === 'invited' && (
            <View className="bg-surface-2 border border-border rounded px-1.5 py-0.5">
              <Text className="font-body text-xs text-text-secondary">Invited</Text>
            </View>
          )}
        </View>
        {name !== member.email && (
          <Text className="font-body text-xs text-text-secondary" numberOfLines={1}>
            {member.email}
          </Text>
        )}
      </View>

      {isAdmin && !isCurrentUser && (
        <TouchableOpacity
          testID={`remove-member-${member.id}`}
          onPress={() => onRemove(member)}
          className="w-8 h-8 items-center justify-center rounded-full bg-destructive/10"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <UserX size={16} color={Colors.destructive} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function GroupMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuthStore();
  const userId = session?.user?.id ?? '';

  const { data: detail } = useQuery({
    queryKey: ['group', id, 'settings'],
    queryFn: () => fetchGroupDetail(supabase, id, userId),
    enabled: !!id && !!userId,
  });

  const {
    data: members,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['group', id, 'members'],
    queryFn: () => fetchGroupMembers(supabase, id),
    enabled: !!id,
  });

  const isAdmin = detail?.currentMemberRole === 'admin';
  const currentMemberId = detail?.currentMemberId ?? '';
  const groupName = detail?.group?.name ?? 'this group';

  function handleRemove(member: GroupMemberRow) {
    const name = getDisplayName(member);
    Alert.alert(
      `Remove ${name}?`,
      `${name} will be removed from ${groupName}. Their balance and expense history remain intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember(supabase, member.id);
              queryClient.invalidateQueries({ queryKey: ['group', id] });
              queryClient.invalidateQueries({ queryKey: ['groups'] });
            } catch {
              Alert.alert('Error', 'Failed to remove member. Please try again.');
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={22} color={Colors.dark.textPrimary} />
        </TouchableOpacity>
        <Text className="font-display text-lg font-semibold text-text-primary flex-1">
          Members
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="font-body text-text-secondary text-center mb-4">
            Failed to load members.
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="bg-surface border border-border rounded-xl px-4 py-2"
          >
            <Text className="font-body text-text-primary">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView className="flex-1">
          <View className="bg-surface rounded-2xl mx-4 mt-4 border border-border overflow-hidden">
            {(members ?? []).map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                isCurrentUser={member.id === currentMemberId}
                isAdmin={isAdmin}
                groupName={groupName}
                onRemove={handleRemove}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
