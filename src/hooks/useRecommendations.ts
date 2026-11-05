import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { shouldSuppressError } from '@/utils/offlineErrorHandler';

export interface Recommendation {
  id: string;
  user_id: string;
  recommendation_type: 'beat_visit' | 'retailer_priority' | 'discussion_points' | 'beat_performance' | 'optimal_day';
  entity_id: string | null;
  entity_name: string | null;
  recommendation_data: any;
  confidence_score: number;
  reasoning: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  feedback?: {
    feedback_type: string;
    feedback_note?: string;
  };
}

export function useRecommendations(type?: string, entityId?: string) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('recommendations')
        .select(`
          *,
          recommendation_feedback (
            feedback_type,
            feedback_note
          )
        `)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (type) {
        query = query.eq('recommendation_type', type);
      }

      if (entityId) {
        query = query.eq('entity_id', entityId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setRecommendations(data?.map((r: any) => ({
        ...r,
        feedback: r.recommendation_feedback?.[0],
      })) || []);
    } catch (error: any) {
      console.log('Recommendations fetch failed (silent when offline):', error);
      // Only show error toast if we're online and error shouldn't be suppressed
      if (!shouldSuppressError(error)) {
        toast({
          title: 'Error',
          description: 'Failed to load recommendations',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendation = async (
    recommendationType: string,
    entityId?: string
  ) => {
    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('generate-recommendations', {
        body: { recommendationType, entityId },
      });

      if (error) throw error;

      toast({
        title: 'Recommendation Generated',
        description: 'New recommendation is ready',
      });

      await fetchRecommendations();
      return data.recommendation;
    } catch (error: any) {
      console.log('Generate recommendation failed:', error);
      // Only show error if not a network/offline error
      if (!shouldSuppressError(error)) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to generate recommendation',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const provideFeedback = async (
    recommendationId: string,
    feedbackType: 'like' | 'dislike' | 'implemented' | 'ignored',
    feedbackNote?: string
  ) => {
    try {
      const { error } = await supabase
        .from('recommendation_feedback')
        .upsert({
          recommendation_id: recommendationId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          feedback_type: feedbackType,
          feedback_note: feedbackNote,
        });

      if (error) throw error;

      toast({
        title: 'Feedback Submitted',
        description: 'Thank you for your feedback',
      });

      await fetchRecommendations();
    } catch (error: any) {
      console.log('Feedback submission failed:', error);
      // Only show error if not a network/offline error
      if (!shouldSuppressError(error)) {
        toast({
          title: 'Error',
          description: 'Failed to submit feedback',
          variant: 'destructive',
        });
      }
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [type, entityId]);

  return {
    recommendations,
    loading,
    fetchRecommendations,
    generateRecommendation,
    provideFeedback,
  };
}
