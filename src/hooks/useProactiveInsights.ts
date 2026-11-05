import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AIInsight {
  id: string;
  insight_type: 'alert' | 'opportunity' | 'recommendation' | 'kudos';
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action_type?: string;
  action_data?: Record<string, unknown>;
  is_read?: boolean;
  created_at: string;
}

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export function useProactiveInsights() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First try to fetch existing insights from the database
      const { data: existingInsights } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_dismissed', false)
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('created_at', { ascending: false })
        .limit(10);

      if (existingInsights && existingInsights.length > 0) {
        // Sort by priority
        const sorted = existingInsights.sort((a, b) => 
          (PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] || 3) - 
          (PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] || 3)
        );
        setInsights(sorted as AIInsight[]);
        return;
      }

      // If no insights, generate new ones
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-insights-engine`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId: user.id, mode: 'generate' }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.insights && data.insights.length > 0) {
          const sorted = data.insights.sort((a: AIInsight, b: AIInsight) => 
            (PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] || 3) - 
            (PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] || 3)
          );
          setInsights(sorted);
        }
      }
    } catch (err) {
      console.error('Error fetching insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch insights');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const dismissInsight = useCallback(async (insightId: string) => {
    try {
      await supabase
        .from('ai_insights')
        .update({ is_dismissed: true })
        .eq('id', insightId);
      
      setInsights(prev => prev.filter(i => i.id !== insightId));
    } catch (err) {
      console.error('Error dismissing insight:', err);
    }
  }, []);

  const markAsRead = useCallback(async (insightId: string) => {
    try {
      await supabase
        .from('ai_insights')
        .update({ is_read: true })
        .eq('id', insightId);
      
      setInsights(prev => prev.map(i => 
        i.id === insightId ? { ...i, is_read: true } : i
      ));
    } catch (err) {
      console.error('Error marking insight as read:', err);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return {
    insights,
    isLoading,
    error,
    refetch: fetchInsights,
    dismissInsight,
    markAsRead,
  };
}
