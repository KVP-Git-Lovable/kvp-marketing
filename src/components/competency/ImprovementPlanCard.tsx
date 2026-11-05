import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Sparkles, CheckCircle, Target, Calendar } from "lucide-react";
import type { MonthlyScorecard } from "@/hooks/useCompetencyScores";

interface ImprovementPlanCardProps {
  scorecard: MonthlyScorecard;
  className?: string;
}

export function ImprovementPlanCard({ scorecard, className }: ImprovementPlanCardProps) {
  const { ai_summary, ai_strengths, ai_improvement_areas, ai_action_plan } = scorecard;

  if (!ai_summary && !ai_strengths?.length && !ai_improvement_areas?.length) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="py-8 text-center">
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">AI insights not yet generated</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Click "Generate AI Insights" to get personalized recommendations</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* AI Summary */}
      {ai_summary && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{ai_summary}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Strengths */}
        {ai_strengths && ai_strengths.length > 0 && (
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="pb-2 bg-green-50/50 dark:bg-green-900/20">
              <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                Your Strengths
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {ai_strengths.map((strength, index) => (
                <div key={index} className="space-y-1">
                  <h4 className="font-medium text-sm">{strength.competency}</h4>
                  <p className="text-xs text-muted-foreground">{strength.insight}</p>
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                    ✓ Keep doing: {strength.keepDoing}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Improvement Areas */}
        {ai_improvement_areas && ai_improvement_areas.length > 0 && (
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader className="pb-2 bg-amber-50/50 dark:bg-amber-900/20">
              <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Target className="h-4 w-4" />
                Focus Areas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {ai_improvement_areas.map((area, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">{area.competency}</h4>
                    <span className="text-xs text-muted-foreground">
                      {area.currentScore}% → {area.targetScore}%
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {area.specificActions?.map((action, actionIndex) => (
                      <li key={actionIndex} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="text-amber-500 mt-0.5">•</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Timeline: {area.timeline}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Weekly Focus */}
      {ai_action_plan?.weeklyFocus && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Monthly Focus Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              {Object.entries(ai_action_plan.weeklyFocus).map(([week, focus]) => (
                <div key={week} className="p-3 rounded-lg bg-muted/50 border">
                  <h4 className="font-medium text-xs uppercase text-muted-foreground mb-1">
                    {week.replace('week', 'Week ')}
                  </h4>
                  <p className="text-sm">{focus}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Motivational Note */}
      {ai_action_plan?.motivationalNote && (
        <div className="text-center p-4 rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20">
          <p className="text-sm text-muted-foreground italic">"{ai_action_plan.motivationalNote}"</p>
        </div>
      )}
    </div>
  );
}
