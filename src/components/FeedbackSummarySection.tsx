import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  Palette, 
  Target, 
  Star,
  ChevronRight,
  Building2,
  ThumbsUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { FeedbackDetailModal } from "./FeedbackDetailModal";

interface FeedbackSummaryProps {
  dateFrom: Date;
  dateTo: Date;
  userId?: string;
}

interface RetailerFeedbackData {
  id: string;
  retailer_name: string;
  feedback_type: string;
  rating: number;
  summary_notes: string;
  created_at: string;
}

interface BrandingRequestData {
  id: string;
  retailer_name: string;
  title: string;
  status: string;
  requested_assets: string;
  description?: string;
  created_at: string;
}

interface CompetitionDataItem {
  id: string;
  retailer_name: string;
  competitor_name: string;
  insight: string;
  impact_level: string;
  created_at: string;
}

export function FeedbackSummarySection({ dateFrom, dateTo, userId }: FeedbackSummaryProps) {
  const [loading, setLoading] = useState(true);
  const [retailerFeedback, setRetailerFeedback] = useState<RetailerFeedbackData[]>([]);
  const [brandingRequests, setBrandingRequests] = useState<BrandingRequestData[]>([]);
  const [competitionData, setCompetitionData] = useState<CompetitionDataItem[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<{ type: 'retailer' | 'branding' | 'competition', data: any } | null>(null);

  useEffect(() => {
    fetchFeedbackData();
  }, [dateFrom, dateTo, userId]);

  const fetchFeedbackData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const targetUserId = userId || user?.id;
      
      if (!targetUserId) return;

      const fromDate = format(dateFrom, 'yyyy-MM-dd');
      const toDate = format(dateTo, 'yyyy-MM-dd');

      // Fetch retailer feedback without inner join
      const { data: feedbackData } = await supabase
        .from('retailer_feedback')
        .select('id, feedback_type, rating, summary_notes, created_at, retailer_id')
        .eq('user_id', targetUserId)
        .gte('created_at', `${fromDate}T00:00:00`)
        .lte('created_at', `${toDate}T23:59:59`)
        .order('created_at', { ascending: false });

      // Fetch branding requests without inner join
      const { data: brandingData } = await supabase
        .from('branding_requests')
        .select('id, title, status, requested_assets, description, created_at, retailer_id')
        .eq('user_id', targetUserId)
        .gte('created_at', `${fromDate}T00:00:00`)
        .lte('created_at', `${toDate}T23:59:59`)
        .order('created_at', { ascending: false });

      // Fetch competition data without inner join
      const { data: competitionDataResult } = await supabase
        .from('competition_data')
        .select('id, insight, impact_level, created_at, retailer_id, competitor_id')
        .eq('user_id', targetUserId)
        .gte('created_at', `${fromDate}T00:00:00`)
        .lte('created_at', `${toDate}T23:59:59`)
        .order('created_at', { ascending: false });

      // Collect all retailer IDs and competitor IDs
      const retailerIds = new Set<string>();
      const competitorIds = new Set<string>();
      
      feedbackData?.forEach(f => f.retailer_id && retailerIds.add(f.retailer_id));
      brandingData?.forEach(b => b.retailer_id && retailerIds.add(b.retailer_id));
      competitionDataResult?.forEach(c => {
        if (c.retailer_id) retailerIds.add(c.retailer_id);
        if (c.competitor_id) competitorIds.add(c.competitor_id);
      });

      // Fetch retailer names
      let retailerMap = new Map<string, string>();
      if (retailerIds.size > 0) {
        const { data: retailers } = await supabase
          .from('retailers')
          .select('id, name')
          .in('id', Array.from(retailerIds));
        retailers?.forEach(r => retailerMap.set(r.id, r.name));
      }

      // Fetch competitor names
      let competitorMap = new Map<string, string>();
      if (competitorIds.size > 0) {
        const { data: competitors } = await supabase
          .from('competition_master')
          .select('id, competitor_name')
          .in('id', Array.from(competitorIds));
        competitors?.forEach(c => competitorMap.set(c.id, c.competitor_name));
      }

      // Map retailer feedback with names
      if (feedbackData) {
        setRetailerFeedback(feedbackData.map((f: any) => ({
          id: f.id,
          retailer_name: retailerMap.get(f.retailer_id) || 'Unknown',
          feedback_type: f.feedback_type,
          rating: f.rating,
          summary_notes: f.summary_notes || '',
          created_at: f.created_at
        })));
      }

      // Map branding requests with names
      if (brandingData) {
        setBrandingRequests(brandingData.map((b: any) => ({
          id: b.id,
          retailer_name: retailerMap.get(b.retailer_id) || 'Unknown',
          title: b.title,
          status: b.status,
          requested_assets: b.requested_assets,
          description: b.description,
          created_at: b.created_at
        })));
      }

      // Map competition data with names
      if (competitionDataResult) {
        setCompetitionData(competitionDataResult.map((c: any) => ({
          id: c.id,
          retailer_name: retailerMap.get(c.retailer_id) || 'Unknown',
          competitor_name: competitorMap.get(c.competitor_id) || 'Unknown',
          insight: c.insight,
          impact_level: c.impact_level,
          created_at: c.created_at
        })));
      }

    } catch (error) {
      console.error('Error fetching feedback data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalFeedback = retailerFeedback.length + brandingRequests.length + competitionData.length;

  if (loading) {
    return (
      <Card className="border-2 border-dashed border-muted">
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading feedback data...
        </CardContent>
      </Card>
    );
  }

  if (totalFeedback === 0) {
    return null; // Don't show section if no feedback
  }

  const getImpactColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'high': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'medium': return 'bg-warning/10 text-warning border-warning/20';
      case 'low': return 'bg-success/10 text-success border-success/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'bg-success/10 text-success';
      case 'pending': return 'bg-warning/10 text-warning';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      case 'executed': return 'bg-primary/10 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={12}
            className={star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}
          />
        ))}
      </div>
    );
  };

  return (
    <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-muted/20">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            Feedback Collected
          </CardTitle>
          <Badge variant="secondary" className="text-sm px-3 py-1 font-semibold">
            {totalFeedback} entries
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 pt-4">
        {/* Summary Pills - 3 columns for Retailer, Branding, Competition */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div 
            className={`p-3 rounded-xl text-center cursor-pointer transition-all duration-200 ${
              retailerFeedback.length > 0 
                ? 'bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 hover:border-blue-500/40' 
                : 'bg-muted/50'
            }`}
            onClick={() => setExpandedSection(expandedSection === 'retailer' ? null : 'retailer')}
          >
            <ThumbsUp className={`h-5 w-5 mx-auto mb-1 ${retailerFeedback.length > 0 ? 'text-blue-500' : 'text-muted-foreground'}`} />
            <div className={`text-xl font-bold ${retailerFeedback.length > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
              {retailerFeedback.length}
            </div>
            <div className="text-xs text-muted-foreground">Retailer</div>
          </div>
          
          <div 
            className={`p-3 rounded-xl text-center cursor-pointer transition-all duration-200 ${
              brandingRequests.length > 0 
                ? 'bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 hover:border-purple-500/40' 
                : 'bg-muted/50'
            }`}
            onClick={() => setExpandedSection(expandedSection === 'branding' ? null : 'branding')}
          >
            <Palette className={`h-5 w-5 mx-auto mb-1 ${brandingRequests.length > 0 ? 'text-purple-500' : 'text-muted-foreground'}`} />
            <div className={`text-xl font-bold ${brandingRequests.length > 0 ? 'text-purple-600' : 'text-muted-foreground'}`}>
              {brandingRequests.length}
            </div>
            <div className="text-xs text-muted-foreground">Branding</div>
          </div>
          
          <div 
            className={`p-3 rounded-xl text-center cursor-pointer transition-all duration-200 ${
              competitionData.length > 0 
                ? 'bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 hover:border-orange-500/40' 
                : 'bg-muted/50'
            }`}
            onClick={() => setExpandedSection(expandedSection === 'competition' ? null : 'competition')}
          >
            <Target className={`h-5 w-5 mx-auto mb-1 ${competitionData.length > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            <div className={`text-xl font-bold ${competitionData.length > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
              {competitionData.length}
            </div>
            <div className="text-xs text-muted-foreground">Competition</div>
          </div>
        </div>

        {/* Expanded Sections */}
        {expandedSection === 'retailer' && retailerFeedback.length > 0 && (
          <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-600 mb-2">
              <ThumbsUp size={14} />
              Retailer Feedback
            </div>
            <ScrollArea className="h-48">
              <div className="space-y-2 pr-2">
                {retailerFeedback.map((feedback) => (
                  <div 
                    key={feedback.id} 
                    className="p-3 bg-gradient-to-r from-blue-500/5 to-transparent rounded-lg border border-blue-500/10 cursor-pointer hover:bg-blue-500/10 transition-colors"
                    onClick={() => setSelectedFeedback({ type: 'retailer', data: feedback })}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 size={12} className="text-blue-500 flex-shrink-0" />
                          <span className="font-medium text-sm truncate">{feedback.retailer_name}</span>
                        </div>
                        {feedback.summary_notes && (
                          <p className="text-xs text-muted-foreground line-clamp-2 ml-4">
                            {feedback.summary_notes}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {renderStars(feedback.rating)}
                        <Badge variant="outline" className="text-xs capitalize">
                          {feedback.feedback_type?.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {expandedSection === 'branding' && brandingRequests.length > 0 && (
          <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 text-sm font-medium text-purple-600 mb-2">
              <Palette size={14} />
              Branding Requests
            </div>
            <ScrollArea className="h-48">
              <div className="space-y-2 pr-2">
                {brandingRequests.map((request) => (
                  <div 
                    key={request.id} 
                    className="p-3 bg-gradient-to-r from-purple-500/5 to-transparent rounded-lg border border-purple-500/10 cursor-pointer hover:bg-purple-500/10 transition-colors"
                    onClick={() => setSelectedFeedback({ type: 'branding', data: request })}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 size={12} className="text-purple-500 flex-shrink-0" />
                          <span className="font-medium text-sm truncate">{request.retailer_name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground ml-4">
                          {request.title || request.requested_assets || 'Branding request'}
                        </p>
                      </div>
                      <Badge className={`text-xs capitalize ${getStatusColor(request.status)}`}>
                        {request.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {expandedSection === 'competition' && competitionData.length > 0 && (
          <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 text-sm font-medium text-orange-600 mb-2">
              <Target size={14} />
              Competition Insights
            </div>
            <ScrollArea className="h-48">
              <div className="space-y-2 pr-2">
                {competitionData.map((data) => (
                  <div 
                    key={data.id} 
                    className="p-3 bg-gradient-to-r from-orange-500/5 to-transparent rounded-lg border border-orange-500/10 cursor-pointer hover:bg-orange-500/10 transition-colors"
                    onClick={() => setSelectedFeedback({ type: 'competition', data })}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 size={12} className="text-orange-500 flex-shrink-0" />
                          <span className="font-medium text-sm truncate">{data.retailer_name}</span>
                        </div>
                        <div className="flex items-center gap-2 ml-4 mb-1">
                          <Target size={10} className="text-muted-foreground" />
                          <span className="text-xs font-medium">{data.competitor_name}</span>
                        </div>
                        {data.insight && (
                          <p className="text-xs text-muted-foreground line-clamp-2 ml-4">
                            {data.insight}
                          </p>
                        )}
                      </div>
                      {data.impact_level && (
                        <Badge className={`text-xs border ${getImpactColor(data.impact_level)}`}>
                          {data.impact_level}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Quick Preview when not expanded */}
        {!expandedSection && (
          <div className="space-y-2">
            {retailerFeedback.slice(0, 1).map((feedback) => (
              <div 
                key={feedback.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-blue-500/5 cursor-pointer hover:bg-blue-500/10 transition-colors"
                onClick={() => setExpandedSection('retailer')}
              >
                <ThumbsUp size={14} className="text-blue-500 flex-shrink-0" />
                <span className="text-sm truncate flex-1">{feedback.retailer_name}</span>
                {renderStars(feedback.rating)}
                <ChevronRight size={14} className="text-muted-foreground" />
              </div>
            ))}
            
            {brandingRequests.slice(0, 1).map((request) => (
              <div 
                key={request.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-purple-500/5 cursor-pointer hover:bg-purple-500/10 transition-colors"
                onClick={() => setExpandedSection('branding')}
              >
                <Palette size={14} className="text-purple-500 flex-shrink-0" />
                <span className="text-sm truncate flex-1">{request.retailer_name}</span>
                <Badge className={`text-xs ${getStatusColor(request.status)}`}>{request.status}</Badge>
                <ChevronRight size={14} className="text-muted-foreground" />
              </div>
            ))}
            
            {competitionData.slice(0, 1).map((data) => (
              <div 
                key={data.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-orange-500/5 cursor-pointer hover:bg-orange-500/10 transition-colors"
                onClick={() => setExpandedSection('competition')}
              >
                <Target size={14} className="text-orange-500 flex-shrink-0" />
                <span className="text-sm truncate flex-1">{data.retailer_name} - {data.competitor_name}</span>
                {data.impact_level && (
                  <Badge className={`text-xs border ${getImpactColor(data.impact_level)}`}>
                    {data.impact_level}
                  </Badge>
                )}
                <ChevronRight size={14} className="text-muted-foreground" />
              </div>
            ))}
            
            {totalFeedback > 3 && (
              <div className="text-center text-xs text-muted-foreground pt-1">
                Tap any category above to see all entries
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Feedback Detail Modal */}
      <FeedbackDetailModal
        open={!!selectedFeedback}
        onClose={() => setSelectedFeedback(null)}
        type={selectedFeedback?.type || 'retailer'}
        data={selectedFeedback?.data}
      />
    </Card>
  );
}