import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Shield } from 'lucide-react';

interface Approver {
  id: string;
  user_id: string;
  approver_level: number;
  department: string;
  is_active: boolean;
  user_name: string;
  created_at: string;
}

interface User {
  id: string;
  username: string;
  full_name: string;
}

const ApproverManagement = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isAddingApprover, setIsAddingApprover] = useState(false);
  
  const [newApprover, setNewApprover] = useState({
    user_id: '',
    approver_level: 1,
    department: ''
  });

  useEffect(() => {
    fetchApprovers();
    fetchUsers();
  }, []);

  const fetchApprovers = async () => {
    const { data, error } = await supabase
      .from('approvers')
      .select(`
        *,
        profiles(username, full_name)
      `)
      .order('approver_level');

    if (!error && data) {
      setApprovers(data.map((item: any) => ({
        ...item,
        user_name: item.profiles?.full_name || 'Unknown User'
      })));
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name')
      .eq('is_active', true)
      .order('full_name');

    if (!error && data) {
      setUsers(data);
    }
  };

  const handleAddApprover = async () => {
    if (!newApprover.user_id) {
      toast({
        title: "Error",
        description: "Please select a user",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('approvers')
        .insert({
          user_id: newApprover.user_id,
          approver_level: newApprover.approver_level,
          department: newApprover.department
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Approver added successfully!"
      });

      setNewApprover({
        user_id: '',
        approver_level: 1,
        department: ''
      });
      setIsAddingApprover(false);
      fetchApprovers();

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add approver",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleApproverStatus = async (approverId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('approvers')
      .update({ is_active: !isActive })
      .eq('id', approverId);

    if (!error) {
      fetchApprovers();
      toast({
        title: "Success",
        description: `Approver ${!isActive ? 'activated' : 'deactivated'} successfully!`
      });
    }
  };

  const removeApprover = async (approverId: string) => {
    const { error } = await supabase
      .from('approvers')
      .delete()
      .eq('id', approverId);

    if (!error) {
      fetchApprovers();
      toast({
        title: "Success",
        description: "Approver removed successfully!"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Approval Workflow Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-medium">Current Approvers</h3>
              <p className="text-sm text-muted-foreground">
                Manage the approval hierarchy for new user accounts
              </p>
            </div>
            <Button onClick={() => setIsAddingApprover(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Approver
            </Button>
          </div>

          {isAddingApprover && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Add New Approver</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>User</Label>
                    <Select 
                      value={newApprover.user_id} 
                      onValueChange={(value) => setNewApprover(prev => ({ ...prev, user_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name} ({user.username})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Approval Level</Label>
                    <Select 
                      value={newApprover.approver_level.toString()} 
                      onValueChange={(value) => setNewApprover(prev => ({ ...prev, approver_level: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Level 1 (First Approver)</SelectItem>
                        <SelectItem value="2">Level 2 (Second Approver)</SelectItem>
                        <SelectItem value="3">Level 3 (Final Approver)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Input
                      value={newApprover.department}
                      onChange={(e) => setNewApprover(prev => ({ ...prev, department: e.target.value }))}
                      placeholder="HR, Finance, IT, etc."
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAddApprover} disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Add Approver
                  </Button>
                  <Button variant="outline" onClick={() => setIsAddingApprover(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added On</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvers.map((approver) => (
                <TableRow key={approver.id}>
                  <TableCell className="font-medium">{approver.user_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      Level {approver.approver_level}
                    </Badge>
                  </TableCell>
                  <TableCell>{approver.department || 'Not specified'}</TableCell>
                  <TableCell>
                    <Badge variant={approver.is_active ? 'default' : 'secondary'}>
                      {approver.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(approver.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleApproverStatus(approver.id, approver.is_active)}
                      >
                        {approver.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeApprover(approver.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {approvers.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No approvers configured yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add approvers to enable the user approval workflow
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApproverManagement;