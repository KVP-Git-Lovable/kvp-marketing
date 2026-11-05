import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, MessageSquare } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  profileUrl?: string;
  overallScore: number;
  previousScore?: number;
  performanceBand: 'exceptional' | 'strong' | 'developing' | 'needs_improvement';
  topCompetency?: string;
  weakestCompetency?: string;
  coachingNotesCount?: number;
}

interface TeamCompetencyTableProps {
  members: TeamMember[];
  onViewDetails: (memberId: string) => void;
  onAddCoachingNote: (memberId: string) => void;
  isLoading?: boolean;
}

const bandConfig = {
  exceptional: { label: 'Exceptional', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  strong: { label: 'Strong', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  developing: { label: 'Developing', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  needs_improvement: { label: 'Needs Work', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function TeamCompetencyTable({ members, onViewDetails, onAddCoachingNote, isLoading }: TeamCompetencyTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading team data...</div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No team members found for this period
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[200px]">Team Member</TableHead>
            <TableHead className="text-center">Score</TableHead>
            <TableHead className="text-center">Trend</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Top Skill</TableHead>
            <TableHead>Focus Area</TableHead>
            <TableHead className="text-center w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const band = bandConfig[member.performanceBand] || bandConfig.developing;
            const scoreDiff = member.previousScore ? member.overallScore - member.previousScore : 0;
            const trend = scoreDiff > 2 ? 'up' : scoreDiff < -2 ? 'down' : 'stable';
            
            return (
              <TableRow 
                key={member.id} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onViewDetails(member.id)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.profileUrl} alt={member.name} />
                      <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{member.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className={cn("font-bold text-lg", getScoreColor(member.overallScore))}>
                    {Math.round(member.overallScore)}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                    {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                    {trend === 'stable' && <Minus className="h-4 w-4 text-muted-foreground" />}
                    {member.previousScore && (
                      <span className={cn(
                        "text-xs",
                        trend === 'up' && "text-green-600",
                        trend === 'down' && "text-red-600",
                        trend === 'stable' && "text-muted-foreground"
                      )}>
                        {scoreDiff > 0 ? '+' : ''}{scoreDiff.toFixed(0)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-xs", band.className)}>
                    {band.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-green-600 dark:text-green-400">
                    {member.topCompetency || '-'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-amber-600 dark:text-amber-400">
                    {member.weakestCompetency || '-'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddCoachingNote(member.id);
                      }}
                    >
                      <MessageSquare className="h-4 w-4" />
                      {member.coachingNotesCount ? (
                        <span className="ml-1 text-xs">{member.coachingNotesCount}</span>
                      ) : null}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
