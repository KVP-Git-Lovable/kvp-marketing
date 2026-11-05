import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Save, FileText, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface LeaveType {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  yearly_limit: number | null;
  allow_half_day: boolean | null;
  proof_required: boolean | null;
  is_active: boolean | null;
  color: string | null;
  sort_order: number | null;
  created_at: string;
}

const PRESET_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

const LeaveTypesManager = () => {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [archivePromptId, setArchivePromptId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    yearly_limit: 12,
    allow_half_day: true,
    proof_required: false,
    is_active: true,
    color: '#3b82f6',
    sort_order: 0,
  });

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const fetchLeaveTypes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setLeaveTypes((data || []) as any);
    } catch (error) {
      console.error('Error fetching leave types:', error);
      toast.error('Failed to load leave types');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingType(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      yearly_limit: 12,
      allow_half_day: true,
      proof_required: false,
      is_active: true,
      color: PRESET_COLORS[leaveTypes.length % PRESET_COLORS.length],
      sort_order: leaveTypes.length,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (leaveType: LeaveType) => {
    setEditingType(leaveType);
    setFormData({
      name: leaveType.name,
      code: leaveType.code || '',
      description: leaveType.description || '',
      yearly_limit: leaveType.yearly_limit || 12,
      allow_half_day: leaveType.allow_half_day ?? true,
      proof_required: leaveType.proof_required ?? false,
      is_active: leaveType.is_active ?? true,
      color: leaveType.color || '#3b82f6',
      sort_order: leaveType.sort_order || 0,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Leave type name is required');
      return;
    }

    setIsSaving(true);
    try {
      const leaveTypeData = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase() || null,
        description: formData.description.trim() || null,
        yearly_limit: formData.yearly_limit,
        allow_half_day: formData.allow_half_day,
        proof_required: formData.proof_required,
        is_active: formData.is_active,
        color: formData.color,
        sort_order: formData.sort_order,
      };

      if (editingType) {
        const { error } = await supabase
          .from('leave_types')
          .update(leaveTypeData)
          .eq('id', editingType.id);

        if (error) throw error;
        toast.success('Leave type updated successfully');
      } else {
        const { error } = await supabase
          .from('leave_types')
          .insert(leaveTypeData);

        if (error) {
          if (error.code === '23505') {
            toast.error('Leave type code must be unique');
            return;
          }
          throw error;
        }
        toast.success('Leave type created successfully');
      }

      setIsDialogOpen(false);
      fetchLeaveTypes();
    } catch (error) {
      console.error('Error saving leave type:', error);
      toast.error('Failed to save leave type');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('leave_types')
        .delete()
        .eq('id', id);

      if (error) {
        if (error.code === '23503') {
          // FK constraint - prompt to archive instead
          setDeleteConfirmId(null);
          setArchivePromptId(id);
          return;
        }
        throw error;
      }

      toast.success('Leave type deleted successfully');
      setDeleteConfirmId(null);
      fetchLeaveTypes();
    } catch (error) {
      console.error('Error deleting leave type:', error);
      toast.error('Failed to delete leave type');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const { error } = await supabase
        .from('leave_types')
        .update({ is_active: false } as any)
        .eq('id', id);

      if (error) throw error;

      toast.success('Leave type archived successfully. It will no longer appear for new applications.');
      setArchivePromptId(null);
      fetchLeaveTypes();
    } catch (error) {
      console.error('Error archiving leave type:', error);
      toast.error('Failed to archive leave type');
    }
  };

  const toggleActive = async (leaveType: LeaveType) => {
    try {
      const { error } = await supabase
        .from('leave_types')
        .update({ is_active: !leaveType.is_active } as any)
        .eq('id', leaveType.id);

      if (error) throw error;
      toast.success(`Leave type ${leaveType.is_active ? 'deactivated' : 'activated'}`);
      fetchLeaveTypes();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Failed to update status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Leave Types Master
              </CardTitle>
              <CardDescription>
                Configure different categories of leaves available in the organization
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Leave Type
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {leaveTypes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No leave types configured yet</p>
              <p className="text-sm mt-2">Click "Add Leave Type" to create your first leave category</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-center">Yearly Limit</TableHead>
                  <TableHead className="text-center">Half Day</TableHead>
                  <TableHead className="text-center">Proof Required</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveTypes.map((leaveType) => (
                  <TableRow key={leaveType.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: leaveType.color || '#3b82f6' }}
                        />
                        <Badge variant="outline">{leaveType.code || '-'}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {leaveType.name}
                      {leaveType.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {leaveType.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{leaveType.yearly_limit || 0} days</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {leaveType.allow_half_day ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {leaveType.proof_required ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={leaveType.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                        onClick={() => toggleActive(leaveType)}
                        style={{ cursor: 'pointer' }}
                      >
                        {leaveType.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(leaveType)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {deleteConfirmId === leaveType.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(leaveType.id)}
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteConfirmId(leaveType.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingType ? 'Edit Leave Type' : 'Create Leave Type'}</DialogTitle>
            <DialogDescription>
              Configure leave type details and rules
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Leave Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Casual Leave"
                />
              </div>
              <div>
                <Label>Leave Code</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., CL"
                  maxLength={5}
                />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this leave type..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Yearly Limit (days)</Label>
                <Input
                  type="number"
                  value={formData.yearly_limit}
                  onChange={(e) => setFormData({ ...formData, yearly_limit: parseInt(e.target.value) || 0 })}
                  min={0}
                  max={365}
                />
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </div>
            </div>

            <div>
              <Label>Color</Label>
              <div className="flex items-center gap-2 mt-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === color ? 'border-primary scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow Half Day</Label>
                  <p className="text-xs text-muted-foreground">Employees can apply for half-day leave</p>
                </div>
                <Switch
                  checked={formData.allow_half_day}
                  onCheckedChange={(checked) => setFormData({ ...formData, allow_half_day: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Proof Required</Label>
                  <p className="text-xs text-muted-foreground">Require document upload for this leave</p>
                </div>
                <Switch
                  checked={formData.proof_required}
                  onCheckedChange={(checked) => setFormData({ ...formData, proof_required: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <p className="text-xs text-muted-foreground">Make this leave type available</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Prompt Dialog */}
      <AlertDialog open={!!archivePromptId} onOpenChange={() => setArchivePromptId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cannot Delete Leave Type</AlertDialogTitle>
            <AlertDialogDescription>
              This leave type has associated applications, balances, or policies and cannot be deleted. 
              Would you like to archive it instead? Archived leave types are hidden from new applications 
              but historical data is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => archivePromptId && handleArchive(archivePromptId)}>
              Archive Instead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LeaveTypesManager;
