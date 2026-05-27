import { TouchableOpacity, View, Text, Image } from 'react-native';
import { User } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { useColorScheme } from 'nativewind';
import { format } from '../lib/currency';
import type { Currency } from '../lib/currency';
import { useAuthStore } from '../store/auth';
import type { ActiveFriend } from '../lib/repos/friends';

interface FriendCardProps {
  friend: ActiveFriend;
  onPress: () => void;
}

export function FriendCard({ friend, onPress }: FriendCardProps) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { profile } = useAuthStore();
  const currency = (profile?.preferred_currency ?? 'EUR') as Currency;

  const balanceColor = friend.totalBalance > 0 ? Colors.accent : Colors.destructive;
  const balanceText =
    friend.totalBalance > 0
      ? `Owes ${format(friend.totalBalance, currency)}`
      : `You owe ${format(Math.abs(friend.totalBalance), currency)}`;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        gap: 12,
      }}
      activeOpacity={0.7}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.surface2,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {friend.avatarUrl ? (
          <Image source={{ uri: friend.avatarUrl }} style={{ width: 40, height: 40 }} />
        ) : (
          <User size={20} color={theme.textSecondary} strokeWidth={1.5} />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 15, color: theme.textPrimary }}>
          {friend.name}
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            color: theme.textSecondary,
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {friend.email}
        </Text>
      </View>

      {friend.totalBalance !== 0 && (
        <Text
          style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 14,
            color: balanceColor,
          }}
        >
          {balanceText}
        </Text>
      )}
    </TouchableOpacity>
  );
}
