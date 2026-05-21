import { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Skeleton } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/ErrorState';
import { FriendCard } from '../../../components/FriendCard';
import { PendingFriendCard } from '../../../components/PendingFriendCard';
import { Colors } from '../../../constants/colors';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/auth';
import {
  listFriendships,
  addFriend,
  removeFriendship,
} from '../../../lib/repos/friends';
import type { ActiveFriend, PendingFriend } from '../../../lib/repos/friends';

function SkeletonFriendRow() {
  return (
    <View className="flex-row items-center gap-3 py-3 border-b border-border">
      <Skeleton width={40} height={40} borderRadius={20} />
      <View className="flex-1 gap-2">
        <Skeleton width={130} height={14} borderRadius={6} />
        <Skeleton width={90} height={12} borderRadius={6} />
      </View>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-text-secondary text-xs font-semibold uppercase tracking-widest mt-4 mb-1">
      {title}
    </Text>
  );
}

interface AddFriendSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (email: string) => void;
  isLoading: boolean;
}

function AddFriendSheet({ visible, onClose, onAdd, isLoading }: AddFriendSheetProps) {
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
            <Text className="text-text-primary font-bold text-lg">Add Friend</Text>
            <TouchableOpacity onPress={handleClose}>
              <X size={22} color={theme.textSecondary} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
          <TextInput
            className="bg-background border border-border rounded-xl px-4 py-3 text-text-primary mb-4"
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
            <Text className="text-white font-semibold text-base">
              {isLoading ? 'Adding…' : 'Add Friend'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function FriendsScreen() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [search, setSearch] = useState('');
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['friends', profile?.id],
    queryFn: () => listFriendships(supabase, profile!.id),
    enabled: !!profile,
  });

  const addMutation = useMutation({
    mutationFn: (email: string) => addFriend(supabase, profile!.id, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends', profile?.id] });
      setSheetVisible(false);
    },
    onError: (err: Error) => {
      Alert.alert('Could not add friend', err.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (friendshipId: string) => removeFriendship(supabase, friendshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends', profile?.id] });
    },
    onError: (err: Error) => {
      Alert.alert('Could not remove friend', err.message);
    },
  });

  function handleRemoveFriend(friend: ActiveFriend) {
    Alert.alert(
      'Remove friend',
      `Remove ${friend.name} from your friends list? This won't affect any shared groups or expense history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeMutation.mutate(friend.friendshipId),
        },
      ]
    );
  }

  const query = search.trim().toLowerCase();

  const filteredActive = useMemo<ActiveFriend[]>(() => {
    const friends = data?.active ?? [];
    if (!query) return friends;
    return friends.filter(
      (f) => f.name.toLowerCase().includes(query) || f.email.toLowerCase().includes(query)
    );
  }, [data?.active, query]);

  const filteredPending = useMemo<PendingFriend[]>(() => {
    const pending = data?.pending ?? [];
    if (!query) return pending;
    return pending.filter((p) => p.email.toLowerCase().includes(query));
  }, [data?.pending, query]);

  function renderContent() {
    if (isLoading) {
      return (
        <View>
          <SkeletonFriendRow />
          <SkeletonFriendRow />
          <SkeletonFriendRow />
        </View>
      );
    }

    if (isError) {
      return <ErrorState onRetry={refetch} />;
    }

    const hasActive = filteredActive.length > 0;
    const hasPending = filteredPending.length > 0;
    const isEmpty = !hasActive && !hasPending;

    if (isEmpty && !query) {
      return (
        <View className="flex-1 items-center justify-center mt-20">
          <Text className="text-text-secondary text-sm text-center">No friends yet.</Text>
          <Text className="text-text-tertiary text-xs text-center mt-1">
            Tap + to add a friend by email.
          </Text>
        </View>
      );
    }

    if (isEmpty && query) {
      return (
        <View className="flex-1 items-center justify-center mt-20">
          <Text className="text-text-secondary text-sm text-center">No results for "{search}"</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={[]}
        ListHeaderComponent={
          <>
            {hasActive && (
              <>
                <SectionHeader title="Friends" />
                {filteredActive.map((friend) => (
                  <FriendCard
                    key={friend.friendshipId}
                    friend={friend}
                    onPress={() => router.push(`/friends/${friend.friendId}`)}
                  />
                ))}
              </>
            )}
            {hasPending && (
              <>
                <SectionHeader title="Pending" />
                {filteredPending.map((pending) => (
                  <PendingFriendCard
                    key={pending.friendshipId}
                    friend={pending}
                    onRemove={() => removeMutation.mutate(pending.friendshipId)}
                  />
                ))}
              </>
            )}
          </>
        }
        renderItem={null}
        keyExtractor={() => ''}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mt-4 mb-4">
          <Text className="text-text-primary font-bold text-2xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
            Friends
          </Text>
          <TouchableOpacity
            onPress={() => setSheetVisible(true)}
            className="w-9 h-9 rounded-full items-center justify-center"
            style={{ backgroundColor: Colors.accentDim }}
            activeOpacity={0.7}
          >
            <Plus size={20} color={Colors.accent} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <TextInput
          className="bg-surface border border-border rounded-xl px-4 py-3 text-text-primary mb-2"
          placeholder="Search by name or email"
          placeholderTextColor={theme.textTertiary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          returnKeyType="search"
        />

        {renderContent()}
      </View>

      <AddFriendSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onAdd={(email) => addMutation.mutate(email)}
        isLoading={addMutation.isPending}
      />
    </SafeAreaView>
  );
}
