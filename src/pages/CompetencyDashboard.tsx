import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useCompetencyScores, useMonthlyScorecard, useCompetencyHistory, useCalculateCompetencyScores, useGenerateCompetencyInsights } from "@/hooks/useCompetencyScores";
import { useSubordinates } from "@/hooks/useSubordinates";
import { EmployeeRecognitionBanner } from "@/components/competency/EmployeeRecognitionBanner";
import { CompetencyHistoryChart } from "@/components/competency/CompetencyHistoryChart";
import { OverallScoreCard } from "@/components/competency/OverallScoreCard";
import { CompetencyRadarChart } from "@/components/competency/CompetencyRadarChart";
import { CompetencyScoreCard } from "@/components/competency/CompetencyScoreCard";
import { ImprovementPlanCard } from "@/components/competency/ImprovementPlanCard";
import { CompetencyFrameworkDialog } from "@/components/competency/CompetencyFrameworkDialog";
import { Layout } from "@/components/Layout";
import { Sparkles, RefreshCw, Users, Loader2 } from "lucide-react";
import { format, subMonths, startOfMonth } from "date-fns";
import { toast } from "sonner";

const getMonthOptions = () => {
  const options = [];
  for (let i = 0; i < 6; i++) {
    const date = startOfMonth(subMonths(new Date(), i));
    options.push({
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, 'MMMM yyyy'),
    });
  }
  return options;
};

export default function CompetencyDashboard() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  const { subordinates, isManager, isLoading: subordinatesLoading } = useSubordinates();
  
  // Use selected user ID or current user
  const viewingUserId = selectedUserId || user?.id;
  
  const { data: scores, isLoading: scoresLoading } = useCompetencyScores(selectedMonth, viewingUserId);
  const { data: scorecard, isLoading: scorecardLoading } = useMonthlyScorecard(selectedMonth, viewingUserId);
  const { data: history } = useCompetencyHistory(viewingUserId);
  
  const calculateScores = useCalculateCompetencyScores();
  const generateInsights = useGenerateCompetencyInsights();

  const handleCalculateScores = async () => {
    if (!viewingUserId) return;
    try {
      await calculateScores.mutateAsync({ userId: viewingUserId, monthYear: selectedMonth });
      toast.success("Competency scores calculated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to calculate scores");
    }
  };

  const handleGenerateInsights = async () => {
    if (!viewingUserId) return;
    try {
      await generateInsights.mutateAsync({ userId: viewingUserId, monthYear: selectedMonth });
      toast.success("AI insights generated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate insights");
    }
  };

  const monthOptions = getMonthOptions();
  const isLoading = scoresLoading || scorecardLoading || subordinatesLoading;
  const hasScores = scores && scores.length > 0;
  
  // Get display name for selected user
  const selectedSubordinate = subordinates?.find(s => s.subordinate_user_id === selectedUserId);
  const employeeName = selectedUserId 
    ? (selectedSubordinate?.full_name || 'Team Member')
    : (userProfile?.full_name || user?.email?.split('@')[0] || 'Team Member');
  
  // Build team member options for dropdown
  const teamMemberOptions = [
    { value: 'self', label: 'Myself' },
    ...(subordinates?.map(s => ({
      value: s.subordinate_user_id,
      label: s.full_name || 'Unknown'
    })) || [])
  ];

  return (
    <Layout>
      <div className="p-4 space-y-6 pb-24">
        {/* Page Title with Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-xl font-bold">My Competency Dashboard</h1>
              <p className="text-sm text-muted-foreground">AI-driven performance insights</p>
            </div>
            <CompetencyFrameworkDialog />
          </div>
          <div className="flex items-center gap-2">
            {isManager && (
              <Select value={selectedUserId || 'self'} onValueChange={(val) => setSelectedUserId(val === 'self' ? null : val)}>
                <SelectTrigger className="w-[140px]">
                  <Users className="h-4 w-4 mr-1" />
                  <SelectValue placeholder="Myself" />
                </SelectTrigger>
                <SelectContent>
                  {teamMemberOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Employee Recognition Banner */}
        <EmployeeRecognitionBanner
          employeeName={employeeName}
          overallScore={scorecard?.overall_score}
          performanceBand={scorecard?.performance_band as any}
        />

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleCalculateScores} disabled={calculateScores.isPending} className="flex-1">
            {calculateScores.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Calculate Scores
          </Button>
          <Button onClick={handleGenerateInsights} disabled={generateInsights.isPending || !hasScores} variant="outline" className="flex-1">
            {generateInsights.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            AI Insights
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !hasScores ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No competency scores for this month yet.</p>
            <Button onClick={handleCalculateScores} disabled={calculateScores.isPending}>
              Calculate Now
            </Button>
          </div>
        ) : (
          <>
            {/* Overall Score */}
            {scorecard && (
              <OverallScoreCard
                score={scorecard.overall_score}
                performanceBand={scorecard.performance_band}
                previousScore={history?.[history.length - 2]?.overall_score}
                rankInTeam={scorecard.rank_in_team}
                totalTeamMembers={scorecard.total_team_members}
              />
            )}

            {/* Radar Chart */}
            {scores && scores.length > 2 && (
              <CompetencyRadarChart scores={scores} />
            )}

            {/* History Chart */}
            {history && history.length > 1 && (
              <CompetencyHistoryChart history={history} />
            )}

            {/* Competency Scores Grid */}
            <div>
              <h2 className="text-base font-semibold mb-3">Competency Breakdown</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {scores.map(score => (
                  <CompetencyScoreCard key={score.id} score={score} onClick={() => navigate(`/competency/${score.competency_templates?.id}`)} />
                ))}
              </div>
            </div>

            {/* AI Improvement Plan */}
            {scorecard && (
              <div>
                <h2 className="text-base font-semibold mb-3">AI Recommendations</h2>
                <ImprovementPlanCard scorecard={scorecard} />
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
