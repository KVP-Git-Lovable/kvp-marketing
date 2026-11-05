import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface FeedbackPolicy {
  id: string;
  name: string;
  description: string | null;
  module: string;
  is_active: boolean;
  priority: number;
  created_at: string;
  rules?: FeedbackPolicyRule[];
}

interface FeedbackPolicyRule {
  id: string;
  policy_id: string;
  condition_type: string;
  condition_operator: string;
  condition_value: string;
  action_type: string;
  question_set_module: string | null;
  is_active: boolean;
  sort_order: number;
}

const MODULES = [
  { value: 'visit', label: 'Visit' },
  { value: 'order', label: 'Order' },
  { value: 'retailer_feedback', label: 'Retailer Feedback' },
];

const CONDITION_TYPES = [
  { value: 'visit_count', label: 'Visit Count', description: 'Based on number of visits since last feedback' },
  { value: 'no_order', label: 'No Order Placed', description: 'When visit ends without order' },
  { value: 'order_placed', label: 'Order Placed', description: 'When an order is placed' },
  { value: 'visit_completed', label: 'Visit Completed', description: 'On visit completion' },
  { value: 'days_since_feedback', label: 'Days Since Last Feedback', description: 'Time elapsed since last feedback' },
];

const CONDITION_OPERATORS: Record<string, { value: string; label: string }[]> = {
  visit_count: [
    { value: 'every_n', label: 'Every N visits' },
    { value: 'greater_than', label: 'More than N visits' },
    { value: 'equals', label: 'Exactly N visits' },
  ],
  no_order: [
    { value: 'is_true', label: 'Is True' },
  ],
  order_placed: [
    { value: 'is_true', label: 'Is True' },
  ],
  visit_completed: [
    { value: 'is_true', label: 'Is True' },
  ],
  days_since_feedback: [
    { value: 'greater_than', label: 'More than N days' },
    { value: 'equals', label: 'Exactly N days' },
  ],
};

const ACTION_TYPES = [
  { value: 'block_order', label: 'Block Order Page', description: 'Prevent opening order until feedback submitted' },
  { value: 'block_checkout', label: 'Block Checkout', description: 'Prevent completing visit until feedback submitted' },
  { value: 'show_prompt', label: 'Show Prompt', description: 'Show a non-blocking feedback prompt' },
  { value: 'mandatory_feedback', label: 'Mandatory Feedback', description: 'Require feedback submission' },
];

const defaultPolicyForm = {
  name: '',
  description: '',
  module: 'visit',
  is_active: true,
  priority: 0,
};

const defaultRuleForm = {
  condition_type: 'visit_count',
  condition_operator: 'every_n',
  condition_value: '5',
  action_type: 'mandatory_feedback',
  question_set_module: '' as string,
  is_active: true,
  sort_order: 0,
};

