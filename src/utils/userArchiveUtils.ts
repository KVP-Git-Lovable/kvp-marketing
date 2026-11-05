import { supabase } from "@/integrations/supabase/client";

interface UserArchiveMeta {
  total_records: number;
  tables_with_data: string[];
  archived_at: string;
  user_email: string;
  user_name: string;
}

interface UserArchiveData {
  profile: Record<string, unknown> | null;
  employee: Record<string, unknown> | null;
  user_role: Record<string, unknown> | null;
  user_profile: Record<string, unknown> | null;
  [key: string]: Record<string, unknown> | Record<string, unknown>[] | UserArchiveMeta | null;
  _meta: UserArchiveMeta;
}

// Helper to fetch table data safely
const fetchTableData = async (
  tableName: string,
  column: string,
  userId: string
): Promise<Record<string, unknown>[]> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from(tableName as any) as any)
      .select('*')
      .eq(column, userId);
    return (data || []) as Record<string, unknown>[];
  } catch {
    return [];
  }
};

// Helper to fetch single record
const fetchSingleRecord = async (
  tableName: string,
  column: string,
  userId: string
): Promise<Record<string, unknown> | null> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from(tableName as any) as any)
      .select('*')
      .eq(column, userId)
      .maybeSingle();
    return data as Record<string, unknown> | null;
  } catch {
    return null;
  }
};

// Helper to delete from table
const deleteFromTable = async (
  tableName: string,
  column: string,
  userId: string
): Promise<void> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from(tableName as any) as any).delete().eq(column, userId);
  } catch (error) {
    console.warn(`Failed to delete from ${tableName}:`, error);
  }
};

// Helper to delete by ID list
const deleteByIds = async (
  tableName: string,
  column: string,
  ids: string[]
): Promise<void> => {
  if (!ids.length) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from(tableName as any) as any).delete().in(column, ids);
  } catch (error) {
    console.warn(`Failed to delete from ${tableName} by IDs:`, error);
  }
};

// Helper to fetch by ID list
const fetchByIds = async (
  tableName: string,
  column: string,
  ids: string[]
): Promise<Record<string, unknown>[]> => {
  if (!ids.length) return [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from(tableName as any) as any)
      .select('*')
      .in(column, ids);
    return (data || []) as Record<string, unknown>[];
  } catch {
    return [];
  }
};

/**
 * Collects ALL data associated with a user across all tables
 */
