import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProfilePointsBadgeProps {
  userId: string;
}

export function ProfilePointsBadge({ userId }: ProfilePointsBadgeProps) {
  const navigate = useNavigate();
  const [totalPoints, setTotalPoints] = useState(0);

  useEffect(() => {
    fetchTotalPoints();
  }, [userId]);

  const fetchTotalPoints = async () => {
    if (!userId) return;

    const { data } = await supabase
      .from('gamification_points')
      .select('points')
      .eq('user_id', userId);

    if (data) {
      const total = data.reduce((sum, record) => sum + (record.points || 0), 0);
      setTotalPoints(total);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate('/leaderboard')}
      className="gap-2 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/30 hover:bg-amber-500/20"
    >
      <Trophy className="h-4 w-4 text-amber-500" />
      <span className="font-bold text-amber-600">{totalPoints.toLocaleString()}</span>
      <span className="text-xs text-muted-foreground">pts</span>
    </Button>
  );
}