export default function FeedbackPolicyConfig() {
  const [policies, setPolicies] = useState<FeedbackPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [activePolicyId, setActivePolicyId] = useState<string | null>(null);
  const [policyForm, setPolicyForm] = useState(defaultPolicyForm);
  const [ruleForm, setRuleForm] = useState(defaultRuleForm);
  const [expandedPolicyId, setExpandedPolicyId] = useState<string | null>(null);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    setLoading(true);
    const { data: policiesData, error: pErr } = await (supabase as any)
      .from('feedback_policies')
      .select('*')
      .order('priority', { ascending: false });

    if (pErr) {
      toast({ title: "Error", description: "Failed to load policies", variant: "destructive" });
      setLoading(false);
      return;
    }

    const { data: rulesData } = await (supabase as any)
      .from('feedback_policy_rules')
      .select('*')
      .order('sort_order', { ascending: true });

    const rulesMap = new Map<string, FeedbackPolicyRule[]>();
    (rulesData || []).forEach((r: FeedbackPolicyRule) => {
      const list = rulesMap.get(r.policy_id) || [];
      list.push(r);
      rulesMap.set(r.policy_id, list);
    });

    setPolicies((policiesData || []).map((p: FeedbackPolicy) => ({
      ...p,
      rules: rulesMap.get(p.id) || [],
    })));
    setLoading(false);
  };

  // Policy CRUD
  const openAddPolicy = () => {
    setEditingPolicyId(null);
    setPolicyForm(defaultPolicyForm);
    setPolicyDialogOpen(true);
  };

  const openEditPolicy = (p: FeedbackPolicy) => {
    setEditingPolicyId(p.id);
    setPolicyForm({
      name: p.name,
      description: p.description || '',
      module: p.module,
      is_active: p.is_active,
      priority: p.priority,
    });
    setPolicyDialogOpen(true);
  };

  const handleSavePolicy = async () => {
    if (!policyForm.name.trim()) {
      toast({ title: "Error", description: "Policy name is required", variant: "destructive" });
      return;
    }

    if (editingPolicyId) {
      const { error } = await (supabase as any)
        .from('feedback_policies')
        .update({ ...policyForm, updated_at: new Date().toISOString() })
        .eq('id', editingPolicyId);
      if (error) {
        toast({ title: "Error", description: "Failed to update policy", variant: "destructive" });
        return;
      }
      toast({ title: "Updated", description: "Policy updated" });
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await (supabase as any)
        .from('feedback_policies')
        .insert({ ...policyForm, created_by: session?.user?.id });
      if (error) {
        toast({ title: "Error", description: "Failed to create policy", variant: "destructive" });
        return;
      }
      toast({ title: "Created", description: "Policy created" });
    }

    setPolicyDialogOpen(false);
    fetchPolicies();
  };

  const handleDeletePolicy = async (id: string) => {
    const { error } = await (supabase as any)
      .from('feedback_policies')
      .delete()
      .eq('id', id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete policy", variant: "destructive" });
      return;
    }
    toast({ title: "Deleted", description: "Policy and its rules deleted" });
    fetchPolicies();
  };

  const handleTogglePolicyActive = async (id: string, current: boolean) => {
    await (supabase as any)
      .from('feedback_policies')
      .update({ is_active: !current, updated_at: new Date().toISOString() })
      .eq('id', id);
    fetchPolicies();
  };

  // Rule CRUD
  const openAddRule = (policyId: string) => {
    setActivePolicyId(policyId);
    setEditingRuleId(null);
    setRuleForm(defaultRuleForm);
    setRuleDialogOpen(true);
  };

  const openEditRule = (rule: FeedbackPolicyRule) => {
    setActivePolicyId(rule.policy_id);
    setEditingRuleId(rule.id);
    setRuleForm({
      condition_type: rule.condition_type,
      condition_operator: rule.condition_operator,
      condition_value: rule.condition_value,
      action_type: rule.action_type,
      question_set_module: rule.question_set_module || '',
      is_active: rule.is_active,
      sort_order: rule.sort_order,
    });
    setRuleDialogOpen(true);
  };

  const handleSaveRule = async () => {
    const payload: any = {
      ...ruleForm,
      question_set_module: ruleForm.question_set_module || null,
      policy_id: activePolicyId,
    };

    if (editingRuleId) {
      payload.updated_at = new Date().toISOString();
      const { error } = await (supabase as any)
        .from('feedback_policy_rules')
        .update(payload)
        .eq('id', editingRuleId);
      if (error) {
        toast({ title: "Error", description: "Failed to update rule", variant: "destructive" });
        return;
      }
      toast({ title: "Updated", description: "Rule updated" });
    } else {
      const { error } = await (supabase as any)
        .from('feedback_policy_rules')
        .insert(payload);
      if (error) {
        toast({ title: "Error", description: "Failed to create rule", variant: "destructive" });
        return;
      }
      toast({ title: "Created", description: "Rule added to policy" });
    }

    setRuleDialogOpen(false);
    fetchPolicies();
  };

  const handleDeleteRule = async (id: string) => {
    await (supabase as any)
      .from('feedback_policy_rules')
      .delete()
      .eq('id', id);
    toast({ title: "Deleted", description: "Rule removed" });
    fetchPolicies();
  };

  const getConditionLabel = (type: string) =>
    CONDITION_TYPES.find(c => c.value === type)?.label || type;

  const getOperatorLabel = (type: string, op: string) =>
    CONDITION_OPERATORS[type]?.find(o => o.value === op)?.label || op;

  const getActionLabel = (type: string) =>
    ACTION_TYPES.find(a => a.value === type)?.label || type;

  return (
    <section className="space-y-4 border-t pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">Feedback policies</h3>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Control when feedback is prompted or required during field work.</p>
        </div>
        <Button onClick={openAddPolicy} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Policy
        </Button>
      </div>

      {loading ? (
        <p className="text-center py-8 text-muted-foreground">Loading...</p>
      ) : policies.length === 0 ? (
        <Card className="border-dashed bg-muted/10 p-10 text-center text-muted-foreground">
          <Settings2 className="mx-auto mb-3 h-8 w-8 opacity-50" />
          <p className="text-sm font-medium text-foreground">No policies configured</p>
          <p className="mt-1 text-xs">Create one to start enforcing feedback rules.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {policies.map(policy => (
            <Card key={policy.id} className="overflow-hidden shadow-sm">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setExpandedPolicyId(expandedPolicyId === policy.id ? null : policy.id)}
                  >
                    {expandedPolicyId === policy.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium truncate">{policy.name}</span>
                      <Badge variant="secondary">{policy.module}</Badge>
                      <Badge variant={policy.is_active ? "default" : "outline"}>
                        {policy.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline">{(policy.rules || []).length} rules</Badge>
                    </div>
                    {policy.description && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">{policy.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <Switch
                    checked={policy.is_active}
                    onCheckedChange={() => handleTogglePolicyActive(policy.id, policy.is_active)}
                  />
                  <Button variant="ghost" size="icon" onClick={() => openEditPolicy(policy)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeletePolicy(policy.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {expandedPolicyId === policy.id && (
                <div className="border-t bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium flex items-center gap-1">
                      <Settings2 className="h-4 w-4" /> Rules
                    </h4>
                    <Button size="sm" variant="outline" onClick={() => openAddRule(policy.id)}>
                      <Plus className="h-3 w-3 mr-1" /> Add Rule
                    </Button>
                  </div>

                  {(policy.rules || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No rules defined. Add a rule to specify when feedback is enforced.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Condition</TableHead>
                          <TableHead>Operator</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Active</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(policy.rules || []).map(rule => (
                          <TableRow key={rule.id}>
                            <TableCell>
                              <Badge variant="secondary">{getConditionLabel(rule.condition_type)}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {getOperatorLabel(rule.condition_type, rule.condition_operator)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{rule.condition_value}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-primary/10 text-primary border-primary/20">
                                {getActionLabel(rule.action_type)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={rule.is_active}
                                onCheckedChange={async () => {
                                  await (supabase as any)
                                    .from('feedback_policy_rules')
                                    .update({ is_active: !rule.is_active })
                                    .eq('id', rule.id);
                                  fetchPolicies();
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEditRule(rule)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteRule(rule.id)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Policy Dialog */}
      <Dialog open={policyDialogOpen} onOpenChange={setPolicyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPolicyId ? 'Edit Policy' : 'Create Policy'}</DialogTitle>
            <DialogDescription>Define a feedback enforcement policy</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Policy Name</Label>
              <Input
                value={policyForm.name}
                onChange={e => setPolicyForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Every 5 visits mandatory feedback"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={policyForm.description}
                onChange={e => setPolicyForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe when and why this policy applies..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Module</Label>
                <Select value={policyForm.module} onValueChange={v => setPolicyForm(f => ({ ...f, module: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODULES.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={policyForm.priority}
                  onChange={e => setPolicyForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={policyForm.is_active}
                onCheckedChange={v => setPolicyForm(f => ({ ...f, is_active: v }))}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPolicyDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePolicy}>{editingPolicyId ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRuleId ? 'Edit Rule' : 'Add Rule'}</DialogTitle>
            <DialogDescription>Define a condition and the action to enforce</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Condition Type</Label>
              <Select
                value={ruleForm.condition_type}
                onValueChange={v => {
                  const ops = CONDITION_OPERATORS[v] || [];
                  setRuleForm(f => ({
                    ...f,
                    condition_type: v,
                    condition_operator: ops[0]?.value || 'is_true',
                    condition_value: v === 'no_order' || v === 'order_placed' || v === 'visit_completed' ? 'true' : '5',
                  }));
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITION_TYPES.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      <div>
                        <div>{c.label}</div>
                        <div className="text-xs text-muted-foreground">{c.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Operator</Label>
                <Select
                  value={ruleForm.condition_operator}
                  onValueChange={v => setRuleForm(f => ({ ...f, condition_operator: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(CONDITION_OPERATORS[ruleForm.condition_type] || []).map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  value={ruleForm.condition_value}
                  onChange={e => setRuleForm(f => ({ ...f, condition_value: e.target.value }))}
                  disabled={ruleForm.condition_operator === 'is_true'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={ruleForm.action_type} onValueChange={v => setRuleForm(f => ({ ...f, action_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map(a => (
                    <SelectItem key={a.value} value={a.value}>
                      <div>
                        <div>{a.label}</div>
                        <div className="text-xs text-muted-foreground">{a.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Question Set Module (optional)</Label>
              <Select
                value={ruleForm.question_set_module || 'none'}
                onValueChange={v => setRuleForm(f => ({ ...f, question_set_module: v === 'none' ? '' : v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default questions</SelectItem>
                  {MODULES.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={ruleForm.is_active}
                onCheckedChange={v => setRuleForm(f => ({ ...f, is_active: v }))}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRule}>{editingRuleId ? 'Update' : 'Add Rule'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
