import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface AttendanceCardProps {
  totalUsers: number;
  punchedIn: number;
  onField: number;
  inOffice: number;
  expected: number;
}

export const AttendanceCard = ({
  totalUsers,
  punchedIn,
  onField,
  inOffice,
  expected
}: AttendanceCardProps) => {
  const data = [
    { name: 'Punched In', value: punchedIn, color: 'hsl(var(--primary))' },
    { name: 'Expected', value: expected, color: 'hsl(var(--muted))' },
  ];

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Attendance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={40}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <span className="text-2xl font-bold">{punchedIn}</span>
                <span className="text-xs text-muted-foreground block">Punched-in</span>
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-primary font-semibold">{onField}</span>
              <span className="text-muted-foreground">On Field</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-600 font-semibold">{inOffice}</span>
              <span className="text-muted-foreground">In Office</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-orange-500 font-semibold">{expected}</span>
              <span className="text-muted-foreground">Expected</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
