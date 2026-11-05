import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Trash2, Loader2, GitBranch, Pencil, X, Check, ChevronDown, ChevronUp, HelpCircle, ArrowDown, Users, UserCheck, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { filterActiveProfileRows } from '@/lib/activeUserFilter';

interface WorkflowStep {
  id?: string;
  workflow_id?: string;
  step_number: number;
  approver_type: 'manager' | 'specific_user' | 'hierarchy_level';
  approver_role: string | null;
  specific_user_id: string | null;
  hierarchy_level: number | null;
}

interface Workflow {
  id: string;
  workflow_name: string;
  entity_type: string;
  approval_mode: 'sequential' | 'parallel_any' | 'parallel_all';
  is_active: boolean;
  is_default: boolean;
  steps?: WorkflowStep[];
}

const APPROVAL_MODE_LABELS: Record<string, string> = {
  sequential: 'Sequential',
  parallel_any: 'Parallel (Any One)',
  parallel_all: 'Parallel (All Required)',
};

const APPROVER_TYPE_LABELS: Record<string, string> = {
  manager: 'Manager',
  specific_user: 'Specific User',
  hierarchy_level: 'Hierarchy Level',
};

const ApprovalWorkflowsConfig = () => {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState<'sequential' | 'parallel_any' | 'parallel_all'>('sequential');
  const [profiles, setProfiles] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    fetchWorkflows();
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    const { data } = await (supabase as any).rpc('get_profiles_for_selector');
    if (data) setProfiles(await filterActiveProfileRows(data));
  };

  const fetchWorkflows = async () => {
    try {
      const { data: wfData, error } = await (supabase as any)
        .from('approval_workflows')
        .select('*')
        .eq('entity_type', 'expense')
        .order('created_at', { ascending: true });
      if (error) throw error;

      // Fetch steps for all workflows
      const ids = (wfData || []).map((w: any) => w.id);
      let stepsData: any[] = [];
      if (ids.length > 0) {
        const { data: steps } = await (supabase as any)
          .from('workflow_steps')
          .select('*')
          .in('workflow_id', ids)
          .order('step_number', { ascending: true });
        stepsData = steps || [];
      }

      setWorkflows((wfData || []).map((w: any) => ({
        ...w,
        steps: stepsData.filter((s: any) => s.workflow_id === w.id),
      })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWorkflow = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('approval_workflows')
        .insert({ workflow_name: newName.trim(), approval_mode: newMode, entity_type: 'expense' });
      if (error) throw error;
      toast({ title: 'Workflow created' });
      setNewName('');
      setShowAdd(false);
      fetchWorkflows();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    try {
      const { error } = await (supabase as any).from('approval_workflows').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Workflow deleted' });
      fetchWorkflows();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      // Unset all defaults
      await (supabase as any).from('approval_workflows').update({ is_default: false }).eq('entity_type', 'expense');
      // Set this one
      await (supabase as any).from('approval_workflows').update({ is_default: true }).eq('id', id);
      fetchWorkflows();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleAddStep = async (workflowId: string, currentSteps: WorkflowStep[]) => {
    setSaving(true);
    try {
      const nextStep = (currentSteps.length > 0 ? Math.max(...currentSteps.map(s => s.step_number)) : 0) + 1;
      const { error } = await (supabase as any)
        .from('workflow_steps')
        .insert({ workflow_id: workflowId, step_number: nextStep, approver_type: 'manager', hierarchy_level: nextStep });
      if (error) throw error;
      fetchWorkflows();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStep = async (stepId: string, updates: Partial<WorkflowStep>) => {
    try {
      const { error } = await (supabase as any)
        .from('workflow_steps')
        .update(updates)
        .eq('id', stepId);
      if (error) throw error;
      fetchWorkflows();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    try {
      const { error } = await (supabase as any).from('workflow_steps').delete().eq('id', stepId);
      if (error) throw error;
      fetchWorkflows();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-cyan-600" />
              Approval Workflows
            </CardTitle>
            <button
              onClick={() => setShowHelp(true)}
              className="inline-flex items-center justify-center rounded-full w-7 h-7 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              aria-label="How approval workflows work"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAdd && (
          <div className="flex flex-wrap items-end gap-2 p-3 bg-muted/50 rounded-md">
            <div className="flex-1 min-w-[150px] space-y-1">
              <label className="text-[11px] text-muted-foreground">Workflow Name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Manager + Finance" className="h-9 text-sm" />
            </div>
            <div className="min-w-[160px] space-y-1">
              <label className="text-[11px] text-muted-foreground">Mode</label>
              <Select value={newMode} onValueChange={(v: any) => setNewMode(v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">Sequential</SelectItem>
                  <SelectItem value="parallel_any">Parallel (Any One)</SelectItem>
                  <SelectItem value="parallel_all">Parallel (All Required)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleAddWorkflow} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {workflows.map((wf) => (
            <div key={wf.id} className="border rounded-md">
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30"
                onClick={() => setExpandedId(expandedId === wf.id ? null : wf.id)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm font-medium truncate">{wf.workflow_name}</span>
                  <Badge variant="secondary" className="text-[10px]">{APPROVAL_MODE_LABELS[wf.approval_mode]}</Badge>
                  {wf.is_default && <Badge className="text-[10px]">Default</Badge>}
                  <Badge variant="outline" className="text-[10px]">{wf.steps?.length || 0} steps</Badge>
                </div>
                <div className="flex items-center gap-1">
                  {!wf.is_default && (
                    <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={(e) => { e.stopPropagation(); handleSetDefault(wf.id); }}>
                      Set Default
                    </Button>
                  )}
                  {!wf.is_default && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteWorkflow(wf.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {expandedId === wf.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>

              {expandedId === wf.id && (
                <div className="border-t p-3 space-y-2 bg-muted/20">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-[60px]">Step</TableHead>
                        <TableHead className="text-xs">Approver Type</TableHead>
                        <TableHead className="text-xs">Level / User</TableHead>
                        <TableHead className="text-xs w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(wf.steps || []).map((step) => (
                        <TableRow key={step.id}>
                          <TableCell className="text-xs font-mono">{step.step_number}</TableCell>
                          <TableCell>
                            <Select
                              value={step.approver_type}
                              onValueChange={(v: any) => handleUpdateStep(step.id!, {
                                approver_type: v,
                                specific_user_id: v === 'specific_user' ? step.specific_user_id : null,
                                hierarchy_level: v === 'hierarchy_level' ? step.step_number : null,
                              })}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="specific_user">Specific User</SelectItem>
                                <SelectItem value="hierarchy_level">Hierarchy Level</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {step.approver_type === 'specific_user' ? (
                              <Select
                                value={step.specific_user_id || ''}
                                onValueChange={(v) => handleUpdateStep(step.id!, { specific_user_id: v })}
                              >
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select user" /></SelectTrigger>
                                <SelectContent>
                                  {profiles.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : step.approver_type === 'hierarchy_level' ? (
                              <Input
                                type="number"
                                min={1}
                                max={10}
                                value={step.hierarchy_level || step.step_number}
                                onChange={(e) => handleUpdateStep(step.id!, { hierarchy_level: Number(e.target.value) })}
                                className="h-8 text-xs w-16"
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">Level {step.step_number} manager</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteStep(step.id!)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Button size="sm" variant="outline" onClick={() => handleAddStep(wf.id, wf.steps || [])}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Step
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>

      {/* Help Dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-4 w-4 text-cyan-600" />
              How Approval Workflows Work
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure who approves expenses and in what order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            {/* Section 1 */}
            <div className="space-y-1.5">
              <h4 className="font-semibold text-foreground">What are Approval Workflows?</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                A workflow is a named approval chain that defines <strong className="text-foreground">who</strong> needs to approve an expense and <strong className="text-foreground">in what order</strong>. For example, "Manager Approval" or "Manager + Finance Head".
              </p>
            </div>

            {/* Section 2 */}
            <div className="space-y-1.5">
              <h4 className="font-semibold text-foreground">How to Create a Workflow</h4>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
                <li>Click <Badge variant="outline" className="text-[10px] px-1.5 py-0">+ Add</Badge> to create a new workflow</li>
                <li>Give it a name (e.g., "Finance Review")</li>
                <li>Choose an approval mode (see below)</li>
                <li>Expand the workflow and add approval steps</li>
                <li>Mark one workflow as <Badge className="text-[10px] px-1.5 py-0">Default</Badge> — it will be used when no specific rule matches</li>
              </ol>
            </div>

            {/* Section 3 - Modes */}
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Approval Modes</h4>
              <div className="grid gap-2">
                <div className="p-2.5 rounded-md border bg-muted/30">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowDown className="h-3.5 w-3.5 text-blue-500" />
                    <span className="font-medium text-xs text-foreground">Sequential</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Step 1 must approve before Step 2 can see the request. Approval flows top-down in order.</p>
                </div>
                <div className="p-2.5 rounded-md border bg-muted/30">
                  <div className="flex items-center gap-2 mb-1">
                    <UserCheck className="h-3.5 w-3.5 text-green-500" />
                    <span className="font-medium text-xs text-foreground">Parallel (Any One)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">All approvers see the request simultaneously. <strong>Any one</strong> approval is enough to proceed.</p>
                </div>
                <div className="p-2.5 rounded-md border bg-muted/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-3.5 w-3.5 text-orange-500" />
                    <span className="font-medium text-xs text-foreground">Parallel (All Required)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">All approvers see the request simultaneously. <strong>Everyone</strong> must approve for it to pass.</p>
                </div>
              </div>
            </div>

            {/* Section 4 - Step Types */}
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Step Types</h4>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-[10px] shrink-0">Manager</Badge>
                  <span>The submitter's direct manager at the given hierarchy level</span>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-[10px] shrink-0">Specific User</Badge>
                  <span>A named person (e.g., Finance Head) — always the same person regardless of who submits</span>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-[10px] shrink-0">Hierarchy Level</Badge>
                  <span>Manager at level N in the reporting chain (e.g., level 2 = manager's manager)</span>
                </div>
              </div>
            </div>

            {/* Section 5 - Connection to Rules */}
            <div className="space-y-1.5">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-purple-500" />
                How Workflows Connect to Expenses
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Workflows are connected to expenses via <strong className="text-foreground">Approval Rules</strong> (configured below). Rules define conditions like:
              </p>
              <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc list-inside">
                <li>Amount between ₹0–500 → use "Auto Approve" workflow</li>
                <li>Amount above ₹2000 → use "Manager + Finance" workflow</li>
                <li>Category = "Travel" → use "Travel Review" workflow</li>
              </ul>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If no rule matches, the <Badge className="text-[10px] px-1.5 py-0">Default</Badge> workflow is used automatically.
              </p>
            </div>

            {/* Section 6 - Example */}
            <div className="p-3 rounded-md border border-dashed bg-muted/20 space-y-2">
              <h4 className="font-semibold text-foreground text-xs">💡 Example Setup</h4>
              <div className="text-[11px] text-muted-foreground space-y-1.5">
                <p><strong className="text-foreground">Workflow:</strong> "Manager + Finance" (Sequential)</p>
                <div className="flex items-center gap-1.5 text-foreground">
                  <Badge variant="outline" className="text-[10px]">Step 1</Badge>
                  <span>Manager</span>
                  <ArrowDown className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline" className="text-[10px]">Step 2</Badge>
                  <span>Finance Head (Specific User)</span>
                </div>
                <p className="pt-1"><strong className="text-foreground">Rule:</strong> Amount above ₹2,000 → route to this workflow</p>
                <p><strong className="text-foreground">Result:</strong> High-value expenses go to the manager first, then to the finance head for final approval.</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ApprovalWorkflowsConfig;
