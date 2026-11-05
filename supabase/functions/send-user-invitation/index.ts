import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

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

    // Verify admin role
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Invalid token')
    }

    // Check permission via profile_object_permissions
    const { data: profileData } = await supabaseAdmin
      .from('user_profiles')
      .select('profile_id')
      .eq('user_id', user.id)
      .single()

    let hasPermission = false
    if (profileData?.profile_id) {
      const { data: perms } = await supabaseAdmin
        .from('profile_object_permissions')
        .select('can_create')
        .eq('profile_id', profileData.profile_id)
        .eq('object_name', 'admin_user_create')
        .eq('can_create', true)
        .limit(1)
      hasPermission = (perms && perms.length > 0) || false
    }

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'You do not have permission to send invitations' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const {
      email,
      full_name,
      phone_number,
      manager_id
    } = await req.json()

    console.log('Sending invitation to:', email)

    // Generate invitation token
    const invitationToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Create invitation record
    const { error: inviteError } = await supabaseAdmin
      .from('user_invitations')
      .insert({
        email,
        full_name,
        phone_number,
        manager_id,
        invitation_token: invitationToken,
        expires_at: expiresAt.toISOString(),
        created_by: user.id
      })

    if (inviteError) {
      console.error('Invitation creation error:', inviteError)
      throw inviteError
    }

    // Send invitation email
    const invitationUrl = `${Deno.env.get('SUPABASE_URL')?.replace('https://', 'https://').replace('.supabase.co', '')}/auth/complete-profile?token=${invitationToken}`

    const emailResponse = await resend.emails.send({
      from: 'HR Team <onboarding@resend.dev>',
      to: [email],
      subject: 'Complete Your Profile Setup',
      html: `
        <h1>Welcome to Our Team, ${full_name}!</h1>
        <p>You have been invited to join our organization. Please complete your profile setup by clicking the link below:</p>
        <p><a href="${invitationUrl}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Complete Profile Setup</a></p>
        <p>This invitation will expire in 7 days.</p>
        <p>If you have any questions, please contact your manager or HR team.</p>
        <p>Best regards,<br>HR Team</p>
      `,
    })

    console.log('Email sent successfully:', emailResponse)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invitation sent successfully',
        invitation_token: invitationToken
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error sending invitation:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send invitation' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})