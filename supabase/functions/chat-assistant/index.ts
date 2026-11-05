import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache for user context (5 min TTL)
const userContextCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// Check if user is a manager/admin
async function checkIfManager(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);
  
  return data?.some((r: any) => ['admin', 'manager', 'asm', 'rsm', 'zsm', 'nsm'].includes(r.role?.toLowerCase())) || false;
}

// Get team members for a manager from employees table
async function getTeamMembers(supabase: any, managerId: string): Promise<string[]> {
  // Get direct reports from employees table
  const { data: directReports } = await supabase
    .from('employees')
    .select('user_id')
    .eq('manager_id', managerId);
  
  // Also try the get_all_subordinates function if available
  let subordinates: string[] = [];
  try {
    const { data: allSubs } = await supabase.rpc('get_all_subordinates', { manager_user_id: managerId });
    if (allSubs && allSubs.length > 0) {
      subordinates = allSubs.map((s: any) => s.subordinate_user_id).filter((id: string) => id !== managerId);
    }
  } catch (e) {
    // Function might not exist, use direct reports only
  }
  
  // Combine both results, prefer subordinates if available
  if (subordinates.length > 0) {
    return [...new Set(subordinates)];
  }
  
  return directReports?.map((p: any) => p.user_id) || [];
}

// Enhanced user context with more data
async function getUserContext(supabase: any, userId: string) {
  const cached = userContextCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const isManager = await checkIfManager(supabase, userId);
    const teamMembers = isManager ? await getTeamMembers(supabase, userId) : [];

    // Fetch comprehensive user context in parallel
    const [
      profileResult, 
      rolesResult, 
      todayVisitsResult,
      todayBeatResult,
      pendingPaymentsResult,
      recentOrdersResult,
      territoryResult,
      teamStatsResult
    ] = await Promise.all([
      supabase.from('profiles').select('full_name, username').eq('id', userId).maybeSingle(),
      supabase.from('user_profiles').select('profile_id, security_profiles(name)').eq('user_id', userId).maybeSingle(),
      supabase.from('visits').select('id, status, retailers(name)').eq('user_id', userId)
        .gte('planned_date', today).lte('planned_date', today),
      supabase.from('beat_plans').select('beat_name, beat_data').eq('user_id', userId)
        .eq('plan_date', today).maybeSingle(),
      supabase.from('orders').select('id, retailer_id, total_amount, payment_status')
        .eq('user_id', userId).neq('payment_status', 'paid').limit(5),
      supabase.from('orders').select('id, total_amount, created_at')
        .eq('user_id', userId).gte('order_date', weekAgo).order('created_at', { ascending: false }).limit(5),
      supabase.from('user_territories').select('territory:territories(name)').eq('user_id', userId).limit(1),
      // Get team stats for managers
      isManager && teamMembers.length > 0 ? 
        supabase.from('visits').select('user_id, status').in('user_id', teamMembers).eq('planned_date', today) :
        Promise.resolve({ data: [] })
    ]);

    // Check admin via profile_object_permissions instead of profile name
    const { data: adminPerms } = await supabase
      .from('profile_object_permissions')
      .select('object_name')
      .eq('profile_id', (rolesResult as any).data?.profile_id || '')
      .like('object_name', 'admin_%')
      .eq('can_read', true)
      .limit(1);
    const isAdmin = (adminPerms && adminPerms.length > 0) || false;
    
    // Calculate business context
    const now = new Date();
    const hour = now.getHours();
    const dayOfMonth = now.getDate();
    const isMonthEnd = dayOfMonth >= 25;
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    
    let timeOfDay = 'morning';
    if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17) timeOfDay = 'evening';

    const totalPending = pendingPaymentsResult.data?.reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0) || 0;
    const recentSales = recentOrdersResult.data?.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0) || 0;

    // Calculate team stats for managers
    let teamStats = null;
    if (isManager && teamStatsResult.data) {
      const teamVisits = teamStatsResult.data;
      teamStats = {
        teamSize: teamMembers.length,
        totalVisitsToday: teamVisits.length,
        completedVisitsToday: teamVisits.filter((v: any) => v.status === 'completed').length,
        inProgressVisitsToday: teamVisits.filter((v: any) => v.status === 'in_progress').length,
        pendingVisitsToday: teamVisits.filter((v: any) => v.status === 'scheduled').length
      };
    }

    const context = {
      profile: profileResult.data || { full_name: 'User', username: 'user' },
      isAdmin,
      isManager,
      teamMembers,
      teamStats,
      userRole: isAdmin ? 'Admin' : (isManager ? 'Manager' : 'Field Sales User'),
      todayVisits: todayVisitsResult.data || [],
      todayBeat: todayBeatResult.data?.beat_name || null,
      territory: territoryResult.data?.[0]?.territory?.name || null,
      pendingCollections: {
        count: pendingPaymentsResult.data?.length || 0,
        total: totalPending,
        topRetailers: pendingPaymentsResult.data?.slice(0, 3) || []
      },
      recentPerformance: {
        orderCount: recentOrdersResult.data?.length || 0,
        totalSales: recentSales
      },
      businessContext: {
        timeOfDay,
        isMonthEnd,
        isWeekend,
        dayOfMonth
      }
    };

    userContextCache.set(userId, { data: context, timestamp: Date.now() });
    return context;
  } catch (error) {
    console.error('Error fetching user context:', error);
    return {
      profile: { full_name: 'User', username: 'user' },
      isAdmin: false,
      isManager: false,
      teamMembers: [],
      teamStats: null,
      userRole: 'Field Sales User',
      todayVisits: [],
      todayBeat: null,
      territory: null,
      pendingCollections: { count: 0, total: 0, topRetailers: [] },
      recentPerformance: { orderCount: 0, totalSales: 0 },
      businessContext: {
        timeOfDay: 'morning',
        isMonthEnd: false,
        isWeekend: false,
        dayOfMonth: new Date().getDate()
      }
    };
  }
}

