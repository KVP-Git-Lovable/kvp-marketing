import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Clock, User, UserCheck, MapPin } from 'lucide-react';
import { format } from 'date-fns';

interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  total_hours: number | null;
  status: string;
  check_in_address: string | null;
  profiles?: {
    full_name: string;
    username: string;
    employee_id?: string;
    role?: string;
  } | null;
}

interface AttendanceDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  type: 'present' | 'absent' | 'half-day';
  records: AttendanceRecord[];
}

export const AttendanceDetailsDialog: React.FC<AttendanceDetailsDialogProps> = ({
  open,
  onOpenChange,
  title,
  type,
  records,
}) => {
  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      present: { className: 'bg-green-100 text-green-800', label: 'Present' },
      absent: { className: 'bg-red-100 text-red-800', label: 'Absent' },
      'half-day': { className: 'bg-yellow-100 text-yellow-800', label: 'Half Day' },
    };
    const statusConfig = config[status] || { className: 'bg-muted text-muted-foreground', label: status };
    return <Badge className={statusConfig.className}>{statusConfig.label}</Badge>;
  };

  const getIcon = () => {
    switch (type) {
      case 'present':
        return <UserCheck className="h-5 w-5 text-green-600" />;
      case 'absent':
        return <User className="h-5 w-5 text-red-600" />;
      case 'half-day':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      default:
        return <User className="h-5 w-5" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {title} ({records.length})
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-auto flex-1">
          {records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found for this status.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Name</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Role / Designation</TableHead>
                  {type === 'present' && <TableHead>Check-in Time</TableHead>}
                  {type === 'present' && <TableHead>Location</TableHead>}
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.profiles?.full_name || 'Unknown User'}
                    </TableCell>
                    <TableCell>
                      {record.profiles?.username || record.profiles?.employee_id || '--'}
                    </TableCell>
                    <TableCell>
                      {record.profiles?.role || 'Field Executive'}
                    </TableCell>
                    {type === 'present' && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {record.check_in_time
                            ? format(new Date(record.check_in_time), 'hh:mm a')
                            : '--'}
                        </div>
                      </TableCell>
                    )}
                    {type === 'present' && (
                      <TableCell>
                        <div className="flex items-center gap-1 max-w-[200px] truncate">
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate" title={record.check_in_address || undefined}>
                            {record.check_in_address || '--'}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
