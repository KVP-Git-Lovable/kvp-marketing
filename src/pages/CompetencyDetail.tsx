import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, Calculator, Lightbulb, Volume2, VolumeX, Play, Pause, 
  TrendingUp, TrendingDown, Minus, Target, Award, Users, BookOpen,
  ExternalLink, ThumbsUp, ThumbsDown, Trophy, Crown, Medal, Sparkles,
  Map, IndianRupee, Clock, UserPlus, Package, Wallet, GraduationCap, Calendar, MapPin,
  Loader2, Youtube, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, startOfMonth } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

// Icon and color mappings
const iconMap: Record<string, any> = {
  Map, TrendingUp, IndianRupee, Clock, UserPlus, Package, Wallet,
  Users, GraduationCap, Calendar, Sparkles, MapPin
};

const categoryColors: Record<string, { bg: string; gradient: string; text: string; border: string }> = {
  productivity: { bg: 'bg-blue-50 dark:bg-blue-900/20', gradient: 'from-blue-500 to-blue-600', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  achievement: { bg: 'bg-green-50 dark:bg-green-900/20', gradient: 'from-green-500 to-emerald-600', text: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
  discipline: { bg: 'bg-amber-50 dark:bg-amber-900/20', gradient: 'from-amber-500 to-orange-600', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  development: { bg: 'bg-purple-50 dark:bg-purple-900/20', gradient: 'from-purple-500 to-violet-600', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
  leadership: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', gradient: 'from-indigo-500 to-blue-600', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
};

const languageOptions = [
  { code: 'en', label: 'English', voice: 'en-IN' },
  { code: 'hi', label: 'हिंदी (Hindi)', voice: 'hi-IN' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)', voice: 'kn-IN' },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)', voice: 'gu-IN' },
  { code: 'mr', label: 'मराठी (Marathi)', voice: 'mr-IN' },
  { code: 'ta', label: 'தமிழ் (Tamil)', voice: 'ta-IN' },
  { code: 'te', label: 'తెలుగు (Telugu)', voice: 'te-IN' },
  { code: 'ml', label: 'മലയാളം (Malayalam)', voice: 'ml-IN' },
];

// Competency trait definitions
const competencyTraits: Record<string, { traits: string[]; keyBehaviors: string[] }> = {
  FSE_TERRITORY_COVERAGE: {
    traits: ['Route Discipline', 'Planning Skills', 'Market Knowledge', 'Time Management'],
    keyBehaviors: ['Visits all assigned beats regularly', 'Follows planned route efficiently', 'Maximizes retailer interactions per day']
  },
  FSE_SALES_GROWTH: {
    traits: ['Target Focus', 'Negotiation Skills', 'Relationship Building', 'Persistence'],
    keyBehaviors: ['Consistently meets or exceeds targets', 'Identifies upselling opportunities', 'Builds strong retailer relationships']
  },
  FSE_RETAILER_DEV: {
    traits: ['Prospecting', 'Onboarding Skills', 'Market Analysis', 'Growth Mindset'],
    keyBehaviors: ['Actively seeks new retailer opportunities', 'Successfully onboards new accounts', 'Develops territory strategically']
  },
  FSE_PRODUCT_MIX: {
    traits: ['Product Knowledge', 'Cross-Selling', 'Category Management', 'Customer Education'],
    keyBehaviors: ['Promotes full product range', 'Identifies gaps in retailer assortment', 'Educates retailers on new products']
  },
  FSE_COLLECTION: {
    traits: ['Financial Discipline', 'Communication', 'Follow-up Skills', 'Problem Solving'],
    keyBehaviors: ['Collects payments on time', 'Manages credit effectively', 'Resolves payment disputes quickly']
  },
  FSE_DISCIPLINE: {
    traits: ['Punctuality', 'Consistency', 'Integrity', 'Professionalism'],
    keyBehaviors: ['Checks in on time daily', 'Follows company policies', 'Maintains accurate records']
  },
};

interface CompetencyScore {
  id: string;
  score: number;
  trend: string;
  previous_month_score: number | null;
  raw_metrics: Record<string, any>;
  competency_templates: {
    id: string;
    competency_name: string;
    competency_code: string;
    description: string | null;
    category: string;
    weightage: number;
    icon: string | null;
  };
}

interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  score: number;
  rank: number;
}

interface ImprovementRecommendation {
  summary: string;
  retailerInsights: string[];
  productInsights: string[];
  actionItems: string[];
  resources: { title: string; url: string; type: 'video' | 'article' }[];
}

export default function CompetencyDetail() {
  const { competencyId } = useParams();
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  
  const [competencyScore, setCompetencyScore] = useState<CompetencyScore | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [recommendations, setRecommendations] = useState<ImprovementRecommendation | null>(null);
  const [scoreBreakdown, setScoreBreakdown] = useState<string | null>(null);
  
  const [isLoadingScore, setIsLoadingScore] = useState(true);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);
  
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);
  
  const monthYear = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  useEffect(() => {
    if (competencyId && user?.id) {
      loadCompetencyData();
      loadLeaderboard();
    }
  }, [competencyId, user?.id]);

  const loadCompetencyData = async () => {
    try {
      setIsLoadingScore(true);
      const { data, error } = await supabase
        .from('user_competency_monthly_scores')
        .select(`
          *,
          competency_templates (
            id,
            competency_name,
            competency_code,
            description,
            category,
            weightage,
            icon
          )
        `)
        .eq('competency_template_id', competencyId)
        .eq('user_id', user!.id)
        .eq('month_year', monthYear)
        .single();

      if (error) throw error;
      setCompetencyScore(data as unknown as CompetencyScore);
    } catch (error) {
      console.error('Error loading competency:', error);
      toast.error('Failed to load competency data');
    } finally {
      setIsLoadingScore(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      setIsLoadingLeaderboard(true);
      const { data, error } = await supabase
        .from('user_competency_monthly_scores')
        .select(`
          user_id,
          score,
          profiles!inner(full_name)
        `)
        .eq('competency_template_id', competencyId)
        .eq('month_year', monthYear)
        .order('score', { ascending: false })
        .limit(5);

      if (error) throw error;

      const leaderboardData: LeaderboardEntry[] = (data || []).map((entry: any, idx: number) => ({
        user_id: entry.user_id,
        user_name: entry.profiles?.full_name || 'Anonymous',
        score: entry.score,
        rank: idx + 1
      }));

      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  const handleScoreBreakdown = async () => {
    if (!competencyScore) return;
    
    try {
      setIsLoadingBreakdown(true);
      const { data, error } = await supabase.functions.invoke('competency-score-breakdown', {
        body: { 
          userId: user!.id,
          competencyId,
          monthYear,
          competencyCode: competencyScore.competency_templates.competency_code,
          rawMetrics: competencyScore.raw_metrics,
          score: competencyScore.score
        }
      });

      if (error) throw error;
      setScoreBreakdown(data.breakdown);
    } catch (error: any) {
      console.error('Error getting score breakdown:', error);
      toast.error(error.message || 'Failed to get score breakdown');
    } finally {
      setIsLoadingBreakdown(false);
    }
  };

  const handleGetRecommendations = async () => {
    if (!competencyScore) return;
    
    try {
      setIsLoadingRecommendations(true);
      const { data, error } = await supabase.functions.invoke('competency-improvement-tips', {
        body: { 
          userId: user!.id,
          competencyId,
          monthYear,
          competencyCode: competencyScore.competency_templates.competency_code,
          competencyName: competencyScore.competency_templates.competency_name,
          rawMetrics: competencyScore.raw_metrics,
          score: competencyScore.score,
          language: selectedLanguage
        }
      });

      if (error) throw error;
      setRecommendations(data.recommendations);
    } catch (error: any) {
      console.error('Error getting recommendations:', error);
      toast.error(error.message || 'Failed to get recommendations');
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const handleListenRecommendations = async () => {
    if (!recommendations) {
      toast.error('Please get recommendations first');
      return;
    }

    // If already speaking, stop
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    try {
      // Create text to speak
      const textToSpeak = `
        ${recommendations.summary}. 
        Here are your action items: 
        ${recommendations.actionItems.join('. ')}.
        Focus on these retailers: ${recommendations.retailerInsights.join('. ')}
      `;

      // Use Web Speech API for multi-language support
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      const langVoice = languageOptions.find(l => l.code === selectedLanguage);
      utterance.lang = langVoice?.voice || 'en-IN';
      
      // Try to find a matching voice
      const voices = window.speechSynthesis.getVoices();
      const matchingVoice = voices.find(v => v.lang.startsWith(selectedLanguage));
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => {
        setIsSpeaking(false);
        toast.error('Speech synthesis failed');
      };

      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Error with TTS:', error);
      toast.error('Text-to-speech is not supported in your browser');
    }
  };

  const handleFeedback = async (type: 'up' | 'down') => {
    try {
      await supabase.from('ai_feature_feedback').insert({
        user_id: user!.id,
        feature: `competency_improvement_${competencyId}`,
        feedback_type: type === 'up' ? 'helpful' : 'not_helpful'
      });
      setFeedbackGiven(type);
      toast.success('Thank you for your feedback!');
    } catch (error) {
      console.error('Error saving feedback:', error);
    }
  };

  if (isLoadingScore) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!competencyScore) {
    return (
      <Layout>
        <div className="p-4 text-center">
          <p className="text-muted-foreground">Competency not found</p>
          <Button onClick={() => navigate(-1)} variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
          </Button>
        </div>
      </Layout>
    );
  }

  const template = competencyScore.competency_templates;
  const IconComponent = iconMap[template.icon || 'Map'] || Map;
  const categoryStyle = categoryColors[template.category] || categoryColors.productivity;
  const traits = competencyTraits[template.competency_code] || { traits: [], keyBehaviors: [] };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="font-bold text-muted-foreground">#{rank}</span>;
  };

  return (
    <Layout>
      <div className="min-h-screen pb-24">
        {/* Hero Header */}
        <div className={cn("relative overflow-hidden bg-gradient-to-br", categoryStyle.gradient, "text-white p-6 pb-12")}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative z-10">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)}
              className="text-white/90 hover:text-white hover:bg-white/20 -ml-2 mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            
            <div className="flex items-start gap-4">
              <div className="p-4 rounded-2xl bg-white/20 backdrop-blur-sm">
                <IconComponent className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{template.competency_name}</h1>
                <Badge variant="secondary" className="mt-2 bg-white/20 text-white border-none">
                  {template.category}
                </Badge>
              </div>
            </div>

            {/* Score Display */}
            <div className="mt-6 flex items-end gap-4">
              <div className="text-5xl font-bold">{Math.round(competencyScore.score)}%</div>
              <div className="flex items-center gap-1 pb-2">
                {competencyScore.trend === 'improving' && <TrendingUp className="h-5 w-5 text-green-300" />}
                {competencyScore.trend === 'declining' && <TrendingDown className="h-5 w-5 text-red-300" />}
                {competencyScore.trend === 'stable' && <Minus className="h-5 w-5 text-white/70" />}
                <span className="text-white/80 text-sm">
                  {competencyScore.previous_month_score 
                    ? `${competencyScore.previous_month_score.toFixed(0)}% last month`
                    : 'New'}
                </span>
              </div>
            </div>
            
            <Progress 
              value={competencyScore.score} 
              className="mt-4 h-3 bg-white/20"
            />
          </div>
          
          {/* Decorative Elements */}
          <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute right-20 bottom-20 w-20 h-20 rounded-full bg-white/5" />
        </div>

        {/* Content */}
        <div className="p-4 -mt-6 relative z-20 space-y-4">
          
          {/* Overview Card */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {template.description || `This competency measures your performance in ${template.competency_name.toLowerCase()}.`}
              </p>
              
              {/* Key Traits */}
              <div>
                <h4 className="font-semibold mb-2">Key Traits</h4>
                <div className="flex flex-wrap gap-2">
                  {traits.traits.map((trait, idx) => (
                    <Badge key={idx} variant="outline" className={cn(categoryStyle.text, categoryStyle.border)}>
                      {trait}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Key Behaviors */}
              {traits.keyBehaviors.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Expected Behaviors</h4>
                  <ul className="space-y-1">
                    {traits.keyBehaviors.map((behavior, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-primary mt-1">•</span>
                        {behavior}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Raw Metrics */}
              {competencyScore.raw_metrics && Object.keys(competencyScore.raw_metrics).length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Your Metrics</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(competencyScore.raw_metrics)
                      .filter(([key]) => !['note', 'error'].includes(key))
                      .map(([key, value]) => (
                        <div key={key} className={cn("p-3 rounded-lg", categoryStyle.bg)}>
                          <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                          <p className="text-lg font-semibold">
                            {typeof value === 'number' ? value.toLocaleString() : String(value)}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              onClick={handleScoreBreakdown}
              disabled={isLoadingBreakdown}
              className="h-auto py-4 flex flex-col items-center gap-2"
              variant="outline"
            >
              {isLoadingBreakdown ? <Loader2 className="h-5 w-5 animate-spin" /> : <Calculator className="h-5 w-5" />}
              <span className="text-xs">Score Calculation</span>
            </Button>
            <Button 
              onClick={handleGetRecommendations}
              disabled={isLoadingRecommendations}
              className={cn("h-auto py-4 flex flex-col items-center gap-2 bg-gradient-to-r", categoryStyle.gradient)}
            >
              {isLoadingRecommendations ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lightbulb className="h-5 w-5" />}
              <span className="text-xs">Get Improvement Tips</span>
            </Button>
          </div>

          {/* Score Breakdown */}
          <AnimatePresence>
            {scoreBreakdown && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Card className="border-2 border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Calculator className="h-5 w-5 text-primary" />
                      Score Calculation Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                        {scoreBreakdown}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Improvement Recommendations */}
          <AnimatePresence>
            {recommendations && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card className="border-2 border-primary/20 overflow-hidden">
                  <CardHeader className={cn("bg-gradient-to-r", categoryStyle.gradient, "text-white")}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        AI Improvement Recommendations
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                          <SelectTrigger className="w-32 bg-white/20 border-white/30 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {languageOptions.map(lang => (
                              <SelectItem key={lang.code} value={lang.code}>{lang.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={handleListenRecommendations}
                          className="text-white hover:bg-white/20"
                        >
                          {isSpeaking ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                        </Button>
                      </div>
                    </div>
                    <CardDescription className="text-white/80">
                      Personalized tips based on your performance data
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    {/* Summary */}
                    <div className={cn("p-4 rounded-lg", categoryStyle.bg)}>
                      <p className="text-sm">{recommendations.summary}</p>
                    </div>

                    {/* Action Items */}
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        Action Items
                      </h4>
                      <ul className="space-y-2">
                        {recommendations.actionItems.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm p-2 bg-muted/50 rounded">
                            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">
                              {idx + 1}
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Retailer Insights */}
                    {recommendations.retailerInsights.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          Retailer Focus
                        </h4>
                        <ul className="space-y-1">
                          {recommendations.retailerInsights.map((insight, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-primary">→</span>
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Product Insights */}
                    {recommendations.productInsights.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Package className="h-4 w-4 text-primary" />
                          Product Opportunities
                        </h4>
                        <ul className="space-y-1">
                          {recommendations.productInsights.map((insight, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-primary">→</span>
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Separator />

                    {/* Learning Resources */}
                    {recommendations.resources.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-primary" />
                          Learning Resources
                        </h4>
                        <div className="space-y-2">
                          {recommendations.resources.map((resource, idx) => (
                            <a
                              key={idx}
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                            >
                              {resource.type === 'video' ? (
                                <Youtube className="h-5 w-5 text-red-500" />
                              ) : (
                                <FileText className="h-5 w-5 text-blue-500" />
                              )}
                              <span className="flex-1 text-sm font-medium">{resource.title}</span>
                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Feedback */}
                    <div className="flex items-center justify-center gap-4 pt-4 border-t">
                      <span className="text-sm text-muted-foreground">Was this helpful?</span>
                      <Button
                        size="sm"
                        variant={feedbackGiven === 'up' ? 'default' : 'outline'}
                        onClick={() => handleFeedback('up')}
                        disabled={feedbackGiven !== null}
                      >
                        <ThumbsUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={feedbackGiven === 'down' ? 'default' : 'outline'}
                        onClick={() => handleFeedback('down')}
                        disabled={feedbackGiven !== null}
                      >
                        <ThumbsDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Top Performers
              </CardTitle>
              <CardDescription>
                Top 5 scorers in {template.competency_name} this month
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLeaderboard ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : leaderboard.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No data available</p>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((entry, idx) => (
                    <motion.div
                      key={entry.user_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg",
                        entry.user_id === user?.id 
                          ? cn(categoryStyle.bg, categoryStyle.border, "border-2")
                          : "bg-muted/30"
                      )}
                    >
                      <div className="w-8 flex justify-center">
                        {getRankIcon(entry.rank)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {entry.user_name}
                          {entry.user_id === user?.id && (
                            <Badge variant="secondary" className="ml-2 text-xs">You</Badge>
                          )}
                        </p>
                      </div>
                      <div className={cn("text-lg font-bold", getScoreColor(entry.score))}>
                        {Math.round(entry.score)}%
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </Layout>
  );
}
