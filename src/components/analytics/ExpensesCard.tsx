import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface ExpensesCardProps {
  totalClaimed: number;
  pending: number;
  approved: number;
  rejected: number;
}

export const ExpensesCard = ({
  totalClaimed,
  pending,
  approved,
  rejected
}: ExpensesCardProps) => {
  const data = [
    { name: 'Approved', value: approved, color: 'hsl(142, 76%, 36%)' },
    { name: 'Pending', value: pending, color: 'hsl(45, 93%, 47%)' },
    { name: 'Rejected', value: rejected, color: 'hsl(0, 84%, 60%)' },
  ];

  const formatCurrency = (value: number) => {
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)}L`;
    } else if (value >= 1000) {
      return `₹${(value / 1000).toFixed(1)}K`;
    }
    return `₹${value}`;
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Expenses
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={40}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  {data.filter(d => d.value > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <span className="text-lg font-bold">{formatCurrency(totalClaimed)}</span>
                <span className="text-xs text-muted-foreground block">Claimed</span>
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-yellow-600 font-semibold">{formatCurrency(pending)}</span>
              <span className="text-muted-foreground">Pending</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-600 font-semibold">{formatCurrency(approved)}</span>
              <span className="text-muted-foreground">Approved</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-red-500 font-semibold">{formatCurrency(rejected)}</span>
              <span className="text-muted-foreground">Rejected</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
