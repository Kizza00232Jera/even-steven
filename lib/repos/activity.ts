import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../database.types';
import { resolveDisplayName } from '../displayName';

type EventType = Database['public']['Tables']['activity_events']['Row']['event_type'];

export interface ActivityEvent {
  id: string;
  eventType: EventType;
  actorName: string;
  groupId: string | null;
  groupName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface FetchActivityOptions {
  groupId?: string | null;
  limit?: number;
  offset?: number;
}

type ActorJoin = { display_name: string | null; email: string; google_name: string | null } | null;
type GroupJoin = { name: string } | null;

export async function fetchActivityFeed(
  client: SupabaseClient<Database>,
  { groupId, limit = 10, offset = 0 }: FetchActivityOptions
): Promise<ActivityEvent[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = client
    .from('activity_events')
    .select(
      `id, event_type, metadata, created_at, group_id,
       actor:actor_id (display_name, email, google_name),
       group:group_id (name)`
    )
    .order('created_at', { ascending: false });

  if (groupId) {
    query = query.eq('group_id', groupId);
  }

  const { data, error } = await query.range(offset, offset + limit - 1);

  if (error) throw error;

  return ((data as unknown[]) ?? []).map((row) => {
    const r = row as {
      id: string;
      event_type: EventType;
      metadata: Record<string, unknown>;
      created_at: string;
      group_id: string | null;
      actor: ActorJoin;
      group: GroupJoin;
    };
    const actor = r.actor;
    const actorName = actor
      ? resolveDisplayName(null, actor.display_name, actor.google_name, actor.email)
      : 'Unknown';

    return {
      id: r.id,
      eventType: r.event_type,
      actorName,
      groupId: r.group_id,
      groupName: r.group?.name ?? null,
      metadata: r.metadata ?? {},
      createdAt: r.created_at,
    };
  });
}

export async function fetchHasNewActivity(
  client: SupabaseClient<Database>,
  since: string | null
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = client
    .from('activity_events')
    .select('id', { count: 'exact', head: true });

  const { count, error } = await (since ? query.gt('created_at', since) : query);

  if (error) throw error;
  return (count ?? 0) > 0;
}

export interface LogActivityParams {
  groupId: string | null;
  actorId: string;
  eventType: EventType;
  metadata?: Record<string, Json>;
}

export async function logActivityEvent(
  client: SupabaseClient<Database>,
  params: LogActivityParams
): Promise<void> {
  const { error } = await client.from('activity_events').insert({
    group_id: params.groupId,
    actor_id: params.actorId,
    event_type: params.eventType,
    metadata: (params.metadata ?? {}) as Json,
  });
  if (error) throw error;
}
