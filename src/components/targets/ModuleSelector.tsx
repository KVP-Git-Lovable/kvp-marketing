import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Target, Trophy } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ModuleSelectorProps {
  currentModule: string;
}

export const ModuleSelector = ({ currentModule }: ModuleSelectorProps) => {
  const [selectedModule, setSelectedModule] = useState(currentModule);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateModuleMutation = useMutation({
    mutationFn: async (module: string) => {
      const { data, error } = await supabase
        .from('performance_module_config')
        .update({ active_module: module, updated_at: new Date().toISOString() })
        .eq('id', (await supabase.from('performance_module_config').select('id').single()).data?.id);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-module-config'] });
      toast({
        title: "Module Updated",
        description: "Performance module configuration has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update module: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateModuleMutation.mutate(selectedModule);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Tracking Module</CardTitle>
        <CardDescription>
          Choose which performance tracking system to activate for your organization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Choose a module. Switching modules will not delete historical data.
          </AlertDescription>
        </Alert>

        <RadioGroup value={selectedModule} onValueChange={setSelectedModule}>
          <div className="flex items-start space-x-3 space-y-0 rounded-lg border p-4 hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="gamification" id="gamification" />
            <div className="flex-1">
              <Label htmlFor="gamification" className="flex items-center gap-2 cursor-pointer">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="font-semibold">Gamification Only</span>
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Activity-based points system with badges, leaderboards, and redemptions. 
                Focus on engagement and competition among team members.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 space-y-0 rounded-lg border p-4 hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="target_actual" id="target_actual" />
            <div className="flex-1">
              <Label htmlFor="target_actual" className="flex items-center gap-2 cursor-pointer">
                <Target className="h-4 w-4 text-primary" />
                <span className="font-semibold">Target vs. Actual Only</span>
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                KPI-based performance tracking with monthly, quarterly, and yearly targets. 
                Focus on goal achievement and performance ratings.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 space-y-0 rounded-lg border p-4 hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="none" id="none" />
            <div className="flex-1">
              <Label htmlFor="none" className="cursor-pointer">
                <span className="font-semibold">Disabled</span>
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Turn off performance tracking modules entirely. Performance will be hidden from navigation.
              </p>
            </div>
          </div>
        </RadioGroup>

        <Button 
          onClick={handleSave} 
          disabled={selectedModule === currentModule || updateModuleMutation.isPending}
        >
          {updateModuleMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  );
};
