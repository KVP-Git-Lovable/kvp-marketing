import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-image';
import { Eye, Phone } from 'lucide-react';
import { TeamMemberAttendance } from '@/hooks/useTeamAttendance';
import { cn } from '@/lib/utils';

interface TeamMemberAttendanceCardProps {
  member: TeamMemberAttendance;
  onViewAttendance: (userId: string) => void;
}

const statusConfig = {
  present: { label: 'Present', className: 'bg-[hsl(150,40%,92%)] text-[hsl(150,50%,30%)]' },
  absent: { label: 'Absent', className: 'bg-[hsl(0,50%,93%)] text-[hsl(0,55%,40%)]' },
  on_leave: { label: 'On Leave', className: 'bg-[hsl(35,60%,92%)] text-[hsl(35,55%,35%)]' },
  late: { label: 'Late', className: 'bg-[hsl(25,65%,92%)] text-[hsl(25,60%,35%)]' },
  regularized: { label: 'Regularized', className: 'bg-[hsl(270,40%,93%)] text-[hsl(270,40%,35%)]' },
};

export const TeamMemberAttendanceCard = ({ member, onViewAttendance }: TeamMemberAttendanceCardProps) => {
  const status = statusConfig[member.todayStatus];
  const initials = member.profile.full_name?.substring(0, 2).toUpperCase() || '??';
  const phoneNumber = member.profile.phone_number;

  return (
    <div className="bg-background rounded-2xl shadow-sm p-3.5 flex items-center gap-3">
      <Avatar className="h-10 w-10 shrink-0">
        <SignedAvatarImage src={member.profile.profile_picture_url || undefined} />
        <AvatarFallback className="text-xs bg-[hsl(210,20%,93%)]">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate">{member.profile.full_name}</p>
          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap', status.className)}>
            {status.label}
          </span>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {member.monthlyPresent} / {member.monthlyTotal}
            </span>
            {phoneNumber && (
              <a
                href={`tel:${phoneNumber}`}
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                onClick={(e) => e.stopPropagation()}
                title={`Call ${phoneNumber}`}
              >
                <Phone className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <button
            className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(160,45%,40%)] hover:text-[hsl(160,45%,30%)] transition-colors"
            onClick={() => onViewAttendance(member.profile.id)}
          >
            <Eye className="h-3.5 w-3.5" />
            View Attendance
          </button>
        </div>
      </div>
    </div>
  );
};
