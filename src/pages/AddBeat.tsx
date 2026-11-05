import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Plus, MapPin, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

export const AddBeat = () => {
  const navigate = useNavigate();
  const [selectedBeat, setSelectedBeat] = useState<string>("");

  const availableBeats = [
    {
      id: "beat2",
      name: "Beat 2 (North Bangalore)",
      retailers: 32,
      avgDailyVisits: 8,
      distance: "15.5 km",
      estimatedTime: "6-7 hours"
    },
    {
      id: "beat3", 
      name: "Beat 3 (East Bangalore)",
      retailers: 28,
      avgDailyVisits: 7,
      distance: "12.8 km",
      estimatedTime: "5-6 hours"
    },
    {
      id: "beat4",
      name: "Beat 4 (South Bangalore)",
      retailers: 25,
      avgDailyVisits: 6,
      distance: "11.2 km",
      estimatedTime: "4-5 hours"
    },
    {
      id: "beat5",
      name: "Beat 5 (West Bangalore)",
      retailers: 35,
      avgDailyVisits: 9,
      distance: "18.3 km", 
      estimatedTime: "7-8 hours"
    }
  ];

  const handleAddBeat = () => {
    if (!selectedBeat) {
      toast({
        title: "No Beat Selected",
        description: "Please select a beat to add to today's plan",
        variant: "destructive"
      });
      return;
    }

    const beat = availableBeats.find(b => b.id === selectedBeat);
    if (beat) {
      toast({
        title: "Beat Added",
        description: `${beat.name} has been added to today's visit plan`,
      });
      
      // Navigate back after adding
      setTimeout(() => navigate('/visits'), 1500);
    }
  };

  return (
    <Layout>
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 space-y-4">
        {/* Header */}
        <Card className="shadow-card bg-gradient-primary text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-3">
              <div>
                <CardTitle className="text-xl font-bold">Add Beat</CardTitle>
                <p className="text-primary-foreground/80">Add another beat to today's plan</p>
              </div>
            </div>
            <Plus size={24} />
          </CardHeader>
        </Card>

        {/* Current Plan Info */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">Current Plan</h3>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary">Beat 1 (Central Bangalore)</Badge>
              <span className="text-muted-foreground">15 retailers planned</span>
            </div>
          </CardContent>
        </Card>

        {/* Available Beats */}
        <div className="space-y-3">
          <h3 className="font-semibold">Available Beats</h3>
          {availableBeats.map((beat) => (
            <Card 
              key={beat.id}
              className={`cursor-pointer transition-all ${
                selectedBeat === beat.id 
                  ? "border-primary bg-primary/5 shadow-md" 
                  : "hover:shadow-md"
              }`}
              onClick={() => setSelectedBeat(beat.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">{beat.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Users size={14} className="text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {beat.retailers} retailers
                      </span>
                    </div>
                  </div>
                  {selectedBeat === beat.id && (
                    <Badge className="bg-primary text-primary-foreground">Selected</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Daily Visits</div>
                    <div className="font-medium">{beat.avgDailyVisits} visits</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Distance</div>
                    <div className="font-medium">{beat.distance}</div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar size={14} />
                    <span>Estimated time: {beat.estimatedTime}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Impact Warning */}
        {selectedBeat && (
          <Card className="border-warning bg-warning/5">
            <CardContent className="p-4">
              <h4 className="font-semibold text-warning mb-2">⚠️ Planning Impact</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Adding another beat will extend your working day</p>
                <p>• Ensure you have sufficient time for all planned visits</p>
                <p>• Consider travel time between beats</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Button */}
        <Button 
          onClick={handleAddBeat}
          className="w-full" 
          size="lg"
          disabled={!selectedBeat}
        >
          <Plus size={16} className="mr-2" />
          Add Beat to Today's Plan
        </Button>
      </div>
    </div>
    </Layout>
  );
};