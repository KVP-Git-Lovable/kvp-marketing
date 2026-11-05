import { useState, useEffect } from "react";
import { ACTIVE_PROFILE } from '@/lib/activeUserFilter';
import { useNavigate } from "react-router-dom";
import { useProfilePermissions } from "@/hooks/useProfilePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Settings, FileText, Users, Clock, RefreshCw, Play, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CompetencyHeader } from "@/components/competency/CompetencyHeader";
import type { CompetencyTemplate } from "@/hooks/useCompetencyScores";

export default function CompetencyAdmin() {
  const navigate = useNavigate();
  const { hasModuleAccess, isLoading: permLoading } = useProfilePermissions();
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState("SalesCoach AI");
  const [isRunningCron, setIsRunningCron] = useState(false);
  const [activeTab, setActiveTab] = useState("templates");

  // Fetch company name
  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const { data } = await supabase.from('companies').select('name').limit(1).single();
        if (data?.name) setCompanyName(data.name);
      } catch (e) { /* use default */ }
    };
    fetchCompany();
  }, []);

  // Fetch templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['competency-templates-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competency_templates')
        .select('*')
        .order('role_type')
        .order('sort_order');
      if (error) throw error;
      return data as CompetencyTemplate[];
    },
  });

  // Fetch recent calculations
  const { data: recentCalculations, isLoading: calculationsLoading } = useQuery({
    queryKey: ['recent-calculations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_monthly_scorecards')
        .select(`
          id,
          user_id,
          month_year,
          overall_score,
          performance_band,
          updated_at,
          profiles:user_id(full_name)
        `)
        .order('updated_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const handleToggleTemplate = async (templateId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('competency_templates')
        .update({ is_active: !currentActive })
        .eq('id', templateId);
      
      if (error) throw error;
      toast.success(`Template ${currentActive ? 'disabled' : 'enabled'}`);
      queryClient.invalidateQueries({ queryKey: ['competency-templates-admin'] });
    } catch (error: any) {
      toast.error(error.message || "Failed to update template");
    }
  };

  const handleRunBatchCalculation = async () => {
    setIsRunningCron(true);
    try {
      // Fetch all active users
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id').match(ACTIVE_PROFILE)
        .limit(100);
      
      if (usersError) throw usersError;
      
      const currentMonth = new Date().toISOString().split('T')[0].slice(0, 8) + '01';
      let successCount = 0;
      
      for (const user of (users || [])) {
        try {
          await supabase.functions.invoke('calculate-competency-scores', {
            body: { userId: user.id, monthYear: currentMonth }
          });
          successCount++;
        } catch (e) {
          console.error(`Failed for user ${user.id}:`, e);
        }
      }
      
      toast.success(`Batch calculation complete: ${successCount}/${users?.length || 0} users processed`);
      queryClient.invalidateQueries({ queryKey: ['recent-calculations'] });
    } catch (error: any) {
      toast.error(error.message || "Failed to run batch calculation");
    } finally {
      setIsRunningCron(false);
    }
  };

  if (!hasModuleAccess('admin_competency_') && !permLoading) {
    return (
      <div className="min-h-screen bg-background">
        <CompetencyHeader
          title="Competency Admin"
          subtitle="Manage competency settings"
          companyName={companyName}
          onBack={() => navigate(-1)}
        />
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <Settings className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Admin Access Required</h2>
            <p className="text-muted-foreground">You need admin privileges to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <CompetencyHeader
        title="Competency Admin"
        subtitle="Configure and manage competency scoring"
        companyName={companyName}
        onBack={() => navigate(-1)}
      />

      <div className="p-4 space-y-6 pb-24">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>Run calculations and maintenance tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleRunBatchCalculation} disabled={isRunningCron} className="flex-1">
                {isRunningCron ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Calculate All Users (This Month)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              💡 Tip: Set up a cron job to run calculations automatically at month end. 
              See documentation for pg_cron setup.
            </p>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="calculations">Recent Calculations</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Templates Tab */}
          <TabsContent value="templates" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Competency Templates
                </CardTitle>
                <CardDescription>Configure competency definitions and weights</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {templatesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competency</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-center">Weight</TableHead>
                        <TableHead className="text-center">Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(templates || []).map((template) => (
                        <TableRow key={template.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{template.competency_name}</div>
                              <div className="text-xs text-muted-foreground">{template.competency_code}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {template.role_type.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{template.category}</TableCell>
                          <TableCell className="text-center">{template.weightage}%</TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={template.is_active}
                              onCheckedChange={() => handleToggleTemplate(template.id, template.is_active)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recent Calculations Tab */}
          <TabsContent value="calculations" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Calculations
                </CardTitle>
                <CardDescription>Latest competency score calculations</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {calculationsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-center">Score</TableHead>
                        <TableHead>Band</TableHead>
                        <TableHead>Calculated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(recentCalculations || []).map((calc: any) => (
                        <TableRow key={calc.id}>
                          <TableCell className="font-medium">
                            {calc.profiles?.full_name || 'Unknown'}
                          </TableCell>
                          <TableCell>{calc.month_year}</TableCell>
                          <TableCell className="text-center font-bold">
                            {Math.round(calc.overall_score)}%
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              {calc.performance_band?.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(calc.updated_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Calculation Settings
                </CardTitle>
                <CardDescription>Configure scoring thresholds and automation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Exceptional Threshold (%)</Label>
                    <Input type="number" defaultValue={90} min={0} max={100} />
                    <p className="text-xs text-muted-foreground">Score above this = Exceptional</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Strong Threshold (%)</Label>
                    <Input type="number" defaultValue={75} min={0} max={100} />
                    <p className="text-xs text-muted-foreground">Score above this = Strong</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Developing Threshold (%)</Label>
                    <Input type="number" defaultValue={60} min={0} max={100} />
                    <p className="text-xs text-muted-foreground">Score above this = Developing</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Auto-calculate Day of Month</Label>
                    <Input type="number" defaultValue={1} min={1} max={28} />
                    <p className="text-xs text-muted-foreground">Day to run automated calculations</p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-3">Cron Job Setup</h4>
                  <div className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto">
                    <pre>{`-- Run this in Supabase SQL Editor to enable scheduled calculations
-- First enable extensions:
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Then create the cron job:
SELECT cron.schedule(
  'monthly-competency-calculation',
  '0 6 1 * *', -- 6 AM on 1st of each month
  $$
  SELECT net.http_post(
    url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/calculate-competency-scores',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_KEY"}'::jsonb,
    body:='{"calculateAll": true}'::jsonb
  ) as request_id;
  $$
);`}</pre>
                  </div>
                </div>

                <Button className="w-full">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Save Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