export const collectUserData = async (userId: string): Promise<UserArchiveData> => {
  const archive: UserArchiveData = {
    profile: null,
    employee: null,
    user_role: null,
    user_profile: null,
    _meta: {
      total_records: 0,
      tables_with_data: [],
      archived_at: new Date().toISOString(),
      user_email: '',
      user_name: '',
    },
  };

  const tablesWithData: string[] = [];
  let totalRecords = 0;

  // Fetch profile first
  const profile = await fetchSingleRecord('profiles', 'id', userId);
  if (profile) {
    archive.profile = profile;
    archive._meta.user_email = (profile.username as string) || '';
    archive._meta.user_name = (profile.full_name as string) || '';
    tablesWithData.push('profiles');
    totalRecords++;
  }

  // Core user records
  const employee = await fetchSingleRecord('employees', 'user_id', userId);
  const userRole = await fetchSingleRecord('user_roles', 'user_id', userId);
  const userProfile = await fetchSingleRecord('user_profiles', 'user_id', userId);

  if (employee) { archive.employee = employee; tablesWithData.push('employees'); totalRecords++; }
  if (userRole) { archive.user_role = userRole; tablesWithData.push('user_roles'); totalRecords++; }
  if (userProfile) { archive.user_profile = userProfile; tablesWithData.push('user_profiles'); totalRecords++; }

  // Tables to fetch with user_id column (comprehensive list from schema)
  const userIdTables = [
    'attendance', 'orders', 'visits', 'retailers', 'beat_plans', 'beat_allowances',
    'gps_tracking', 'gps_tracking_stops', 'leave_applications', 'leave_balance',
    'leave_accrual_log', 'additional_expenses', 'user_period_targets',
    'hierarchy_target_allocations', 'user_business_plans', 'gamification_points',
    'gamification_daily_tracking', 'gamification_retailer_sequences',
    'employee_badges', 'employee_competencies', 'employee_documents',
    'employee_recommendations', 'notifications', 'notification_preferences',
    'ai_insights', 'chat_conversations', 'coach_user_progress', 'coach_user_badges',
    'coach_user_streaks', 'competition_insights', 'branding_requests',
    'regularization_requests', 'profile_attachments', 'education_history',
    'emergency_contacts', 'aspirations_and_preferences',
    // Additional tables from schema scan
    'ai_autonomous_actions', 'ai_feature_feedback', 'analytics_likes', 'analytics_views',
    'approvers', 'chat_feedback', 'coach_chat_messages', 'coach_daily_nudges',
    'coach_feedback', 'coach_quiz_attempts', 'coach_scenario_attempts',
    'coach_user_competency_scores', 'coach_user_overall_scores', 'competition_data',
    'competency_coaching_notes', 'distributor_retailer_mappings', 'gamification_redemptions',
    'hierarchy_target_history', 'joint_sales_feedback', 'joint_sales_sessions',
    'password_reset_tokens', 'performance_comments', 'push_content_execution_log',
    'push_content_posts', 'recommendation_feedback', 'recommendations', 'retailer_feedback',
    'sensitive_data_access_log', 'user_monthly_scorecard_competencies', 'user_monthly_scorecards',
    'user_object_permissions'
  ];

  // Tables with created_by column
  const createdByTables = [
    'beats', 'invoices', 'packing_lists', 'custom_invoice_templates',
    'distributor_beat_mappings', 'distributor_company_returns', 'distributor_evaluation_tasks',
    'distributor_inventory_transactions', 'distributor_returns', 'fy_target_config',
    'gamification_games', 'hierarchy_targets', 'holidays', 'inst_invoices', 'inst_leads',
    'inst_order_commitments', 'inst_quotes', 'price_books', 'push_content_templates',
    'retailer_loyalty_plans'
  ];

  // Fetch user_id tables
  for (const tableName of userIdTables) {
    const data = await fetchTableData(tableName, 'user_id', userId);
    if (data.length) {
      archive[tableName] = data;
      tablesWithData.push(tableName);
      totalRecords += data.length;
    }
  }

  // Fetch created_by tables
  for (const tableName of createdByTables) {
    const data = await fetchTableData(tableName, 'created_by', userId);
    if (data.length) {
      archive[tableName] = data;
      tablesWithData.push(tableName);
      totalRecords += data.length;
    }
  }

  // Fetch nested records
  const orders = archive['orders'] as Record<string, unknown>[] | undefined;
  if (orders?.length) {
    const orderIds = orders.map(o => o.id as string);
    const orderItems = await fetchByIds('order_items', 'order_id', orderIds);
    if (orderItems.length) {
      archive['order_items'] = orderItems;
      tablesWithData.push('order_items');
      totalRecords += orderItems.length;
    }
  }

  const visits = archive['visits'] as Record<string, unknown>[] | undefined;
  if (visits?.length) {
    const visitIds = visits.map(v => v.id as string);
    const visitLogs = await fetchByIds('retailer_visit_logs', 'visit_id', visitIds);
    if (visitLogs.length) {
      archive['retailer_visit_logs'] = visitLogs;
      tablesWithData.push('retailer_visit_logs');
      totalRecords += visitLogs.length;
    }
  }

  const chatConversations = archive['chat_conversations'] as Record<string, unknown>[] | undefined;
  if (chatConversations?.length) {
    const conversationIds = chatConversations.map(c => c.id as string);
    const messages = await fetchByIds('chat_messages', 'conversation_id', conversationIds);
    if (messages.length) {
      archive['chat_messages'] = messages;
      tablesWithData.push('chat_messages');
      totalRecords += messages.length;
    }
  }

  const businessPlans = archive['user_business_plans'] as Record<string, unknown>[] | undefined;
  if (businessPlans?.length) {
    const planIds = businessPlans.map(p => p.id as string);
    const months = await fetchByIds('user_business_plan_months', 'plan_id', planIds);
    if (months.length) {
      archive['user_business_plan_months'] = months;
      tablesWithData.push('user_business_plan_months');
      totalRecords += months.length;

      const monthIds = months.map(m => m.id as string);
      const products = await fetchByIds('user_business_plan_month_products', 'month_id', monthIds);
      if (products.length) {
        archive['user_business_plan_month_products'] = products;
        tablesWithData.push('user_business_plan_month_products');
        totalRecords += products.length;
      }
    }
  }

  const packingLists = archive['packing_lists'] as Record<string, unknown>[] | undefined;
  if (packingLists?.length) {
    const packingListIds = packingLists.map(p => p.id as string);
    const packingItems = await fetchByIds('packing_list_items', 'packing_list_id', packingListIds);
    if (packingItems.length) {
      archive['packing_list_items'] = packingItems;
      tablesWithData.push('packing_list_items');
      totalRecords += packingItems.length;
    }
  }

  // Territory assignments
  const territories = await fetchTableData('territories', 'assigned_user_id', userId);
  if (territories.length) {
    archive['territory_assignments'] = territories.map(t => ({
      territory_id: t.id,
      assigned_user_id: t.assigned_user_id
    }));
    tablesWithData.push('territories');
    totalRecords += territories.length;
  }

  archive._meta.total_records = totalRecords;
  archive._meta.tables_with_data = tablesWithData;

  return archive;
};

