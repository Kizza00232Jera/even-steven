import { TouchableOpacity, View, Text } from 'react-native';
import { User } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { useColorScheme } from 'nativewind';
import type { ActiveFriend } from '../lib/repos/friends';

interface FriendCardProps {
  friend: ActiveFriend;
  onPress: () => void;
}

function balanceLabel(totalBalance: number, sharedGroupCount: number): {
  text: string;
  color: string;
} {
  if (totalBalance === 0) {
    return { text: 'All settled', color: Colors.accent };
  }
  const groupSuffix =
    sharedGroupCount > 1 ? ` across ${sharedGroupCount} groups` : '';
  if (totalBalance > 0) {
    return { text: `Owes you${groupSuffix}`, color: Colors.accent };
  }
  return { text: `You owe${groupSuffix}`, color: Colors.destructive };
}

export function FriendCard({ friend, onPress }: FriendCardProps) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { text, color } = balanceLabel(friend.totalBalance, friend.sharedGroupCount);

  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center gap-3 py-3 border-b border-border"
      activeOpacity={0.7}
    >
      <View
        className="w-10 h-10 rounded-full items-center justify-center"
        style={{ backgroundColor: theme.surface2 }}
      >
        <User size={20} color={theme.textSecondary} strokeWidth={1.5} />
      </View>
      <View className="flex-1">
        <Text className="text-text-primary font-medium text-base">{friend.name}</Text>
        <Text style={{ color }} className="text-xs mt-0.5">
          {text}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
