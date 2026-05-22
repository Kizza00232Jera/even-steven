import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PrefKey =
  | 'new_expense'
  | 'expense_edited'
  | 'expense_deleted'
  | 'payment_received'
  | 'payment_in_group'
  | 'someone_joins_group'
  | 'someone_added'
  | 'member_removed'
  | 'trip_end_approaching'
  | 'trip_ends_today'
  | 'trip_expired'
  | 'balance_reaches_zero';

interface Payload {
  eventType: string;
  groupId: string | null;
  actorMemberId: string;
  payeeMemberId?: string;
  metadata?: Record<string, unknown>;
  scheduled?: boolean;
}

interface NotifContent {
  title: string;
  body: string;
  route: string;
  prefKey: PrefKey;
  onlyPayee?: boolean;
}

function buildContent(payload: Payload, groupName: string, actorName: string): NotifContent | null {
  const meta = payload.meta ?? payload.metadata ?? {};
  const groupId = payload.groupId ?? '';

  switch (payload.eventType) {
    case 'expense_added':
    case 'new_expense':
      return {
        title: 'New expense',
        body: `${actorName} added "${meta.title ?? 'an expense'}"`,
        route: `/group/${groupId}`,
        prefKey: 'new_expense',
      };
    case 'expense_edited':
      return {
        title: 'Expense edited',
        body: `${actorName} edited "${meta.title ?? 'an expense'}"`,
        route: `/group/${groupId}`,
        prefKey: 'expense_edited',
      };
    case 'expense_deleted':
      return {
        title: 'Expense deleted',
        body: `${actorName} deleted "${meta.title ?? 'an expense'}"`,
        route: `/group/${groupId}`,
        prefKey: 'expense_deleted',
      };
    case 'settlement_recorded':
      return {
        title: 'Payment recorded',
        body: `${actorName} recorded a payment`,
        route: `/group/${groupId}/balances`,
        prefKey: 'payment_in_group',
      };
    case 'payment_received':
      return {
        title: 'Payment received',
        body: `${actorName} recorded a payment to you`,
        route: `/group/${groupId}/balances`,
        prefKey: 'payment_received',
        onlyPayee: true,
      };
    case 'member_joined':
      return {
        title: `${actorName} joined`,
        body: `${actorName} joined ${groupName}`,
        route: `/group/${groupId}/members`,
        prefKey: 'someone_joins_group',
      };
    case 'member_added':
      return {
        title: 'New member',
        body: `${actorName} was added to ${groupName}`,
        route: `/group/${groupId}/members`,
        prefKey: 'someone_added',
      };
    case 'member_removed':
      return {
        title: 'Member removed',
        body: `${actorName} was removed from ${groupName}`,
        route: `/group/${groupId}/members`,
        prefKey: 'member_removed',
      };
    case 'trip_expired':
      return {
        title: 'Trip ended',
        body: `${groupName} has expired`,
        route: `/group/${groupId}`,
        prefKey: 'trip_expired',
      };
    case 'trip_expiry_warning':
      return {
        title: 'Trip ending soon',
        body: `${groupName} ends in 3 days`,
        route: `/group/${groupId}`,
        prefKey: 'trip_end_approaching',
      };
    case 'trip_ends_today':
      return {
        title: 'Trip ends today',
        body: `${groupName} ends today`,
        route: `/group/${groupId}`,
        prefKey: 'trip_ends_today',
      };
    case 'balance_zero':
      return {
        title: 'Balance settled',
        body: `Your balance in ${groupName} is now zero`,
        route: `/group/${groupId}/balances`,
        prefKey: 'balance_reaches_zero',
        onlyPayee: true,
      };
    default:
      return null;
  }
}

