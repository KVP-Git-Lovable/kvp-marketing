import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteRequest {
  distributorUserId: string;
  distributorName: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
    );

    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Invalid token:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token or unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check permission via profile_object_permissions
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
      console.error('User does not have distributor portal permission');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - You do not have permission for distributor portal' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { distributorUserId, distributorName }: InviteRequest = await req.json();

    if (!distributorUserId) {
      return new Response(
        JSON.stringify({ error: 'distributorUserId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the distributor user details
    const { data: distributorUser, error: fetchError } = await supabaseAdmin
      .from('distributor_users')
      .select('*')
      .eq('id', distributorUserId)
      .single();

    if (fetchError || !distributorUser) {
      console.error('Failed to fetch distributor user:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Distributor user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a random temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '!';

    // Check if auth user already exists (either linked or by email)
    let authUserId = distributorUser.auth_user_id;
    
    // If no auth_user_id linked, check if a user with this email already exists
    if (!authUserId) {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === distributorUser.email);
      if (existingUser) {
        authUserId = existingUser.id;
        console.log('Found existing auth user by email:', authUserId);
      }
    }
    
    if (!authUserId) {
      // Create new auth user for the distributor portal user
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: distributorUser.email,
        password: tempPassword,
        user_metadata: {
          full_name: distributorUser.full_name,
          distributor_user_id: distributorUserId,
          is_distributor_portal_user: true,
        },
        email_confirm: true
      });

      if (authError) {
        console.error('Auth creation error:', authError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create auth user', 
            details: authError.message 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      authUserId = authUser.user?.id;

      // Update distributor_users with auth_user_id
      await supabaseAdmin
        .from('distributor_users')
        .update({ 
          auth_user_id: authUserId,
          user_status: 'initiated',
          email_sent_at: new Date().toISOString(),
          is_active: true,
          approved_at: new Date().toISOString(),
          approved_by: user.id
        })
        .eq('id', distributorUserId);
    } else {
      // User already exists, reset their password and update metadata
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        authUserId,
        { 
          password: tempPassword,
          user_metadata: {
            full_name: distributorUser.full_name,
            distributor_user_id: distributorUserId,
            is_distributor_portal_user: true,
          }
        }
      );

      if (updateError) {
        console.error('Password reset error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to reset password', details: updateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update distributor_users with auth_user_id and status
      await supabaseAdmin
        .from('distributor_users')
        .update({ 
          auth_user_id: authUserId,
          email_sent_at: new Date().toISOString(),
          user_status: 'initiated',
          is_active: true,
          approved_at: distributorUser.approved_at || new Date().toISOString(),
          approved_by: distributorUser.approved_by || user.id
        })
        .eq('id', distributorUserId);
    }

    // Send email with login credentials
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Email service not configured',
          tempPassword // Return temp password for manual sharing if email fails
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(resendApiKey);
    const portalUrl = `${req.headers.get('origin')}/distributor-portal/login`;

    const emailResponse = await resend.emails.send({
      from: "Distributor Portal <onboarding@resend.dev>",
      to: [distributorUser.email],
      subject: `Welcome to ${distributorName} - Distributor Portal Access`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Welcome to the Distributor Portal!</h1>
          <p>Hello ${distributorUser.full_name},</p>
          <p>You have been granted access to the <strong>${distributorName}</strong> distributor portal.</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Your Login Credentials:</h3>
            <p><strong>Email:</strong> ${distributorUser.email}</p>
            <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          </div>
          
          <p style="color: #e74c3c;"><strong>Important:</strong> Please change your password after your first login for security.</p>
          
          <p>
            <a href="${portalUrl}" 
               style="display: inline-block; background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Login to Portal
            </a>
          </p>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            If you have any questions, please contact your administrator.
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invitation email sent successfully',
        authUserId 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error sending invitation:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send invitation' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
