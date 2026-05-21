import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: adminGroups } = await adminClient
      .from('groups')
      .select('id, group_members(id, user_id, joined_at, status)')
      .eq('admin_id', user.id)

    for (const group of adminGroups ?? []) {
      const otherActiveMembers = (group.group_members as Array<{
        id: string
        user_id: string | null
        joined_at: string
        status: string
      }>)
        .filter((m) => m.user_id !== user.id && m.status === 'active' && m.user_id !== null)
        .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime())

      if (otherActiveMembers.length > 0) {
        // Transfer admin to the longest-tenured other member
        await adminClient
          .from('groups')
          .update({ admin_id: otherActiveMembers[0].user_id })
          .eq('id', group.id)
      } else {
        // User is the only member — delete the group (cascades members, expenses, etc.)
        await adminClient.from('groups').delete().eq('id', group.id)
      }
    }

    // Delete the auth user (cascades profile deletion; group_members.user_id SET NULL)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