/**
 * Delete all user data in the correct order to avoid FK constraint errors
 */
export const deleteUserDataCascade = async (userId: string): Promise<boolean> => {
  try {
    // Phase 1: Delete deeply nested records first
    const orders = await fetchTableData('orders', 'user_id', userId);
    if (orders.length) {
      const orderIds = orders.map(o => o.id as string);
      await deleteByIds('order_items', 'order_id', orderIds);
    }

    const visits = await fetchTableData('visits', 'user_id', userId);
    if (visits.length) {
      const visitIds = visits.map(v => v.id as string);
      await deleteByIds('retailer_visit_logs', 'visit_id', visitIds);
    }

    const businessPlans = await fetchTableData('user_business_plans', 'user_id', userId);
    if (businessPlans.length) {
      const planIds = businessPlans.map(p => p.id as string);
      const months = await fetchByIds('user_business_plan_months', 'plan_id', planIds);
      if (months.length) {
        const monthIds = months.map(m => m.id as string);
        await deleteByIds('user_business_plan_month_products', 'month_id', monthIds);
      }
      await deleteByIds('user_business_plan_months', 'plan_id', planIds);
    }

    const packingLists = await fetchTableData('packing_lists', 'created_by', userId);
    if (packingLists.length) {
      const packingListIds = packingLists.map(p => p.id as string);
      await deleteByIds('packing_list_items', 'packing_list_id', packingListIds);
    }

    const conversations = await fetchTableData('chat_conversations', 'user_id', userId);
    if (conversations.length) {
      const conversationIds = conversations.map(c => c.id as string);
      await deleteByIds('chat_messages', 'conversation_id', conversationIds);
    }

    // Phase 2: Delete parent records
    await deleteFromTable('orders', 'user_id', userId);
    await deleteFromTable('visits', 'user_id', userId);
    await deleteFromTable('user_business_plans', 'user_id', userId);
    await deleteFromTable('packing_lists', 'created_by', userId);
    await deleteFromTable('chat_conversations', 'user_id', userId);

    // Phase 3: Clear territory assignments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('territories') as any).update({ assigned_user_id: null }).eq('assigned_user_id', userId);

    // Phase 4: Clear manager references and other FK references pointing to this user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('employees') as any).update({ manager_id: null }).eq('manager_id', userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('employees') as any).update({ secondary_manager_id: null }).eq('secondary_manager_id', userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('branding_requests') as any).update({ manager_id: null }).eq('manager_id', userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('competency_coaching_notes') as any).update({ manager_id: null }).eq('manager_id', userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('hierarchy_target_allocations') as any).update({ manager_id: null }).eq('manager_id', userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('joint_sales_sessions') as any).update({ manager_id: null }).eq('manager_id', userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('joint_sales_feedback') as any).update({ manager_id: null }).eq('manager_id', userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('performance_comments') as any).update({ manager_id: null }).eq('manager_id', userId);

    // Phase 5: Delete remaining user data tables
    const tablesToDelete = [
      { name: 'attendance', column: 'user_id' },
      { name: 'retailers', column: 'user_id' },
      { name: 'beats', column: 'created_by' },
      { name: 'beat_plans', column: 'user_id' },
      { name: 'beat_allowances', column: 'user_id' },
      { name: 'gps_tracking', column: 'user_id' },
      { name: 'gps_tracking_stops', column: 'user_id' },
      { name: 'leave_applications', column: 'user_id' },
      { name: 'leave_balance', column: 'user_id' },
      { name: 'leave_accrual_log', column: 'user_id' },
      { name: 'additional_expenses', column: 'user_id' },
      { name: 'user_period_targets', column: 'user_id' },
      { name: 'hierarchy_target_allocations', column: 'user_id' },
      { name: 'gamification_points', column: 'user_id' },
      { name: 'gamification_daily_tracking', column: 'user_id' },
      { name: 'gamification_retailer_sequences', column: 'user_id' },
      { name: 'employee_badges', column: 'user_id' },
      { name: 'employee_competencies', column: 'user_id' },
      { name: 'employee_documents', column: 'user_id' },
      { name: 'employee_recommendations', column: 'user_id' },
      { name: 'notifications', column: 'user_id' },
      { name: 'notification_preferences', column: 'user_id' },
      { name: 'ai_insights', column: 'user_id' },
      { name: 'coach_user_progress', column: 'user_id' },
      { name: 'coach_user_badges', column: 'user_id' },
      { name: 'coach_user_streaks', column: 'user_id' },
      { name: 'competition_insights', column: 'user_id' },
      { name: 'branding_requests', column: 'user_id' },
      { name: 'invoices', column: 'created_by' },
      { name: 'regularization_requests', column: 'user_id' },
      { name: 'profile_attachments', column: 'user_id' },
      { name: 'education_history', column: 'user_id' },
      { name: 'emergency_contacts', column: 'user_id' },
      { name: 'aspirations_and_preferences', column: 'user_id' },
      // Additional tables from schema scan
      { name: 'ai_autonomous_actions', column: 'user_id' },
      { name: 'ai_feature_feedback', column: 'user_id' },
      { name: 'analytics_likes', column: 'user_id' },
      { name: 'analytics_views', column: 'user_id' },
      { name: 'approvers', column: 'user_id' },
      { name: 'chat_feedback', column: 'user_id' },
      { name: 'coach_chat_messages', column: 'user_id' },
      { name: 'coach_daily_nudges', column: 'user_id' },
      { name: 'coach_feedback', column: 'user_id' },
      { name: 'coach_quiz_attempts', column: 'user_id' },
      { name: 'coach_scenario_attempts', column: 'user_id' },
      { name: 'coach_user_competency_scores', column: 'user_id' },
      { name: 'coach_user_overall_scores', column: 'user_id' },
      { name: 'competition_data', column: 'user_id' },
      { name: 'competency_coaching_notes', column: 'user_id' },
      { name: 'distributor_retailer_mappings', column: 'user_id' },
      { name: 'gamification_redemptions', column: 'user_id' },
      { name: 'hierarchy_target_history', column: 'user_id' },
      { name: 'password_reset_tokens', column: 'user_id' },
      { name: 'performance_comments', column: 'user_id' },
      { name: 'push_content_execution_log', column: 'user_id' },
      { name: 'push_content_posts', column: 'user_id' },
      { name: 'recommendation_feedback', column: 'user_id' },
      { name: 'recommendations', column: 'user_id' },
      { name: 'retailer_feedback', column: 'user_id' },
      { name: 'sensitive_data_access_log', column: 'user_id' },
      { name: 'user_monthly_scorecard_competencies', column: 'user_id' },
      { name: 'user_monthly_scorecards', column: 'user_id' },
      { name: 'user_object_permissions', column: 'user_id' },
      // created_by tables
      { name: 'custom_invoice_templates', column: 'created_by' },
      { name: 'distributor_beat_mappings', column: 'created_by' },
      { name: 'distributor_company_returns', column: 'created_by' },
      { name: 'distributor_evaluation_tasks', column: 'created_by' },
      { name: 'distributor_inventory_transactions', column: 'created_by' },
      { name: 'distributor_returns', column: 'created_by' },
      { name: 'fy_target_config', column: 'created_by' },
      { name: 'gamification_games', column: 'created_by' },
      { name: 'hierarchy_targets', column: 'created_by' },
      { name: 'holidays', column: 'created_by' },
      { name: 'inst_invoices', column: 'created_by' },
      { name: 'inst_leads', column: 'created_by' },
      { name: 'inst_order_commitments', column: 'created_by' },
      { name: 'inst_quotes', column: 'created_by' },
      { name: 'price_books', column: 'created_by' },
      { name: 'push_content_templates', column: 'created_by' },
      { name: 'retailer_loyalty_plans', column: 'created_by' },
    ];

    for (const table of tablesToDelete) {
      await deleteFromTable(table.name, table.column, userId);
    }

    // Phase 6: Delete core user records
    await deleteFromTable('employees', 'user_id', userId);
    await deleteFromTable('user_profiles', 'user_id', userId);
    await deleteFromTable('user_roles', 'user_id', userId);
    
    // Phase 7: Finally delete the profile
    const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);
    if (profileError) throw profileError;

    return true;
  } catch (error) {
    console.error('Error in cascade delete:', error);
    return false;
  }
};

