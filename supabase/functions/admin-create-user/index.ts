import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Initialize admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the requesting user's JWT manually (since verify_jwt = false)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create anon client with user's token and validate
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user: callerUser }, error: callerError } = await supabaseUser.auth.getUser();
    
    if (callerError || !callerUser) {
      console.error('Invalid token:', callerError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminUserId = callerUser.id;
    console.log('User authenticated:', adminUserId);

    // Check if user has admin_user_create permission via profile_object_permissions
    const { data: profileData } = await supabaseAdmin
      .from('user_profiles')
      .select('profile_id')
      .eq('user_id', adminUserId)
      .single();

    let hasPermission = false;
    if (profileData?.profile_id) {
      const { data: perms } = await supabaseAdmin
        .from('profile_object_permissions')
        .select('can_create')
        .eq('profile_id', profileData.profile_id)
        .eq('object_name', 'admin_user_create')
        .eq('can_create', true)
        .limit(1);
      hasPermission = (perms && perms.length > 0) || false;
    }

    if (!hasPermission) {
      console.error('User does not have admin_user_create permission');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - You do not have permission to create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin verified');

    // Parse request body
    const {
      email,
      password,
      username,
      full_name,
      phone_number,
      recovery_email,
      hint_question,
      hint_answer,
      monthly_salary,
      daily_da_allowance,
      manager_id,
      secondary_manager_id,
      security_profile_id,
      hq,
      date_of_joining,
      date_of_exit,
      alternate_email,
      address,
      education,
      emergency_contact_number,
      band,
      is_temporary_password
    } = await req.json();

    console.log('Creating user with email:', email);

    // Validate required fields
    if (!email || !password || !username || !full_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, username, and full_name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and parse band if provided
    let parsedBand: number | null = null;
    if (band !== undefined && band !== null && band !== '') {
      const bandNum = parseInt(band, 10);
      if (isNaN(bandNum)) {
        return new Response(
          JSON.stringify({ error: 'Invalid band value', details: 'Band must be a number' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (bandNum < 1 || bandNum > 10) {
        return new Response(
          JSON.stringify({ error: 'Invalid band value', details: 'Band must be between 1 and 10' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      parsedBand = bandNum;
    }

    // Build sanitized user metadata - ONLY include non-empty values
    // This prevents empty strings from triggering DB CHECK constraints
    const userMetadata: Record<string, string> = {
      username,
      full_name,
    };
    if (phone_number?.trim()) userMetadata.phone_number = phone_number.trim();
    if (recovery_email?.trim()) userMetadata.recovery_email = recovery_email.trim();
    if (hint_question?.trim()) userMetadata.hint_question = hint_question.trim();
    if (hint_answer?.trim()) userMetadata.hint_answer = hint_answer.trim();

    // Check if username already exists in profiles
    const { data: usernameProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    // Check if user already exists by email (using profiles table to avoid auth.admin.listUsers bug)
    // In this app, username field in profiles stores the email
    const { data: emailProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .eq('username', email.toLowerCase())
      .maybeSingle();

    const existingUser = emailProfile ? { id: emailProfile.id, email: emailProfile.username } : null;
    
    // If username exists for a DIFFERENT user, reject
    if (usernameProfile && (!existingUser || usernameProfile.id !== existingUser.id)) {
      return new Response(
        JSON.stringify({ error: 'Username already taken', details: `The username "${username}" is already in use by another user.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let authUserId: string;
    
    if (existingUser) {
      console.log('User already exists, updating:', existingUser.id);
      
      // Update existing user's password and metadata
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        user_metadata: userMetadata
      });
      
      if (updateError) {
        console.error('User update error:', updateError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update existing user', 
            details: updateError.message 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      authUserId = existingUser.id;
      
      // Check if employee record already exists
      const { data: existingEmployee } = await supabaseAdmin
        .from('employees')
        .select('id')
        .eq('user_id', existingUser.id)
        .single();
      
      if (existingEmployee) {
        console.log('Employee record already exists, updating');
        const { error: empUpdateError } = await supabaseAdmin
          .from('employees')
          .update({
            monthly_salary: monthly_salary ? parseFloat(monthly_salary) : 0,
            daily_da_allowance: daily_da_allowance ? parseFloat(daily_da_allowance) : 0,
            manager_id: manager_id || null,
            secondary_manager_id: secondary_manager_id || null,
            hq: hq || null,
            date_of_joining: date_of_joining || null,
            date_of_exit: date_of_exit || null,
            alternate_email: alternate_email || null,
            address: address || null,
            education: education || null,
            emergency_contact_number: emergency_contact_number || null,
            band: parsedBand
          })
          .eq('user_id', existingUser.id);
        
        if (empUpdateError) {
          console.error('Employee update error:', empUpdateError);
        }
        
        // Update must_change_password flag if using temporary password
        if (is_temporary_password) {
          const { error: profileUpdateError } = await supabaseAdmin
            .from('profiles')
            .update({ must_change_password: true })
            .eq('id', existingUser.id);
          
          if (profileUpdateError) {
            console.error('Profile update error:', profileUpdateError);
          }
        }

        // Update security profile if provided
        if (security_profile_id) {
          const { error: profileAssignError } = await supabaseAdmin
            .from('user_profiles')
            .upsert({
              user_id: existingUser.id,
              profile_id: security_profile_id
            }, { onConflict: 'user_id' });
          
          if (profileAssignError) {
            console.error('Security profile assignment error:', profileAssignError);
          }
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'User updated successfully',
            user: {
              id: existingUser.id,
              email: existingUser.email,
              username,
              full_name
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Create new auth user using raw REST API to avoid the broken listUsers/createUser internal check
      const createResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
        },
        body: JSON.stringify({
          email,
          password,
          user_metadata: userMetadata,
          email_confirm: true,
        }),
      });

      const createResult = await createResponse.json();

      if (!createResponse.ok) {
        console.error('Auth creation error:', createResult);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create user account', 
            details: createResult.msg || createResult.message || JSON.stringify(createResult)
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!createResult.id) {
        console.error('User creation returned no user id');
        return new Response(
          JSON.stringify({ error: 'User creation failed - no user returned' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      authUserId = createResult.id;
    }

    console.log('Auth user created/updated:', authUserId);

    // Create employee record for new user
    const { error: employeeError } = await supabaseAdmin
      .from('employees')
      .insert({
        user_id: authUserId,
        monthly_salary: monthly_salary ? parseFloat(monthly_salary) : 0,
        daily_da_allowance: daily_da_allowance ? parseFloat(daily_da_allowance) : 0,
        manager_id: manager_id || null,
        secondary_manager_id: secondary_manager_id || null,
        hq: hq || null,
        date_of_joining: date_of_joining || null,
        date_of_exit: date_of_exit || null,
        alternate_email: alternate_email || null,
        address: address || null,
        education: education || null,
        emergency_contact_number: emergency_contact_number || null,
        band: parsedBand
      });

    if (employeeError) {
      console.error('Employee creation error:', employeeError);
      // Clean up auth user if employee creation fails (only for new users)
      if (!existingUser) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create employee record', 
          details: employeeError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Employee record created successfully');

    // Set must_change_password flag if using temporary password
    if (is_temporary_password) {
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ must_change_password: true })
        .eq('id', authUserId);
      
      if (profileUpdateError) {
        console.error('Profile update error for must_change_password:', profileUpdateError);
      }
    }

    // Assign default 'user' role (ignore conflict if exists)
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: authUserId,
        role: 'user'
      }, { onConflict: 'user_id,role', ignoreDuplicates: true });

    if (roleInsertError) {
      console.error('Role assignment error:', roleInsertError);
      // Non-blocking - continue even if role assignment fails
    } else {
      console.log('User role assigned successfully');
    }

    // Assign security profile if provided
    if (security_profile_id) {
      const { error: profileAssignError } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
          user_id: authUserId,
          profile_id: security_profile_id
        }, { onConflict: 'user_id' });
      
      if (profileAssignError) {
        console.error('Security profile assignment error:', profileAssignError);
        // Non-blocking - continue even if profile assignment fails
      } else {
        console.log('Security profile assigned successfully');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: authUserId,
          email,
          username,
          full_name
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error creating user:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message || 'Failed to create user' : 'Failed to create user'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
