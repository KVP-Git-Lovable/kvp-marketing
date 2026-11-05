import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface PerformanceSummaryProps {
  data: Array<{
    period: string;
    avgScore: number;
    rating: string;
    kpiScores: Record<string, number>;
  }>;
}

export const PerformanceSummaryTable = ({ data }: PerformanceSummaryProps) => {
  const getRatingColor = (rating: string) => {
    const colors = {
      excellent: "bg-chart-1/10 text-chart-1 border-chart-1/20",
      good: "bg-chart-2/10 text-chart-2 border-chart-2/20",
      average: "bg-chart-3/10 text-chart-3 border-chart-3/20",
      needs_improvement: "bg-destructive/10 text-destructive border-destructive/20",
    };
    return colors[rating as keyof typeof colors] || colors.needs_improvement;
  };

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead>Overall Score</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead className="text-right">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, idx) => (
            <TableRow key={idx}>
              <TableCell className="font-medium">{row.period}</TableCell>
              <TableCell>
                <span className="font-bold text-lg">{row.avgScore.toFixed(1)}%</span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={getRatingColor(row.rating)}>
                  {row.rating.replace('_', ' ').toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {Object.keys(row.kpiScores).length} KPIs tracked
              </TableCell>
            </TableRow>
          ))}
          {data.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No historical data available
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
