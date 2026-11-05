import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { calculateCreditScore } from '@/utils/creditScoreCalculator';

export function useCreditScoreCalculation(retailerId: string) {
  const [isCalculating, setIsCalculating] = useState(false);
  const queryClient = useQueryClient();

  const triggerCalculation = useCallback(async () => {
    if (!retailerId || isCalculating) return null;

    setIsCalculating(true);
    try {
      const result = await calculateCreditScore(retailerId);
      
      // Invalidate the credit score query to refetch
      await queryClient.invalidateQueries({ 
        queryKey: ['credit-score', retailerId] 
      });

      return result;
    } catch (error) {
      console.error('Error in credit score calculation:', error);
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, [retailerId, isCalculating, queryClient]);

  return {
    triggerCalculation,
    isCalculating
  };
}