// Query classification for routing
function classifyQuery(message: string): { category: string; priority: string; suggestedTools: string[]; isManagerQuery: boolean } {
  const lower = message.toLowerCase();
  
  // Manager-specific queries
  const managerPatterns = /team|staff|members|who|everyone|all users|my people|subordinates|compare|benchmark|exception|alert|anomaly|underperform|not (checked|visited|working)/i;
  const isManagerQuery = managerPatterns.test(lower);
  
  // High priority - urgent business queries
  if (/overdue|urgent|critical|immediately|asap|alert|exception|problem/i.test(lower)) {
    return { category: 'urgent', priority: 'high', suggestedTools: ['get_exception_alerts', 'get_overdue_visits', 'get_pending_collections'], isManagerQuery };
  }
  
  // Team/Manager queries
  if (/team|staff|performance|members|who|everyone/i.test(lower)) {
    return { category: 'team', priority: 'high', suggestedTools: ['get_team_performance', 'get_team_attendance'], isManagerQuery: true };
  }
  
  // Comparison queries
  if (/compare|vs|versus|better|worse|top|bottom|ranking/i.test(lower)) {
    return { category: 'comparison', priority: 'medium', suggestedTools: ['compare_team_members', 'get_team_performance'], isManagerQuery: true };
  }
  
  // Territory/Distributor queries
  if (/territory|territories|area|region|distributor|distribution/i.test(lower)) {
    return { category: 'territory', priority: 'medium', suggestedTools: ['get_territory_overview', 'get_distributor_health'], isManagerQuery };
  }
  
  // Data queries
  if (/visits?|schedule|today|beat|plan/i.test(lower)) {
    return { category: 'visits', priority: 'medium', suggestedTools: ['get_visit_summary', 'get_beat_schedule'], isManagerQuery };
  }
  if (/sales|orders?|revenue|performance/i.test(lower)) {
    return { category: 'sales', priority: 'medium', suggestedTools: ['get_sales_report'], isManagerQuery };
  }
  if (/payments?|pending|outstanding|collect|dues?/i.test(lower)) {
    return { category: 'payments', priority: 'high', suggestedTools: ['get_pending_collections'], isManagerQuery };
  }
  if (/retailers?|customers?|shops?/i.test(lower)) {
    return { category: 'retailers', priority: 'medium', suggestedTools: ['get_retailer_analytics', 'check_retailer_status'], isManagerQuery };
  }
  if (/stock|inventory|products?/i.test(lower)) {
    return { category: 'inventory', priority: 'medium', suggestedTools: ['get_inventory_status'], isManagerQuery };
  }
  if (/scheme|offer|discount|promotion/i.test(lower)) {
    return { category: 'schemes', priority: 'medium', suggestedTools: ['get_active_schemes'], isManagerQuery };
  }
  
  // Navigation queries
  if (/how (do|can|to)|where|navigate|go to|find|add|create/i.test(lower)) {
    return { category: 'navigation', priority: 'low', suggestedTools: ['get_navigation_help'], isManagerQuery: false };
  }
  
  // Analytics
  if (/compare|trend|growth|analysis|top|best|worst/i.test(lower)) {
    return { category: 'analytics', priority: 'medium', suggestedTools: ['get_performance_trends'], isManagerQuery };
  }
  
  return { category: 'general', priority: 'low', suggestedTools: [], isManagerQuery: false };
}

