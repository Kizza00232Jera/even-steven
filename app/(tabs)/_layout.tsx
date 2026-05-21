import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Users, UserPlus, Activity, User } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { fetchHasNewActivity } from '../../lib/repos/activity';
import { useActivityStore } from '../../store/activity';

function ActivityIcon({ color, size }: { color: string; size: number }) {
  const lastSeenAt = useActivityStore((s) => s.lastSeenAt);
  const { data: hasNew } = useQuery({
    queryKey: ['activity-badge', lastSeenAt],
    queryFn: () => fetchHasNewActivity(supabase, lastSeenAt),
    staleTime: 30_000,
  });

  return (
    <View>
      <Activity size={size} color={color} strokeWidth={1.5} />
      {hasNew && (
        <View
          testID="activity-badge"
          style={{
            position: 'absolute',
            top: -2,
            right: -4,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: Colors.accent,
          }}
        />
      )}
    </View>
  );
}

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'Inter_500Medium',
        },
      }}
    >
      <Tabs.Screen
        name="groups/index"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="friends/index"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, size }) => <UserPlus size={size} color={color} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="activity/index"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size }) => <ActivityIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="account/index"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} strokeWidth={1.5} />,
        }}
      />
    </Tabs>
  );
}
