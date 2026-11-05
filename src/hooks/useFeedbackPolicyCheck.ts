import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PolicyRule {
  id: string;
  policy_id: string;
  condition_type: string;
  condition_operator: string;
  condition_value: string;
  action_type: string;
  question_set_module: string | null;
  is_active: boolean;
}

interface PolicyWithRules {
  id: string;
  name: string;
  module: string;
  is_active: boolean;
  priority: number;
  rules: PolicyRule[];
}

interface FeedbackPolicyCheckResult {
  isFeedbackRequired: boolean;
  matchedPolicy: PolicyWithRules | null;
  matchedRule: PolicyRule | null;
  requiredAction: string;
  loading: boolean;
}

export function useFeedbackPolicyCheck(
  retailerId: string | undefined,
  userId: string | undefined,
  module: string = 'visit'
): FeedbackPolicyCheckResult {
  const [result, setResult] = useState<FeedbackPolicyCheckResult>({
    isFeedbackRequired: false,
    matchedPolicy: null,
    matchedRule: null,
    requiredAction: '',
    loading: true,
  });

  useEffect(() => {
    if (!retailerId || !userId) {
      setResult(r => ({ ...r, loading: false }));
      return;
    }

    let cancelled = false;

    const evaluate = async () => {
      try {
        // Fetch active policies for the module
        const { data: policiesData } = await (supabase as any)
          .from('feedback_policies')
          .select('*')
          .eq('module', module)
          .eq('is_active', true)
          .order('priority', { ascending: false });

        if (!policiesData || policiesData.length === 0) {
          if (!cancelled) setResult({ isFeedbackRequired: false, matchedPolicy: null, matchedRule: null, requiredAction: '', loading: false });
          return;
        }

        const policyIds = policiesData.map((p: any) => p.id);
        const { data: rulesData } = await (supabase as any)
          .from('feedback_policy_rules')
          .select('*')
          .in('policy_id', policyIds)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        // Build policies with rules
        const policies: PolicyWithRules[] = policiesData.map((p: any) => ({
          ...p,
          rules: (rulesData || []).filter((r: any) => r.policy_id === p.id),
        }));

        // Fetch context data for evaluation
        // 1. Count visits since last feedback
        const { data: lastFeedback } = await (supabase as any)
          .from('retailer_feedback')
          .select('created_at')
          .eq('retailer_id', retailerId)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastFeedbackDate = lastFeedback?.[0]?.created_at || null;

        let visitCountSinceFeedback = 0;
        if (lastFeedbackDate) {
          const { count } = await (supabase as any)
            .from('retailer_visit_logs')
            .select('id', { count: 'exact', head: true })
            .eq('retailer_id', retailerId)
            .eq('user_id', userId)
            .gt('created_at', lastFeedbackDate);
          visitCountSinceFeedback = count || 0;
        } else {
          // No feedback ever given — count all visits
          const { count } = await (supabase as any)
            .from('retailer_visit_logs')
            .select('id', { count: 'exact', head: true })
            .eq('retailer_id', retailerId)
            .eq('user_id', userId);
          visitCountSinceFeedback = count || 0;
        }

        // 2. Days since last feedback
        const daysSinceFeedback = lastFeedbackDate
          ? Math.floor((Date.now() - new Date(lastFeedbackDate).getTime()) / (1000 * 60 * 60 * 24))
          : 9999;

        // 3. Check latest visit for order status
        const { data: latestVisitLog } = await (supabase as any)
          .from('retailer_visit_logs')
          .select('action_type')
          .eq('retailer_id', retailerId)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);

        const latestAction = latestVisitLog?.[0]?.action_type || '';
        const hasOrder = ['order', 'order_submitted', 'phone_order'].includes(latestAction);
        const hasNoOrder = latestAction === 'no_order';
        const isVisitCompleted = ['checkout', 'order', 'order_submitted', 'no_order'].includes(latestAction);

        // Evaluate rules against context
        for (const policy of policies) {
          for (const rule of policy.rules) {
            let conditionMet = false;
            const val = parseInt(rule.condition_value) || 0;

            switch (rule.condition_type) {
              case 'visit_count':
                if (rule.condition_operator === 'every_n' && val > 0) {
                  conditionMet = visitCountSinceFeedback > 0 && visitCountSinceFeedback % val === 0;
                } else if (rule.condition_operator === 'greater_than') {
                  conditionMet = visitCountSinceFeedback > val;
                } else if (rule.condition_operator === 'equals') {
                  conditionMet = visitCountSinceFeedback === val;
                }
                break;
              case 'no_order':
                conditionMet = hasNoOrder;
                break;
              case 'order_placed':
                conditionMet = hasOrder;
                break;
              case 'visit_completed':
                conditionMet = isVisitCompleted;
                break;
              case 'days_since_feedback':
                if (rule.condition_operator === 'greater_than') {
                  conditionMet = daysSinceFeedback > val;
                } else if (rule.condition_operator === 'equals') {
                  conditionMet = daysSinceFeedback === val;
                }
                break;
            }

            if (conditionMet) {
              if (!cancelled) {
                setResult({
                  isFeedbackRequired: true,
                  matchedPolicy: policy,
                  matchedRule: rule,
                  requiredAction: rule.action_type,
                  loading: false,
                });
              }
              return;
            }
          }
        }

        // No condition matched
        if (!cancelled) {
          setResult({ isFeedbackRequired: false, matchedPolicy: null, matchedRule: null, requiredAction: '', loading: false });
        }
      } catch (err) {
        console.error('[useFeedbackPolicyCheck] Error:', err);
        if (!cancelled) {
          setResult({ isFeedbackRequired: false, matchedPolicy: null, matchedRule: null, requiredAction: '', loading: false });
        }
      }
    };

    evaluate();
    return () => { cancelled = true; };
  }, [retailerId, userId, module]);

  return result;
}
