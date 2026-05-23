import React from 'react';
import { View } from 'react-native';
import { Skeleton } from './Skeleton';

export function SkeletonExpenseCard() {
  return (
    <View className="bg-surface rounded-2xl border border-border p-4 flex-row items-center gap-3">
      <Skeleton width={40} height={40} borderRadius={20} />
      <View className="flex-1 gap-2">
        <Skeleton width={160} height={14} borderRadius={6} />
        <Skeleton width={100} height={12} borderRadius={6} />
      </View>
      <Skeleton width={60} height={14} borderRadius={6} />
    </View>
  );
}
