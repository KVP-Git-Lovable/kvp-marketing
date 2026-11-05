import { useState, useMemo, useEffect } from "react";
import { ACTIVE_PROFILE } from '@/lib/activeUserFilter';
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import {
  Plus, Trash2, Edit2, Users, TrendingUp, DollarSign,
  Clock, ChevronDown, ChevronUp, IndianRupee,
} from "lucide-react";
import { AIWorkloadAnalysis } from "./AIWorkloadAnalysis";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  projectId: string;
}

interface Resource {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  budget_allocated: number;
  selling_rate: number;
  cost_rate: number;
  start_date: string | null;
  release_date: string | null;
  deployment_type: string;
  created_at: string;
  updated_at: string;
  profile?: { full_name: string; profile_picture_url?: string };
}

interface TimeLogEntry {
  user_id: string;
  hours: number;
  date: string;
  allocation: string;
}

const ROLE_OPTIONS = ["Project Manager", "Developer", "Designer", "Tester", "Business Analyst", "Consultant", "Architect", "Lead", "Other"];
const DEPLOYMENT_OPTIONS = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
];

const COLORS = ["#6366f1", "#ec4899", "#f97316", "#22c55e", "#06b6d4", "#eab308", "#8b5cf6", "#ef4444"];

export function ResourcesPanel({ projectId }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [chartOpen, setChartOpen] = useState(true);

  // Fetch resources
  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["pm_project_resources", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pm_project_resources")
        .select("*, profile:profiles!pm_project_resources_user_id_fkey(full_name, profile_picture_url)")
        .eq("project_id", projectId)
        .order("created_at");
      if (error) throw error;
      return (data || []) as Resource[];
    },
  });

  // Fetch all time logs for this project
  const { data: timeLogs = [] } = useQuery({
    queryKey: ["pm_time_logs_resources", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pm_time_logs")
        .select("user_id, hours, date, allocation")
        .eq("project_id", projectId);
      if (error) throw error;
      return (data || []) as TimeLogEntry[];
    },
  });

  // Fetch available users for adding
  const { data: allUsers = [] } = useQuery({
    queryKey: ["profiles_for_resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name").match(ACTIVE_PROFILE)
        .not("full_name", "is", null)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Create resource + auto-add as project member
  const createResource = useMutation({
    mutationFn: async (values: Partial<Resource>) => {
      const { error } = await supabase.from("pm_project_resources").insert([values] as any);
      if (error) throw error;
      // Also add as project member (collaborator) if not already
      if (values.user_id) {
        await supabase.from("pm_project_members").upsert(
          { project_id: projectId, user_id: values.user_id, role: "member" as any },
          { onConflict: "project_id,user_id" }
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm_project_resources", projectId] });
      queryClient.invalidateQueries({ queryKey: ["pm_project_members", projectId] });
      toast.success("Resource added & added as project collaborator");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Update resource
  const updateResource = useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & Partial<Resource>) => {
      const { error } = await supabase.from("pm_project_resources").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm_project_resources", projectId] });
      toast.success("Resource updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete resource
  const deleteResource = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pm_project_resources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm_project_resources", projectId] });
      toast.success("Resource removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Compute per-resource metrics
  const resourceMetrics = useMemo(() => {
    return resources.map((r) => {
      const userLogs = timeLogs.filter((l) => l.user_id === r.user_id);
      const totalHoursLogged = userLogs.reduce((s, l) => s + l.hours, 0);
      const billableHours = userLogs.filter((l) => l.allocation === "Billable").reduce((s, l) => s + l.hours, 0);

      const revenue = totalHoursLogged * r.selling_rate;
      const cost = totalHoursLogged * r.cost_rate;
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      // Utilization: hours logged vs effort budget (hours)
      const availableHours = r.budget_allocated || 0;
      const utilization = availableHours > 0 ? Math.min((totalHoursLogged / availableHours) * 100, 100) : 0;

      return {
        ...r,
        totalHoursLogged,
        billableHours,
        revenue,
        cost,
        profit,
        margin,
        availableHours,
        utilization,
      };
    });
  }, [resources, timeLogs]);

  // Project-level profitability
  const projectProfitability = useMemo(() => {
    const totalRevenue = resourceMetrics.reduce((s, r) => s + r.revenue, 0);
    const totalCost = resourceMetrics.reduce((s, r) => s + r.cost, 0);
    const totalProfit = totalRevenue - totalCost;
    const totalBudget = resourceMetrics.reduce((s, r) => s + r.budget_allocated, 0);
    const totalHours = resourceMetrics.reduce((s, r) => s + r.totalHoursLogged, 0);
    const avgUtilization = resourceMetrics.length > 0
      ? resourceMetrics.reduce((s, r) => s + r.utilization, 0) / resourceMetrics.length
      : 0;
    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    return { totalRevenue, totalCost, totalProfit, totalBudget, totalHours, avgUtilization, margin };
  }, [resourceMetrics]);

  // Chart data
  const utilizationData = resourceMetrics.map((r, i) => ({
    name: r.profile?.full_name || "Unknown",
    utilization: Math.round(r.utilization),
    fill: COLORS[i % COLORS.length],
  }));

  const profitabilityData = resourceMetrics.map((r, i) => ({
    name: r.profile?.full_name || "Unknown",
    revenue: r.revenue,
    cost: r.cost,
    profit: r.profit,
  }));

  const availableUsers = allUsers.filter(
    (u) => !resources.some((r) => r.user_id === u.id)
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Profitability KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Team Size", value: resources.length, icon: Users, color: "text-primary" },
          { label: "Total Hours", value: `${projectProfitability.totalHours.toFixed(1)}h`, icon: Clock, color: "text-blue-500" },
          { label: "Effort Budget", value: `${projectProfitability.totalBudget.toFixed(0)}h`, icon: Clock, color: "text-indigo-500" },
          { label: "Revenue", value: `₹${(projectProfitability.totalRevenue / 1000).toFixed(1)}K`, icon: IndianRupee, color: "text-green-600" },
          { label: "Cost", value: `₹${(projectProfitability.totalCost / 1000).toFixed(1)}K`, icon: IndianRupee, color: "text-red-500" },
          { label: "Profit", value: `₹${(projectProfitability.totalProfit / 1000).toFixed(1)}K`, icon: TrendingUp, color: projectProfitability.totalProfit >= 0 ? "text-green-600" : "text-red-500" },
          { label: "Avg Utilization", value: `${projectProfitability.avgUtilization.toFixed(0)}%`, icon: TrendingUp, color: "text-amber-500" },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="p-3 flex items-center gap-2">
              <m.icon className={cn("w-6 h-6", m.color)} />
              <div>
                <div className="text-lg font-bold text-foreground">{m.value}</div>
                <div className="text-[10px] text-muted-foreground">{m.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <Collapsible open={chartOpen} onOpenChange={setChartOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 mb-2">
            {chartOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {chartOpen ? "Hide Charts" : "Show Charts"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {resourceMetrics.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Utilization by Resource</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={utilizationData} layout="vertical">
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Bar dataKey="utilization" radius={4}>
                        {utilizationData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue vs Cost by Resource</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={profitabilityData}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => `₹${v.toFixed(0)}`} />
                      <Bar dataKey="revenue" fill="#22c55e" name="Revenue" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="cost" fill="#ef4444" name="Cost" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Resource Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Team Resources</CardTitle>
            <div className="flex gap-2">
              <AIWorkloadAnalysis projectId={projectId} />
              <Button size="sm" onClick={() => { setEditingResource(null); setShowForm(true); }} className="gap-1">
                <Plus className="w-4 h-4" /> Add Resource
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
          ) : resourceMetrics.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No resources added yet. Add team members to track utilization and profitability.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2 px-2">ID</th>
                    <th className="text-left py-2 px-2">Name</th>
                    <th className="text-left py-2 px-2">Role</th>
                    <th className="text-center py-2 px-2">Type</th>
                    <th className="text-right py-2 px-2">Sell Rate/hr</th>
                    <th className="text-right py-2 px-2">Cost/hr</th>
                    <th className="text-right py-2 px-2">Effort Budget</th>
                    <th className="text-center py-2 px-2">Period</th>
                    <th className="text-right py-2 px-2">Hours</th>
                    <th className="text-center py-2 px-2">Utilization</th>
                    <th className="text-right py-2 px-2">Revenue</th>
                    <th className="text-right py-2 px-2">Cost</th>
                    <th className="text-right py-2 px-2">Profit</th>
                    <th className="text-right py-2 px-2">Margin</th>
                    <th className="text-center py-2 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {resourceMetrics.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-2">
                        <span className="text-primary hover:underline cursor-pointer font-mono text-xs" onClick={() => navigate(`/projects/${projectId}/resources/${r.id}`)}>
                          {r.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-medium text-foreground">{r.profile?.full_name || "Unknown"}</td>
                      <td className="py-2 px-2 text-muted-foreground">{r.role}</td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant={r.deployment_type === "full_time" ? "default" : "secondary"} className="text-[10px]">
                          {r.deployment_type === "full_time" ? "FT" : "PT"}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-right">₹{r.selling_rate}</td>
                      <td className="py-2 px-2 text-right">₹{r.cost_rate}</td>
                      <td className="py-2 px-2 text-right">{r.budget_allocated}h</td>
                      <td className="py-2 px-2 text-center text-[10px] text-muted-foreground">
                        {r.start_date ? format(parseISO(r.start_date), "dd MMM") : "—"} – {r.release_date ? format(parseISO(r.release_date), "dd MMM") : "—"}
                      </td>
                      <td className="py-2 px-2 text-right">{r.totalHoursLogged.toFixed(1)}h</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <Progress value={r.utilization} className="h-1.5 flex-1" />
                          <span className="text-[10px] w-8 text-right">{r.utilization.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right text-green-600">₹{r.revenue.toFixed(0)}</td>
                      <td className="py-2 px-2 text-right text-red-500">₹{r.cost.toFixed(0)}</td>
                      <td className={cn("py-2 px-2 text-right font-medium", r.profit >= 0 ? "text-green-600" : "text-red-500")}>
                        ₹{r.profit.toFixed(0)}
                      </td>
                      <td className={cn("py-2 px-2 text-right", r.margin >= 0 ? "text-green-600" : "text-red-500")}>
                        {r.margin.toFixed(0)}%
                      </td>
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => { setEditingResource(r); setShowForm(true); }}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive" onClick={() => deleteResource.mutate(r.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr className="border-t-2 font-semibold text-foreground">
                    <td className="py-2 px-2" colSpan={8}>Total</td>
                    <td className="py-2 px-2 text-right">{projectProfitability.totalHours.toFixed(1)}h</td>
                    <td className="py-2 px-2 text-center">{projectProfitability.avgUtilization.toFixed(0)}%</td>
                    <td className="py-2 px-2 text-right text-green-600">₹{projectProfitability.totalRevenue.toFixed(0)}</td>
                    <td className="py-2 px-2 text-right text-red-500">₹{projectProfitability.totalCost.toFixed(0)}</td>
                    <td className={cn("py-2 px-2 text-right", projectProfitability.totalProfit >= 0 ? "text-green-600" : "text-red-500")}>
                      ₹{projectProfitability.totalProfit.toFixed(0)}
                    </td>
                    <td className={cn("py-2 px-2 text-right", projectProfitability.margin >= 0 ? "text-green-600" : "text-red-500")}>
                      {projectProfitability.margin.toFixed(0)}%
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Resource Dialog */}
      <ResourceFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditingResource(null); }}
        resource={editingResource}
        availableUsers={editingResource ? allUsers : availableUsers}
        projectId={projectId}
        onSave={(vals) => {
          if (editingResource) {
            updateResource.mutate({ id: editingResource.id, ...vals } as any);
          } else {
            createResource.mutate({ ...vals, project_id: projectId } as any);
          }
          setShowForm(false);
          setEditingResource(null);
        }}
      />
    </div>
  );
}

// ─── Resource Form Dialog ───────────────────────────────────────────────────
interface FormProps {
  open: boolean;
  onClose: () => void;
  resource: Resource | null;
  availableUsers: { id: string; full_name: string }[];
  projectId: string;
  onSave: (vals: any) => void;
}

function ResourceFormDialog({ open, onClose, resource, availableUsers, onSave }: FormProps) {
  const [form, setForm] = useState({
    user_id: "",
    role: "Developer",
    budget_allocated: "",
    selling_rate: "",
    cost_rate: "",
    start_date: "",
    release_date: "",
    deployment_type: "full_time",
  });

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && resource) {
      setForm({
        user_id: resource.user_id,
        role: resource.role,
        budget_allocated: resource.budget_allocated?.toString() || "",
        selling_rate: resource.selling_rate?.toString() || "",
        cost_rate: resource.cost_rate?.toString() || "",
        start_date: resource.start_date || "",
        release_date: resource.release_date || "",
        deployment_type: resource.deployment_type || "full_time",
      });
    } else if (isOpen) {
      setForm({ user_id: "", role: "Developer", budget_allocated: "", selling_rate: "", cost_rate: "", start_date: "", release_date: "", deployment_type: "full_time" });
    }
    if (!isOpen) onClose();
  };

  // Trigger reset when dialog opens or resource changes
  useEffect(() => { if (open) handleOpenChange(true); }, [open, resource]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resource && !form.user_id) {
      toast.error("Please select a team member");
      return;
    }
    onSave({
      ...(resource ? {} : { user_id: form.user_id }),
      role: form.role,
      budget_allocated: parseFloat(form.budget_allocated) || 0,
      selling_rate: parseFloat(form.selling_rate) || 0,
      cost_rate: parseFloat(form.cost_rate) || 0,
      start_date: form.start_date || null,
      release_date: form.release_date || null,
      deployment_type: form.deployment_type,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{resource ? "Edit Resource" : "Add Team Resource"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {!resource && (
            <div>
              <Label>Team Member *</Label>
              <Select value={form.user_id} onValueChange={(v) => setForm((f) => ({ ...f, user_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
                <SelectContent>
                  {availableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Deployment Type</Label>
              <Select value={form.deployment_type} onValueChange={(v) => setForm((f) => ({ ...f, deployment_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPLOYMENT_OPTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Selling Rate/hr (₹)</Label>
              <Input type="number" step="0.01" value={form.selling_rate} onChange={(e) => setForm((f) => ({ ...f, selling_rate: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <Label>Cost Rate/hr (₹)</Label>
              <Input type="number" step="0.01" value={form.cost_rate} onChange={(e) => setForm((f) => ({ ...f, cost_rate: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <Label>Effort Budget (hrs)</Label>
              <Input type="number" value={form.budget_allocated} onChange={(e) => setForm((f) => ({ ...f, budget_allocated: e.target.value }))} placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <Label>Release Date</Label>
              <Input type="date" value={form.release_date} onChange={(e) => setForm((f) => ({ ...f, release_date: e.target.value }))} />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">{resource ? "Update" : "Add Resource"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}