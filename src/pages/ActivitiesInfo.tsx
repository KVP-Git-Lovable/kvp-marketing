import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, MapPin, Target, TrendingUp, Loader2, DollarSign, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Game {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  territories: string[] | null;
  is_all_territories: boolean;
  baseline_target: number | null;
  points_to_rupee_conversion: number;
  is_active: boolean;
}

export default function ActivitiesInfo() {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    const { data, error } = await supabase
      .from("gamification_games")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load game configurations");
      setLoading(false);
      return;
    }

    setGames(data || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold mt-4">Game Configurations</h1>
          <p className="text-muted-foreground">View all active game policies and their configurations</p>
        </div>

        {games.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No active games found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {games.map((game) => (
              <Card key={game.id} className="border-l-4 border-l-primary">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-2xl flex items-center gap-2">
                        <Zap className="h-6 w-6 text-primary" />
                        {game.name}
                      </CardTitle>
                      <CardDescription className="mt-2 text-base">
                        {game.description || "No description provided"}
                      </CardDescription>
                    </div>
                    <Badge variant="default" className="ml-4">Active</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Points to Rupee Conversion */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-500 rounded-full p-2">
                        <DollarSign className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Points to Rupee Conversion</p>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                          1 Point = ₹{game.points_to_rupee_conversion}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Target Configuration */}
                  {game.baseline_target && (
                    <div className="flex items-start gap-3">
                      <Target className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-1" />
                      <div>
                        <p className="font-semibold text-sm text-muted-foreground">Baseline Target</p>
                        <p className="text-lg font-medium">{game.baseline_target}</p>
                      </div>
                    </div>
                  )}

                  {/* Territory Information */}
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-1" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-muted-foreground mb-2">Territory Coverage</p>
                      {game.is_all_territories ? (
                        <Badge variant="secondary" className="text-sm">All Territories</Badge>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {game.territories?.map((territory, idx) => (
                            <Badge key={idx} variant="outline" className="text-sm">
                              {territory}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-1" />
                    <div>
                      <p className="font-semibold text-sm text-muted-foreground">Game Duration</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">
                          Start: {format(new Date(game.start_date), "MMM dd, yyyy")}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge variant="outline">
                          End: {format(new Date(game.end_date), "MMM dd, yyyy")}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      <Badge variant="default">Active</Badge>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Conversion Rate</p>
                      <p className="font-semibold">₹{game.points_to_rupee_conversion}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Territories</p>
                      <p className="font-semibold">
                        {game.is_all_territories ? "All" : game.territories?.length || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
