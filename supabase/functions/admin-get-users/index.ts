import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate JWT using anon client + getUser
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller }, error: callerError } = await supabaseAuth.auth.getUser()
    if (callerError || !caller) {
      console.error('Auth error:', callerError)
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = caller.id

    // Create service role client for admin queries
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Check if user has admin_user_list permission via profile_object_permissions
    const { data: profileData } = await supabaseAdmin
      .from('user_profiles')
      .select('profile_id')
      .eq('user_id', userId)
      .single()

    let hasPermission = false
    if (profileData?.profile_id) {
      const { data: perms } = await supabaseAdmin
        .from('profile_object_permissions')
        .select('can_read')
        .eq('profile_id', profileData.profile_id)
        .eq('object_name', 'admin_user_list')
        .eq('can_read', true)
        .limit(1)
      hasPermission = (perms && perms.length > 0) || false
    }

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'You do not have permission to view users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch profiles directly (avoids Supabase auth.admin.listUsers bug with NULL confirmation_token)
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, full_name, phone_number, recovery_email, created_at, profile_picture_url, user_status')

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profiles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user roles
    const { data: userRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role, assigned_at')

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError)
    }

    // Fetch actual emails from auth.users via admin API (paginated)
    const emailMap = new Map<string, { email: string | null; email_confirmed_at: string | null; last_sign_in_at: string | null; phone: string | null }>()
    try {
      let page = 1
      const perPage = 1000
      while (true) {
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
        if (authErr) {
          console.error('Error listing auth users (page ' + page + '):', authErr)
          break
        }
        const users = authData?.users || []
        for (const u of users) {
          emailMap.set(u.id, {
            email: u.email ?? null,
            email_confirmed_at: u.email_confirmed_at ?? null,
            last_sign_in_at: u.last_sign_in_at ?? null,
            phone: u.phone ?? null,
          })
        }
        if (users.length < perPage) break
        page += 1
      }
    } catch (e) {
      console.error('Exception fetching auth users:', e)
    }

    // Combine all data
    const usersWithDetails = (profiles || []).map(profile => {
      const roleData = userRoles?.find(r => r.user_id === profile.id)
      const authInfo = emailMap.get(profile.id)

      return {
        id: profile.id,
        email: authInfo?.email || profile.recovery_email || profile.username || 'No email',
        username: profile.username || 'N/A',
        full_name: profile.full_name || 'N/A',
        phone_number: profile.phone_number || 'N/A',
        recovery_email: profile.recovery_email || 'N/A',
        role: roleData?.role || 'user',
        assigned_at: roleData?.assigned_at || profile.created_at,
        created_at: profile.created_at,
        last_sign_in_at: authInfo?.last_sign_in_at || null,
        email_confirmed_at: authInfo?.email_confirmed_at || null,
        confirmed_at: authInfo?.email_confirmed_at || null,
        phone: authInfo?.phone || null,
        app_metadata: {},
        user_metadata: {},
        profile: {
          id: profile.id,
          username: profile.username || 'N/A',
          full_name: profile.full_name || 'N/A',
          created_at: profile.created_at,
          profile_picture_url: profile.profile_picture_url,
          user_status: profile.user_status || 'active'
        }
      }
    })
    console.log(`Successfully fetched ${usersWithDetails.length} users`)

    return new Response(
      JSON.stringify({ users: usersWithDetails }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in admin-get-users function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})