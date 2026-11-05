import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, X, Clock, User, UserCheck, Calendar, Users, ClipboardList, ArrowLeft, Settings, CalendarDays, FileText, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import LiveAttendanceMonitoring from '@/components/LiveAttendanceMonitoring';
import HolidayManagement from '@/components/HolidayManagement';
import LeaveBalancesManager from '@/components/attendance/LeaveBalancesManager';
import AttendancePolicyConfig from '@/components/attendance/AttendancePolicyConfig';
import WorkingDaysConfig from '@/components/attendance/WorkingDaysConfig';
import LeaveTypesManager from '@/components/attendance/LeaveTypesManager';
import { Layout } from '@/components/Layout';
import RejectionReasonDialog from '@/components/RejectionReasonDialog';
import AttendanceReportGenerator from '@/components/attendance/AttendanceReportGenerator';

interface LeaveApplication {
  id: string;
  user_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  applied_date: string;
  profiles?: {
    full_name: string;
    username: string;
  };
  leave_types?: {
    name: string;
  };
}

interface RegularizationRequest {
  id: string;
  user_id: string;
  attendance_date: string;
  current_check_in_time: string | null;
  current_check_out_time: string | null;
  requested_check_in_time: string | null;
  requested_check_out_time: string | null;
  reason: string;
  status: string;
  created_at: string;
  profiles?: {
    full_name: string;
    username: string;
  };
}

