import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompetencyScore } from "@/hooks/useCompetencyScores";

interface CompetencyRadarChartProps {
  scores: CompetencyScore[];
  className?: string;
}

export function CompetencyRadarChart({ scores, className }: CompetencyRadarChartProps) {
  if (!scores || scores.length === 0) return null;

  const data = scores.map(score => ({
    name: score.competency_templates?.competency_name?.split(' ').slice(0, 2).join(' ') || 'Unknown',
    fullName: score.competency_templates?.competency_name || 'Unknown',
    score: Math.round(score.score),
    previousScore: score.previous_month_score ? Math.round(score.previous_month_score) : null,
  }));

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Competency Overview</CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
            <PolarGrid strokeDasharray="3 3" className="stroke-muted" />
            <PolarAngleAxis 
              dataKey="name" 
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
            />
            <PolarRadiusAxis 
              angle={30} 
              domain={[0, 100]} 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
            />
            {data.some(d => d.previousScore !== null) && (
              <Radar
                name="Previous Month"
                dataKey="previousScore"
                stroke="hsl(var(--muted-foreground))"
                fill="hsl(var(--muted-foreground))"
                fillOpacity={0.1}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            )}
            <Radar
              name="Current Score"
              dataKey="score"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-popover border rounded-lg p-2 shadow-lg">
                      <p className="font-medium text-sm">{data.fullName}</p>
                      <p className="text-sm text-primary">Current: {data.score}%</p>
                      {data.previousScore !== null && (
                        <p className="text-xs text-muted-foreground">Previous: {data.previousScore}%</p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
