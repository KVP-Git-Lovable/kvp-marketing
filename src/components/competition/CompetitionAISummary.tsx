import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, TrendingUp, AlertTriangle, CheckCircle, Lightbulb, Target, AlertCircle, Newspaper, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CompetitionAISummaryProps {
  competitorId: string;
  competitorName: string;
  competitionData: any[];
  competitorData?: any;
}

interface SWOTAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

interface NewsItem {
  title: string;
  summary: string;
  source: string;
  date: string;
  url: string;
}

export const CompetitionAISummary: React.FC<CompetitionAISummaryProps> = ({
  competitorId,
  competitorName,
  competitionData,
  competitorData,
}) => {
  const [summary, setSummary] = useState<string>("");
  const [monthlySummaries, setMonthlySummaries] = useState<any[]>([]);
  const [swot, setSwot] = useState<SWOTAnalysis | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (competitionData.length > 0) {
      generateSummary();
    }
  }, [competitionData, competitorId]);

  const generateSummary = async () => {
    setLoading(true);
    try {
      // Generate basic summary
      const grouped = groupByMonth(competitionData);
      const summaries = Object.entries(grouped).map(([month, data]) => {
        const dataArray = data as any[];
        return {
          month,
          totalObservations: dataArray.length,
          topSKUs: getTopSKUs(dataArray),
          averagePrice: (dataArray.reduce((sum: number, item: any) => sum + (item.selling_price || 0), 0) / dataArray.length).toFixed(2),
        };
      });

      setMonthlySummaries(summaries);
      const basicSummary = generateBasicSummary(competitionData, summaries);
      setSummary(basicSummary);

      // Generate SWOT and News using edge function
      console.log('Calling generate-competition-ai-summary...');
      const { data, error } = await supabase.functions.invoke('generate-competition-ai-summary', {
        body: {
          competitorId,
          competitorName,
          competitorData: competitorData || {}
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        toast.error('Failed to generate AI insights');
      } else if (data) {
        console.log('AI summary generated:', data);
        if (data.swot) setSwot(data.swot);
        if (data.news) setNews(data.news);
        toast.success('AI insights generated successfully');
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      setSummary("Failed to generate AI summary. Please try again.");
      toast.error('Error generating summary');
    } finally {
      setLoading(false);
    }
  };

  const generateBasicSummary = (data: any[], summaries: any[]): string => {
    const highImpact = data.filter(d => d.impact_level === 'high').length;
    const needsAttention = data.filter(d => d.needs_attention).length;
    
    return `
**Overall Analysis**
- Total Observations: ${data.length}
- High Impact Items: ${highImpact}
- Items Needing Attention: ${needsAttention}

**Monthly Trend**
${summaries.map(s => `${s.month}: ${s.totalObservations} observations, Top SKUs: ${s.topSKUs.join(', ')}`).join('\n')}

**Key Insights**
- Competitor showing ${highImpact > 5 ? 'strong' : 'moderate'} market presence
- ${needsAttention > 0 ? `${needsAttention} items require immediate attention` : 'No critical items identified'}
    `.trim();
  };

  const groupByMonth = (data: any[]) => {
    return data.reduce((acc: any, item: any) => {
      const date = new Date(item.created_at);
      const month = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      if (!acc[month]) acc[month] = [];
      acc[month].push(item);
      return acc;
    }, {});
  };

  const getTopSKUs = (data: any[]): string[] => {
    const skuCount: any = {};
    data.forEach((item: any) => {
      const sku = item.sku_id || 'Unknown';
      skuCount[sku] = (skuCount[sku] || 0) + 1;
    });
    return Object.entries(skuCount)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 3)
      .map((entry: any) => entry[0]);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base md:text-lg font-semibold">AI-Powered Competition Analysis</h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            Insights from {competitionData.length} data points
          </p>
        </div>
        <Button onClick={generateSummary} disabled={loading} variant="outline" size="sm" className="w-full sm:w-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          <span className="text-xs md:text-sm">Regenerate</span>
        </Button>
      </div>

      <Separator />

      {/* Overall Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm md:text-base">
            <TrendingUp className="h-4 w-4 md:h-5 md:w-5" />
            Overall Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-xs md:text-sm break-words">{summary}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Breakdown */}
      {monthlySummaries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm md:text-base">Monthly Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {monthlySummaries.map((month, idx) => (
                <Card key={idx} className="border">
                  <CardContent className="pt-3 md:pt-4 p-3 md:p-6">
                    <div className="text-xs md:text-sm font-semibold mb-2">{month.month}</div>
                    <div className="space-y-1 text-xs md:text-sm text-muted-foreground">
                      <div>Observations: {month.totalObservations}</div>
                      <div>Avg Price: ₹{month.averagePrice}</div>
                      <div className="text-[10px] md:text-xs break-words">Top: {month.topSKUs.join(', ')}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SWOT Analysis Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm md:text-base">
            <Target className="h-4 w-4 md:h-5 md:w-5" />
            SWOT Analysis
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">AI-powered competitive intelligence analysis</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3 md:space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : swot ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {/* Strengths */}
              <Card className="border-green-200 dark:border-green-900">
                <CardHeader className="pb-2 md:pb-3">
                  <CardTitle className="text-xs md:text-sm flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-green-600 shrink-0" />
                    Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                    {swot.strengths.map((strength, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5 shrink-0">•</span>
                        <span className="break-words">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Weaknesses */}
              <Card className="border-red-200 dark:border-red-900">
                <CardHeader className="pb-2 md:pb-3">
                  <CardTitle className="text-xs md:text-sm flex items-center gap-2">
                    <AlertCircle className="h-3 w-3 md:h-4 md:w-4 text-red-600 shrink-0" />
                    Weaknesses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                    {swot.weaknesses.map((weakness, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-red-600 mt-0.5 shrink-0">•</span>
                        <span className="break-words">{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Opportunities */}
              <Card className="border-blue-200 dark:border-blue-900">
                <CardHeader className="pb-2 md:pb-3">
                  <CardTitle className="text-xs md:text-sm flex items-center gap-2">
                    <Lightbulb className="h-3 w-3 md:h-4 md:w-4 text-blue-600 shrink-0" />
                    Opportunities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                    {swot.opportunities.map((opportunity, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-blue-600 mt-0.5 shrink-0">•</span>
                        <span className="break-words">{opportunity}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Threats */}
              <Card className="border-orange-200 dark:border-orange-900">
                <CardHeader className="pb-2 md:pb-3">
                  <CardTitle className="text-xs md:text-sm flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 text-orange-600 shrink-0" />
                    Threats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                    {swot.threats.map((threat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-orange-600 mt-0.5 shrink-0">•</span>
                        <span className="break-words">{threat}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-6 md:py-8 text-muted-foreground">
              <Target className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-2 opacity-50" />
              <p className="text-xs md:text-sm">Click "Regenerate Summary" to generate SWOT analysis</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* News Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm md:text-base">
            <Newspaper className="h-4 w-4 md:h-5 md:w-5" />
            Latest Competitor News
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">Recent news and developments from external sources</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3 md:space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : news.length > 0 ? (
            <div className="space-y-3 md:space-y-4">
              {news.map((item, idx) => (
                <Card key={idx} className="hover:bg-accent/50 transition-colors">
                  <CardContent className="pt-3 md:pt-4 p-3 md:p-6">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2 md:gap-4">
                        <h4 className="font-semibold text-xs md:text-sm flex-1 break-words">
                          {item.title}
                        </h4>
                        <Badge variant="outline" className="text-[10px] md:text-xs whitespace-nowrap shrink-0">
                          {item.date}
                        </Badge>
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground break-words">
                        {item.summary}
                      </p>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] md:text-xs text-muted-foreground break-all">
                          Source: {item.source}
                        </span>
                        {item.url && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 md:h-7 text-[10px] md:text-xs gap-1 shrink-0"
                            onClick={() => window.open(item.url, '_blank')}
                          >
                            Read More
                            <ExternalLink className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 md:py-8 text-muted-foreground">
              <Newspaper className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-2 opacity-50" />
              <p className="text-xs md:text-sm">Click "Regenerate Summary" to fetch latest news</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Card>
          <CardContent className="pt-4 md:pt-6 p-3 md:p-6">
            <div className="text-lg md:text-2xl font-bold">{competitionData.length}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">Total Observations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-6 p-3 md:p-6">
            <div className="text-lg md:text-2xl font-bold text-orange-600">
              {competitionData.filter(d => d.impact_level === 'high').length}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground">High Impact</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-6 p-3 md:p-6">
            <div className="text-lg md:text-2xl font-bold text-red-600">
              {competitionData.filter(d => d.needs_attention).length}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground">Needs Attention</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