const AttendanceManagement = () => {
  const [topTab, setTopTab] = useState<'overview' | 'configuration'>('overview');
  const [subTab, setSubTab] = useState('live');
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([]);
  const [regularizationRequests, setRegularizationRequests] = useState<RegularizationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [allUsers, setAllUsers] = useState<Array<{id: string, full_name: string}>>([]);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [selectedRequestForRejection, setSelectedRequestForRejection] = useState<string | null>(null);

  const handleTopTabChange = (value: string) => {
    setTopTab(value as 'overview' | 'configuration');
    if (value === 'overview') setSubTab('live');
    else setSubTab('leave-types');
  };

  const overviewSubTabs = [
    { id: 'live', label: 'Live Attendance', icon: User },
    { id: 'leave', label: 'Leave Management', icon: Calendar },
    { id: 'regularization', label: 'Regularization', icon: Users },
    { id: 'leave-balances', label: 'Leave Balances', icon: ClipboardList },
    { id: 'reports', label: 'Reports', icon: BookOpen },
  ];

  const configSubTabs = [
    { id: 'leave-types', label: 'Leave Types', icon: FileText },
    { id: 'holidays', label: 'Holidays', icon: CalendarDays },
    { id: 'working-days', label: 'Working Days', icon: Calendar },
    { id: 'policy', label: 'Policy', icon: Settings },
  ];

  const currentSubTabs = topTab === 'overview' ? overviewSubTabs : configSubTabs;

  useEffect(() => {
    if (subTab === 'leave') {
      fetchLeaveApplications();
      fetchUsers();
    } else if (subTab === 'regularization') {
      fetchRegularizationRequests();
      fetchUsers();
    }
  }, [subTab, selectedUser]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .eq('user_status', 'active')
        .order('full_name');

      if (error) throw error;
      setAllUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchLeaveApplications = async () => {
    try {
      setIsLoading(true);
      
      let query = supabase
        .from('leave_applications')
        .select('*');

      if (selectedUser !== 'all') {
        query = query.eq('user_id', selectedUser);
      }

      const { data, error } = await query.order('applied_date', { ascending: false });

      if (error) throw error;

      // Fetch profiles and leave types separately
      const userIds = [...new Set(data?.map(app => app.user_id) || [])];
      const leaveTypeIds = [...new Set(data?.map(app => app.leave_type_id) || [])];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', userIds);

      const { data: leaveTypes } = await supabase
        .from('leave_types')
        .select('id, name')
        .in('id', leaveTypeIds);

      // Join the data manually
      const enrichedData = data?.map(app => ({
        ...app,
        profiles: profiles?.find(p => p.id === app.user_id),
        leave_types: leaveTypes?.find(lt => lt.id === app.leave_type_id)
      })) || [];

      setLeaveApplications(enrichedData);
    } catch (error) {
      console.error('Error fetching leave applications:', error);
      toast.error('Failed to fetch leave applications');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRegularizationRequests = async () => {
    try {
      setIsLoading(true);
      
      let query = supabase
        .from('regularization_requests')
        .select('*')
        .eq('status', 'pending');

      if (selectedUser !== 'all') {
        query = query.eq('user_id', selectedUser);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
      const userIds = [...new Set(data?.map(req => req.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', userIds);

      // Join the data manually
      const enrichedData = data?.map(req => ({
        ...req,
        profiles: profiles?.find(p => p.id === req.user_id)
      })) || [];

      setRegularizationRequests(enrichedData);
    } catch (error) {
      console.error('Error fetching regularization requests:', error);
      toast.error('Failed to fetch regularization requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveStatusUpdate = async (applicationId: string, newStatus: string) => {
    try {
      const updateData: any = {
        status: newStatus,
        approved_date: newStatus === 'approved' ? new Date().toISOString() : null
      };

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        updateData.approved_by = user.id;
      }

      const { error } = await supabase
        .from('leave_applications')
        .update(updateData)
        .eq('id', applicationId);

      if (error) throw error;

      // Sync approval_requests table so approval engine stays consistent
      await supabase
        .from('approval_requests')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
          ...(newStatus === 'approved' && user ? { final_approved_by: user.id } : {}),
        })
        .eq('entity_id', applicationId)
        .eq('entity_type', 'leave');

      toast.success(`Leave application ${newStatus} successfully`);
      fetchLeaveApplications();
    } catch (error) {
      console.error('Error updating leave application:', error);
      toast.error('Failed to update leave application');
    }
  };

  const handleRegularizationStatusUpdate = async (requestId: string, newStatus: string, rejectionReason?: string) => {
    try {
      // First get the request details
      const { data: request, error: fetchError } = await supabase
        .from('regularization_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;

      const { data: { user } } = await supabase.auth.getUser();

      // If approved, update the attendance table
      if (newStatus === 'approved' && request) {
        // Calculate total hours
        let totalHours = null;
        if (request.requested_check_in_time && request.requested_check_out_time) {
          const checkIn = new Date(request.requested_check_in_time);
          const checkOut = new Date(request.requested_check_out_time);
          totalHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
        }

        // Upsert attendance record with approved times
        const { error: attendanceError } = await supabase
          .from('attendance')
          .upsert({
            user_id: request.user_id,
            date: request.attendance_date,
            check_in_time: request.requested_check_in_time,
            check_out_time: request.requested_check_out_time,
            status: 'regularized',
            total_hours: totalHours,
            notes: `Regularized via request #${requestId.slice(0, 8)}`,
            regularized_request_id: requestId
          }, { 
            onConflict: 'user_id,date'
          });

        if (attendanceError) {
          console.error('Error updating attendance:', attendanceError);
          throw attendanceError;
        }
      }

      // Update the regularization request status
      const updateData: any = {
        status: newStatus,
        approved_at: newStatus === 'approved' ? new Date().toISOString() : null,
        rejection_reason: rejectionReason || null
      };

      if (user) {
        updateData.approved_by = user.id;
      }

      const { error } = await supabase
        .from('regularization_requests')
        .update(updateData)
        .eq('id', requestId);

      if (error) throw error;

      toast.success(`Regularization request ${newStatus} successfully`);
      fetchRegularizationRequests();
    } catch (error) {
      console.error('Error updating regularization request:', error);
      toast.error('Failed to update regularization request');
    }
  };

  const handleRejectClick = (requestId: string) => {
    setSelectedRequestForRejection(requestId);
    setShowRejectionDialog(true);
  };

  const handleConfirmRejection = async (reason: string) => {
    if (selectedRequestForRejection) {
      await handleRegularizationStatusUpdate(selectedRequestForRejection, 'rejected', reason);
      setSelectedRequestForRejection(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      approved: { color: 'bg-green-100 text-green-800', label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected' }
    };

    const statusConfig = config[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    
    return (
      <Badge className={statusConfig.color}>
        {statusConfig.label}
      </Badge>
    );
  };

  return (
    <Layout>
    <div className="space-y-6 p-4 md:p-6">

      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Attendance Management</h1>
        <p className="text-muted-foreground">
          Monitor attendance, manage leaves, configure policies and holidays
        </p>
      </div>

      {/* Top-Level Tabs */}
      <Tabs value={topTab} onValueChange={handleTopTabChange} className="w-full">
        <TabsList className="w-full justify-start h-12">
          <TabsTrigger value="overview" className="text-base px-6">
            <User className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="configuration" className="text-base px-6">
            <Settings className="w-4 h-4 mr-2" />
            Configuration
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Sub-Tabs */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 border-b pb-2 min-w-max">
          {currentSubTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`py-2 px-3 rounded-t-lg transition-colors flex items-center text-sm font-medium whitespace-nowrap ${
                subTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-1.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {subTab === 'live' && <LiveAttendanceMonitoring />}

      {subTab === 'leave' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Leave Applications Management</CardTitle>
                <CardDescription>
                  Review and manage employee leave requests
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {allUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Applied Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveApplications.map((application) => (
                    <TableRow key={application.id}>
                      <TableCell className="font-medium">
                        {application.profiles?.full_name || 'Unknown User'}
                      </TableCell>
                      <TableCell>
                        {application.leave_types?.name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(application.start_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        {format(new Date(application.end_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate">
                          {application.reason}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(application.applied_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(application.status)}
                      </TableCell>
                      <TableCell>
                        {application.status === 'pending' && (
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              onClick={() => handleLeaveStatusUpdate(application.id, 'approved')}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleLeaveStatusUpdate(application.id, 'rejected')}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {!isLoading && leaveApplications.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No leave applications found.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {subTab === 'regularization' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pending Regularization Requests</CardTitle>
                <CardDescription>
                  Review and approve attendance regularization requests
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {allUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Current In/Out</TableHead>
                    <TableHead>Requested In/Out</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Requested On</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regularizationRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {request.profiles?.full_name || 'Unknown User'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(request.attendance_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>In: {request.current_check_in_time ? format(new Date(request.current_check_in_time), 'HH:mm') : '--'}</div>
                          <div>Out: {request.current_check_out_time ? format(new Date(request.current_check_out_time), 'HH:mm') : '--'}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>In: {request.requested_check_in_time ? format(new Date(request.requested_check_in_time), 'HH:mm') : '--'}</div>
                          <div>Out: {request.requested_check_out_time ? format(new Date(request.requested_check_out_time), 'HH:mm') : '--'}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate">
                          {request.reason}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(request.created_at), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={() => handleRegularizationStatusUpdate(request.id, 'approved')}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRegularizationStatusUpdate(request.id, 'rejected')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {!isLoading && regularizationRequests.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No pending regularization requests found.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {subTab === 'leave-balances' && <LeaveBalancesManager />}

      {subTab === 'reports' && <AttendanceReportGenerator />}

      {subTab === 'leave-types' && <LeaveTypesManager />}


      {subTab === 'holidays' && <HolidayManagement />}

      {subTab === 'working-days' && <WorkingDaysConfig />}

      {subTab === 'policy' && <AttendancePolicyConfig />}
    </div>
    </Layout>
  );
};

export default AttendanceManagement;
