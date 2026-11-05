import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

export const RoleTargetForm = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedKPI, setSelectedKPI] = useState<string>("");
  const [monthlyTarget, setMonthlyTarget] = useState<string>("");
  const [quarterlyTarget, setQuarterlyTarget] = useState<string>("");
  const [yearlyTarget, setYearlyTarget] = useState<string>("");

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

  const { data: kpis } = useQuery({
    queryKey: ['active-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('target_kpi_definitions')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: roleTargets } = useQuery({
    queryKey: ['role-targets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_targets')
        .select(`
          *,
          kpi:target_kpi_definitions(kpi_name, unit)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const createTargetMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('role_targets')
        .insert({
          kpi_id: selectedKPI,
          role_name: selectedRole,
          monthly_target: parseFloat(monthlyTarget),
          quarterly_target: parseFloat(quarterlyTarget),
          yearly_target: parseFloat(yearlyTarget),
          created_by: user?.id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-targets'] });
      toast({ title: "Target created successfully" });
      setSelectedRole("");
      setSelectedKPI("");
      setMonthlyTarget("");
      setQuarterlyTarget("");
      setYearlyTarget("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTargetMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('role_targets')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-targets'] });
      toast({ title: "Target deleted successfully" });
    },
  });

  const formatValue = (value: number, unit: string) => {
    if (unit === 'currency') return `₹${value.toLocaleString()}`;
    if (unit === 'percentage') return `${value}%`;
    return value.toString();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Set Role-Based Targets</CardTitle>
          <CardDescription>
            Define targets for different roles across monthly, quarterly, and yearly periods
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role (Security Profile)</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role from security profiles" />
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

              <div className="space-y-2">
                <Label>KPI</Label>
                <Select value={selectedKPI} onValueChange={setSelectedKPI}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select KPI" />
                  </SelectTrigger>
                  <SelectContent>
                    {kpis?.map((kpi) => (
                      <SelectItem key={kpi.id} value={kpi.id}>
                        {kpi.kpi_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Monthly Target</Label>
                <Input
                  type="number"
                  placeholder="Enter monthly target"
                  value={monthlyTarget}
                  onChange={(e) => setMonthlyTarget(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Quarterly Target</Label>
                <Input
                  type="number"
                  placeholder="Enter quarterly target"
                  value={quarterlyTarget}
                  onChange={(e) => setQuarterlyTarget(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Yearly Target</Label>
                <Input
                  type="number"
                  placeholder="Enter yearly target"
                  value={yearlyTarget}
                  onChange={(e) => setYearlyTarget(e.target.value)}
                />
              </div>
            </div>

            <Button 
              onClick={() => createTargetMutation.mutate()}
              disabled={!selectedRole || !selectedKPI || !monthlyTarget || createTargetMutation.isPending}
            >
              {createTargetMutation.isPending ? "Creating..." : "Create Target"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Role Targets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>KPI</TableHead>
                  <TableHead>Monthly</TableHead>
                  <TableHead>Quarterly</TableHead>
                  <TableHead>Yearly</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roleTargets?.map((target) => (
                  <TableRow key={target.id}>
                    <TableCell className="font-medium uppercase">{target.role_name}</TableCell>
                    <TableCell>{target.kpi?.kpi_name}</TableCell>
                    <TableCell>{formatValue(target.monthly_target, target.kpi?.unit || 'number')}</TableCell>
                    <TableCell>{formatValue(target.quarterly_target, target.kpi?.unit || 'number')}</TableCell>
                    <TableCell>{formatValue(target.yearly_target, target.kpi?.unit || 'number')}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteTargetMutation.mutate(target.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!roleTargets || roleTargets.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No role targets configured yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
