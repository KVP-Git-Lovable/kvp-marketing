import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

interface TeamMemberCardProps {
  name: string;
  photoUrl?: string;
  overallScore: number;
  rating: string;
  onViewDetails: () => void;
}

export const TeamMemberCard = ({ 
  name, 
  photoUrl, 
  overallScore, 
  rating, 
  onViewDetails 
}: TeamMemberCardProps) => {
  const getRatingColor = (rating: string) => {
    const colors = {
      excellent: "bg-chart-1/10 text-chart-1 border-chart-1/20",
      good: "bg-chart-2/10 text-chart-2 border-chart-2/20",
      average: "bg-chart-3/10 text-chart-3 border-chart-3/20",
      needs_improvement: "bg-destructive/10 text-destructive border-destructive/20",
    };
    return colors[rating as keyof typeof colors] || colors.needs_improvement;
  };

  const getScoreColor = (score: number) => {
    if (score >= 100) return "text-chart-1";
    if (score >= 80) return "text-chart-2";
    if (score >= 60) return "text-chart-3";
    return "text-destructive";
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={photoUrl} alt={name} />
            <AvatarFallback>{name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-2">
            <div>
              <h3 className="font-semibold">{name}</h3>
            </div>
            
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Overall Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
                  {overallScore.toFixed(0)}%
                </p>
              </div>
              
              <Badge variant="outline" className={getRatingColor(rating)}>
                {rating.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onViewDetails}
              className="w-full mt-2"
            >
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
