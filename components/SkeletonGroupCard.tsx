import React from 'react';
import { View } from 'react-native';
import { Skeleton } from './Skeleton';

export function SkeletonGroupCard() {
  return (
    <View className="bg-surface rounded-2xl border border-border overflow-hidden" style={{ minHeight: 100 }}>
      <View style={{ height: 56, backgroundColor: '#1e2a3a' }} />
      <View className="p-4 gap-2">
        <Skeleton width={140} height={16} borderRadius={6} />
        <Skeleton width={90} height={13} borderRadius={6} />
      </View>
    </View>
  );
}
