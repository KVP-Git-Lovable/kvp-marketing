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
    // Create Supabase client with service role for admin access
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

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: adminUser }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !adminUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check permission via profile_object_permissions
    // Checks for user management permissions (admin_user_mgmt OR admin_user_list)
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('profile_id')
      .eq('user_id', adminUser.id)
      .single()

    let hasPermission = false
    if (userProfile?.profile_id) {
      const { data: perms } = await supabaseAdmin
        .from('profile_object_permissions')
        .select('can_read')
        .eq('profile_id', userProfile.profile_id)
        .eq('can_read', true)
        .in('object_name', ['admin_user_login_as', 'admin_user_mgmt', 'admin_user_list', 'user_mgmt_list'])
        .limit(1)
      hasPermission = (perms && perms.length > 0) || false
    }

    if (!hasPermission) {
      console.log('Access denied for user:', adminUser.id)
      return new Response(
        JSON.stringify({ error: 'You do not have permission to login as other users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the target user ID from request body
    const { targetUserId } = await req.json()

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'Target user ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify target user exists
    const { data: { user: targetUser }, error: targetError } = await supabaseAdmin.auth.admin.getUserById(targetUserId)

    if (targetError || !targetUser) {
      console.error('Target user not found:', targetError)
      return new Response(
        JSON.stringify({ error: 'Target user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log the impersonation for audit purposes
    console.log(`Admin ${adminUser.email} (${adminUser.id}) is logging in as ${targetUser.email} (${targetUser.id})`)

    // Generate a magic link and extract the token components
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.email!,
    })

    if (linkError || !linkData) {
      console.error('Failed to generate login link:', linkError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate login session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // The linkData contains hashed_token and verification_type
    // We can use these to verify the OTP and create a session
    const { hashed_token, verification_type } = linkData.properties
    
    // Use verifyOtp with token_hash to create a session
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: hashed_token,
      type: verification_type as any,
    })

    if (sessionError || !sessionData.session) {
      console.error('Failed to create session:', sessionError)
      return new Response(
        JSON.stringify({ error: 'Failed to create login session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Return the session tokens for the frontend to set
    return new Response(
      JSON.stringify({ 
        success: true, 
        session: {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
        },
        user: {
          email: targetUser.email,
          id: targetUser.id,
        },
        message: `Logged in as ${targetUser.email}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in admin-login-as-user function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
