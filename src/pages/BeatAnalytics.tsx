import { useState } from "react";
import { ArrowLeft, TrendingUp, Target, Users, Calendar, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";

export const BeatAnalytics = () => {
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState("week");

  const beatMetrics = {
    totalRetailers: 45,
    activeRetailers: 38,
    visitCompletionRate: 84,
    avgOrderValue: 15250,
    totalOrderValue: 578500,
    ordersThisWeek: 32,
    productiveVisits: 28,
    unproductiveVisits: 4
  };

  const weeklyProgress = [
    { day: "Mon", planned: 8, completed: 7, orders: 5 },
    { day: "Tue", planned: 9, completed: 8, orders: 6 },
    { day: "Wed", planned: 7, completed: 6, orders: 4 },
    { day: "Thu", planned: 10, completed: 9, orders: 7 },
    { day: "Fri", planned: 8, completed: 7, orders: 5 },
    { day: "Sat", planned: 6, completed: 5, orders: 3 },
    { day: "Sun", planned: 4, completed: 4, orders: 2 }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 space-y-4">
        {/* Header */}
        <Card className="shadow-card bg-gradient-primary text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate(-1)}
                className="text-primary-foreground hover:bg-primary-foreground/20"
              >
                <ArrowLeft size={20} />
              </Button>
              <div>
                <CardTitle className="text-xl font-bold">Beat Analytics</CardTitle>
                <p className="text-primary-foreground/80">Beat 1 (Central Bangalore)</p>
              </div>
            </div>
            <BarChart3 size={24} />
          </CardHeader>
        </Card>

        {/* Period Selector */}
        <Card>
          <CardContent className="p-3">
            <div className="flex gap-2">
              {["week", "month", "quarter"].map((period) => (
                <Button
                  key={period}
                  variant={selectedPeriod === period ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPeriod(period)}
                  className="flex-1"
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">₹{beatMetrics.totalOrderValue.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Order Value</div>
              <div className="flex items-center justify-center mt-2 text-success text-sm">
                <TrendingUp size={14} className="mr-1" />
                +12.5%
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-success">{beatMetrics.ordersThisWeek}</div>
              <div className="text-sm text-muted-foreground">Orders This Week</div>
              <div className="flex items-center justify-center mt-2 text-success text-sm">
                <Target size={14} className="mr-1" />
                80% of target
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Visit Completion Rate</span>
                <span className="font-semibold">{beatMetrics.visitCompletionRate}%</span>
              </div>
              <Progress value={beatMetrics.visitCompletionRate} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Retailer Coverage</span>
                <span className="font-semibold">{Math.round((beatMetrics.activeRetailers / beatMetrics.totalRetailers) * 100)}%</span>
              </div>
              <Progress value={(beatMetrics.activeRetailers / beatMetrics.totalRetailers) * 100} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-lg font-bold">{beatMetrics.totalRetailers}</div>
                <div className="text-sm text-muted-foreground">Total Retailers</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-lg font-bold">₹{beatMetrics.avgOrderValue.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Avg Order Value</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Weekly Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {weeklyProgress.map((day) => (
                <div key={day.day} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-12 text-sm font-medium">{day.day}</div>
                    <div className="text-sm text-muted-foreground">
                      {day.completed}/{day.planned} visits
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{day.orders} orders</Badge>
                    <div className="w-16 text-right text-sm font-medium">
                      {Math.round((day.completed / day.planned) * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Visit Analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Visit Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-success/10 rounded-lg border border-success/20">
                <div className="text-xl font-bold text-success">{beatMetrics.productiveVisits}</div>
                <div className="text-sm text-muted-foreground">Productive Visits</div>
              </div>
              <div className="text-center p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                <div className="text-xl font-bold text-destructive">{beatMetrics.unproductiveVisits}</div>
                <div className="text-sm text-muted-foreground">Unproductive Visits</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};