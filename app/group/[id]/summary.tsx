import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { useColorScheme } from 'nativewind';
import { User } from 'lucide-react-native';
import { fetchGroupSummary, type CategoryBreakdown } from '../../../lib/repos/summary';
import { supabase } from '../../../lib/supabase';
import { format } from '../../../lib/currency';
import { Skeleton } from '../../../components/Skeleton';
import { Colors } from '../../../constants/colors';

interface SummaryTabProps {
  groupId: string;
}

// Distinct palette for category segments
const CATEGORY_COLORS = [
  '#00C896',
  '#3B82F6',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#10B981',
  '#F97316',
  '#6366F1',
  '#14B8A6',
];

function DonutChart({ segments }: { segments: CategoryBreakdown[] }) {
  const size = 180;
  const strokeWidth = 32;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  let offset = 0;
  const total = segments.reduce((sum, s) => sum + s.amount, 0);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G rotation="-90" origin={`${cx}, ${cy}`}>
        {segments.map((seg, i) => {
          const dash = (seg.amount / total) * circumference;
          const gap = circumference - dash;
          const segOffset = offset;
          offset += dash;
          return (
            <Circle
              key={seg.category}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-segOffset}
            />
          );
        })}
      </G>
    </Svg>
  );
}

export function SummaryTab({ groupId }: SummaryTabProps) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['group-summary', groupId],
    queryFn: () => fetchGroupSummary(supabase, groupId),
  });

  if (isLoading) {
    return (
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View testID="skeleton-summary">
          <Skeleton width="100%" height={80} borderRadius={16} />
        </View>
        <View testID="skeleton-summary">
          <Skeleton width="100%" height={200} borderRadius={16} />
        </View>
        <View testID="skeleton-summary">
          <Skeleton width="100%" height={120} borderRadius={16} />
        </View>
      </ScrollView>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-text-secondary text-base mb-4">Failed to load summary.</Text>
        <TouchableOpacity
          onPress={() => refetch()}
          className="bg-surface-2 rounded-xl px-6 py-3"
        >
          <Text className="text-text-primary font-medium">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!data || data.totalSpending === 0) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-text-secondary text-base text-center">
          No expenses yet — add one to see the summary.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View
        className="rounded-2xl p-5 border border-border"
        style={{ backgroundColor: theme.surface }}
      >
        <Text className="text-text-secondary text-sm mb-1">Total Group Spending</Text>
        <Text
          className="font-display text-3xl font-bold"
          style={{ color: Colors.accent }}
        >
          {format(data.totalSpending, data.currency)}
        </Text>
      </View>

      <View
        className="rounded-2xl p-5 border border-border"
        style={{ backgroundColor: theme.surface }}
      >
        <Text className="text-text-primary font-semibold text-base mb-4">
          Category Breakdown
        </Text>
        <View className="items-center mb-4">
          <DonutChart segments={data.categoryBreakdown} />
        </View>
        <View className="gap-2">
          {data.categoryBreakdown.map((item, i) => (
            <View key={item.category} className="flex-row items-center gap-3">
              <View
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
              />
              <Text className="text-text-primary text-sm flex-1">{item.category}</Text>
              <Text className="text-text-secondary text-sm">
                {item.percentage.toFixed(0)}%
              </Text>
              <Text className="text-text-secondary text-sm w-20 text-right">
                {format(item.amount, data.currency)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View
        className="rounded-2xl p-5 border border-border"
        style={{ backgroundColor: theme.surface }}
      >
        <Text className="text-text-primary font-semibold text-base mb-4">
          Who Paid
        </Text>
        <View className="gap-3">
          {data.memberContributions.map((member) => (
            <View key={member.memberId} className="flex-row items-center gap-3">
              <View
                className="w-9 h-9 rounded-full items-center justify-center"
                style={{ backgroundColor: theme.surface2 }}
              >
                <User size={18} color={theme.textSecondary} strokeWidth={1.5} />
              </View>
              <Text className="text-text-primary text-sm flex-1">{member.name}</Text>
              <Text className="font-semibold text-sm" style={{ color: Colors.accent }}>
                {format(member.amount, data.currency)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
