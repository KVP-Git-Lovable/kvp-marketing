import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface TeamMember {
  id: string;
  name: string;
  avatarUrl?: string;
  status: 'punched_in' | 'punched_out' | 'in_transit' | 'in_meeting' | 'on_leave';
  punchTime?: string;
  location?: string;
}

interface TeamStatusCardProps {
  members: TeamMember[];
}

export const TeamStatusCard = ({ members }: TeamStatusCardProps) => {
  const [filter, setFilter] = useState<string>('all');

  const filteredMembers = members.filter(member => {
    if (filter === 'all') return true;
    if (filter === 'punched_in') return member.status === 'punched_in' || member.status === 'in_meeting' || member.status === 'in_transit';
    if (filter === 'punched_out') return member.status === 'punched_out';
    if (filter === 'on_leave') return member.status === 'on_leave';
    return true;
  });

  const getStatusBadge = (status: TeamMember['status']) => {
    switch (status) {
      case 'punched_in':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Punched In</Badge>;
      case 'punched_out':
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Punched Out</Badge>;
      case 'in_transit':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">In Transit</Badge>;
      case 'in_meeting':
        return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">In Meeting</Badge>;
      case 'on_leave':
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">On Leave</Badge>;
      default:
        return null;
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            My Team
          </CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Showing:" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="punched_in">Punched in</SelectItem>
              <SelectItem value="punched_out">Punched out</SelectItem>
              <SelectItem value="on_leave">On leave</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[280px] overflow-y-auto">
          {filteredMembers.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              No team members found
            </div>
          ) : (
            filteredMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatarUrl} />
                    <AvatarFallback className="text-xs bg-primary/10">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-sm">{member.name}</div>
                    {member.punchTime && (
                      <div className="text-xs text-muted-foreground">
                        {member.punchTime} {member.location && `@ ${member.location}`}
                      </div>
                    )}
                  </div>
                </div>
                {getStatusBadge(member.status)}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
