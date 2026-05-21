import React from 'react';
import { View, Text } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Colors } from '../constants/colors';

interface Props {
  isOnline: boolean;
}

export function OfflineBanner({ isOnline }: Props) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (isOnline) return null;

  return (
    <View
      style={{
        backgroundColor: isDark ? '#2a1f00' : '#fef3c7',
        borderBottomWidth: 1,
        borderBottomColor: isDark ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.4)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: Colors.warning,
          fontSize: 13,
          fontFamily: 'Inter_500Medium',
          textAlign: 'center',
        }}
      >
        You're offline — showing last known data.
      </Text>
    </View>
  );
}
