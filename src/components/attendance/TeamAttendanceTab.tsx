import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { ChevronRight, FileText } from 'lucide-react';
import { useTeamAttendance } from '@/hooks/useTeamAttendance';
import { TeamSummaryCards, TeamFilter } from './TeamSummaryCards';
import { TeamMemberHierarchyRow, HierarchyMemberNode } from './TeamMemberHierarchyRow';
import { TeamAttendanceReportModal } from './TeamAttendanceReportModal';
import { TeamMemberDetailSheet } from './TeamMemberDetailSheet';
import { SearchInput } from '@/components/SearchInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TeamMemberAttendance } from '@/hooks/useTeamAttendance';
import { toast } from 'sonner';

interface TeamAttendanceTabProps {
  subordinateIds: string[];
  directReportIds: string[];
}

// Build hierarchy tree from flat member list + employee relationships
function buildHierarchyTree(
  members: TeamMemberAttendance[],
  managerMap: Map<string, string | null>, // userId -> managerId
  currentUserId: string | undefined,
  searchQuery: string
): HierarchyMemberNode[] {
  const memberMap = new Map(members.map(m => [m.profile.id, m]));

  // If searching, return flat filtered list
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    return members
      .filter(m =>
        m.profile.full_name.toLowerCase().includes(q) ||
        (m.profile.designation && m.profile.designation.toLowerCase().includes(q))
      )
      .map(m => ({ member: m, children: [] }));
  }

  // Build tree
  const nodeMap = new Map<string, HierarchyMemberNode>();
  members.forEach(m => {
    nodeMap.set(m.profile.id, { member: m, children: [] });
  });

  const roots: HierarchyMemberNode[] = [];

  members.forEach(m => {
    const node = nodeMap.get(m.profile.id)!;
    const managerId = managerMap.get(m.profile.id);

    // If manager is the current user or manager not in the list, it's a root
    if (!managerId || managerId === currentUserId || !nodeMap.has(managerId)) {
      roots.push(node);
    } else {
      const parentNode = nodeMap.get(managerId);
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        roots.push(node);
      }
    }
  });

  return roots;
}

export const TeamAttendanceTab = ({ subordinateIds, directReportIds }: TeamAttendanceTabProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState<TeamFilter>('all');
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Compute date range from filter
  const { dateRangeStart, dateRangeEnd } = useMemo(() => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    switch (dateFilter) {
      case 'this-week': {
        const s = startOfWeek(now, { weekStartsOn: 1 });
        const e = endOfWeek(now, { weekStartsOn: 1 });
        return { dateRangeStart: format(s, 'yyyy-MM-dd'), dateRangeEnd: format(e, 'yyyy-MM-dd') };
      }
      case 'last-week': {
        const lastW = subWeeks(now, 1);
        const s = startOfWeek(lastW, { weekStartsOn: 1 });
        const e = endOfWeek(lastW, { weekStartsOn: 1 });
        return { dateRangeStart: format(s, 'yyyy-MM-dd'), dateRangeEnd: format(e, 'yyyy-MM-dd') };
      }
      case 'custom':
        return {
          dateRangeStart: customStartDate ? format(customStartDate, 'yyyy-MM-dd') : todayStr,
          dateRangeEnd: customEndDate ? format(customEndDate, 'yyyy-MM-dd') : todayStr,
        };
      default: // today
        return { dateRangeStart: todayStr, dateRangeEnd: todayStr };
    }
  }, [dateFilter, customStartDate, customEndDate]);

  const periodLabel = dateFilter === 'today' ? undefined
    : dateFilter === 'this-week' ? 'This Week'
    : dateFilter === 'last-week' ? 'Last Week'
    : 'Range';

  const {
    teamMembers,
    pendingApprovals,
    presentCount,
    onLeaveCount,
    absentCount,
    handleLeaveAction,
    handleRegularizationAction,
  } = useTeamAttendance(subordinateIds, directReportIds, 'current-month', dateRangeStart, dateRangeEnd);

  // Fetch manager relationships using useQuery for stable caching
  const { data: managerMap = new Map<string, string | null>(), isLoading: managerMapLoading } = useQuery({
    queryKey: ['team-manager-map', subordinateIds],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('user_id, manager_id')
        .in('user_id', subordinateIds);
      const map = new Map<string, string | null>();
      data?.forEach(e => map.set(e.user_id, e.manager_id));
      return map;
    },
    enabled: subordinateIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const filteredMembers = useMemo(() => {
    if (filter === 'all') return teamMembers;
    return teamMembers.filter((m) => m.todayStatus === filter);
  }, [teamMembers, filter]);

  const hierarchyTree = useMemo(() =>
    buildHierarchyTree(filteredMembers, managerMap, user?.id, searchQuery),
    [filteredMembers, managerMap, user?.id, searchQuery]
  );

  const detailMember = teamMembers.find(m => m.profile.id === detailUserId);

  return (
    <div className="space-y-4">
      {/* Date filter removed */}

      <TeamSummaryCards
        presentCount={presentCount}
        onLeaveCount={onLeaveCount}
        absentCount={absentCount}
        activeFilter={filter}
        onFilterChange={(f) => { setFilter(f); }}
        periodLabel={periodLabel}
      />

      {/* Approvals Button */}
      {pendingApprovals.length > 0 && (
        <button
          className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-[hsl(20,70%,94%)] hover:bg-[hsl(20,70%,90%)] transition-colors"
          onClick={() => navigate('/team-approvals')}
        >
          <span className="text-sm font-semibold text-[hsl(160,40%,35%)]">Approvals</span>
          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-[hsl(15,55%,82%)] text-[hsl(15,60%,35%)] text-xs font-semibold">
            {pendingApprovals.length}
          </span>
          <ChevronRight className="h-4 w-4 text-[hsl(160,40%,35%)]" />
        </button>
      )}

      {/* Team Members */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground whitespace-nowrap">
            Team Members ({filteredMembers.length})
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setReportModalOpen(true)}
            >
              <FileText className="h-3.5 w-3.5" />
              Report
            </Button>
            <div className="flex-1 max-w-[200px]">
              <SearchInput
                placeholder="Search members..."
                value={searchQuery}
                onChange={(v) => { setSearchQuery(v); }}
              />
            </div>
          </div>
        </div>

        {managerMapLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading team...</p>
        ) : hierarchyTree.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No team members {filter !== 'all' ? `with status "${filter.replace('_', ' ')}"` : 'found'}
          </p>
        ) : (
          <div className="space-y-1">
            {hierarchyTree.map((node) => (
              <TeamMemberHierarchyRow
                key={node.member.profile.id}
                node={node}
                onViewAttendance={setDetailUserId}
              />
            ))}
          </div>
        )}
      </div>

      <TeamMemberDetailSheet
        isOpen={!!detailUserId}
        onClose={() => setDetailUserId(null)}
        userId={detailUserId || ''}
        userName={detailMember?.profile.full_name || ''}
      />

      <TeamAttendanceReportModal
        open={reportModalOpen}
        onOpenChange={setReportModalOpen}
        subordinateIds={subordinateIds}
      />
    </div>
  );
};
