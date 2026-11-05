import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Save, Loader2, Tags, Pencil, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ExpenseCategory {
  id: string;
  name: string;
  receipt_required: boolean;
  limit_amount: number | null;
  is_active: boolean;
  sort_order: number;
}

const ExpenseCategoriesConfig = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', receipt_required: false, limit_amount: '' });
  const [newForm, setNewForm] = useState({ name: '', receipt_required: false, limit_amount: '' });
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('expense_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setCategories(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newForm.name.trim()) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('expense_categories')
        .insert({
          name: newForm.name.trim(),
          receipt_required: newForm.receipt_required,
          limit_amount: newForm.limit_amount ? Number(newForm.limit_amount) : null,
          sort_order: categories.length + 1,
        });
      if (error) throw error;
      toast({ title: 'Category added' });
      setNewForm({ name: '', receipt_required: false, limit_amount: '' });
      setShowAdd(false);
      fetchCategories();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('expense_categories')
        .update({
          name: editForm.name.trim(),
          receipt_required: editForm.receipt_required,
          limit_amount: editForm.limit_amount ? Number(editForm.limit_amount) : null,
        })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Category updated' });
      setEditingId(null);
      fetchCategories();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('expense_categories')
        .update({ is_active: !isActive })
        .eq('id', id);
      if (error) throw error;
      fetchCategories();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('expense_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Category deleted' });
      fetchCategories();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const startEdit = (cat: ExpenseCategory) => {
    setEditingId(cat.id);
    setEditForm({
      name: cat.name,
      receipt_required: cat.receipt_required,
      limit_amount: cat.limit_amount?.toString() || '',
    });
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
            <Tags className="h-4 w-4 text-orange-600" />
            Expense Categories
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAdd && (
          <div className="flex flex-wrap items-end gap-2 p-3 bg-muted/50 rounded-md">
            <div className="flex-1 min-w-[120px] space-y-1">
              <label className="text-[11px] text-muted-foreground">Name</label>
              <Input
                value={newForm.name}
                onChange={(e) => setNewForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Category name"
                className="h-9 text-sm"
              />
            </div>
            <div className="min-w-[100px] space-y-1">
              <label className="text-[11px] text-muted-foreground">Limit (₹)</label>
              <Input
                type="number"
                value={newForm.limit_amount}
                onChange={(e) => setNewForm(p => ({ ...p, limit_amount: e.target.value }))}
                placeholder="No limit"
                className="h-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Switch
                checked={newForm.receipt_required}
                onCheckedChange={(v) => setNewForm(p => ({ ...p, receipt_required: v }))}
              />
              <span className="text-[11px] text-muted-foreground">Receipt</span>
            </div>
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-[40%]">Name</TableHead>
              <TableHead className="text-xs w-[15%]">Receipt</TableHead>
              <TableHead className="text-xs w-[15%]">Limit</TableHead>
              <TableHead className="text-xs w-[15%]">Active</TableHead>
              <TableHead className="text-xs w-[15%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                {editingId === cat.id ? (
                  <>
                    <TableCell>
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={editForm.receipt_required}
                        onCheckedChange={(v) => setEditForm(p => ({ ...p, receipt_required: v }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={editForm.limit_amount}
                        onChange={(e) => setEditForm(p => ({ ...p, limit_amount: e.target.value }))}
                        placeholder="—"
                        className="h-8 text-xs w-20"
                      />
                    </TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdate(cat.id)} disabled={saving}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="text-xs font-medium">{cat.name}</TableCell>
                    <TableCell className="text-xs">{cat.receipt_required ? 'Yes' : 'No'}</TableCell>
                    <TableCell className="text-xs">{cat.limit_amount ? `₹${cat.limit_amount}` : '—'}</TableCell>
                    <TableCell>
                      <Switch
                        checked={cat.is_active}
                        onCheckedChange={() => handleToggleActive(cat.id, cat.is_active)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(cat)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(cat.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default ExpenseCategoriesConfig;
