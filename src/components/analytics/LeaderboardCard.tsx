import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy } from "lucide-react";

interface LeaderboardMember {
  id: string;
  name: string;
  avatarUrl?: string;
  score: number;
  rank: number;
}

interface LeaderboardCardProps {
  members: LeaderboardMember[];
}

export const LeaderboardCard = ({ members }: LeaderboardCardProps) => {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />;
    if (rank === 2) return <Trophy className="h-4 w-4 text-gray-400" />;
    if (rank === 3) return <Trophy className="h-4 w-4 text-amber-700" />;
    return <span className="text-sm font-semibold text-muted-foreground">{rank}</span>;
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xs font-medium text-primary mb-3">INDIVIDUAL</div>
        <div className="space-y-3 max-h-[200px] overflow-y-auto">
          {members.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              No leaderboard data
            </div>
          ) : (
            members.slice(0, 5).map((member) => (
              <div key={member.id} className="flex items-center gap-3">
                <div className="w-6 flex items-center justify-center">
                  {getRankBadge(member.rank)}
                </div>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.avatarUrl} />
                  <AvatarFallback className="text-xs bg-primary/10">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium text-sm">{member.name}</div>
                </div>
                <div className="text-sm font-semibold text-primary">
                  {member.score.toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
