import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface InsightData {
  user_id: string;
  insight_type: 'alert' | 'opportunity' | 'recommendation' | 'kudos';
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action_type?: string;
  action_data?: Record<string, unknown>;
  reference_type?: string;
  reference_id?: string;
  expires_at?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { userId, mode = 'generate' } = await req.json();

    // Mode: 'generate' = create new insights, 'fetch' = get existing insights
    if (mode === 'fetch') {
      return await fetchInsights(supabase, userId);
    }

    // Generate insights for the user
    const insights = await generateInsightsForUser(supabase, userId);
    
    // Store insights in the database
    if (insights.length > 0) {
      const { error } = await supabase.from('ai_insights').insert(insights);
      if (error) {
        console.error('Error storing insights:', error);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      insights_generated: insights.length,
      insights 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('AI Insights Engine error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function fetchInsights(supabase: any, userId: string) {
  const { data: insights, error } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('user_id', userId)
    .eq('is_dismissed', false)
    .or('expires_at.is.null,expires_at.gt.now()')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;

  return new Response(JSON.stringify({ insights: insights || [] }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function generateInsightsForUser(supabase: any, userId: string): Promise<InsightData[]> {
  const insights: InsightData[] = [];
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Check if user is a manager
  const { data: teamMembers } = await supabase
    .from('employees')
    .select('user_id')
    .eq('manager_id', userId);

  const isManager = teamMembers && teamMembers.length > 0;
  const teamUserIds = isManager ? teamMembers.map((t: any) => t.user_id) : [userId];

  // 1. Check for attendance issues (manager: team members not checked in)
  if (isManager) {
    const currentHour = new Date().getHours();
    if (currentHour >= 10) { // After 10 AM
      const { data: attendance } = await supabase
        .from('attendance')
        .select('user_id')
        .eq('date', today)
        .in('user_id', teamUserIds)
        .not('check_in_time', 'is', null);

      const checkedInIds = attendance?.map((a: any) => a.user_id) || [];
      const notCheckedIn = teamUserIds.filter((id: string) => !checkedInIds.includes(id));

      if (notCheckedIn.length > 0) {
        // Get names of team members not checked in
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', notCheckedIn.slice(0, 3));

        const names = profiles?.map((p: any) => p.full_name?.split(' ')[0]).join(', ') || '';
        
        insights.push({
          user_id: userId,
          insight_type: 'alert',
          category: 'attendance',
          priority: notCheckedIn.length > 2 ? 'high' : 'medium',
          title: `${notCheckedIn.length} team member${notCheckedIn.length > 1 ? 's' : ''} not checked in`,
          description: `${names}${notCheckedIn.length > 3 ? ` and ${notCheckedIn.length - 3} more` : ''} haven't checked in yet today.`,
          action_type: 'navigate',
          action_data: { route: '/attendance', filter: 'not-checked-in' },
          expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() // Expires in 12 hours
        });
      }
    }
  }

  // 2. Check for declining retailers (no orders in 30+ days)
  const { data: retailers } = await supabase
    .from('retailers')
    .select('id, shop_name, last_order_date')
    .in('user_id', teamUserIds)
    .lt('last_order_date', thirtyDaysAgo)
    .not('last_order_date', 'is', null)
    .limit(5);

  if (retailers && retailers.length > 0) {
    insights.push({
      user_id: userId,
      insight_type: 'alert',
      category: 'retailers',
      priority: retailers.length > 3 ? 'high' : 'medium',
      title: `${retailers.length} retailer${retailers.length > 1 ? 's' : ''} declining`,
      description: `${retailers[0]?.shop_name}${retailers.length > 1 ? ` and ${retailers.length - 1} more` : ''} haven't ordered in 30+ days.`,
      action_type: 'navigate',
      action_data: { route: '/retailers', filter: 'declining' },
      reference_type: 'retailer',
      reference_id: retailers[0]?.id
    });
  }

  // 3. Check today's visits progress
  const { data: todayVisits } = await supabase
    .from('visits')
    .select('id, status')
    .in('user_id', teamUserIds)
    .eq('planned_date', today);

  if (todayVisits && todayVisits.length > 0) {
    const completed = todayVisits.filter((v: any) => v.status === 'productive' || v.status === 'unproductive').length;
    const total = todayVisits.length;
    const completionRate = Math.round((completed / total) * 100);

    if (completionRate >= 80) {
      insights.push({
        user_id: userId,
        insight_type: 'kudos',
        category: 'visits',
        priority: 'low',
        title: `Great progress! ${completionRate}% visits completed`,
        description: `${completed} of ${total} planned visits are done. Keep up the momentum!`,
        action_type: 'navigate',
        action_data: { route: '/visits' },
        expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
      });
    } else if (completionRate < 50 && new Date().getHours() >= 14) {
      insights.push({
        user_id: userId,
        insight_type: 'alert',
        category: 'visits',
        priority: 'high',
        title: `Only ${completionRate}% visits completed`,
        description: `${total - completed} visits remaining today. Time to pick up the pace!`,
        action_type: 'navigate',
        action_data: { route: '/visits', filter: 'pending' },
        expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
      });
    }
  }

  // 4. Check for pending collections (overdue payments)
  const { data: overdueOrders } = await supabase
    .from('orders')
    .select('id, total_amount, retailer_id')
    .in('user_id', teamUserIds)
    .eq('payment_status', 'pending')
    .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .limit(10);

  if (overdueOrders && overdueOrders.length > 0) {
    const totalOverdue = overdueOrders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
    
    insights.push({
      user_id: userId,
      insight_type: 'alert',
      category: 'collections',
      priority: totalOverdue > 50000 ? 'critical' : 'high',
      title: `₹${(totalOverdue / 1000).toFixed(1)}K overdue collections`,
      description: `${overdueOrders.length} orders pending payment for 30+ days.`,
      action_type: 'navigate',
      action_data: { route: '/collections', filter: 'overdue' }
    });
  }

  // 5. Check for sales opportunities (high-potential retailers not visited recently)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const { data: highPotentialRetailers } = await supabase
    .from('retailers')
    .select('id, shop_name, last_order_value, last_visit_date')
    .in('user_id', teamUserIds)
    .gt('last_order_value', 10000)
    .lt('last_visit_date', sevenDaysAgo)
    .order('last_order_value', { ascending: false })
    .limit(3);

  if (highPotentialRetailers && highPotentialRetailers.length > 0) {
    const topRetailer = highPotentialRetailers[0];
    insights.push({
      user_id: userId,
      insight_type: 'opportunity',
      category: 'sales',
      priority: 'medium',
      title: `${highPotentialRetailers.length} high-value retailers need attention`,
      description: `${topRetailer.shop_name} (last order: ₹${(topRetailer.last_order_value / 1000).toFixed(1)}K) hasn't been visited in a week.`,
      action_type: 'navigate',
      action_data: { route: '/retailers', filter: 'high-potential' },
      reference_type: 'retailer',
      reference_id: topRetailer.id
    });
  }

  // 6. Monthly target progress (if targets exist)
  const currentMonth = new Date().getMonth();
  const monthStart = new Date(new Date().getFullYear(), currentMonth, 1).toISOString().split('T')[0];
  const monthEnd = new Date(new Date().getFullYear(), currentMonth + 1, 0).toISOString().split('T')[0];

  const { data: monthlyOrders } = await supabase
    .from('orders')
    .select('total_amount')
    .in('user_id', teamUserIds)
    .gte('order_date', monthStart)
    .lte('order_date', monthEnd)
    .in('status', ['confirmed', 'delivered']);

  if (monthlyOrders && monthlyOrders.length > 0) {
    const totalRevenue = monthlyOrders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
    const dayOfMonth = new Date().getDate();
    const daysInMonth = new Date(new Date().getFullYear(), currentMonth + 1, 0).getDate();
    const expectedProgress = (dayOfMonth / daysInMonth) * 100;
    
    // Assume a basic monthly target for demo
    const assumedTarget = 500000; // ₹5L
    const actualProgress = (totalRevenue / assumedTarget) * 100;

    if (actualProgress > expectedProgress + 10) {
      insights.push({
        user_id: userId,
        insight_type: 'kudos',
        category: 'targets',
        priority: 'low',
        title: `Ahead of target! ${Math.round(actualProgress)}% achieved`,
        description: `₹${(totalRevenue / 100000).toFixed(1)}L revenue this month. You're ${Math.round(actualProgress - expectedProgress)}% ahead of pace!`,
        action_type: 'navigate',
        action_data: { route: '/analytics' }
      });
    } else if (actualProgress < expectedProgress - 15) {
      insights.push({
        user_id: userId,
        insight_type: 'recommendation',
        category: 'targets',
        priority: 'high',
        title: `Target gap: ${Math.round(expectedProgress - actualProgress)}% behind`,
        description: `Need ₹${((assumedTarget - totalRevenue) / 100000).toFixed(1)}L more to hit target. Focus on high-value retailers.`,
        action_type: 'navigate',
        action_data: { route: '/analytics' }
      });
    }
  }

  return insights;
}
