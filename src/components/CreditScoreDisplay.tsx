import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, CreditCard, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreditScoreRationale } from "@/components/credit/CreditScoreRationale";
import { CreditLimitWidget } from "@/components/credit/CreditLimitWidget";
import { useCreditScoreCalculation } from "@/hooks/useCreditScoreCalculation";

interface CreditScoreDisplayProps {
  retailerId: string;
  variant?: "compact" | "full";
  showCreditLimit?: boolean;
}

export const CreditScoreDisplay = ({ 
  retailerId, 
  variant = "compact",
  showCreditLimit = false 
}: CreditScoreDisplayProps) => {
  const { triggerCalculation, isCalculating } = useCreditScoreCalculation(retailerId);
  const hasTriggeredCalculation = useRef(false);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['credit-config-active'],
    queryFn: async () => {
      // Get any active enabled config (territory filtering happens at calculation time)
      const { data, error } = await supabase
        .from('credit_management_config')
        .select('*')
        .eq('is_enabled', true)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  const { data: creditScore, isLoading: scoreLoading } = useQuery({
    queryKey: ['credit-score', retailerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('retailer_credit_scores')
        .select('*')
        .eq('retailer_id', retailerId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!config?.is_enabled
  });

  // Auto-trigger calculation if AI-driven mode and no score exists
  useEffect(() => {
    if (
      config?.is_enabled && 
      config?.scoring_mode === 'ai_driven' && 
      !creditScore && 
      !scoreLoading && 
      !hasTriggeredCalculation.current
    ) {
      hasTriggeredCalculation.current = true;
      triggerCalculation();
    }
  }, [config, creditScore, scoreLoading, triggerCalculation]);

  const { data: retailer } = useQuery({
    queryKey: ['retailer-manual-score', retailerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('retailers')
        .select('manual_credit_score')
        .eq('id', retailerId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: config?.is_enabled && config?.scoring_mode === 'manual'
  });

  // Don't show anything if credit management is disabled (only for compact)
  if (!config?.is_enabled) {
    if (variant === "compact") return null;
    // For full variant, show disabled message
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Credit Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">Credit management is not enabled.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isLoading = configLoading || scoreLoading;
  const score = config.scoring_mode === 'manual' 
    ? retailer?.manual_credit_score 
    : creditScore?.score;

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 6) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return "Excellent";
    if (score >= 6) return "Good";
    if (score >= 4) return "Fair";
    return "Poor";
  };

  // Format credit limit for display
  const formatCreditLimit = (amount: number) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
    return `₹${amount.toLocaleString()}`;
  };

  if (variant === "compact") {
    // Show loading state
    if (isLoading || isCalculating) {
      return (
        <Badge variant="outline" className="text-muted-foreground bg-muted/30 border-muted">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Calculating...
        </Badge>
      );
    }
    
    // Show placeholder if no score yet
    if (!score) {
      return (
        <Badge variant="outline" className="text-muted-foreground bg-muted/30 border-muted">
          <CreditCard className="mr-1 h-3 w-3" />
          No Score
        </Badge>
      );
    }

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-auto p-0">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className={getScoreColor(score)}>
                <CreditCard className="mr-1 h-3 w-3" />
                {score.toFixed(1)}/10
              </Badge>
              {creditScore?.credit_limit && (
                <span className="text-xs text-muted-foreground">
                  {formatCreditLimit(creditScore.credit_limit)}
                </span>
              )}
              <Info className="h-3 w-3 text-muted-foreground" />
            </div>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Credit Score Details</DialogTitle>
          </DialogHeader>
          <CreditScoreBreakdown 
            score={score} 
            creditScore={creditScore}
            config={config}
            showCreditLimit={showCreditLimit}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Full variant - always show card
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Credit Score
            </CardTitle>
            <CardDescription>
              {config.scoring_mode === 'manual' ? 'Manual Entry' : 'AI-Driven Calculation'}
            </CardDescription>
          </div>
          {isCalculating ? (
            <div className="text-right">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Calculating...</span>
              </div>
            </div>
          ) : score ? (
            <div className="text-right">
              <div className={`text-3xl font-bold px-3 py-1 rounded-lg ${getScoreColor(score)}`}>
                {score.toFixed(1)}/10
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {getScoreLabel(score)}
              </div>
            </div>
          ) : (
            <div className="text-right">
              <div className="text-2xl font-bold text-muted-foreground">
                --/10
              </div>
              <div className="text-sm text-muted-foreground">
                Not calculated
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <CreditScoreBreakdown 
          score={score} 
          creditScore={creditScore}
          config={config}
          showCreditLimit={showCreditLimit}
        />
      </CardContent>
    </Card>
  );
};

const CreditScoreBreakdown = ({ score, creditScore, config, showCreditLimit }: any) => {
  if (config.scoring_mode === 'manual') {
    if (!score) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No manual credit score has been set for this retailer yet.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            An administrator can set a credit score (0-10) from the retailer's profile.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This credit score has been manually entered by an administrator.
        </p>
        {showCreditLimit && creditScore?.credit_limit && (
          <CreditLimitWidget
            creditLimit={creditScore.credit_limit}
            outstandingAmount={0}
            score={score}
            compact
          />
        )}
      </div>
    );
  }

  if (!creditScore || !score) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No AI-driven score calculated yet.
          </p>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Score will be generated based on:</strong></p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li>Sales growth rate over time</li>
            <li>Payment speed (Days Sales Outstanding)</li>
            <li>Order frequency per visit</li>
          </ul>
        </div>
      </div>
    );
  }

  const isNewRetailer = !creditScore.growth_rate_score && !creditScore.repayment_dso_score;

  return (
    <div className="space-y-4">
      <CreditScoreRationale
        score={score}
        growthRateScore={creditScore.growth_rate_score || 0}
        repaymentDsoScore={creditScore.repayment_dso_score || 0}
        orderFrequencyScore={creditScore.order_frequency_score || 0}
        avgGrowthRate={creditScore.avg_growth_rate || 0}
        avgDso={creditScore.avg_dso || 0}
        avgOrderFrequency={creditScore.avg_order_frequency || 0}
        weightGrowthRate={config.weight_growth_rate || 4}
        weightRepaymentDso={config.weight_repayment_dso || 4}
        weightOrderFrequency={config.weight_order_frequency || 2}
        targetDays={config.payment_term_days || 30}
        isNewRetailer={isNewRetailer}
      />

      {showCreditLimit && creditScore?.credit_limit && (
        <CreditLimitWidget
          creditLimit={creditScore.credit_limit}
          outstandingAmount={0}
          score={score}
          scoreLabel={isNewRetailer ? "New Retailer" : undefined}
        />
      )}

      <div className="text-xs text-muted-foreground">
        Last calculated: {new Date(creditScore.calculated_at).toLocaleString()}
      </div>
    </div>
  );
};