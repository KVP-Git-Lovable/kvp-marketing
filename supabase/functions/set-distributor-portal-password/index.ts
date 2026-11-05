import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check admin permission via profile_object_permissions
    const { data: profileData } = await supabaseAdmin
      .from('user_profiles')
      .select('profile_id')
      .eq('user_id', user.id)
      .single();

    let hasPermission = false;
    if (profileData?.profile_id) {
      const { data: perms } = await supabaseAdmin
        .from('profile_object_permissions')
        .select('can_create')
        .eq('profile_id', profileData.profile_id)
        .eq('object_name', 'admin_distributor_portal')
        .eq('can_create', true)
        .limit(1);
      hasPermission = (perms && perms.length > 0) || false;
    }

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { distributorUserId, password } = await req.json();

    if (!distributorUserId || !password) {
      return new Response(JSON.stringify({ error: 'distributorUserId and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get distributor user
    const { data: distributorUser, error: fetchError } = await supabaseAdmin
      .from('distributor_users')
      .select('*')
      .eq('id', distributorUserId)
      .single();

    if (fetchError || !distributorUser) {
      return new Response(JSON.stringify({ error: 'Distributor user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let authUserId = distributorUser.auth_user_id;

    if (!authUserId) {
      // Try to create a new auth user first
      const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: distributorUser.email,
        password,
        user_metadata: {
          full_name: distributorUser.full_name,
          distributor_user_id: distributorUserId,
          is_distributor_portal_user: true,
        },
        email_confirm: true,
      });

      if (createError) {
        // If user already exists, find by querying auth.users via raw SQL through the DB
        if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
          // Query auth.users directly via service role to find the user by email
          const { data: existingUserRow, error: queryError } = await supabaseAdmin
            .rpc('get_auth_user_id_by_email', { lookup_email: distributorUser.email });

          if (queryError || !existingUserRow) {
            // Fallback: try to use listUsers with per_page=1 filter workaround
            // Since listUsers may fail due to NULL tokens, catch gracefully
            return new Response(JSON.stringify({ 
              error: 'User with this email already exists in auth but could not be linked. Please use the Set Password button on the user card instead.',
              details: queryError?.message || 'Could not find existing auth user'
            }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          authUserId = existingUserRow;

          // Update existing user's password
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
            password,
            user_metadata: {
              full_name: distributorUser.full_name,
              distributor_user_id: distributorUserId,
              is_distributor_portal_user: true,
            },
          });

          if (updateError) {
            return new Response(JSON.stringify({ error: 'Failed to update password', details: updateError.message }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        } else {
          return new Response(JSON.stringify({ error: 'Failed to create auth user', details: createError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } else {
        authUserId = authUser.user?.id;
      }
    } else {
      // Update existing user's password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password,
        user_metadata: {
          full_name: distributorUser.full_name,
          distributor_user_id: distributorUserId,
          is_distributor_portal_user: true,
        },
      });

      if (updateError) {
        return new Response(JSON.stringify({ error: 'Failed to update password', details: updateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Update distributor_users record
    await supabaseAdmin
      .from('distributor_users')
      .update({
        auth_user_id: authUserId,
        user_status: 'initiated',
        is_active: true,
        approved_at: distributorUser.approved_at || new Date().toISOString(),
        approved_by: distributorUser.approved_by || user.id,
      })
      .eq('id', distributorUserId);

    return new Response(JSON.stringify({ success: true, authUserId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Error setting password:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to set password' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
