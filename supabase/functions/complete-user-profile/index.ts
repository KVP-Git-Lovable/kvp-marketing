import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
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

    const {
      invitation_token,
      username,
      password,
      monthly_salary,
      daily_da_allowance,
      hq,
      date_of_joining,
      date_of_exit,
      alternate_email,
      address,
      education,
      emergency_contact_number,
      hint_question,
      hint_answer
    } = await req.json()

    console.log('Completing profile for token:', invitation_token)

    // Verify invitation token
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('user_invitations')
      .select('*')
      .eq('invitation_token', invitation_token)
      .eq('status', 'pending')
      .single()

    if (inviteError || !invitation) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired invitation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Invitation has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: invitation.email,
      password,
      user_metadata: {
        username,
        full_name: invitation.full_name,
        phone_number: invitation.phone_number,
        hint_question,
        hint_answer
      },
      email_confirm: true
    })

    if (authError) {
      console.error('Auth creation error:', authError)
      throw authError
    }

    if (!authUser.user) {
      throw new Error('User creation failed')
    }

    console.log('Auth user created:', authUser.user.id)

    // Update profile with invitation token and pending status
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        invitation_token,
        user_status: 'pending_approval'
      })
      .eq('id', authUser.user.id)

    if (profileError) {
      console.error('Profile update error:', profileError)
      throw profileError
    }

    // Create employee record
    const { error: employeeError } = await supabaseAdmin
      .from('employees')
      .insert({
        user_id: authUser.user.id,
        monthly_salary: monthly_salary || 0,
        daily_da_allowance: daily_da_allowance || 0,
        manager_id: invitation.manager_id,
        hq: hq || null,
        date_of_joining: date_of_joining || null,
        date_of_exit: date_of_exit || null,
        alternate_email: alternate_email || null,
        address: address || null,
        education: education || null,
        emergency_contact_number: emergency_contact_number || null
      })

    if (employeeError) {
      console.error('Employee creation error:', employeeError)
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      throw employeeError
    }

    // Create approval workflow
    const { error: workflowError } = await supabaseAdmin
      .rpc('create_approval_workflow', { user_id_param: authUser.user.id })

    if (workflowError) {
      console.error('Approval workflow error:', workflowError)
    }

    // Mark invitation as completed
    const { error: completeError } = await supabaseAdmin
      .from('user_invitations')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', invitation.id)

    if (completeError) {
      console.error('Invitation completion error:', completeError)
    }

    // Send notifications to manager and approvers
    if (invitation.manager_id) {
      await supabaseAdmin.rpc('send_notification', {
        user_id_param: invitation.manager_id,
        title_param: 'New Profile Completion',
        message_param: `${invitation.full_name} has completed their profile and is pending approval.`,
        type_param: 'approval_request'
      })
    }

    console.log('Profile completion successful')

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Profile completed successfully. Your account is now pending approval.',
        user: {
          id: authUser.user.id,
          email: authUser.user.email,
          username,
          full_name: invitation.full_name
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error completing profile:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to complete profile' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})