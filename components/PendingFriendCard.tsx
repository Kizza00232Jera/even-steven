import { TouchableOpacity, View, Text } from 'react-native';
import { Mail } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { useColorScheme } from 'nativewind';
import type { PendingFriend } from '../lib/repos/friends';

interface PendingFriendCardProps {
  friend: PendingFriend;
  onRemove: () => void;
}

export function PendingFriendCard({ friend, onRemove }: PendingFriendCardProps) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  return (
    <View className="flex-row items-center gap-3 py-3 border-b border-border">
      <View
        className="w-10 h-10 rounded-full items-center justify-center"
        style={{ backgroundColor: theme.surface2 }}
      >
        <Mail size={18} color={theme.textSecondary} strokeWidth={1.5} />
      </View>
      <View className="flex-1">
        <Text className="text-text-primary text-base">{friend.email}</Text>
        <View className="flex-row items-center gap-2 mt-0.5">
          <View
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: Colors.warning + '22' }}
          >
            <Text style={{ color: Colors.warning }} className="text-xs font-medium">
              Pending
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity onPress={onRemove} activeOpacity={0.7}>
        <Text style={{ color: Colors.destructive }} className="text-sm">
          Remove
        </Text>
      </TouchableOpacity>
    </View>
  );
}
