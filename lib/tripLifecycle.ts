import type { Database } from './database.types';

type Group = Database['public']['Tables']['groups']['Row'];

export function isTripExpired(group: Group, today: string): boolean {
  return (
    group.type === 'Trip' &&
    group.status === 'active' &&
    group.end_date !== null &&
    group.end_date < today
  );
}

export function shouldAutoArchive(group: Group, allBalancesZero: boolean): boolean {
  return group.status === 'expired' && allBalancesZero;
}