/**
 * Move user to recycle bin with comprehensive data archive
 */
export const moveUserToRecycleBin = async (userId: string, userName: string): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Collect all user data into a single archive
    const archiveData = await collectUserData(userId);

    // Store the combined archive in recycle bin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase.from('recycle_bin') as any)
      .insert({
        original_table: 'profiles',
        original_id: userId,
        record_data: archiveData,
        deleted_by: user.id,
        module_name: 'Users & Roles',
        record_name: userName || archiveData._meta.user_name || 'Unknown User',
      });

    if (insertError) throw insertError;

    // Now cascade delete all user data
    const deleted = await deleteUserDataCascade(userId);
    if (!deleted) {
      await supabase.from('recycle_bin').delete().eq('original_id', userId).eq('original_table', 'profiles');
      throw new Error('Failed to delete user data');
    }

    return true;
  } catch (error) {
    console.error('Error moving user to recycle bin:', error);
    return false;
  }
};

/**
 * Complete list of all tables that reference user data
 */
export const ALL_USER_TABLES = [
  // Core user tables
  { name: 'profiles', column: 'id', category: 'Core' },
  { name: 'employees', column: 'user_id', category: 'Core' },
  { name: 'user_roles', column: 'user_id', category: 'Core' },
  { name: 'user_profiles', column: 'user_id', category: 'Core' },
  
  // Sales & Orders
  { name: 'orders', column: 'user_id', category: 'Sales' },
  { name: 'visits', column: 'user_id', category: 'Sales' },
  { name: 'retailers', column: 'user_id', category: 'Sales' },
  { name: 'invoices', column: 'created_by', category: 'Sales' },
  { name: 'packing_lists', column: 'created_by', category: 'Sales' },
  
  // Beat & Territory
  { name: 'beats', column: 'created_by', category: 'Territory' },
  { name: 'beat_plans', column: 'user_id', category: 'Territory' },
  { name: 'beat_allowances', column: 'user_id', category: 'Territory' },
  { name: 'territories', column: 'assigned_user_id', category: 'Territory' },
  
  // Attendance & Leave
  { name: 'attendance', column: 'user_id', category: 'Attendance' },
  { name: 'leave_applications', column: 'user_id', category: 'Attendance' },
  { name: 'leave_balance', column: 'user_id', category: 'Attendance' },
  { name: 'leave_accrual_log', column: 'user_id', category: 'Attendance' },
  { name: 'regularization_requests', column: 'user_id', category: 'Attendance' },
  { name: 'holidays', column: 'created_by', category: 'Attendance' },
  
  // GPS & Tracking
  { name: 'gps_tracking', column: 'user_id', category: 'Tracking' },
  { name: 'gps_tracking_stops', column: 'user_id', category: 'Tracking' },
  
  // Targets & Business Planning
  { name: 'user_period_targets', column: 'user_id', category: 'Targets' },
  { name: 'hierarchy_target_allocations', column: 'user_id', category: 'Targets' },
  { name: 'user_business_plans', column: 'user_id', category: 'Targets' },
  { name: 'fy_target_config', column: 'created_by', category: 'Targets' },
  { name: 'hierarchy_targets', column: 'created_by', category: 'Targets' },
  
  // Gamification
  { name: 'gamification_points', column: 'user_id', category: 'Gamification' },
  { name: 'gamification_daily_tracking', column: 'user_id', category: 'Gamification' },
  { name: 'gamification_retailer_sequences', column: 'user_id', category: 'Gamification' },
  { name: 'gamification_games', column: 'created_by', category: 'Gamification' },
  { name: 'gamification_redemptions', column: 'user_id', category: 'Gamification' },
  
  // Employee Data
  { name: 'employee_badges', column: 'user_id', category: 'Employee' },
  { name: 'employee_competencies', column: 'user_id', category: 'Employee' },
  { name: 'employee_documents', column: 'user_id', category: 'Employee' },
  { name: 'employee_recommendations', column: 'user_id', category: 'Employee' },
  { name: 'profile_attachments', column: 'user_id', category: 'Employee' },
  { name: 'education_history', column: 'user_id', category: 'Employee' },
  { name: 'emergency_contacts', column: 'user_id', category: 'Employee' },
  { name: 'aspirations_and_preferences', column: 'user_id', category: 'Employee' },
  
  // Expenses
  { name: 'additional_expenses', column: 'user_id', category: 'Expenses' },
  
  // Communication
  { name: 'notifications', column: 'user_id', category: 'Communication' },
  { name: 'notification_preferences', column: 'user_id', category: 'Communication' },
  { name: 'chat_conversations', column: 'user_id', category: 'Communication' },
  { name: 'push_content_templates', column: 'created_by', category: 'Communication' },
  { name: 'push_content_posts', column: 'user_id', category: 'Communication' },
  { name: 'push_content_execution_log', column: 'user_id', category: 'Communication' },
  
  // AI & Insights
  { name: 'ai_insights', column: 'user_id', category: 'AI' },
  { name: 'ai_autonomous_actions', column: 'user_id', category: 'AI' },
  { name: 'ai_feature_feedback', column: 'user_id', category: 'AI' },
  
  // Coach & Learning
  { name: 'coach_user_progress', column: 'user_id', category: 'Learning' },
  { name: 'coach_user_badges', column: 'user_id', category: 'Learning' },
  { name: 'coach_user_streaks', column: 'user_id', category: 'Learning' },
  { name: 'coach_chat_messages', column: 'user_id', category: 'Learning' },
  { name: 'coach_daily_nudges', column: 'user_id', category: 'Learning' },
  { name: 'coach_feedback', column: 'user_id', category: 'Learning' },
  { name: 'coach_quiz_attempts', column: 'user_id', category: 'Learning' },
  { name: 'coach_scenario_attempts', column: 'user_id', category: 'Learning' },
  { name: 'coach_user_competency_scores', column: 'user_id', category: 'Learning' },
  { name: 'coach_user_overall_scores', column: 'user_id', category: 'Learning' },
  
  // Competition
  { name: 'competition_insights', column: 'user_id', category: 'Competition' },
  { name: 'competition_data', column: 'user_id', category: 'Competition' },
  
  // Branding
  { name: 'branding_requests', column: 'user_id', category: 'Branding' },
  
  // Analytics
  { name: 'analytics_views', column: 'user_id', category: 'Analytics' },
  { name: 'analytics_likes', column: 'user_id', category: 'Analytics' },
  
  // Performance
  { name: 'user_monthly_scorecards', column: 'user_id', category: 'Performance' },
  { name: 'competency_coaching_notes', column: 'user_id', category: 'Performance' },
  { name: 'performance_comments', column: 'user_id', category: 'Performance' },
  
  // Joint Sales (uses fse_user_id, not user_id)
  { name: 'joint_sales_sessions', column: 'fse_user_id', category: 'Joint Sales' },
  { name: 'joint_sales_feedback', column: 'fse_user_id', category: 'Joint Sales' },
  
  // Distributor
  { name: 'distributor_inventory_transactions', column: 'created_by', category: 'Distributor' },
  { name: 'distributor_returns', column: 'created_by', category: 'Distributor' },
  { name: 'distributor_company_returns', column: 'created_by', category: 'Distributor' },
  { name: 'distributor_retailer_mappings', column: 'user_id', category: 'Distributor' },
  
  // Institutional
  { name: 'inst_invoices', column: 'created_by', category: 'Institutional' },
  { name: 'inst_leads', column: 'created_by', category: 'Institutional' },
  { name: 'inst_order_commitments', column: 'created_by', category: 'Institutional' },
  { name: 'inst_quotes', column: 'created_by', category: 'Institutional' },
  
  // Security & Other
  { name: 'sensitive_data_access_log', column: 'user_id', category: 'Security' },
  { name: 'password_reset_tokens', column: 'user_id', category: 'Security' },
  { name: 'user_object_permissions', column: 'user_id', category: 'Security' },
  { name: 'price_books', column: 'created_by', category: 'Other' },
  { name: 'retailer_loyalty_plans', column: 'created_by', category: 'Other' },
  { name: 'custom_invoice_templates', column: 'created_by', category: 'Other' },
  { name: 'recommendations', column: 'user_id', category: 'Other' },
  { name: 'recommendation_feedback', column: 'user_id', category: 'Other' },
  { name: 'retailer_feedback', column: 'user_id', category: 'Other' },
];

