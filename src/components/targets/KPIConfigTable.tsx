import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const KPIConfigTable = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [weightages, setWeightages] = useState<Record<string, number>>({});

  const { data: securityProfiles } = useQuery({
    queryKey: ['security-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('security_profiles')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: kpis, isLoading } = useQuery({
    queryKey: ['kpi-definitions', selectedProfile],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('target_kpi_definitions')
        .select('*')
        .order('display_order');
      
      if (error) throw error;
      
      // Initialize weightages
      const initialWeightages: Record<string, number> = {};
      data?.forEach(kpi => {
        initialWeightages[kpi.id] = kpi.weightage;
      });
      setWeightages(initialWeightages);
      
      return data;
    },
    enabled: !!selectedProfile,
  });

  const toggleKPIMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('target_kpi_definitions')
        .update({ is_active: isActive })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-definitions'] });
      toast({ title: "KPI updated successfully" });
    },
  });

  const updateWeightagesMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(weightages).map(([id, weightage]) => 
        supabase
          .from('target_kpi_definitions')
          .update({ weightage })
          .eq('id', id)
      );
      
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-definitions'] });
      toast({ title: "Weightages updated successfully" });
    },
  });

  const totalWeightage = Object.values(weightages).reduce((sum, w) => sum + w, 0);

  const getUnitBadge = (unit: string) => {
    const colors = {
      currency: 'bg-chart-1/10 text-chart-1',
      percentage: 'bg-chart-2/10 text-chart-2',
      number: 'bg-chart-3/10 text-chart-3',
    };
    return colors[unit as keyof typeof colors] || 'bg-muted text-muted-foreground';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>KPI Configuration by Role</CardTitle>
        <CardDescription>
          Select a role to configure KPIs and their weightages for performance calculation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Role (Security Profile)</label>
            <Select value={selectedProfile} onValueChange={setSelectedProfile}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role to configure KPIs" />
              </SelectTrigger>
              <SelectContent>
                {securityProfiles?.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProfile && (
            <>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading KPIs...</div>
              ) : (
                <>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>KPI Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead className="text-center">Weightage (%)</TableHead>
                          <TableHead className="text-center">Active</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {kpis?.map((kpi) => (
                          <TableRow key={kpi.id}>
                            <TableCell className="font-medium">{kpi.kpi_name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-xs">
                              {kpi.description}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getUnitBadge(kpi.unit)}>
                                {kpi.unit}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={weightages[kpi.id] || 0}
                                onChange={(e) => setWeightages(prev => ({
                                  ...prev,
                                  [kpi.id]: parseFloat(e.target.value) || 0
                                }))}
                                className="w-20 text-center"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={kpi.is_active}
                                onCheckedChange={(checked) => 
                                  toggleKPIMutation.mutate({ id: kpi.id, isActive: checked })
                                }
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="font-semibold">Total Weightage</p>
                      <p className="text-sm text-muted-foreground">
                        {totalWeightage === 100 ? "Perfect!" : "Should equal 100%"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-2xl font-bold ${totalWeightage === 100 ? 'text-chart-1' : 'text-destructive'}`}>
                        {totalWeightage}%
                      </span>
                      <Button 
                        onClick={() => updateWeightagesMutation.mutate()}
                        disabled={totalWeightage !== 100 || updateWeightagesMutation.isPending}
                      >
                        Save Weightages
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};