import type { Database } from './database.types';

type GroupType = Database['public']['Tables']['groups']['Row']['type'];
type GroupStatus = Database['public']['Tables']['groups']['Row']['status'];

export interface GroupWithMembership {
  id: string;
  name: string;
  type: GroupType;
  base_currency: Database['public']['Tables']['groups']['Row']['base_currency'];
  admin_id: string;
  status: GroupStatus;
  start_date: string | null;
  end_date: string | null;
  settlement_visibility: 'public' | 'private';
  background_image_url: string | null;
  created_at: string;
  updated_at: string;
  member_id: string;
  is_pinned: boolean;
  is_muted: boolean;
  role: 'admin' | 'member';
  balance: number;
}

export interface GroupFilters {
  status: GroupStatus | null;
  types: GroupType[];
  balance: 'owe' | 'owed' | 'settled' | null;
  tripTiming: 'upcoming' | 'ongoing' | 'past' | null;
  today?: string;
}

export function sortGroups(groups: GroupWithMembership[]): GroupWithMembership[] {
  return [...groups].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export function filterGroups(
  groups: GroupWithMembership[],
  filters: GroupFilters,
): GroupWithMembership[] {
  const today = filters.today ?? new Date().toISOString().slice(0, 10);

  return groups.filter((g) => {
    if (filters.status !== null && g.status !== filters.status) return false;

    if (filters.types.length > 0 && !filters.types.includes(g.type)) return false;

    if (filters.balance === 'owe' && g.balance >= 0) return false;
    if (filters.balance === 'owed' && g.balance <= 0) return false;
    if (filters.balance === 'settled' && g.balance !== 0) return false;

    if (filters.tripTiming !== null && g.type === 'Trip') {
      const start = g.start_date ?? '';
      const end = g.end_date ?? '';
      if (filters.tripTiming === 'upcoming' && !(start > today)) return false;
      if (filters.tripTiming === 'ongoing' && !(start <= today && end >= today)) return false;
      if (filters.tripTiming === 'past' && !(end < today)) return false;
    }

    return true;
  });
}