/**
 * Get a comprehensive summary of what will be deleted for a user
 */
export const getUserDataSummary = async (userId: string): Promise<{ tableName: string; count: number; category: string }[]> => {
  const summary: { tableName: string; count: number; category: string }[] = [];

  // Fetch counts in parallel batches for efficiency
  const batchSize = 10;
  for (let i = 0; i < ALL_USER_TABLES.length; i += batchSize) {
    const batch = ALL_USER_TABLES.slice(i, i + batchSize);
    const promises = batch.map(async (table) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count } = await (supabase.from(table.name as any) as any)
          .select('*', { count: 'exact', head: true })
          .eq(table.column, userId);
        
        if (count && count > 0) {
          return { tableName: table.name, count, category: table.category };
        }
        return null;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(promises);
    results.forEach(result => {
      if (result) summary.push(result);
    });
  }

  // Sort by category then by count
  return summary.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return b.count - a.count;
  });
};

/**
 * Check if archive is a combined user archive
 */
export const isUserArchive = (recordData: Record<string, unknown>): boolean => {
  return recordData._meta !== undefined && 
         typeof recordData._meta === 'object' && 
         recordData._meta !== null &&
         'total_records' in recordData._meta;
};

// Helper to update user_id in a table
const updateTableUserId = async (
  tableName: string,
  column: string,
  fromUserId: string,
  toUserId: string
): Promise<void> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from(tableName as any) as any)
      .update({ [column]: toUserId })
      .eq(column, fromUserId);
  } catch (error) {
    console.warn(`Failed to transfer ${tableName}:`, error);
  }
};

