import { useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useQueryClient } from '@tanstack/react-query';
import type { Database } from '../lib/database.types';
import { isTripExpired, shouldAutoArchive } from '../lib/tripLifecycle';
import { markGroupExpired, markGroupArchived } from '../lib/repos/groups';
import { supabase } from '../lib/supabase';

type Group = Database['public']['Tables']['groups']['Row'];

const SHOWN_KEY = 'trip_expiry_popups_shown_v1';

async function getShownIds(): Promise<Set<string>> {
  try {
    const stored = await SecureStore.getItemAsync(SHOWN_KEY);
    return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

async function addShownId(groupId: string): Promise<void> {
  const ids = await getShownIds();
  ids.add(groupId);
  await SecureStore.setItemAsync(SHOWN_KEY, JSON.stringify(Array.from(ids)));
}

export async function checkAndAutoArchive(
  groupId: string,
  groupStatus: Group['status'],
  allBalancesZero: boolean,
): Promise<void> {
  if (shouldAutoArchive({ status: groupStatus } as Group, allBalancesZero)) {
    await markGroupArchived(supabase, groupId);
  }
}

export function useTripExpiry(groups: Group[] | undefined) {
  const queryClient = useQueryClient();
  const [popupGroup, setPopupGroup] = useState<Group | null>(null);
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (!groups || hasProcessed.current) return;
    hasProcessed.current = true;

    const today = new Date().toISOString().slice(0, 10);

    async function run() {
      const shownIds = await getShownIds();
      let didTransition = false;

      for (const group of groups!) {
        if (isTripExpired(group, today)) {
          try {
            await markGroupExpired(supabase, group.id);
            didTransition = true;
          } catch {
            // Retry silently on next app open
          }
        }
      }

      if (didTransition) {
        queryClient.invalidateQueries({ queryKey: ['groups'] });
      }

      // Show popup for first expired Trip whose notification hasn't been shown yet
      const pending = groups!.find(
        (g) =>
          g.type === 'Trip' &&
          (g.status === 'expired' || isTripExpired(g, today)) &&
          !shownIds.has(g.id),
      );

      if (pending) {
        setPopupGroup(pending);
      }
    }

    run();
  }, [groups]);

  async function dismissPopup() {
    if (popupGroup) {
      await addShownId(popupGroup.id);
    }
    setPopupGroup(null);
  }

  return { popupGroup, dismissPopup };
}
