import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { useState } from "react";

interface Activity {
  id: string;
  retailerName: string;
  userName: string;
  status: 'completed' | 'ongoing' | 'scheduled';
  time?: string;
}

interface CurrentActivitiesCardProps {
  activities: Activity[];
}

export const CurrentActivitiesCard = ({ activities }: CurrentActivitiesCardProps) => {
  const [filter, setFilter] = useState<string>('all');

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    return activity.status === filter;
  });

  const getStatusBadge = (status: Activity['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Completed</Badge>;
      case 'ongoing':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Ongoing</Badge>;
      case 'scheduled':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Scheduled</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Current Activities
          </CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Showing:" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="ongoing">Ongoing</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[280px] overflow-y-auto">
          {filteredActivities.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              No activities found
            </div>
          ) : (
            filteredActivities.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{activity.retailerName}</div>
                    <div className="text-xs text-muted-foreground">
                      {activity.userName} {activity.time && `• ${activity.time}`}
                    </div>
                  </div>
                </div>
                {getStatusBadge(activity.status)}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
