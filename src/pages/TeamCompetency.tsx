import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubordinates } from "@/hooks/useSubordinates";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, Users } from "lucide-react";
import { format, subMonths, startOfMonth } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TeamCompetencyTable } from "@/components/competency/TeamCompetencyTable";
import { CoachingNotesDialog } from "@/components/competency/CoachingNotesDialog";
import { useCompetencyTemplates } from "@/hooks/useCompetencyScores";

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

interface TeamScorecard {
  user_id: string;
  overall_score: number;
  performance_band: string;
  profiles: {
    full_name: string;
    profile_picture_url?: string;
  };
}

export default function TeamCompetency() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [coachingDialogOpen, setCoachingDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [selectedMemberName, setSelectedMemberName] = useState<string>("");
  const [isCalculating, setIsCalculating] = useState(false);

  const { subordinates, subordinateIds, isManager, isLoading: subordinatesLoading } = useSubordinates();
  const { data: templates } = useCompetencyTemplates('field_executive');

  // Fetch team scorecards
  const { data: teamScorecards, isLoading: scorecardsLoading } = useQuery({
    queryKey: ['team-scorecards', selectedMonth, subordinateIds],
    queryFn: async () => {
      if (!subordinateIds || subordinateIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('user_monthly_scorecards')
        .select(`
          user_id,
          overall_score,
          performance_band,
          profiles:user_id(full_name, profile_picture_url)
        `)
        .eq('month_year', selectedMonth)
        .in('user_id', subordinateIds);
      
      if (error) throw error;
      return (data || []) as unknown as TeamScorecard[];
    },
    enabled: !!subordinateIds && subordinateIds.length > 0,
  });

  // Fetch previous month scores for trends
  const previousMonth = format(startOfMonth(subMonths(new Date(selectedMonth), 1)), 'yyyy-MM-dd');
  const { data: previousScorecards } = useQuery({
    queryKey: ['team-scorecards-prev', previousMonth, subordinateIds],
    queryFn: async () => {
      if (!subordinateIds || subordinateIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('user_monthly_scorecards')
        .select('user_id, overall_score')
        .eq('month_year', previousMonth)
        .in('user_id', subordinateIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!subordinateIds && subordinateIds.length > 0,
  });

  // Fetch individual competency scores for top/weak analysis
  const { data: teamCompetencyScores } = useQuery({
    queryKey: ['team-competency-scores', selectedMonth, subordinateIds],
    queryFn: async () => {
      if (!subordinateIds || subordinateIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('user_competency_monthly_scores')
        .select(`
          user_id,
          score,
          competency_templates(competency_name)
        `)
        .eq('month_year', selectedMonth)
        .in('user_id', subordinateIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!subordinateIds && subordinateIds.length > 0,
  });

  // Transform data for table
  const teamMembers = useMemo(() => {
    if (!subordinates || !teamScorecards) return [];

    const previousScoreMap = new Map(
      (previousScorecards || []).map(s => [s.user_id, s.overall_score])
    );

    // Group competency scores by user
    const userCompetencies: Record<string, { name: string; score: number }[]> = {};
    (teamCompetencyScores || []).forEach((cs: any) => {
      if (!userCompetencies[cs.user_id]) userCompetencies[cs.user_id] = [];
      userCompetencies[cs.user_id].push({
        name: cs.competency_templates?.competency_name || 'Unknown',
        score: cs.score,
      });
    });

    return subordinates.map(sub => {
      const scorecard = teamScorecards.find(s => s.user_id === sub.subordinate_user_id);
      const competencies = userCompetencies[sub.subordinate_user_id] || [];
      const sortedCompetencies = [...competencies].sort((a, b) => b.score - a.score);
      
      return {
        id: sub.subordinate_user_id,
        name: sub.full_name || 'Unknown',
        profileUrl: (scorecard?.profiles as any)?.profile_picture_url,
        overallScore: scorecard?.overall_score || 0,
        previousScore: previousScoreMap.get(sub.subordinate_user_id),
        performanceBand: (scorecard?.performance_band || 'needs_improvement') as any,
        topCompetency: sortedCompetencies[0]?.name,
        weakestCompetency: sortedCompetencies[sortedCompetencies.length - 1]?.name,
      };
    }).sort((a, b) => b.overallScore - a.overallScore);
  }, [subordinates, teamScorecards, previousScorecards, teamCompetencyScores]);

  // Calculate team stats
  const teamStats = useMemo(() => {
    if (teamMembers.length === 0) return null;
    
    const avgScore = teamMembers.reduce((sum, m) => sum + m.overallScore, 0) / teamMembers.length;
    const exceptional = teamMembers.filter(m => m.performanceBand === 'exceptional').length;
    const needsImprovement = teamMembers.filter(m => m.performanceBand === 'needs_improvement').length;
    
    return {
      avgScore: Math.round(avgScore),
      exceptional,
      needsImprovement,
      total: teamMembers.length,
    };
  }, [teamMembers]);

  const handleViewDetails = (memberId: string) => {
    navigate(`/competency-dashboard?userId=${memberId}`);
  };

  const handleAddCoachingNote = (memberId: string) => {
    const member = teamMembers.find(m => m.id === memberId);
    setSelectedMemberId(memberId);
    setSelectedMemberName(member?.name || 'Team Member');
    setCoachingDialogOpen(true);
  };

  const handleCalculateAll = async () => {
    if (!subordinateIds || subordinateIds.length === 0) return;
    
    setIsCalculating(true);
    try {
      for (const userId of subordinateIds) {
        await supabase.functions.invoke('calculate-competency-scores', {
          body: { userId, monthYear: selectedMonth }
        });
      }
      toast.success(`Calculated scores for ${subordinateIds.length} team members`);
      queryClient.invalidateQueries({ queryKey: ['team-scorecards'] });
      queryClient.invalidateQueries({ queryKey: ['team-competency-scores'] });
    } catch (error: any) {
      toast.error(error.message || "Failed to calculate team scores");
    } finally {
      setIsCalculating(false);
    }
  };

  const monthOptions = getMonthOptions();
  const isLoading = subordinatesLoading || scorecardsLoading;

  if (!isManager && !subordinatesLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Manager Access Required</h2>
          <p className="text-muted-foreground">This page is only available to managers with team members.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Page Title with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Team Competency</h1>
          <p className="text-sm text-muted-foreground">{teamMembers.length} team members</p>
        </div>
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
        {/* Team Stats */}
        {teamStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-primary">{teamStats.avgScore}%</div>
                <div className="text-xs text-muted-foreground">Team Average</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{teamStats.exceptional}</div>
                <div className="text-xs text-muted-foreground">Exceptional</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-amber-600">{teamStats.needsImprovement}</div>
                <div className="text-xs text-muted-foreground">Needs Work</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold">{teamStats.total}</div>
                <div className="text-xs text-muted-foreground">Total Members</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Action Button */}
        <Button onClick={handleCalculateAll} disabled={isCalculating} className="w-full">
          {isCalculating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Calculate All Team Scores
        </Button>

        {/* Team Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-4">
            <TeamCompetencyTable
              members={teamMembers}
              onViewDetails={handleViewDetails}
              onAddCoachingNote={handleAddCoachingNote}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      {/* Coaching Notes Dialog */}
      <CoachingNotesDialog
        open={coachingDialogOpen}
        onOpenChange={setCoachingDialogOpen}
        userId={selectedMemberId}
        userName={selectedMemberName}
        templates={templates}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['coaching-notes'] });
        }}
      />
    </div>
  );
}
