import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useRealtimeGroups(userId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`groups-list-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['groups', userId] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'group_members' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['groups', userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

export function useRealtime(groupId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`group-${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${groupId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
          queryClient.invalidateQueries({ queryKey: ['group-balances', groupId] });
          queryClient.invalidateQueries({ queryKey: ['group-summary', groupId] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settlements', filter: `group_id=eq.${groupId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['group-balances', groupId] });
          queryClient.invalidateQueries({ queryKey: ['group-settlements', groupId] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
          queryClient.invalidateQueries({ queryKey: ['group', groupId] });
          queryClient.invalidateQueries({ queryKey: ['group-balances', groupId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);
}
