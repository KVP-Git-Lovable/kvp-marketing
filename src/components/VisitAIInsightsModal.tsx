import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Sparkles, TrendingUp, Target, MessageCircle, MapPin, Megaphone, ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface VisitAIInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  retailerId: string;
  retailerName: string;
  visitId: string;
}

interface AIInsights {
  crossSell?: Array<{
    product: string;
    reason: string;
    potentialMargin?: string;
  }>;
  upSell?: Array<{
    opportunity: string;
    reasoning: string;
  }>;
  questions?: Array<{
    question: string;
    category: string;
    options: string[];
  }>;
  territoryInsights?: Array<string | { insight: string; fomo?: string }>;
  marketingInitiatives?: Array<{
    title: string;
    description: string;
  }>;
  rawResponse?: string;
}

export const VisitAIInsightsModal = ({
  isOpen,
  onClose,
  retailerId,
  retailerName,
  visitId,
}: VisitAIInsightsModalProps) => {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);

  const generateInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-visit-ai-insights', {
        body: { retailerId },
      });

      if (error) throw error;

      if (data?.insights) {
        setInsights(data.insights);
        toast({
          title: "AI Insights Generated",
          description: "Your personalized visit insights are ready",
        });
      }
    } catch (error: any) {
      console.error('Error generating insights:', error);
      toast({
        title: "Failed to generate insights",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionAnswer = (questionIndex: number, answer: string) => {
    setQuestionAnswers(prev => ({
      ...prev,
      [questionIndex]: answer,
    }));
  };

  const saveAnswers = async () => {
    try {
      // Get the current visit's feedback or create new
      const { data: existingVisit } = await supabase
        .from('visits')
        .select('feedback')
        .eq('id', visitId)
        .single();

      const currentFeedback = existingVisit?.feedback as Record<string, any> || {};
      
      const updatedFeedback = {
        ...currentFeedback,
        aiQuestions: Object.entries(questionAnswers).map(([index, answer]) => ({
          question: insights?.questions?.[parseInt(index)]?.question,
          category: insights?.questions?.[parseInt(index)]?.category,
          answer,
          timestamp: new Date().toISOString(),
        })),
      };

      await supabase
        .from('visits')
        .update({ feedback: updatedFeedback } as any)
        .eq('id', visitId);

      toast({
        title: "Answers saved",
        description: "Your responses have been recorded for analytics",
      });
    } catch (error: any) {
      console.error('Error saving answers:', error);
      toast({
        title: "Failed to save answers",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const submitFeedback = async (feedbackType: 'positive' | 'negative') => {
    try {
      await supabase.from('ai_feature_feedback').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        retailer_id: retailerId,
        visit_id: visitId,
        feedback_type: feedbackType,
        feature: 'visit_ai_insights',
        created_at: new Date().toISOString(),
      });

      setFeedback(feedbackType);
      toast({
        title: "Thank you for your feedback!",
        description: "Your input helps us improve AI recommendations",
      });
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Visit Insights
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{retailerName}</p>
        </DialogHeader>

        {!insights ? (
          <div className="py-8 text-center space-y-4">
            <Sparkles className="h-12 w-12 mx-auto text-primary animate-pulse" />
            <div>
              <h3 className="text-lg font-medium mb-2">Get AI-Powered Visit Insights</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Receive personalized recommendations for cross-selling, up-selling, and conversation topics
              </p>
            </div>
            <Button onClick={generateInsights} disabled={loading} size="lg">
              {loading ? "Generating Insights..." : "Generate AI Insights"}
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="cross-sell" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="cross-sell">Cross & Up-Sell</TabsTrigger>
              <TabsTrigger value="questions">Questions</TabsTrigger>
              <TabsTrigger value="territory">Territory Info</TabsTrigger>
            </TabsList>

            <TabsContent value="cross-sell" className="space-y-4">
              {/* Cross-Sell Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4" />
                    Cross-Sell Opportunities
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {insights.crossSell && insights.crossSell.length > 0 ? (
                    insights.crossSell.map((item, index) => (
                      <div key={index} className="p-3 bg-muted/50 rounded-lg space-y-1">
                        <div className="font-medium text-sm">{item.product}</div>
                        <div className="text-xs text-muted-foreground">{item.reason}</div>
                        {item.potentialMargin && (
                          <Badge variant="secondary" className="text-xs">
                            Potential Margin: {item.potentialMargin}
                          </Badge>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No cross-sell opportunities identified</p>
                  )}
                </CardContent>
              </Card>

              {/* Up-Sell Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4" />
                    Up-Sell Opportunities
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {insights.upSell && insights.upSell.length > 0 ? (
                    insights.upSell.map((item, index) => (
                      <div key={index} className="p-3 bg-muted/50 rounded-lg space-y-1">
                        <div className="font-medium text-sm">{item.opportunity}</div>
                        <div className="text-xs text-muted-foreground">{item.reasoning}</div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No up-sell opportunities identified</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="questions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageCircle className="h-4 w-4" />
                    Questions to Ask
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Ask these questions and record the retailer's response</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insights.questions && insights.questions.length > 0 ? (
                    <>
                      {insights.questions.map((q, index) => (
                        <div key={index} className="space-y-2 p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className="text-xs">
                              {q.category}
                            </Badge>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{q.question}</p>
                            </div>
                          </div>
                          <RadioGroup
                            value={questionAnswers[index]}
                            onValueChange={(value) => handleQuestionAnswer(index, value)}
                          >
                            {q.options.map((option, optIndex) => (
                              <div key={optIndex} className="flex items-center space-x-2">
                                <RadioGroupItem value={option} id={`q${index}-opt${optIndex}`} />
                                <Label htmlFor={`q${index}-opt${optIndex}`} className="text-sm cursor-pointer">
                                  {option}
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      ))}
                      <Button onClick={saveAnswers} className="w-full" size="sm">
                        Save All Answers
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No questions generated</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="territory" className="space-y-4">
              {/* Territory Insights */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="h-4 w-4" />
                    Territory Insights
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Share these insights to create FOMO and drive sales</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {insights.territoryInsights && insights.territoryInsights.length > 0 ? (
                    insights.territoryInsights.map((insight, index) => {
                      const insightText = typeof insight === 'string' 
                        ? insight 
                        : insight.insight || '';
                      const fomoText = typeof insight === 'object' && insight.fomo 
                        ? insight.fomo 
                        : null;
                      
                      return (
                        <div key={index} className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-1">
                          <p className="text-sm">{insightText}</p>
                          {fomoText && (
                            <p className="text-xs text-muted-foreground italic">{fomoText}</p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">No territory insights available</p>
                  )}
                </CardContent>
              </Card>

              {/* Marketing Initiatives */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Megaphone className="h-4 w-4" />
                    Marketing Initiatives
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Current programs to share with the retailer</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {insights.marketingInitiatives && insights.marketingInitiatives.length > 0 ? (
                    insights.marketingInitiatives.map((initiative, index) => (
                      <div key={index} className="p-3 bg-muted/50 rounded-lg space-y-1">
                        <div className="font-medium text-sm">{initiative.title}</div>
                        <div className="text-xs text-muted-foreground">{initiative.description}</div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No marketing initiatives available</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {insights && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-xs text-muted-foreground">Was this helpful?</p>
            <div className="flex gap-2">
              <Button
                variant={feedback === 'positive' ? 'default' : 'outline'}
                size="sm"
                onClick={() => submitFeedback('positive')}
                disabled={feedback !== null}
              >
                <ThumbsUp className="h-4 w-4" />
              </Button>
              <Button
                variant={feedback === 'negative' ? 'default' : 'outline'}
                size="sm"
                onClick={() => submitFeedback('negative')}
                disabled={feedback !== null}
              >
                <ThumbsDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