/**
 * Transfer all user data from one user to another
 * This reassigns ownership of records like retailers, orders, visits, etc.
 */
export const transferUserData = async (
  fromUserId: string,
  toUserId: string
): Promise<boolean> => {
  try {
    // Tables with user_id column to transfer
    const userIdTables = [
      'retailers',
      'orders',
      'visits',
      'beat_plans',
      'attendance',
      'gps_tracking',
      'gps_tracking_stops',
      'leave_applications',
      'leave_balance',
      'leave_accrual_log',
      'additional_expenses',
      'user_period_targets',
      'hierarchy_target_allocations',
      'user_business_plans',
      'gamification_points',
      'gamification_daily_tracking',
      'gamification_retailer_sequences',
      'employee_badges',
      'employee_competencies',
      'employee_documents',
      'employee_recommendations',
      'notifications',
      'notification_preferences',
      'ai_insights',
      'coach_user_progress',
      'coach_user_badges',
      'coach_user_streaks',
      'competition_insights',
      'branding_requests',
      'regularization_requests',
      'profile_attachments',
      'education_history',
      'emergency_contacts',
      'aspirations_and_preferences',
    ];

    // Tables with created_by column
    const createdByTables = [
      'beats',
      'invoices',
      'packing_lists',
    ];

    // Transfer user_id tables
    for (const tableName of userIdTables) {
      await updateTableUserId(tableName, 'user_id', fromUserId, toUserId);
    }

    // Transfer created_by tables
    for (const tableName of createdByTables) {
      await updateTableUserId(tableName, 'created_by', fromUserId, toUserId);
    }

    // Transfer territory assignments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('territories') as any)
      .update({ assigned_user_id: toUserId })
      .eq('assigned_user_id', fromUserId);

    // Transfer manager relationships in employees table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('employees') as any)
      .update({ manager_id: toUserId })
      .eq('manager_id', fromUserId);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('employees') as any)
      .update({ secondary_manager_id: toUserId })
      .eq('secondary_manager_id', fromUserId);

    return true;
  } catch (error) {
    console.error('Error transferring user data:', error);
    return false;
  }
};
