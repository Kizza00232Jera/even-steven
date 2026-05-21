import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useColorScheme } from 'nativewind';
import { ChevronLeft, User, Shield, UserMinus, Clock } from 'lucide-react-native';
import { ErrorState } from '../../../components/ErrorState';
import { Colors } from '../../../constants/colors';
import { fetchGroupMembers, removeMember } from '../../../lib/repos/groups';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/auth';
import type { GroupMemberWithProfile } from '../../../lib/repos/groups';

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

interface MemberRowProps {
  member: GroupMemberWithProfile;
  isCurrentUser: boolean;
  isCurrentUserAdmin: boolean;
  onRemove: () => void;
}

function MemberRow({ member, isCurrentUser, isCurrentUserAdmin, onRemove }: MemberRowProps) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const displayName = member.display_name ?? member.email;
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

  const { data: members, isLoading, isError, refetch } = useGroupMembers(groupId);

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeMember(supabase, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  const currentMember = members?.find((m) => m.user_id === currentUserId);
  const isAdmin = currentMember?.role === 'admin';

  function confirmRemove(member: GroupMemberWithProfile) {
    const name = member.display_name ?? member.email;
    Alert.alert(
      'Remove member',
      `Remove ${name} from this group? Their expense history will remain intact.`,
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
    </SafeAreaView>
  );
}
