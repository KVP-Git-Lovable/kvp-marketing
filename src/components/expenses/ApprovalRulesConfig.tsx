import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Loader2, Scale, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ApprovalRule {
  id: string;
  rule_name: string;
  condition_type: 'amount_range' | 'category' | 'always';
  condition_value: any;
  workflow_id: string;
  priority: number;
  is_active: boolean;
}

interface Workflow {
  id: string;
  workflow_name: string;
}

interface Category {
  id: string;
  name: string;
}

const ApprovalRulesConfig = () => {
  const { toast } = useToast();
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const [newForm, setNewForm] = useState({
    rule_name: '',
    condition_type: 'amount_range' as 'amount_range' | 'category' | 'always',
    min_amount: '',
    max_amount: '',
    category_id: '',
    workflow_id: '',
    priority: '100',
  });

  useEffect(() => {
    Promise.all([fetchRules(), fetchWorkflows(), fetchCategories()]).finally(() => setLoading(false));
  }, []);

  const fetchRules = async () => {
    const { data } = await (supabase as any)
      .from('expense_approval_rules')
      .select('*')
      .order('priority', { ascending: true });
    setRules(data || []);
  };

  const fetchWorkflows = async () => {
    const { data } = await (supabase as any)
      .from('approval_workflows')
      .select('id, workflow_name')
      .eq('entity_type', 'expense')
      .eq('is_active', true);
    setWorkflows(data || []);
  };

  const fetchCategories = async () => {
    const { data } = await (supabase as any)
      .from('expense_categories')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order');
    setCategories(data || []);
  };

  const handleAdd = async () => {
    if (!newForm.rule_name.trim() || !newForm.workflow_id) return;
    setSaving(true);
    try {
      let conditionValue: any = {};
      if (newForm.condition_type === 'amount_range') {
        conditionValue = { min: Number(newForm.min_amount) || 0, max: Number(newForm.max_amount) || 999999 };
      } else if (newForm.condition_type === 'category') {
        conditionValue = { category_id: newForm.category_id };
      }

      const { error } = await (supabase as any)
        .from('expense_approval_rules')
        .insert({
          rule_name: newForm.rule_name.trim(),
          condition_type: newForm.condition_type,
          condition_value: conditionValue,
          workflow_id: newForm.workflow_id,
          priority: Number(newForm.priority) || 100,
        });
      if (error) throw error;
      toast({ title: 'Rule added' });
      setNewForm({ rule_name: '', condition_type: 'amount_range', min_amount: '', max_amount: '', category_id: '', workflow_id: '', priority: '100' });
      setShowAdd(false);
      fetchRules();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase as any).from('expense_approval_rules').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Rule deleted' });
      fetchRules();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const getConditionLabel = (rule: ApprovalRule) => {
    if (rule.condition_type === 'amount_range') {
      return `₹${rule.condition_value?.min || 0} — ₹${rule.condition_value?.max || '∞'}`;
    }
    if (rule.condition_type === 'category') {
      const cat = categories.find(c => c.id === rule.condition_value?.category_id);
      return cat?.name || 'Unknown category';
    }
    return 'Always';
  };

  const getWorkflowName = (wfId: string) => {
    return workflows.find(w => w.id === wfId)?.workflow_name || 'Unknown';
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
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-4 w-4 text-violet-600" />
            Approval Rules
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Rule
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Rules are checked in priority order (lowest first). First match wins. If no rule matches, the default workflow is used.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAdd && (
          <div className="space-y-3 p-3 bg-muted/50 rounded-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Rule Name</label>
                <Input value={newForm.rule_name} onChange={(e) => setNewForm(p => ({ ...p, rule_name: e.target.value }))} placeholder="e.g. High value expenses" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Condition Type</label>
                <Select value={newForm.condition_type} onValueChange={(v: any) => setNewForm(p => ({ ...p, condition_type: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount_range">Amount Range</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="always">Always</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newForm.condition_type === 'amount_range' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Min Amount (₹)</label>
                  <Input type="number" value={newForm.min_amount} onChange={(e) => setNewForm(p => ({ ...p, min_amount: e.target.value }))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Max Amount (₹)</label>
                  <Input type="number" value={newForm.max_amount} onChange={(e) => setNewForm(p => ({ ...p, max_amount: e.target.value }))} className="h-9 text-sm" />
                </div>
              </div>
            )}

            {newForm.condition_type === 'category' && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Category</label>
                <Select value={newForm.category_id} onValueChange={(v) => setNewForm(p => ({ ...p, category_id: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Workflow</label>
                <Select value={newForm.workflow_id} onValueChange={(v) => setNewForm(p => ({ ...p, workflow_id: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select workflow" /></SelectTrigger>
                  <SelectContent>
                    {workflows.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.workflow_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Priority (lower = first)</label>
                <Input type="number" value={newForm.priority} onChange={(e) => setNewForm(p => ({ ...p, priority: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {rules.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No rules configured. All expenses will use the default workflow.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-[50px]">Priority</TableHead>
                <TableHead className="text-xs">Rule</TableHead>
                <TableHead className="text-xs">Condition</TableHead>
                <TableHead className="text-xs">Workflow</TableHead>
                <TableHead className="text-xs w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="text-xs font-mono">{rule.priority}</TableCell>
                  <TableCell className="text-xs font-medium">{rule.rule_name}</TableCell>
                  <TableCell className="text-xs">{getConditionLabel(rule)}</TableCell>
                  <TableCell className="text-xs">{getWorkflowName(rule.workflow_id)}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(rule.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ApprovalRulesConfig;
