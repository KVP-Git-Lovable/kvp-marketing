import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Read policy config from DB
    const { data: policy, error: policyError } = await supabase
      .from('auto_end_day_policy')
      .select('*')
      .limit(1)
      .single()

    if (policyError || !policy) {
      console.log('⚠️ No auto_end_day_policy found, skipping.')
      return new Response(JSON.stringify({ success: false, message: 'No policy configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!policy.is_enabled) {
      console.log('⏸️ Auto End Day is disabled.')
      return new Response(JSON.stringify({ success: true, message: 'Policy disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Step 2: Calculate current time in configured timezone
    const now = new Date()
    const tzNow = new Date(now.toLocaleString('en-US', { timeZone: policy.timezone }))
    const currentHours = tzNow.getHours()
    const currentMinutes = tzNow.getMinutes()
    const currentTimeMinutes = currentHours * 60 + currentMinutes

    const [closeH, closeM] = (policy.auto_close_time as string).split(':').map(Number)
    const closeTimeMinutes = closeH * 60 + closeM

    // Use exact pre_warning_time if available, otherwise fall back to minutes_before
    let warningTimeMinutes: number
    if (policy.pre_warning_time) {
      const [warnH, warnM] = (policy.pre_warning_time as string).split(':').map(Number)
      warningTimeMinutes = warnH * 60 + warnM
    } else {
      warningTimeMinutes = closeTimeMinutes - (policy.pre_warning_minutes_before || 60)
    }

    // Determine if this run is for warning or auto-close (±15 min window)
    const isWarningWindow = policy.pre_warning_enabled &&
      Math.abs(currentTimeMinutes - warningTimeMinutes) <= 15
    const isCloseWindow = Math.abs(currentTimeMinutes - closeTimeMinutes) <= 15

    if (!isWarningWindow && !isCloseWindow) {
      console.log(`⏳ Not time yet. Current: ${currentHours}:${currentMinutes}, Close: ${closeH}:${closeM}`)
      return new Response(JSON.stringify({ success: true, message: 'Not time yet', current: `${currentHours}:${currentMinutes}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const dateStr = `${tzNow.getFullYear()}-${String(tzNow.getMonth() + 1).padStart(2, '0')}-${String(tzNow.getDate()).padStart(2, '0')}`
    console.log(`📅 Processing for date: ${dateStr}, mode: ${isCloseWindow ? 'CLOSE' : 'WARNING'}`)

    // Step 3: Find open attendance records
    const { data: openAttendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('id, user_id, check_in_time, date')
      .eq('date', dateStr)
      .not('check_in_time', 'is', null)
      .is('check_out_time', null)
      .neq('status', 'leave')

    if (attendanceError) throw attendanceError

    if (!openAttendance || openAttendance.length === 0) {
      console.log('✅ No open attendance records.')
      return new Response(JSON.stringify({ success: true, message: 'No open records', date: dateStr, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // WARNING MODE: send notifications to the users themselves
    if (isWarningWindow && !isCloseWindow) {
      console.log(`⚠️ Sending pre-warning to ${openAttendance.length} users`)
      for (const record of openAttendance) {
        try {
          // Fetch user name for personalized notification
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', record.user_id)
            .single()

          await supabase.rpc('emit_notification_event', {
            p_event_code: 'AUTO_DAY_WARNING',
            p_source_table: 'attendance',
            p_record_id: record.id,
            p_actor_user_id: record.user_id,
            p_metadata: {
              user_name: profile?.full_name || 'User',
              record_name: 'Attendance',
              date: dateStr,
              auto_close_time: policy.auto_close_time,
              minutes_remaining: String(policy.pre_warning_minutes_before)
            }
          })
        } catch (e) {
          console.error(`Warning notification failed for ${record.user_id}:`, e.message)
        }
      }
      return new Response(JSON.stringify({ success: true, mode: 'warning', warned: openAttendance.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // CLOSE MODE: auto-close attendance
    console.log(`🌙 Auto-closing ${openAttendance.length} records`)
    const processedUsers: string[] = []
    const errors: string[] = []

    for (const record of openAttendance) {
      try {
        const userId = record.user_id
        const lastActivityTime = await findLastActivityTime(
          supabase, userId, dateStr, record.check_in_time, policy.last_activity_source
        )

        // Calculate total_hours
        const checkInDate = new Date(record.check_in_time)
        const checkOutDate = new Date(lastActivityTime)
        const totalHours = Math.round(((checkOutDate.getTime() - checkInDate.getTime()) / 3600000) * 100) / 100

        // Update attendance with total_hours
        const { error: updateError } = await supabase
          .from('attendance')
          .update({
            check_out_time: lastActivityTime,
            total_hours: totalHours,
            check_out_address: 'Auto-closed by system',
            notes: `Auto-closed. Last activity: ${lastActivityTime}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', record.id)

        if (updateError) {
          errors.push(`${userId}: ${updateError.message}`)
          continue
        }

        // Close in-progress visits
        if (policy.close_in_progress_visits) {
          const { data: inProgressVisits } = await supabase
            .from('visits')
            .select('id, updated_at')
            .eq('user_id', userId)
            .eq('planned_date', dateStr)
            .eq('status', 'in-progress')

          if (inProgressVisits?.length) {
            for (const visit of inProgressVisits) {
              await supabase
                .from('visits')
                .update({
                  check_out_time: visit.updated_at || lastActivityTime,
                  status: policy.mark_unproductive ? 'unproductive' : 'completed',
                  no_order_reason: 'Auto-closed by system',
                  updated_at: new Date().toISOString()
                })
                .eq('id', visit.id)
            }
          }
        }

        // Cancel planned visits
        if (policy.cancel_planned_visits) {
          await supabase
            .from('visits')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('planned_date', dateStr)
            .eq('status', 'planned')
        }

        // Close retailer visit logs
        const { data: activeLogs } = await supabase
          .from('retailer_visit_logs')
          .select('id, start_time, updated_at')
          .eq('user_id', userId)
          .eq('visit_date', dateStr)
          .is('end_time', null)

        if (activeLogs?.length) {
          for (const log of activeLogs) {
            const endTime = log.updated_at || lastActivityTime
            const timeSpent = Math.max(0, Math.floor((new Date(endTime).getTime() - new Date(log.start_time).getTime()) / 1000))
            await supabase
              .from('retailer_visit_logs')
              .update({ end_time: endTime, time_spent_seconds: timeSpent })
              .eq('id', log.id)
          }
        }

        // Fetch user name for close notification
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .single()

        // Emit close notification
        await supabase.rpc('emit_notification_event', {
          p_event_code: 'AUTO_DAY_CLOSED',
          p_source_table: 'attendance',
          p_record_id: record.id,
          p_actor_user_id: userId,
          p_metadata: {
            user_name: profile?.full_name || 'User',
            record_name: 'Attendance',
            date: dateStr,
            last_activity: lastActivityTime
          }
        })

        processedUsers.push(userId)
      } catch (e) {
        errors.push(`${record.user_id}: ${e.message}`)
      }
    }

    // Refresh summaries
    try {
      await supabase.rpc('refresh_daily_admin_summary', { p_date: dateStr })
      for (const userId of processedUsers) {
        const [y, m] = dateStr.split('-')
        await supabase.rpc('refresh_user_monthly_summary', { p_user_id: userId, p_year: parseInt(y), p_month: parseInt(m) })
      }
    } catch (e) {
      console.error('Summary refresh failed (non-fatal):', e.message)
    }

    const summary = { success: true, date: dateStr, totalOpen: openAttendance.length, processed: processedUsers.length, errors: errors.length, errorDetails: errors }
    console.log('🌙 Auto End Day completed:', summary)

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Auto End Day Error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    })
  }
})

async function findLastActivityTime(
  supabase: any, userId: string, dateStr: string, checkInTime: string, source: string
): Promise<string> {
  const activities: Date[] = []

  if (source === 'all_activity' || source === 'last_order_only') {
    const { data: orders } = await supabase
      .from('orders')
      .select('created_at')
      .eq('user_id', userId)
      .eq('order_date', dateStr)
      .order('created_at', { ascending: false })
      .limit(1)
    if (orders?.[0]) activities.push(new Date(orders[0].created_at))
  }

  if (source === 'all_activity') {
    const { data: visits } = await supabase
      .from('visits')
      .select('updated_at, check_out_time')
      .eq('user_id', userId)
      .eq('planned_date', dateStr)
      .order('updated_at', { ascending: false })
      .limit(1)
    if (visits?.[0]) {
      const t = visits[0].check_out_time || visits[0].updated_at
      if (t) activities.push(new Date(t))
    }

    const { data: logs } = await supabase
      .from('retailer_visit_logs')
      .select('updated_at, end_time')
      .eq('user_id', userId)
      .eq('visit_date', dateStr)
      .order('updated_at', { ascending: false })
      .limit(1)
    if (logs?.[0]) {
      const t = logs[0].end_time || logs[0].updated_at
      if (t) activities.push(new Date(t))
    }
  }

  if (source === 'all_activity' || source === 'last_click') {
    const { data: pageViews } = await supabase
      .from('user_page_views')
      .select('visited_at')
      .eq('user_id', userId)
      .gte('visited_at', `${dateStr}T00:00:00`)
      .lte('visited_at', `${dateStr}T23:59:59`)
      .order('visited_at', { ascending: false })
      .limit(1)
    if (pageViews?.[0]) activities.push(new Date(pageViews[0].visited_at))

    const { data: sessions } = await supabase
      .from('user_sessions')
      .select('logout_at, created_at')
      .eq('user_id', userId)
      .gte('created_at', `${dateStr}T00:00:00`)
      .lte('created_at', `${dateStr}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(1)
    if (sessions?.[0]) {
      const t = sessions[0].logout_at || sessions[0].created_at
      if (t) activities.push(new Date(t))
    }
  }

  if (activities.length === 0) return checkInTime
  return new Date(Math.max(...activities.map(d => d.getTime()))).toISOString()
}
