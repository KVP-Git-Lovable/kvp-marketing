import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface ActivitiesCardProps {
  total: number;
  completed: number;
  ongoing: number;
  scheduled: number;
  missed: number;
}

export const ActivitiesCard = ({
  total,
  completed,
  ongoing,
  scheduled,
  missed
}: ActivitiesCardProps) => {
  const data = [
    { name: 'Completed', value: completed, color: 'hsl(142, 76%, 36%)' },
    { name: 'Ongoing', value: ongoing, color: 'hsl(221, 83%, 53%)' },
    { name: 'Scheduled', value: scheduled, color: 'hsl(45, 93%, 47%)' },
    { name: 'Missed', value: missed, color: 'hsl(0, 84%, 60%)' },
  ];

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Activities
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
                <span className="text-2xl font-bold">{total}</span>
                <span className="text-xs text-muted-foreground block">Total</span>
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-600 font-semibold">{completed}</span>
              <span className="text-muted-foreground">Completed</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-600 font-semibold">{ongoing}</span>
              <span className="text-muted-foreground">Ongoing</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-yellow-600 font-semibold">{scheduled}</span>
              <span className="text-muted-foreground">Scheduled</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-red-500 font-semibold">{missed}</span>
              <span className="text-muted-foreground">Missed</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
