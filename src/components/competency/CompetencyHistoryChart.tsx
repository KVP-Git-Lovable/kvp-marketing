import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import type { MonthlyScorecard } from "@/hooks/useCompetencyScores";

interface CompetencyHistoryChartProps {
  history: MonthlyScorecard[];
  className?: string;
}

const bandColors: Record<string, string> = {
  exceptional: '#22c55e',
  strong: '#3b82f6',
  developing: '#f59e0b',
  needs_improvement: '#ef4444',
};

export function CompetencyHistoryChart({ history, className }: CompetencyHistoryChartProps) {
  if (!history || history.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">Score History</CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center">
          <p className="text-muted-foreground text-sm">No historical data available</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = history.map(item => ({
    month: format(parseISO(item.month_year), 'MMM yy'),
    score: item.overall_score,
    band: item.performance_band,
    color: bandColors[item.performance_band] || bandColors.developing,
  }));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">Performance Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 11 }} 
                className="text-muted-foreground"
              />
              <YAxis 
                domain={[0, 100]} 
                tick={{ fontSize: 11 }} 
                className="text-muted-foreground"
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border rounded-lg px-3 py-2 shadow-lg">
                        <p className="font-medium">{data.month}</p>
                        <p className="text-sm" style={{ color: data.color }}>
                          Score: {data.score.toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {data.band.replace('_', ' ')}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
              />
              {/* Reference lines for bands */}
              <Line 
                type="monotone" 
                dataKey={() => 90} 
                stroke="#22c55e" 
                strokeDasharray="5 5" 
                strokeWidth={1}
                dot={false}
                legendType="none"
              />
              <Line 
                type="monotone" 
                dataKey={() => 75} 
                stroke="#3b82f6" 
                strokeDasharray="5 5" 
                strokeWidth={1}
                dot={false}
                legendType="none"
              />
              <Line 
                type="monotone" 
                dataKey={() => 60} 
                stroke="#f59e0b" 
                strokeDasharray="5 5" 
                strokeWidth={1}
                dot={false}
                legendType="none"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Band legend */}
        <div className="flex justify-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-muted-foreground">≥90 Exceptional</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">≥75 Strong</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-muted-foreground">≥60 Developing</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
