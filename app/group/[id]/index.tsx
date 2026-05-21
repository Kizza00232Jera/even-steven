import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { fetchGroupDetail } from '../../../lib/repos/groups';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/auth';
import { BalancesTab } from './balances';
import { SkeletonExpenseCard } from '../../../components/SkeletonExpenseCard';
import { SkeletonBalanceRow } from '../../../components/SkeletonBalanceRow';
import { ErrorState } from '../../../components/ErrorState';
import { RemovedMemberState } from '../../../components/RemovedMemberState';
import { Colors } from '../../../constants/colors';

type Tab = 'expenses' | 'balances' | 'summary';

const GROUP_HEADER_COLORS: Record<string, string> = {
  Trip: Colors.gradients.trip[0],
  Home: Colors.gradients.home[0],
  Couple: Colors.gradients.couple[0],
  Utilities: Colors.gradients.utilities[0],
  Family: Colors.gradients.family[0],
  Other: Colors.gradients.other[0],
};

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const session = useAuthStore((s) => s.session);
  const [activeTab, setActiveTab] = useState<Tab>('balances');

  const { data: group, isLoading, isError, refetch } = useQuery({
    queryKey: ['group-detail', id],
    queryFn: () => fetchGroupDetail(supabase, id, session?.user.id ?? ''),
    enabled: !!session?.user.id,
  });

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="h-14 bg-surface-2 items-center justify-center">
          <View className="h-5 w-40 bg-surface rounded-lg" />
        </View>
        <View className="flex-1 px-4 pt-4 gap-3">
          <SkeletonExpenseCard />
          <SkeletonExpenseCard />
          <SkeletonBalanceRow />
          <SkeletonBalanceRow />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 px-4 pt-4">
          <ErrorState onRetry={refetch} />
        </View>
      </SafeAreaView>
    );
  }

  const isMember = group?.currentMember?.status === 'active';
  if (group && !isMember) {
    return <RemovedMemberState />;
  }

  const headerColor = group ? (GROUP_HEADER_COLORS[group.type] ?? Colors.gradients.other[0]) : Colors.gradients.other[0];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View
        className="px-4 pt-3 pb-4"
        style={{ backgroundColor: headerColor }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          className="flex-row items-center mb-2"
        >
          <ChevronLeft size={22} color="rgba(255,255,255,0.8)" strokeWidth={2} />
          <Text className="text-sm ml-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Back
          </Text>
        </TouchableOpacity>
        <Text className="text-white font-bold text-2xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
          {group?.name ?? ''}
        </Text>
      </View>

      {/* Tab bar */}
      <View
        className="flex-row border-b border-border"
        style={{ backgroundColor: theme.surface }}
      >
        {(['expenses', 'balances', 'summary'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className="flex-1 py-3 items-center"
          >
            <Text
              className="text-sm font-medium capitalize"
              style={{
                color: activeTab === tab ? Colors.accent : theme.textSecondary,
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
            {activeTab === tab && (
              <View
                className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                style={{ backgroundColor: Colors.accent }}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View className="flex-1">
        {activeTab === 'expenses' && <ExpensesTabStub />}
        {activeTab === 'balances' && group?.currentMember && (
          <BalancesTab groupId={id} currentMemberId={group.currentMember.id} />
        )}
        {activeTab === 'summary' && <SummaryTabStub />}
      </View>
    </SafeAreaView>
  );
}

function ExpensesTabStub() {
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <Text className="text-text-secondary text-base">Expenses coming soon</Text>
    </ScrollView>
  );
}

function SummaryTabStub() {
  return (
    <View className="flex-1 items-center justify-center px-4">
      <Text className="text-text-secondary text-base">Summary coming soon</Text>
    </View>
  );
}