// Execute database queries based on tool calls
async function executeQuery(supabase: any, userId: string, toolName: string, params: any, userContext: any) {
  const today = new Date().toISOString().split('T')[0];
  const { filters = {} } = params;
  const isManager = userContext.isManager;
  const teamMembers = userContext.teamMembers || [];
  
  switch(toolName) {
    // ==================== MANAGER-SPECIFIC TOOLS ====================
    
    case 'get_team_performance': {
      if (!isManager) {
        return { error: 'This feature is only available for managers.' };
      }
      
      const period = filters.period || 'today';
      let startDate = today;
      let endDate = today;
      
      if (period === 'week') {
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      } else if (period === 'month') {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
      
      // Get team profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', teamMembers);
      
      // Get visits, orders, and attendance for all team members
      const [visitsResult, ordersResult, attendanceResult] = await Promise.all([
        supabase.from('visits')
          .select('user_id, status')
          .in('user_id', teamMembers)
          .gte('planned_date', startDate)
          .lte('planned_date', endDate),
        supabase.from('orders')
          .select('user_id, total_amount, status')
          .in('user_id', teamMembers)
          .gte('order_date', startDate)
          .lte('order_date', endDate),
        supabase.from('attendance')
          .select('user_id, status, check_in_time')
          .in('user_id', teamMembers)
          .gte('date', startDate)
          .lte('date', endDate)
      ]);
      
      // Aggregate by team member
      const teamPerformance = (profiles || []).map((p: any) => {
        const userVisits = (visitsResult.data || []).filter((v: any) => v.user_id === p.id);
        const userOrders = (ordersResult.data || []).filter((o: any) => o.user_id === p.id);
        const userAttendance = (attendanceResult.data || []).filter((a: any) => a.user_id === p.id);
        
        return {
          name: p.full_name || p.username,
          user_id: p.id,
          visits: {
            total: userVisits.length,
            completed: userVisits.filter((v: any) => v.status === 'completed').length,
            completion_rate: userVisits.length > 0 
              ? Math.round((userVisits.filter((v: any) => v.status === 'completed').length / userVisits.length) * 100) 
              : 0
          },
          orders: {
            count: userOrders.length,
            total_value: userOrders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0)
          },
          attendance: {
            present_days: userAttendance.filter((a: any) => a.status === 'present').length,
            late_days: userAttendance.filter((a: any) => a.check_in_time && new Date(`2000-01-01T${a.check_in_time}`).getHours() >= 10).length
          }
        };
      });
      
      // Sort by performance (orders value)
      teamPerformance.sort((a: any, b: any) => b.orders.total_value - a.orders.total_value);
      
      const totalVisits = teamPerformance.reduce((sum: number, p: any) => sum + p.visits.completed, 0);
      const totalOrders = teamPerformance.reduce((sum: number, p: any) => sum + p.orders.total_value, 0);
      
      return {
        period: `${startDate} to ${endDate}`,
        team_size: teamMembers.length,
        summary: {
          total_visits_completed: totalVisits,
          total_orders_value: totalOrders,
          avg_orders_per_person: teamMembers.length > 0 ? Math.round(totalOrders / teamMembers.length) : 0
        },
        team_members: teamPerformance
      };
    }
    
    case 'get_team_attendance': {
      if (!isManager) {
        return { error: 'This feature is only available for managers.' };
      }
      
      const targetDate = filters.date || today;
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', teamMembers);
      
      const { data: attendance } = await supabase
        .from('attendance')
        .select('user_id, status, check_in_time, check_out_time, check_in_address')
        .in('user_id', teamMembers)
        .eq('date', targetDate);
      
      const attendanceMap = new Map((attendance || []).map((a: any) => [a.user_id, a]));
      
      const teamAttendance = (profiles || []).map((p: any) => {
        const att = attendanceMap.get(p.id);
        return {
          name: p.full_name,
          user_id: p.id,
          status: att?.status || 'not_checked_in',
          check_in_time: att?.check_in_time || null,
          check_out_time: att?.check_out_time || null,
          location: att?.check_in_address || null
        };
      });
      
      const checkedIn = teamAttendance.filter((a: any) => a.status === 'present').length;
      const notCheckedIn = teamAttendance.filter((a: any) => a.status === 'not_checked_in').length;
      
      return {
        date: targetDate,
        summary: {
          checked_in: checkedIn,
          not_checked_in: notCheckedIn,
          on_leave: teamAttendance.filter((a: any) => a.status === 'leave').length,
          total: teamMembers.length
        },
        members: teamAttendance,
        alerts: notCheckedIn > 0 ? `⚠️ ${notCheckedIn} team member(s) have not checked in yet!` : null
      };
    }
    
    case 'compare_team_members': {
      if (!isManager) {
        return { error: 'This feature is only available for managers.' };
      }
      
      const { member1_name, member2_name } = params;
      const period = filters.period || 'month';
      
      let startDate = today;
      if (period === 'week') {
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      } else if (period === 'month') {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
      
      // Find team members by name
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', teamMembers);
      
      const findMember = (name: string) => {
        const lower = name?.toLowerCase() || '';
        return profiles?.find((p: any) => 
          p.full_name?.toLowerCase().includes(lower) || 
          p.username?.toLowerCase().includes(lower)
        );
      };
      
      const m1 = findMember(member1_name);
      const m2 = findMember(member2_name);
      
      if (!m1 && !m2) {
        // If no specific members, compare top 2
        const sorted = profiles || [];
        if (sorted.length < 2) return { error: 'Need at least 2 team members to compare' };
        // Will compare first 2
      }
      
      const membersToCompare = [m1, m2].filter(Boolean);
      if (membersToCompare.length < 2 && profiles && profiles.length >= 2) {
        // Add more members if needed
        for (const p of profiles) {
          if (membersToCompare.length >= 2) break;
          if (!membersToCompare.find((m: any) => m.id === p.id)) {
            membersToCompare.push(p);
          }
        }
      }
      
      // Get data for comparison
      const comparisonData = await Promise.all(membersToCompare.map(async (member: any) => {
        const [visits, orders] = await Promise.all([
          supabase.from('visits')
            .select('status')
            .eq('user_id', member.id)
            .gte('planned_date', startDate),
          supabase.from('orders')
            .select('total_amount')
            .eq('user_id', member.id)
            .gte('order_date', startDate)
        ]);
        
        const visitData = visits.data || [];
        const orderData = orders.data || [];
        
        return {
          name: member.full_name || member.username,
          visits_completed: visitData.filter((v: any) => v.status === 'completed').length,
          total_visits: visitData.length,
          visit_completion_rate: visitData.length > 0 
            ? Math.round((visitData.filter((v: any) => v.status === 'completed').length / visitData.length) * 100)
            : 0,
          orders_count: orderData.length,
          total_sales: orderData.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0)
        };
      }));
      
      return {
        period: `${startDate} to ${today}`,
        comparison: comparisonData,
        winner: comparisonData[0]?.total_sales > comparisonData[1]?.total_sales 
          ? comparisonData[0]?.name 
          : comparisonData[1]?.name
      };
    }
    
    case 'get_exception_alerts': {
      const alerts: any[] = [];
      const targetUsers = isManager && teamMembers.length > 0 ? teamMembers : [userId];
      
      // Check for team members not checked in (after 10 AM)
      const hour = new Date().getHours();
      if (hour >= 10 && isManager) {
        const { data: attendance } = await supabase
          .from('attendance')
          .select('user_id')
          .in('user_id', teamMembers)
          .eq('date', today);
        
        const checkedInUsers = new Set((attendance || []).map((a: any) => a.user_id));
        
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', teamMembers);
        
        const notCheckedIn = (profiles || []).filter((p: any) => !checkedInUsers.has(p.id));
        
        if (notCheckedIn.length > 0) {
          alerts.push({
            type: 'attendance',
            severity: 'high',
            message: `${notCheckedIn.length} team member(s) haven't checked in yet`,
            details: notCheckedIn.map((p: any) => p.full_name)
          });
        }
      }
      
      // Check for overdue visits
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: overdueVisits } = await supabase
        .from('visits')
        .select('id, planned_date, retailers(name), user_id')
        .in('user_id', targetUsers)
        .eq('status', 'scheduled')
        .lt('planned_date', today)
        .limit(10);
      
      if (overdueVisits && overdueVisits.length > 0) {
        alerts.push({
          type: 'overdue_visits',
          severity: 'medium',
          message: `${overdueVisits.length} overdue visit(s) need attention`,
          details: overdueVisits.map((v: any) => ({ 
            retailer: v.retailers?.name, 
            date: v.planned_date 
          }))
        });
      }
      
      // Check for high pending collections
      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('retailer_id, total_amount, retailers(name)')
        .in('user_id', targetUsers)
        .neq('payment_status', 'paid')
        .order('total_amount', { ascending: false })
        .limit(10);
      
      const totalPending = (pendingOrders || []).reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
      if (totalPending > 10000) {
        alerts.push({
          type: 'pending_collections',
          severity: totalPending > 50000 ? 'high' : 'medium',
          message: `₹${totalPending.toLocaleString('en-IN')} pending collections`,
          details: (pendingOrders || []).slice(0, 5).map((o: any) => ({
            retailer: o.retailers?.name,
            amount: o.total_amount
          }))
        });
      }
      
      // Check for retailers not visited in 14+ days
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: dormantRetailers } = await supabase
        .from('retailers')
        .select('id, name, last_visit_date')
        .in('user_id', targetUsers)
        .lt('last_visit_date', twoWeeksAgo)
        .eq('status', 'active')
        .order('last_visit_date', { ascending: true })
        .limit(10);
      
      if (dormantRetailers && dormantRetailers.length > 0) {
        alerts.push({
          type: 'dormant_retailers',
          severity: 'low',
          message: `${dormantRetailers.length} active retailer(s) not visited in 14+ days`,
          details: (dormantRetailers || []).slice(0, 5).map((r: any) => ({
            name: r.name,
            last_visit: r.last_visit_date
          }))
        });
      }
      
      return {
        total_alerts: alerts.length,
        high_priority: alerts.filter(a => a.severity === 'high').length,
        alerts: alerts.sort((a, b) => {
          const severityOrder = { high: 0, medium: 1, low: 2 };
          return (severityOrder[a.severity as keyof typeof severityOrder] || 2) - (severityOrder[b.severity as keyof typeof severityOrder] || 2);
        })
      };
    }
    
    case 'get_territory_overview': {
      if (!isManager) {
        return { error: 'This feature is only available for managers.' };
      }
      
      // Get territories for manager's team
      const { data: userTerritories } = await supabase
        .from('user_territories')
        .select('territory_id, territory:territories(id, name)')
        .in('user_id', [...teamMembers, userId]);
      
      const territoryIds = [...new Set((userTerritories || []).map((ut: any) => ut.territory_id))];
      
      // Get retailers count and sales by territory
      const { data: retailers } = await supabase
        .from('retailers')
        .select('id, territory_id, last_order_value, pending_amount, status')
        .in('territory_id', territoryIds);
      
      // Get orders for this month
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, retailers!inner(territory_id)')
        .gte('order_date', monthStart);
      
      // Aggregate by territory
      const territories = [...new Set((userTerritories || []).map((ut: any) => ut.territory))];
      const territoryData = territories.filter(Boolean).map((t: any) => {
        const territoryRetailers = (retailers || []).filter((r: any) => r.territory_id === t.id);
        const territoryOrders = (orders || []).filter((o: any) => o.retailers?.territory_id === t.id);
        
        return {
          name: t.name,
          retailers: {
            total: territoryRetailers.length,
            active: territoryRetailers.filter((r: any) => r.status === 'active').length
          },
          mtd_sales: territoryOrders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0),
          pending_collections: territoryRetailers.reduce((sum: number, r: any) => sum + (r.pending_amount || 0), 0)
        };
      });
      
      return {
        total_territories: territoryData.length,
        territories: territoryData,
        summary: {
          total_retailers: territoryData.reduce((sum, t) => sum + t.retailers.total, 0),
          total_mtd_sales: territoryData.reduce((sum, t) => sum + t.mtd_sales, 0),
          total_pending: territoryData.reduce((sum, t) => sum + t.pending_collections, 0)
        }
      };
    }
    
    case 'get_distributor_health': {
      // Get distributors and their secondary order stats
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0];
      const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0];
      
      const { data: distributors } = await supabase
        .from('distributors')
        .select('id, name, contact_person, territory_id')
        .limit(20);
      
      if (!distributors || distributors.length === 0) {
        return { message: 'No distributors found' };
      }
      
      const distributorIds = distributors.map((d: any) => d.id);
      
      // Get this month's orders
      const { data: thisMonthOrders } = await supabase
        .from('orders')
        .select('distributor_id, total_amount')
        .in('distributor_id', distributorIds)
        .gte('order_date', monthStart);
      
      // Get last month's orders
      const { data: lastMonthOrders } = await supabase
        .from('orders')
        .select('distributor_id, total_amount')
        .in('distributor_id', distributorIds)
        .gte('order_date', lastMonthStart)
        .lte('order_date', lastMonthEnd);
      
      const distributorHealth = distributors.map((d: any) => {
        const thisMonth = (thisMonthOrders || []).filter((o: any) => o.distributor_id === d.id);
        const lastMonth = (lastMonthOrders || []).filter((o: any) => o.distributor_id === d.id);
        
        const thisMonthTotal = thisMonth.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
        const lastMonthTotal = lastMonth.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
        
        const growth = lastMonthTotal > 0 
          ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100) 
          : (thisMonthTotal > 0 ? 100 : 0);
        
        return {
          name: d.name,
          contact: d.contact_person,
          mtd_orders: thisMonth.length,
          mtd_value: thisMonthTotal,
          last_month_value: lastMonthTotal,
          growth_percent: growth,
          health_status: growth >= 10 ? 'good' : (growth >= 0 ? 'stable' : 'declining')
        };
      });
      
      // Sort by MTD value
      distributorHealth.sort((a: any, b: any) => b.mtd_value - a.mtd_value);
      
      return {
        total_distributors: distributorHealth.length,
        distributors: distributorHealth,
        summary: {
          healthy: distributorHealth.filter((d: any) => d.health_status === 'good').length,
          stable: distributorHealth.filter((d: any) => d.health_status === 'stable').length,
          declining: distributorHealth.filter((d: any) => d.health_status === 'declining').length
        }
      };
    }
    
    case 'get_proactive_insights': {
      // Generate proactive insights for the user
      const insights: any[] = [];
      const targetUsers = isManager && teamMembers.length > 0 ? teamMembers : [userId];
      
      // Quick wins - retailers with high potential
      const { data: potentialRetailers } = await supabase
        .from('retailers')
        .select('name, avg_monthly_orders_3m, last_order_value')
        .in('user_id', targetUsers)
        .order('avg_monthly_orders_3m', { ascending: false })
        .limit(5);
      
      if (potentialRetailers && potentialRetailers.length > 0) {
        insights.push({
          type: 'opportunity',
          icon: '💡',
          title: 'Top Potential Retailers',
          message: `Your best performers: ${potentialRetailers.slice(0, 3).map((r: any) => r.name).join(', ')}`,
          action: 'Focus visits on these retailers for maximum impact'
        });
      }
      
      // Month-end push
      const dayOfMonth = new Date().getDate();
      if (dayOfMonth >= 25) {
        const { data: monthTarget } = await supabase
          .from('user_period_targets')
          .select('target_value, achieved_value')
          .eq('user_id', userId)
          .eq('period_type', 'month')
          .maybeSingle();
        
        if (monthTarget) {
          const gap = (monthTarget.target_value || 0) - (monthTarget.achieved_value || 0);
          if (gap > 0) {
            insights.push({
              type: 'alert',
              icon: '🎯',
              title: 'Month-End Push',
              message: `₹${gap.toLocaleString('en-IN')} to go to hit target. ${6 - (dayOfMonth - 25)} days left!`,
              action: 'Prioritize high-value retailers and collections'
            });
          }
        }
      }
      
      // Streak recognition
      const weekVisits = await supabase
        .from('visits')
        .select('planned_date')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('planned_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      
      if (weekVisits.data && weekVisits.data.length >= 25) {
        insights.push({
          type: 'kudos',
          icon: '🔥',
          title: 'Great Week!',
          message: `${weekVisits.data.length} visits completed this week. Keep up the momentum!`,
          action: null
        });
      }
      
      return {
        insights,
        generated_at: new Date().toISOString()
      };
    }
    
    // ==================== EXISTING FIELD USER TOOLS ====================
    
    case 'get_sales_report': {
      const startDate = filters.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = filters.end_date || today;
      const targetUsers = isManager && teamMembers.length > 0 ? [...teamMembers, userId] : [userId];
      
      const { data, error } = await supabase
        .from('orders')
        .select(`id, order_date, total_amount, status, retailers(name, address)`)
        .in('user_id', targetUsers)
        .gte('order_date', startDate)
        .lte('order_date', endDate)
        .order('order_date', { ascending: false });
      
      if (error) throw error;
      
      const totalSales = data?.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0) || 0;
      const confirmedOrders = data?.filter((o: any) => o.status === 'confirmed').length || 0;
      
      return {
        summary: { 
          total_sales: totalSales, 
          total_orders: data?.length || 0, 
          confirmed_orders: confirmedOrders, 
          period: `${startDate} to ${endDate}`,
          scope: isManager ? 'Team' : 'Personal'
        },
        orders: data?.slice(0, 10)
      };
    }
    
    case 'get_visit_summary': {
      const targetUsers = isManager && teamMembers.length > 0 ? [...teamMembers, userId] : [userId];
      
      const { data, error } = await supabase
        .from('visits')
        .select(`id, planned_date, status, visit_type, user_id, retailers(name, address, phone)`)
        .in('user_id', targetUsers)
        .gte('planned_date', today)
        .order('planned_date', { ascending: true });
      
      if (error) throw error;
      
      return {
        total: data?.length || 0,
        completed: data?.filter((v: any) => v.status === 'completed').length || 0,
        pending: data?.filter((v: any) => v.status === 'scheduled').length || 0,
        in_progress: data?.filter((v: any) => v.status === 'in_progress').length || 0,
        scope: isManager ? 'Team' : 'Personal',
        visits: data?.slice(0, 15)
      };
    }
    
    case 'get_overdue_visits': {
      const targetUsers = isManager && teamMembers.length > 0 ? [...teamMembers, userId] : [userId];
      
      const { data, error } = await supabase
        .from('visits')
        .select(`id, planned_date, status, retailers(name, phone)`)
        .in('user_id', targetUsers)
        .eq('status', 'scheduled')
        .lt('planned_date', today)
        .order('planned_date', { ascending: true })
        .limit(10);
      
      if (error) throw error;
      return { overdue_count: data?.length || 0, visits: data };
    }
    
    case 'get_pending_collections': {
      const targetUsers = isManager && teamMembers.length > 0 ? [...teamMembers, userId] : [userId];
      
      const { data, error } = await supabase
        .from('retailers')
        .select(`id, name, phone, address, pending_amount, last_visit_date, last_order_value`)
        .in('user_id', targetUsers)
        .gt('pending_amount', 0)
        .order('pending_amount', { ascending: false })
        .limit(15);
      
      if (error) throw error;
      
      const totalPending = data?.reduce((sum: number, r: any) => sum + (r.pending_amount || 0), 0) || 0;
      return {
        total_pending: totalPending,
        retailer_count: data?.length || 0,
        scope: isManager ? 'Team' : 'Personal',
        retailers: data
      };
    }
    
    case 'get_retailer_analytics': {
      const { data, error } = await supabase
        .from('retailers')
        .select(`id, name, address, last_visit_date, last_order_value, avg_monthly_orders_3m, order_value, pending_amount`)
        .eq('user_id', userId)
        .order('last_order_value', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return { retailers: data };
    }
    
    case 'check_retailer_status': {
      const { retailer_name } = params;
      const { data, error } = await supabase
        .from('retailers')
        .select(`id, name, phone, address, last_visit_date, last_order_value, pending_amount, avg_monthly_orders_3m`)
        .ilike('name', `%${retailer_name}%`)
        .limit(5);
      
      if (error) throw error;
      return { found: data?.length || 0, retailers: data };
    }
    
    case 'get_inventory_status': {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, stock_quantity, unit, price')
        .order('stock_quantity', { ascending: true })
        .limit(20);
      
      if (error) throw error;
      
      const lowStock = data?.filter((p: any) => p.stock_quantity < 10) || [];
      return { 
        total_products: data?.length || 0,
        low_stock_count: lowStock.length,
        low_stock_items: lowStock,
        all_products: data 
      };
    }
    
    case 'get_active_schemes': {
      const { data, error } = await supabase
        .from('schemes')
        .select('id, name, description, scheme_type, min_quantity, discount_percentage, bonus_quantity, start_date, end_date')
        .eq('is_active', true)
        .gte('end_date', today)
        .order('end_date', { ascending: true })
        .limit(10);
      
      if (error) throw error;
      return { active_schemes: data?.length || 0, schemes: data };
    }
    
    case 'get_attendance': {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('attendance')
        .select('id, date, check_in_time, check_out_time, status, total_hours')
        .eq('user_id', userId)
        .gte('date', weekAgo)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return { attendance: data };
    }
    
    case 'get_beat_schedule': {
      const targetDate = filters.date || today;
      const { data, error } = await supabase
        .from('beat_plans')
        .select('id, beat_name, beat_data, plan_date')
        .eq('user_id', userId)
        .eq('plan_date', targetDate)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return { beat_plan: data };
    }
    
    case 'get_performance_trends': {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const targetUsers = isManager && teamMembers.length > 0 ? [...teamMembers, userId] : [userId];
      
      const [ordersResult, visitsResult] = await Promise.all([
        supabase.from('orders').select('order_date, total_amount')
          .in('user_id', targetUsers).gte('order_date', thirtyDaysAgo),
        supabase.from('visits').select('planned_date, status')
          .in('user_id', targetUsers).gte('planned_date', thirtyDaysAgo)
      ]);
      
      const totalSales = ordersResult.data?.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0) || 0;
      const completedVisits = visitsResult.data?.filter((v: any) => v.status === 'completed').length || 0;
      const totalVisits = visitsResult.data?.length || 0;
      
      return {
        period: '30 days',
        scope: isManager ? 'Team' : 'Personal',
        total_sales: totalSales,
        order_count: ordersResult.data?.length || 0,
        visit_completion_rate: totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0,
        completed_visits: completedVisits,
        total_visits: totalVisits
      };
    }
    
    case 'get_navigation_help': {
      const { task } = params;
      const navigationGuides: Record<string, any> = {
        add_retailer: {
          path: '/add-retailer',
          steps: ['Go to My Retailers', 'Click + Add Retailer', 'Fill details', 'Save']
        },
        add_visit: {
          path: '/visits',
          steps: ['Go to My Visits', 'Click Plan Visit', 'Select retailers', 'Save']
        },
        add_order: {
          path: '/order-entry',
          steps: ['Start a visit', 'Click Order Entry', 'Add products', 'Submit']
        },
        view_analytics: {
          path: '/analytics',
          steps: ['Go to Analytics', 'Select report type', 'Choose date range', 'View']
        }
      };
      
      const taskLower = (task || '').toLowerCase();
      for (const [key, guide] of Object.entries(navigationGuides)) {
        if (taskLower.includes(key.replace('_', ' ')) || taskLower.includes(key.replace('_', ''))) {
          return guide;
        }
      }
      return { message: 'Available guides: add retailer, add visit, add order, view analytics' };
    }
    
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Format tool results into natural language
function formatToolResult(toolName: string, result: any): string {
  if (result.error) {
    return `\n\n⚠️ ${result.error}\n`;
  }
  
  switch (toolName) {
    case 'get_team_performance': {
      if (!result.team_members || result.team_members.length === 0) {
        return `\n\n📊 **Team Performance** (${result.period})\n\nNo team members found. Please ensure your team is configured in the system.\n`;
      }
      
      let response = `\n\n📊 **Team Performance** (${result.period})\n\n`;
      response += `**Summary:**\n`;
      response += `- 👥 Team Size: ${result.team_size} members\n`;
      response += `- ✅ Visits Completed: ${result.summary.total_visits_completed}\n`;
      response += `- 💰 Total Orders: ₹${result.summary.total_orders_value.toLocaleString('en-IN')}\n`;
      response += `- 📈 Avg per Person: ₹${result.summary.avg_orders_per_person.toLocaleString('en-IN')}\n\n`;
      
      response += `**Team Members:**\n`;
      result.team_members.forEach((m: any, i: number) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•';
        response += `${medal} **${m.name}** - ₹${m.orders.total_value.toLocaleString('en-IN')} (${m.visits.completed}/${m.visits.total} visits, ${m.visits.completion_rate}%)\n`;
      });
      return response;
    }
    
    case 'get_team_attendance': {
      let response = `\n\n📋 **Team Attendance** (${result.date})\n\n`;
      
      if (!result.members || result.members.length === 0) {
        response += `No team members found. Please ensure your team is configured.\n`;
        return response;
      }
      
      const { checked_in, not_checked_in, on_leave, total } = result.summary;
      response += `**Summary:** ✅ ${checked_in}/${total} checked in`;
      if (not_checked_in > 0) response += ` | ⚠️ ${not_checked_in} pending`;
      if (on_leave > 0) response += ` | 🏠 ${on_leave} on leave`;
      response += `\n\n`;
      
      if (result.alerts) {
        response += `${result.alerts}\n\n`;
      }
      
      response += `**Details:**\n`;
      result.members.forEach((m: any) => {
        const status = m.status === 'present' ? '✅' : m.status === 'leave' ? '🏠' : '⏳';
        response += `${status} **${m.name}**`;
        if (m.check_in_time) response += ` - In: ${m.check_in_time}`;
        if (m.location) response += ` @ ${m.location.substring(0, 30)}...`;
        response += `\n`;
      });
      return response;
    }
    
    case 'compare_team_members': {
      if (!result.comparison || result.comparison.length < 2) {
        return `\n\n⚠️ Need at least 2 team members to compare.\n`;
      }
      
      let response = `\n\n📊 **Team Comparison** (${result.period})\n\n`;
      
      const [m1, m2] = result.comparison;
      response += `| Metric | ${m1.name} | ${m2.name} |\n`;
      response += `|--------|----------|----------|\n`;
      response += `| 📍 Visits | ${m1.visits_completed}/${m1.total_visits} (${m1.visit_completion_rate}%) | ${m2.visits_completed}/${m2.total_visits} (${m2.visit_completion_rate}%) |\n`;
      response += `| 🛒 Orders | ${m1.orders_count} | ${m2.orders_count} |\n`;
      response += `| 💰 Sales | ₹${m1.total_sales.toLocaleString('en-IN')} | ₹${m2.total_sales.toLocaleString('en-IN')} |\n\n`;
      
      // Winner declaration
      const salesWinner = m1.total_sales > m2.total_sales ? m1.name : m2.name;
      response += `🏆 **Sales Leader:** ${salesWinner}\n`;
      return response;
    }
    
    case 'get_exception_alerts': {
      let response = `\n\n⚠️ **Exception Alerts**\n\n`;
      
      if (result.attendance_alerts?.length > 0) {
        response += `**Not Checked In:**\n`;
        result.attendance_alerts.forEach((a: any) => {
          response += `- ⏳ ${a.name} - not checked in\n`;
        });
        response += `\n`;
      }
      
      if (result.overdue_visits > 0) {
        response += `📍 **Overdue Visits:** ${result.overdue_visits} visits need attention\n\n`;
      }
      
      if (result.high_pending_collections?.length > 0) {
        response += `💰 **High Pending Collections:**\n`;
        result.high_pending_collections.forEach((r: any) => {
          response += `- ${r.retailer_name}: ₹${r.amount.toLocaleString('en-IN')}\n`;
        });
        response += `\n`;
      }
      
      if (result.declining_retailers?.length > 0) {
        response += `📉 **Declining Retailers:**\n`;
        result.declining_retailers.forEach((r: any) => {
          response += `- ${r.name}: ${r.decline_percent}% drop\n`;
        });
      }
      
      if (!result.attendance_alerts?.length && !result.overdue_visits && !result.high_pending_collections?.length && !result.declining_retailers?.length) {
        response += `✅ No critical alerts at this time. Great job!\n`;
      }
      
      return response;
    }
    
    case 'get_visit_summary': {
      let response = `\n\n📍 **Today's Visits**\n\n`;
      if (!result.visits || result.visits.length === 0) {
        response += `No visits planned for today.\n`;
        return response;
      }
      
      response += `**Summary:** ${result.completed}/${result.total} completed (${result.completion_rate}%)\n\n`;
      result.visits.slice(0, 5).forEach((v: any) => {
        const icon = v.status === 'completed' ? '✅' : v.status === 'in_progress' ? '🔄' : '⏳';
        response += `${icon} ${v.retailer_name} - ${v.status}\n`;
      });
      if (result.visits.length > 5) {
        response += `\n...and ${result.visits.length - 5} more visits.\n`;
      }
      return response;
    }
    
    case 'get_sales_report': {
      let response = `\n\n💰 **Sales Report** (${result.period})\n\n`;
      response += `- Total Orders: ${result.total_orders}\n`;
      response += `- Total Revenue: ₹${result.total_revenue?.toLocaleString('en-IN') || 0}\n`;
      response += `- Average Order: ₹${result.avg_order_value?.toLocaleString('en-IN') || 0}\n`;
      return response;
    }
    
    case 'get_pending_collections': {
      let response = `\n\n💵 **Pending Collections**\n\n`;
      if (!result.retailers || result.retailers.length === 0) {
        response += `✅ No pending collections. Great work!\n`;
        return response;
      }
      response += `**Total Pending:** ₹${result.total_pending?.toLocaleString('en-IN') || 0}\n\n`;
      result.retailers.slice(0, 5).forEach((r: any) => {
        response += `• ${r.name}: ₹${r.pending_amount?.toLocaleString('en-IN') || 0}\n`;
      });
      return response;
    }
    
    case 'get_retailer_analytics': {
      let response = `\n\n🏪 **Top Retailers**\n\n`;
      if (!result.retailers || result.retailers.length === 0) {
        response += `No retailer data available.\n`;
        return response;
      }
      result.retailers.slice(0, 5).forEach((r: any, i: number) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•';
        response += `${medal} ${r.name} - ₹${r.total_orders?.toLocaleString('en-IN') || 0}\n`;
      });
      return response;
    }
    
    default: {
      // Fallback: format as readable list
      let response = `\n\n📋 **Results:**\n\n`;
      if (typeof result === 'object') {
        Object.entries(result).forEach(([key, value]) => {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          if (typeof value === 'number') {
            response += `• ${label}: ${value.toLocaleString('en-IN')}\n`;
          } else if (typeof value === 'string') {
            response += `• ${label}: ${value}\n`;
          }
        });
      }
      return response;
    }
  }
}

