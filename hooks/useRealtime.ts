import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

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