async function handleScheduled(
  eventType: 'trip_ends_today' | 'trip_expiry_warning',
  db: ReturnType<typeof createClient>,
): Promise<Response> {
  const today = new Date().toISOString().slice(0, 10);
  const warningDate = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const targetDate = eventType === 'trip_ends_today' ? today : warningDate;

  const { data: groups } = await db
    .from('groups')
    .select('id, name')
    .eq('type', 'Trip')
    .eq('end_date', targetDate)
    .eq('status', 'active');

  if (!groups || groups.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const messages: Record<string, unknown>[] = [];

  for (const group of groups) {
    const { data: members } = await db
      .from('group_members')
      .select('id, user_id, is_muted')
      .eq('group_id', group.id)
      .eq('status', 'active');

    if (!members) continue;

    const prefKey = eventType === 'trip_ends_today' ? 'trip_ends_today' : 'trip_end_approaching';
    const title = eventType === 'trip_ends_today' ? 'Trip ends today' : 'Trip ending soon';
    const body = eventType === 'trip_ends_today'
      ? `${group.name} ends today`
      : `${group.name} ends in 3 days`;
    const route = `/group/${group.id}`;

    for (const member of members) {
      if (!member.user_id || member.is_muted) continue;

      const { data: prefs } = await db
        .from('notification_preferences')
        .select(prefKey)
        .eq('user_id', member.user_id)
        .single();

      if (!prefs || !(prefs as Record<string, unknown>)[prefKey]) continue;

      const { data: tokenRow } = await db
        .from('push_tokens')
        .select('token')
        .eq('user_id', member.user_id)
        .maybeSingle();

      if (!tokenRow?.token) continue;

      messages.push({ to: tokenRow.token, title, body, data: { route }, sound: 'default' });
    }
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const expoRes = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const expoBody = await expoRes.json();
  return new Response(JSON.stringify({ sent: messages.length, expo: expoBody }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (payload.scheduled) {
    const et = payload.eventType as 'trip_ends_today' | 'trip_expiry_warning';
    return handleScheduled(et, db);
  }

  const { groupId, actorMemberId, payeeMemberId } = payload;
  if (!groupId) return new Response(JSON.stringify({ sent: 0 }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  // Fetch group name
  const { data: group } = await db.from('groups').select('name').eq('id', groupId).single();
  const groupName = group?.name ?? 'your group';

  // Fetch actor display name
  const { data: actorMember } = await db
    .from('group_members')
    .select('display_name, email, user_id')
    .eq('id', actorMemberId)
    .single();
  const actorName = actorMember?.display_name ?? actorMember?.email ?? 'Someone';

  const content = buildContent(payload, groupName, actorName);
  if (!content) return new Response(JSON.stringify({ sent: 0 }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  // Fetch all active group members (excluding the actor)
  const { data: members } = await db
    .from('group_members')
    .select('id, user_id, is_muted')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .neq('id', actorMemberId);

  if (!members || members.length === 0) return new Response(JSON.stringify({ sent: 0 }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const messages: Record<string, unknown>[] = [];

  for (const member of members) {
    if (!member.user_id) continue;
    if (member.is_muted) continue;

    // For onlyPayee notifications (e.g. payment_received, balance_zero), skip non-payees
    if (content.onlyPayee && payeeMemberId && member.id !== payeeMemberId) continue;

    // Check notification preferences
    const { data: prefs } = await db
      .from('notification_preferences')
      .select(content.prefKey)
      .eq('user_id', member.user_id)
      .single();

    if (!prefs || !(prefs as Record<string, unknown>)[content.prefKey]) continue;

    // Look up push token
    const { data: tokenRow } = await db
      .from('push_tokens')
      .select('token')
      .eq('user_id', member.user_id)
      .maybeSingle();

    if (!tokenRow?.token) continue;

    messages.push({
      to: tokenRow.token,
      title: content.title,
      body: content.body,
      data: { route: content.route },
      sound: 'default',
    });
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const expoRes = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  const expoBody = await expoRes.json();
  return new Response(JSON.stringify({ sent: messages.length, expo: expoBody }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
