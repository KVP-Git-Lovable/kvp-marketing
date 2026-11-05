import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-image';
import { Eye, Phone, ChevronDown, ChevronRight } from 'lucide-react';
import { TeamMemberAttendance } from '@/hooks/useTeamAttendance';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface HierarchyMemberNode {
  member: TeamMemberAttendance;
  children: HierarchyMemberNode[];
}

interface TeamMemberHierarchyRowProps {
  node: HierarchyMemberNode;
  level?: number;
  onViewAttendance: (userId: string) => void;
}

const statusConfig = {
  present: { label: 'Present', className: 'bg-[hsl(150,40%,92%)] text-[hsl(150,50%,30%)]' },
  absent: { label: 'Absent', className: 'bg-[hsl(0,50%,93%)] text-[hsl(0,55%,40%)]' },
  on_leave: { label: 'On Leave', className: 'bg-[hsl(35,60%,92%)] text-[hsl(35,55%,35%)]' },
  late: { label: 'Late', className: 'bg-[hsl(25,65%,92%)] text-[hsl(25,60%,35%)]' },
  regularized: { label: 'Regularized', className: 'bg-[hsl(270,40%,93%)] text-[hsl(270,40%,35%)]' },
};

const levelAccents = [
  'border-l-rose-500',
  'border-l-purple-500',
  'border-l-blue-500',
  'border-l-emerald-500',
  'border-l-amber-500',
  'border-l-cyan-500',
];

const getLevelAccent = (level: number) => levelAccents[Math.min(level, levelAccents.length - 1)];

export const TeamMemberHierarchyRow = ({ node, level = 0, onViewAttendance }: TeamMemberHierarchyRowProps) => {
  const [isOpen, setIsOpen] = useState(level < 1);
  const hasChildren = node.children.length > 0;
  const { member } = node;
  const status = statusConfig[member.todayStatus];
  const initials = member.profile.full_name?.substring(0, 2).toUpperCase() || '??';
  const accentClass = getLevelAccent(level);

  return (
    <div className={cn('space-y-1', level > 0 && 'ml-3 md:ml-5')}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div
          className={cn(
            'flex items-center gap-2.5 p-2.5 rounded-lg border-l-[3px] transition-colors',
            accentClass,
            hasChildren ? 'cursor-pointer hover:bg-muted/60' : 'bg-transparent'
          )}
        >
          {/* Expand/collapse toggle */}
          {hasChildren ? (
            <CollapsibleTrigger asChild>
              <button className="shrink-0 p-0.5 rounded hover:bg-muted">
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
          ) : (
            <div className="w-[18px]" />
          )}

          {/* Avatar */}
          <Avatar className="h-8 w-8 shrink-0">
            <SignedAvatarImage src={member.profile.profile_picture_url || undefined} />
            <AvatarFallback className="text-[10px] bg-[hsl(210,20%,93%)]">{initials}</AvatarFallback>
          </Avatar>

          {/* Name + Monthly count */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate leading-tight">{member.profile.full_name}</p>
            <span className="text-[10px] text-muted-foreground">
              {member.monthlyPresent} / {member.monthlyTotal}
            </span>
          </div>

          {/* Phone */}
          {member.profile.phone_number && (
            <a
              href={`tel:${member.profile.phone_number}`}
              className="shrink-0 p-1 text-primary hover:text-primary/80 transition-colors"
              onClick={(e) => e.stopPropagation()}
              title={`Call ${member.profile.phone_number}`}
            >
              <Phone className="h-3.5 w-3.5" />
            </a>
          )}

          {/* Status badge */}
          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0', status.className)}>
            {status.label}
          </span>

          {/* Children count */}
          {hasChildren && (
            <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
              {node.children.length}
            </span>
          )}

          {/* View attendance */}
          <button
            className="shrink-0 p-1 text-[hsl(160,45%,40%)] hover:text-[hsl(160,45%,30%)] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onViewAttendance(member.profile.id);
            }}
            title="View Attendance"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </div>

        {hasChildren && (
          <CollapsibleContent className="pt-1">
            {node.children.map((child) => (
              <TeamMemberHierarchyRow
                key={child.member.profile.id}
                node={child}
                level={level + 1}
                onViewAttendance={onViewAttendance}
              />
            ))}
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
};
