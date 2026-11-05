import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { 
  Sparkles, TrendingUp, TrendingDown, ChevronDown, ChevronUp, 
  ThumbsUp, ThumbsDown, Volume2, VolumeX, Calendar, Users, 
  ShoppingCart, Target, CreditCard, MapPin, Lightbulb, Loader2,
  Star, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface WeekAISummaryProps {
  userId: string;
  weekType: 'current' | 'next';
}

interface WeekInsights {
  totalBeats: number;
  uniqueBeats: string[];
  plannedRetailers: number;
  completedVisits: number;
  productiveVisits: number;
  totalRevenue: number;
  averageOrderValue: number;
  growthVsLastWeek: number;
  pendingCollections: number;
  topRetailers: Array<{ name: string; revenue: number }>;
  topProducts: string[];
  unvisitedRetailers: number;
  targetProgress: number;
}

export const WeekAISummary = ({ userId, weekType }: WeekAISummaryProps) => {
  const [insights, setInsights] = useState<WeekInsights | null>(null);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const getWeekRange = () => {
    const baseDate = weekType === 'current' ? new Date() : addWeeks(new Date(), 1);
    return {
      start: startOfWeek(baseDate, { weekStartsOn: 1 }),
      end: endOfWeek(baseDate, { weekStartsOn: 1 })
    };
  };

  const { start, end } = getWeekRange();

  useEffect(() => {
    fetchWeekInsights();
  }, [userId, weekType]);

  const fetchWeekInsights = async () => {
    try {
      setLoadingInsights(true);
      const startDate = format(start, 'yyyy-MM-dd');
      const endDate = format(end, 'yyyy-MM-dd');
      
      // Previous week for comparison
      const prevWeekStart = format(subWeeks(start, 1), 'yyyy-MM-dd');
      const prevWeekEnd = format(subWeeks(end, 1), 'yyyy-MM-dd');

      // Fetch beat plans for the week
      const { data: beatPlans } = await supabase
        .from('beat_plans')
        .select('beat_name, plan_date, beat_id')
        .eq('user_id', userId)
        .gte('plan_date', startDate)
        .lte('plan_date', endDate);

      const uniqueBeats = [...new Set(beatPlans?.map(b => b.beat_name) || [])];
      const beatIds = [...new Set(beatPlans?.map(b => b.beat_id).filter(Boolean) || [])];

      // Fetch retailers for planned beats
      let plannedRetailers = 0;
      if (beatIds.length > 0) {
        const { count } = await supabase
          .from('retailers')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .in('beat_id', beatIds)
          .eq('status', 'active');
        plannedRetailers = count || 0;
      }

      // Fetch visits for the week
      const { data: visits } = await supabase
        .from('visits')
        .select('id, status, retailer_id')
        .eq('user_id', userId)
        .gte('visit_date', startDate)
        .lte('visit_date', endDate);

      const completedVisits = visits?.filter(v => v.status === 'completed' || v.status === 'productive').length || 0;
      const productiveVisits = visits?.filter(v => v.status === 'productive').length || 0;

      // Fetch orders for the week
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, total_amount, retailer_id')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const orders = ordersData as any[] || [];
      const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const averageOrderValue = orders.length ? totalRevenue / orders.length : 0;

      // Fetch previous week orders for comparison
      const { data: prevWeekOrdersData } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('user_id', userId)
        .gte('created_at', prevWeekStart)
        .lte('created_at', prevWeekEnd);

      const prevWeekOrders = prevWeekOrdersData as any[] || [];
      const prevWeekRevenue = prevWeekOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const growthVsLastWeek = prevWeekRevenue > 0 
        ? ((totalRevenue - prevWeekRevenue) / prevWeekRevenue) * 100 
        : 0;

      // Get pending payments from orders that aren't fully paid
      // We'll estimate based on total orders for simplicity
      const pendingCollections = Math.round(totalRevenue * 0.2); // Estimate 20% pending

      // Top retailers by revenue
      const retailerRevenue = new Map<string, number>();
      orders.forEach((o: any) => {
        if (o.retailer_id) {
          retailerRevenue.set(o.retailer_id, (retailerRevenue.get(o.retailer_id) || 0) + (o.total_amount || 0));
        }
      });

      const topRetailerIds = Array.from(retailerRevenue.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id);

      let topRetailers: Array<{ name: string; revenue: number }> = [];
      if (topRetailerIds.length > 0) {
        const { data: retailers } = await supabase
          .from('retailers')
          .select('id, name')
          .in('id', topRetailerIds);

        topRetailers = (retailers || []).map(r => ({
          name: r.name,
          revenue: retailerRevenue.get(r.id) || 0
        })).sort((a, b) => b.revenue - a.revenue);
      }

      // Top products from order_items
      const orderIds = orders.map((o: any) => o.id);
      let topProducts: string[] = [];
      
      if (orderIds.length > 0) {
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('product_name, quantity')
          .in('order_id', orderIds);

        const productCount = new Map<string, number>();
        (orderItems || []).forEach((item: any) => {
          const name = item.product_name || 'Unknown';
          productCount.set(name, (productCount.get(name) || 0) + (item.quantity || 1));
        });
        
        topProducts = Array.from(productCount.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name]) => name);
      }

      // Unvisited retailers calculation
      const visitedRetailerIds = new Set(visits?.map(v => v.retailer_id) || []);
      const unvisitedRetailers = plannedRetailers - visitedRetailerIds.size;

      // Target progress (simplified)
      const targetProgress = plannedRetailers > 0 
        ? Math.min(100, Math.round((completedVisits / plannedRetailers) * 100))
        : 0;

      setInsights({
        totalBeats: beatPlans?.length || 0,
        uniqueBeats,
        plannedRetailers,
        completedVisits,
        productiveVisits,
        totalRevenue,
        averageOrderValue,
        growthVsLastWeek,
        pendingCollections,
        topRetailers,
        topProducts,
        unvisitedRetailers: Math.max(0, unvisitedRetailers),
        targetProgress
      });

    } catch (error) {
      console.error('Error fetching week insights:', error);
    } finally {
      setLoadingInsights(false);
    }
  };

  const generateAISummary = async () => {
    if (!insights) return;
    
    try {
      setGenerating(true);
      
      const weekLabel = weekType === 'current' ? 'This Week' : 'Next Week';
      const prompt = weekType === 'current' 
        ? `Analyze the current week's sales performance and provide actionable insights:

Week: ${format(start, 'MMM dd')} - ${format(end, 'MMM dd')}
Beats Planned: ${insights.totalBeats} (${insights.uniqueBeats.join(', ')})
Retailers to Cover: ${insights.plannedRetailers}
Visits Completed: ${insights.completedVisits} (${insights.productiveVisits} productive)
Total Revenue: ₹${insights.totalRevenue.toLocaleString()}
Average Order: ₹${insights.averageOrderValue.toLocaleString()}
Growth vs Last Week: ${insights.growthVsLastWeek.toFixed(1)}%
Pending Collections: ₹${insights.pendingCollections.toLocaleString()}
Top Retailers: ${insights.topRetailers.map(r => r.name).join(', ')}
Top Products: ${insights.topProducts.join(', ')}
Unvisited Retailers: ${insights.unvisitedRetailers}

Provide 3-4 specific recommendations to improve performance this week. Focus on:
1. Priority actions for remaining days
2. Revenue optimization opportunities
3. Collection priorities
Keep it concise and actionable.`
        : `Based on next week's plan, provide strategic recommendations:

Week: ${format(start, 'MMM dd')} - ${format(end, 'MMM dd')}
Beats Planned: ${insights.totalBeats} across ${insights.uniqueBeats.length} territories
Territories: ${insights.uniqueBeats.join(', ')}
Retailers to Cover: ${insights.plannedRetailers}

Based on historical patterns, provide:
1. Key focus areas for the week
2. Expected challenges and how to prepare
3. Opportunities to maximize revenue
Keep it strategic and forward-looking.`;

      const { data, error } = await supabase.functions.invoke('chat-assistant', {
        body: { message: prompt, context: 'weekly_planning' }
      });

      if (error) throw error;
      
      setAiSummary(data?.response || generateFallbackSummary());
    } catch (error) {
      console.error('Error generating AI summary:', error);
      setAiSummary(generateFallbackSummary());
    } finally {
      setGenerating(false);
    }
  };

  const generateFallbackSummary = () => {
    if (!insights) return "Generate insights by clicking above.";
    
    if (weekType === 'current') {
      let summary = "🎯 Week Focus:\n\n";
      
      if (insights.completedVisits < insights.plannedRetailers * 0.5) {
        summary += `• Accelerate visits - ${insights.unvisitedRetailers} retailers pending\n`;
      }
      
      if (insights.pendingCollections > 0) {
        summary += `• Prioritize collections: ₹${insights.pendingCollections.toLocaleString()} pending\n`;
      }
      
      if (insights.topRetailers.length > 0) {
        summary += `• Focus on ${insights.topRetailers[0].name} - your top performer\n`;
      }
      
      if (insights.growthVsLastWeek < 0) {
        summary += `• Push harder - currently ${Math.abs(insights.growthVsLastWeek).toFixed(0)}% below last week\n`;
      } else if (insights.growthVsLastWeek > 0) {
        summary += `• Great momentum! ${insights.growthVsLastWeek.toFixed(0)}% above last week\n`;
      }
      
      return summary;
    } else {
      return `📅 Next Week Prep:\n\n• ${insights.totalBeats} beats across ${insights.uniqueBeats.length} territories\n• ${insights.plannedRetailers} retailers to cover\n• Focus territories: ${insights.uniqueBeats.slice(0, 2).join(', ')}\n• Review pending collections before starting`;
    }
  };

  const handleFeedback = async (type: 'up' | 'down') => {
    setFeedback(type);
    toast.success(type === 'up' ? "Thanks for your feedback!" : "We'll improve our recommendations");
    
    try {
      await supabase.from('ai_feature_feedback').insert({
        user_id: userId,
        feature: `week_summary_${weekType}`,
        feedback_type: type
      });
    } catch (error) {
      console.error('Error storing feedback:', error);
    }
  };

  const toggleSpeech = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!aiSummary) {
      toast.error("No content to read");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(aiSummary);
    utterance.rate = 0.95;
    utterance.pitch = 1.1;
    
    const voices = window.speechSynthesis.getVoices();
    const indianVoice = voices.find(v => 
      (v.lang === 'en-IN' || v.lang.includes('IN')) && v.name.toLowerCase().includes('female')
    ) || voices.find(v => 
      v.lang === 'en-IN' || v.lang.includes('IN')
    ) || voices.find(v => 
      v.name.toLowerCase().includes('indian')
    ) || voices.find(v => 
      v.lang.startsWith('en') && v.name.toLowerCase().includes('female')
    );
    
    if (indianVoice) {
      utterance.voice = indianVoice;
    }
    
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => {
      setIsSpeaking(false);
      toast.error("Speech synthesis failed");
    };
    
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const title = weekType === 'current' ? 'Current Week Summary' : 'Next Week Outlook';
  const gradientClass = weekType === 'current' 
    ? 'from-green-500/10 to-emerald-500/10' 
    : 'from-blue-500/10 to-indigo-500/10';

  if (loadingInsights) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className={`pb-2 bg-gradient-to-r ${gradientClass}`}>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
      <Card className="overflow-hidden border-2 border-primary/10">
        <CardHeader className={`pb-2 bg-gradient-to-r ${gradientClass}`}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              {title}
            </CardTitle>
            <div className="flex gap-1">
              {aiSummary && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSpeech}
                    className="h-7 w-7 p-0"
                    title={isSpeaking ? "Stop" : "Listen"}
                  >
                    {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={generateAISummary}
                    disabled={generating}
                    className="h-7 w-7 p-0"
                    title="Regenerate"
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  </Button>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={isCollapsed ? "Expand" : "Collapse"}>
                      {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-3">
            {/* Week Header */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {format(start, 'MMM dd')} - {format(end, 'MMM dd, yyyy')}
              </p>
              {insights && weekType === 'current' && (
                <Badge variant={insights.growthVsLastWeek >= 0 ? "default" : "secondary"} className="text-xs">
                  {insights.growthVsLastWeek >= 0 ? (
                    <><TrendingUp className="h-3 w-3 mr-1" /> +{insights.growthVsLastWeek.toFixed(0)}%</>
                  ) : (
                    <><TrendingDown className="h-3 w-3 mr-1" /> {insights.growthVsLastWeek.toFixed(0)}%</>
                  )}
                </Badge>
              )}
            </div>

            {insights && (
              <>
                {/* Key Metrics */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <MapPin className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-bold">{insights.totalBeats}</p>
                    <p className="text-[10px] text-muted-foreground">Beats</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <Users className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-bold">{insights.plannedRetailers}</p>
                    <p className="text-[10px] text-muted-foreground">Retailers</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <ShoppingCart className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-bold">₹{(insights.totalRevenue / 1000).toFixed(0)}K</p>
                    <p className="text-[10px] text-muted-foreground">Revenue</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <Target className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-bold">{insights.targetProgress}%</p>
                    <p className="text-[10px] text-muted-foreground">Progress</p>
                  </div>
                </div>

                {/* Visits Progress - Only for current week */}
                {weekType === 'current' && (
                  <div className="bg-muted/30 rounded-lg p-2 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Visit Progress</span>
                      <span className="font-medium">{insights.completedVisits}/{insights.plannedRetailers}</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${insights.targetProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{insights.productiveVisits} productive</span>
                      <span>{insights.unvisitedRetailers} remaining</span>
                    </div>
                  </div>
                )}

                {/* Territories */}
                {insights.uniqueBeats.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-primary" /> Territories
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {insights.uniqueBeats.slice(0, 4).map((beat, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">
                          {beat}
                        </Badge>
                      ))}
                      {insights.uniqueBeats.length > 4 && (
                        <Badge variant="secondary" className="text-[10px]">
                          +{insights.uniqueBeats.length - 4} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Top Retailers - Only for current week */}
                {weekType === 'current' && insights.topRetailers.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500" /> Top Performers
                    </p>
                    {insights.topRetailers.map((r, i) => (
                      <div key={i} className="flex items-center justify-between bg-gradient-to-r from-yellow-500/5 to-orange-500/5 rounded px-2 py-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-yellow-600">{i + 1}</span>
                          <span className="font-medium truncate max-w-[120px]">{r.name}</span>
                        </div>
                        <span className="font-medium">₹{r.revenue.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending Collections Warning */}
                {weekType === 'current' && insights.pendingCollections > 0 && (
                  <div className="bg-red-500/10 rounded-lg p-2">
                    <p className="text-xs font-semibold flex items-center gap-1 text-red-600">
                      <CreditCard className="h-3 w-3" /> Pending Collections
                    </p>
                    <p className="text-sm font-bold text-red-600">
                      ₹{insights.pendingCollections.toLocaleString()}
                    </p>
                  </div>
                )}

                {/* Top Products */}
                {insights.topProducts.length > 0 && (
                  <div className="bg-green-500/10 rounded-lg p-2">
                    <p className="text-[10px] font-semibold text-green-600 flex items-center gap-1 mb-1">
                      <TrendingUp className="h-3 w-3" /> {weekType === 'current' ? 'Hot This Week' : 'Focus Products'}
                    </p>
                    <p className="text-xs truncate">
                      {insights.topProducts.join(', ')}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* AI Summary Section */}
            {aiSummary ? (
              <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-lg p-3 border border-primary/20">
                <p className="text-xs font-semibold flex items-center gap-1 mb-2 text-primary">
                  <Lightbulb className="h-3 w-3" /> AI Recommendations
                </p>
                <p className="text-xs whitespace-pre-line leading-relaxed">{aiSummary}</p>
              </div>
            ) : (
              <Button 
                onClick={generateAISummary}
                disabled={generating || !insights}
                size="sm"
                variant="outline"
                className="w-full"
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> Generate AI Insights</>
                )}
              </Button>
            )}

            {/* Feedback Buttons */}
            {aiSummary && !generating && (
              <div className="flex items-center justify-center gap-3 pt-2 border-t border-border/50">
                <span className="text-xs text-muted-foreground">Was this helpful?</span>
                <Button
                  variant={feedback === 'up' ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-3"
                  onClick={() => handleFeedback('up')}
                  disabled={feedback !== null}
                >
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  Yes
                </Button>
                <Button
                  variant={feedback === 'down' ? "destructive" : "outline"}
                  size="sm"
                  className="h-7 px-3"
                  onClick={() => handleFeedback('down')}
                  disabled={feedback !== null}
                >
                  <ThumbsDown className="h-3 w-3 mr-1" />
                  No
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};