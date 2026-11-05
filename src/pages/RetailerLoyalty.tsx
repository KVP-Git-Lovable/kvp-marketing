import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Gift, Star, TrendingUp, ThumbsUp, ThumbsDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function RetailerLoyalty() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedFeedback, setSelectedFeedback] = useState<{ [key: string]: 'positive' | 'negative' | null }>({});

  // Fetch active loyalty programs
  const { data: programs, isLoading: programsLoading } = useQuery({
    queryKey: ['loyalty-programs-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('retailer_loyalty_programs')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch loyalty actions for active programs
  const { data: actions, isLoading: actionsLoading } = useQuery({
    queryKey: ['loyalty-actions-active'],
    queryFn: async () => {
      if (!programs?.length) return [];
      
      const programIds = programs.map(p => p.id);
      const { data, error } = await supabase
        .from('retailer_loyalty_actions')
        .select('*')
        .in('program_id', programIds)
        .eq('is_enabled', true)
        .order('points', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!programs?.length,
  });

  // Submit feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: async ({ actionId, feedbackType }: { actionId: string; feedbackType: 'positive' | 'negative' }) => {
      const { error } = await supabase
        .from('retailer_loyalty_feedback')
        .insert({
          action_id: actionId,
          feedback_type: feedbackType,
          fse_user_id: user?.id,
          feedback_date: new Date().toISOString(),
        });
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      setSelectedFeedback(prev => ({ ...prev, [variables.actionId]: variables.feedbackType }));
      toast({
        title: "Feedback Recorded",
        description: "Thank you for sharing the retailer's reaction!",
      });
      queryClient.invalidateQueries({ queryKey: ['loyalty-feedback'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to record feedback. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFeedback = (actionId: string, feedbackType: 'positive' | 'negative') => {
    feedbackMutation.mutate({ actionId, feedbackType });
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'first_order_bonus':
        return '🎁';
      case 'order_frequency_reward':
        return '🔄';
      case 'order_value_milestone':
        return '💰';
      case 'new_product_trial':
        return '🆕';
      case 'bulk_order_reward':
        return '📦';
      case 'timely_payment':
        return '⚡';
      case 'growth_bonus':
        return '📈';
      default:
        return '⭐';
    }
  };

  const getActionDescription = (action: any) => {
    switch (action.action_type) {
      case 'first_order_bonus':
        return 'First time ordering? Get bonus points!';
      case 'order_frequency_reward':
        return `Order ${action.consecutive_orders_required || 3} times in a row`;
      case 'order_value_milestone':
        return `Order worth ₹${action.min_order_value || 0}+`;
      case 'new_product_trial':
        return 'Try new products and earn';
      case 'bulk_order_reward':
        return `Order ${action.min_quantity || 0}+ units at once`;
      case 'timely_payment':
        return 'Pay on time and earn rewards';
      case 'growth_bonus':
        return `Grow orders by ${action.min_growth_percentage || 0}%`;
      default:
        return 'Special loyalty reward';
    }
  };

  if (programsLoading || actionsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  const activeProgram = programs?.[0];

  return (
    <Layout>
      <div className="container mx-auto p-4 sm:p-6 max-w-4xl space-y-6">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 text-white p-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Gift className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Retailer Rewards</h1>
                <p className="text-white/90">Loyalty Program</p>
              </div>
            </div>
            
            {activeProgram && (
              <div className="mt-6 p-4 bg-white/20 backdrop-blur-sm rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">{activeProgram.program_name}</h2>
                    <p className="text-sm text-white/90">{activeProgram.description || 'Earn points on every qualifying activity'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">{activeProgram.points_to_rupee_conversion}:1</div>
                    <div className="text-xs text-white/80">Points to ₹ Ratio</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              How Retailers Earn Points
            </CardTitle>
            <CardDescription>
              Show this to your retailers and explain how they can benefit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {actions?.map((action, index) => (
                <div
                  key={action.id}
                  className="p-4 rounded-xl border-2 border-border bg-gradient-to-r from-background to-secondary/5 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">{getActionIcon(action.action_type)}</span>
                        <div>
                          <h3 className="font-semibold text-lg">{action.action_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {getActionDescription(action)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-3">
                        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                          <Star className="h-3 w-3 mr-1" />
                          {action.points} Points
                        </Badge>
                        
                        {activeProgram?.points_to_rupee_conversion && (
                          <Badge variant="outline" className="border-primary/30">
                            ≈ ₹{Math.round(action.points / activeProgram.points_to_rupee_conversion)}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Feedback Buttons */}
                    <div className="flex flex-col gap-2 items-center">
                      <p className="text-xs text-muted-foreground mb-1">Retailer's Reaction</p>
                      <div className="flex gap-2">
                        <Button
                          variant={selectedFeedback[action.id] === 'positive' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleFeedback(action.id, 'positive')}
                          disabled={feedbackMutation.isPending}
                          className={selectedFeedback[action.id] === 'positive' ? 'bg-green-500 hover:bg-green-600' : ''}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={selectedFeedback[action.id] === 'negative' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleFeedback(action.id, 'negative')}
                          disabled={feedbackMutation.isPending}
                          className={selectedFeedback[action.id] === 'negative' ? 'bg-red-500 hover:bg-red-600' : ''}
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </Button>
                      </div>
                      {selectedFeedback[action.id] && (
                        <p className="text-xs text-muted-foreground">Recorded</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Benefits Card */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Rewards & Benefits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Gift className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold">Convert to Vouchers</h4>
                  <p className="text-sm text-muted-foreground">
                    Every {activeProgram?.points_to_rupee_conversion || 100} points = ₹1 voucher for future purchases
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Star className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold">No Expiry</h4>
                  <p className="text-sm text-muted-foreground">
                    Points never expire - keep accumulating for bigger rewards
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold">Track Progress</h4>
                  <p className="text-sm text-muted-foreground">
                    Retailers can view their points history anytime
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="text-center p-6 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl">
          <p className="text-lg font-medium mb-2">Start Earning Today!</p>
          <p className="text-sm text-muted-foreground">
            Place your next order and watch the points add up automatically
          </p>
        </div>
      </div>
    </Layout>
  );
}