// Dynamic model selection based on query complexity and context
function selectModel(messages: any[], classification: any): { model: string; maxTokens: number; temperature: number } {
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
  
  // Very simple greetings - use fast model
  const greetingPatterns = [
    /^(hi|hello|hey|thanks|ok|bye|good morning|good evening)$/i,
  ];
  
  if (greetingPatterns.some(p => p.test(lastMessage.trim()))) {
    return { model: 'google/gemini-2.5-flash-lite', maxTokens: 300, temperature: 0.7 };
  }
  
  // Most queries should use flash for speed - only use pro for truly complex analysis
  if (classification.category === 'analytics' && /trend|analyze|why|explain|deep/i.test(lastMessage)) {
    return { model: 'google/gemini-2.5-pro', maxTokens: 2000, temperature: 0.5 };
  }
  
  // Default - use flash model for fast responses (covers team, comparison, data queries)
  return { model: 'google/gemini-2.5-flash', maxTokens: 1200, temperature: 0.5 };
}

// Enhanced tools definition with manager tools
const TOOLS = [
  // ==================== MANAGER-SPECIFIC TOOLS ====================
  {
    type: "function",
    function: {
      name: "get_team_performance",
      description: "Get performance metrics for all team members including visits, orders, and attendance. MANAGER ONLY.",
      parameters: {
        type: "object",
        properties: {
          filters: {
            type: "object",
            properties: {
              period: { type: "string", enum: ["today", "week", "month"], description: "Time period for analysis" }
            }
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_team_attendance",
      description: "Get today's attendance status for all team members - who has checked in, who hasn't. MANAGER ONLY.",
      parameters: {
        type: "object",
        properties: {
          filters: {
            type: "object",
            properties: {
              date: { type: "string", description: "Date YYYY-MM-DD, defaults to today" }
            }
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "compare_team_members",
      description: "Compare performance between two team members side-by-side. MANAGER ONLY.",
      parameters: {
        type: "object",
        properties: {
          member1_name: { type: "string", description: "First team member name" },
          member2_name: { type: "string", description: "Second team member name" },
          filters: {
            type: "object",
            properties: {
              period: { type: "string", enum: ["week", "month"], description: "Comparison period" }
            }
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_exception_alerts",
      description: "Get alerts for exceptions - team not checked in, overdue visits, high pending amounts, dormant retailers.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_territory_overview",
      description: "Get overview of all territories including retailer counts, MTD sales, and pending collections. MANAGER ONLY.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_distributor_health",
      description: "Get health status of distributors - MTD orders, growth trends, performance comparison.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_proactive_insights",
      description: "Get AI-generated proactive insights - opportunities, alerts, and recommendations.",
      parameters: { type: "object", properties: {} }
    }
  },
  // ==================== EXISTING FIELD USER TOOLS ====================
  {
    type: "function",
    function: {
      name: "get_sales_report",
      description: "Fetch sales data and order history with totals. Use for sales summary, revenue, order counts.",
      parameters: {
        type: "object",
        properties: {
          filters: {
            type: "object",
            properties: {
              start_date: { type: "string", description: "Start date YYYY-MM-DD" },
              end_date: { type: "string", description: "End date YYYY-MM-DD" }
            }
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_visit_summary",
      description: "Get today's and upcoming visits with status (completed, scheduled, in_progress).",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_overdue_visits",
      description: "Find visits that were scheduled but not completed. Use for overdue, missed visits.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_pending_collections",
      description: "Get retailers with outstanding payments. Use for pending payments, collections, dues.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_retailer_analytics",
      description: "Get top retailers by performance with order history and credit info.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "check_retailer_status",
      description: "Look up a specific retailer by name - shows visits, orders, credit, pending amounts.",
      parameters: {
        type: "object",
        properties: {
          retailer_name: { type: "string", description: "Name of retailer to look up" }
        },
        required: ["retailer_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_inventory_status",
      description: "Check product stock levels. Highlights low stock items.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_active_schemes",
      description: "Get currently active schemes, offers, and promotions.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_attendance",
      description: "Get recent attendance records with check-in/out times.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_beat_schedule",
      description: "Get beat plan for a specific date.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date YYYY-MM-DD, defaults to today" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_performance_trends",
      description: "Get 30-day performance trends - sales, visits, completion rates.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_navigation_help",
      description: "Get step-by-step guide for app tasks like adding retailers, orders, visits.",
      parameters: {
        type: "object",
        properties: {
          task: { type: "string", description: "Task to get help for (add retailer, add order, etc.)" }
        }
      }
    }
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const requestBody = await req.json();
    const { messages: rawMessages, message, conversationId, pageContext, context } = requestBody;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const authHeader = req.headers.get('Authorization');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Handle both formats: messages array (chat widget) or single message (AI summary components)
    let messages: Array<{role: string, content: string}>;
    if (rawMessages && Array.isArray(rawMessages)) {
      messages = rawMessages;
    } else if (message && typeof message === 'string') {
      messages = [{ role: 'user', content: message }];
    } else {
      return new Response(JSON.stringify({ error: 'Either messages array or message string is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Validate auth using anon key client with user's token
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      console.error('Auth validation failed:', claimsError?.message || 'No claims');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    const userId = claimsData.claims.sub;
    const user = { id: userId, email: claimsData.claims.email };
    
    // Use service role client for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    // Get enhanced user context
    const userContext = await getUserContext(supabase, user.id);
    
    // Classify the query for routing
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()?.content || '';
    const classification = classifyQuery(lastUserMessage);
    console.log(`Query classification: ${JSON.stringify(classification)}`);

    // Build context-aware system prompt
    const { timeOfDay, isMonthEnd, isWeekend, dayOfMonth } = userContext.businessContext || {};
    const todayVisits = userContext.todayVisits || [];
    const pendingVisits = todayVisits.filter((v: any) => v.status === 'scheduled').length;
    const completedVisits = todayVisits.filter((v: any) => v.status === 'completed').length;
    
    // Add contextual tips based on business context
    let contextualTips = '';
    if (isMonthEnd) {
      contextualTips += '\n⚠️ Month-end: Focus on collections and closing pending orders.';
    }
    if (userContext.pendingCollections?.total > 0) {
      contextualTips += `\n💰 Pending collections: ₹${userContext.pendingCollections.total.toLocaleString('en-IN')} from ${userContext.pendingCollections.count} retailers.`;
    }
    if (pendingVisits > 0 && timeOfDay === 'afternoon') {
      contextualTips += `\n📍 ${pendingVisits} visits still pending today.`;
    }
    
    // Team stats for managers
    let teamContextBlock = '';
    if (userContext.isManager && userContext.teamStats) {
      const ts = userContext.teamStats;
      teamContextBlock = `
**Your Team Today:**
- Team Size: ${ts.teamSize} members
- Visits: ${ts.completedVisitsToday}/${ts.totalVisitsToday} completed
- In Progress: ${ts.inProgressVisitsToday}
- Pending: ${ts.pendingVisitsToday}`;
    }
    
    // Role-specific system prompt
    const roleSpecificInstructions = userContext.isManager ? `
**Manager Capabilities:**
You have access to powerful team management tools:
- View all team members' performance, attendance, and activities
- Compare team members' metrics
- Get exception alerts (who hasn't checked in, overdue tasks, etc.)
- Analyze territory and distributor health
- See aggregated team data

When answering manager queries:
- Be proactive about highlighting issues and opportunities
- Suggest actions they can take to improve team performance
- Compare against targets and historical data when available
- Always mention if data is for the whole team vs individual

**Quick Actions for Managers:**
• "Team status" - Overview of all team members today
• "Who hasn't checked in?" - Attendance alerts
• "Compare [Name1] and [Name2]" - Side-by-side comparison
• "Exception alerts" - All issues needing attention
• "Territory overview" - All territories summary
• "Distributor health" - Secondary order analysis
` : `
**Field User Capabilities:**
You help with day-to-day sales activities:
- Track and manage visits
- View sales and orders
- Check retailer information
- Monitor pending collections
- Access schemes and inventory

**Quick Actions:**
• "My visits" - Today's schedule
• "Sales summary" - Recent orders
• "Pending payments" - Outstanding collections
• "Top retailers" - Best performers
`;

    const systemPrompt = `You are an intelligent, proactive AI assistant for Bharath Beverages Field Sales Management. You're like a smart colleague who anticipates needs and provides actionable insights.

**Your Personality:**
- Be warm, conversational, and genuinely helpful
- Be PROACTIVE - don't wait to be asked, suggest relevant insights
- Use natural language with personality, not robotic responses
- Celebrate wins and provide encouragement
- When sharing data, always interpret it and suggest next steps
- Use emojis sparingly but effectively to add warmth

**User Profile:**
- Name: ${userContext.profile?.full_name || 'User'}
- Role: ${userContext.userRole}${userContext.isManager ? ' 👔' : ''}
- Territory: ${userContext.territory || 'Not assigned'}
- Today's Beat: ${userContext.todayBeat || 'No beat planned'}

**Current Context:**
- Date: ${new Date().toLocaleDateString('en-IN')} (${timeOfDay})
- Day ${dayOfMonth} of month${isMonthEnd ? ' ⚡ MONTH-END' : ''}${isWeekend ? ' 🏠 Weekend' : ''}
${pageContext ? `- Current page: ${pageContext}` : ''}

**Today's Progress:**
- Visits: ${completedVisits}/${todayVisits.length} completed
- Pending: ${pendingVisits} visits remaining
${contextualTips}
${teamContextBlock}

**Recent Performance (7 days):**
- Orders: ${userContext.recentPerformance.orderCount}
- Sales: ₹${userContext.recentPerformance.totalSales.toLocaleString('en-IN')}

${roleSpecificInstructions}

**Response Style:**
1. **Greetings**: Be warm! "Good ${timeOfDay}, ${userContext.profile?.full_name?.split(' ')[0] || 'there'}! 👋"
2. **Data Queries**: Fetch data, present clearly with bullet points, then give actionable insight
3. **Alerts**: Lead with the most important info, use ⚠️ for warnings, ✅ for good news
4. **Comparisons**: Use tables or side-by-side format, declare a "winner" when comparing
5. **Navigation**: Give step-by-step with numbered points

**Formatting:**
- Currency: ₹X,XXX (Indian format with commas)
- Dates: DD MMM YYYY (e.g., 15 Jan 2024)
- Percentages: XX% with context (good/bad)
- Lists: Use bullet points for 3+ items
- Keep responses focused - don't over-explain

**Proactive Behaviors:**
- If it's after 10 AM and team members haven't checked in, mention it
- If pending collections are high, suggest prioritization
- If it's month-end, emphasize target completion
- Celebrate when metrics look good!

Always use the available tools to fetch real-time data. Interpret the data meaningfully - don't just dump raw numbers.`;

    // Select model based on query
    const { model, maxTokens, temperature } = selectModel(messages, classification);
    console.log(`Using model: ${model}, maxTokens: ${maxTokens}, temp: ${temperature}, category: ${classification.category}, isManager: ${userContext.isManager}`);
    
    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-12)
    ];
    
    // Retry logic for transient errors (503, network issues)
    const MAX_RETRIES = 3;
    let response: Response | null = null;
    let lastError = '';
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: aiMessages,
            tools: TOOLS,
            tool_choice: 'auto',
            stream: true,
            max_tokens: maxTokens,
            temperature,
          }),
        });

        if (response.ok) {
          break; // Success, exit retry loop
        }
        
        const errorText = await response.text();
        lastError = errorText;
        console.error(`AI gateway error (attempt ${attempt}/${MAX_RETRIES}):`, response.status, errorText);
        
        // Don't retry for client errors (except 429 which we handle separately)
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment.' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: 'AI credits exhausted. Contact administrator.' }), {
            status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (response.status >= 400 && response.status < 500) {
          // Client error, don't retry
          break;
        }
        
        // For 5xx errors, retry with exponential backoff
        if (attempt < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000); // 1s, 2s, 4s
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (fetchError) {
        lastError = fetchError instanceof Error ? fetchError.message : 'Network error';
        console.error(`Fetch error (attempt ${attempt}/${MAX_RETRIES}):`, fetchError);
        
        if (attempt < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    if (!response || !response.ok) {
      console.error('All retry attempts failed:', lastError);
      return new Response(JSON.stringify({ error: 'AI service temporarily unavailable. Please try again in a moment.' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reader = response.body?.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        let toolCallsBuffer: any[] = [];
        
        try {
          while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (!line.trim() || line.startsWith(':')) continue;
              if (!line.startsWith('data: ')) continue;
              
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                const finishReason = parsed.choices?.[0]?.finish_reason;
                
                // Handle tool calls
                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    if (tc.index !== undefined) {
                      if (!toolCallsBuffer[tc.index]) {
                        toolCallsBuffer[tc.index] = { function: { name: '', arguments: '' } };
                      }
                      if (tc.function?.name) {
                        toolCallsBuffer[tc.index].function.name = tc.function.name;
                      }
                      if (tc.function?.arguments) {
                        toolCallsBuffer[tc.index].function.arguments += tc.function.arguments;
                      }
                    }
                  }
                }
                
                // Stream content
                if (delta?.content) {
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
                
                // Execute tool calls when done
                if (finishReason === 'tool_calls' && toolCallsBuffer.length > 0) {
                  for (const toolCall of toolCallsBuffer) {
                    if (toolCall.function?.name) {
                      try {
                        const args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
                        console.log(`Executing tool: ${toolCall.function.name}`, args);
                        
                        const result = await executeQuery(supabase, user.id, toolCall.function.name, args, userContext);
                        
                        // Format result as natural language based on the tool
                        const formattedContent = formatToolResult(toolCall.function.name, result);
                        
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                          choices: [{ delta: { content: formattedContent }, index: 0 }]
                        })}\n\n`));
                      } catch (toolError: any) {
                        const errorMsg = toolError?.message || JSON.stringify(toolError) || 'Unknown error';
                        console.error(`Tool error (${toolCall.function.name}):`, toolError);
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                          choices: [{ delta: { content: `\n\n⚠️ Could not fetch data: ${errorMsg}` }, index: 0 }]
                        })}\n\n`));
                      }
                    }
                  }
                  toolCallsBuffer = [];
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
          
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (e) {
          console.error('Stream error:', e);
          controller.error(e);
        }
      }
    });

    console.log(`AI Assistant response time: ${Date.now() - startTime}ms`);

    return new Response(stream, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Chat assistant error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
