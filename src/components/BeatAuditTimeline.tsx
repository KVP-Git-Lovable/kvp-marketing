import { useEffect, useState } from "react";
import { ArrowRightLeft, Trash2, Plus, Unlink, UserPlus, Power, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

interface AuditEntry {
  id: string;
  beat_id: string;
  action: string;
  old_user_id: string | null;
  new_user_id: string | null;
  metadata: any;
  performed_by: string;
  created_at: string;
  performer_name?: string;
  old_user_name?: string;
  new_user_name?: string;
}

interface BeatAuditTimelineProps {
  beatId: string;
}

const actionConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  create: { icon: Plus, label: "Created", color: "text-green-600" },
  transfer: { icon: ArrowRightLeft, label: "Transferred", color: "text-blue-600" },
  delete: { icon: Trash2, label: "Deleted", color: "text-destructive" },
  deactivate: { icon: Power, label: "Deactivated", color: "text-orange-600" },
  reassign: { icon: UserPlus, label: "Reassigned", color: "text-purple-600" },
  unassign: { icon: Unlink, label: "Unassigned retailers", color: "text-amber-600" },
};

export const BeatAuditTimeline = ({ beatId }: BeatAuditTimelineProps) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchAuditLog = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("beat_audit_log" as any)
          .select("*")
          .eq("beat_id", beatId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const logs = (data || []) as any[];

        // Fetch profile names for all user IDs
        const userIds = new Set<string>();
        logs.forEach((l) => {
          if (l.performed_by) userIds.add(l.performed_by);
          if (l.old_user_id) userIds.add(l.old_user_id);
          if (l.new_user_id) userIds.add(l.new_user_id);
        });

        let profileMap = new Map<string, string>();
        if (userIds.size > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", Array.from(userIds));

          profiles?.forEach((p) => profileMap.set(p.id, p.full_name || "Unknown"));
        }

        setEntries(
          logs.map((l) => ({
            ...l,
            performer_name: profileMap.get(l.performed_by) || "Unknown",
            old_user_name: l.old_user_id ? profileMap.get(l.old_user_id) : null,
            new_user_name: l.new_user_id ? profileMap.get(l.new_user_id) : null,
          }))
        );
      } catch (error) {
        console.error("Error fetching audit log:", error);
      } finally {
        setLoading(false);
      }
    };

    if (beatId) fetchAuditLog();
  }, [beatId]);

  const getDescription = (entry: AuditEntry): string => {
    switch (entry.action) {
      case "transfer":
        return `Transferred from ${entry.old_user_name || "Unknown"} to ${entry.new_user_name || "Unknown"}`;
      case "reassign":
        return `Retailers reassigned to ${entry.new_user_name || "Unknown"}`;
      case "unassign":
        return `${entry.metadata?.retailer_count || ""} retailers marked as unassigned`;
      case "deactivate":
        return "Beat deactivated (hidden from daily planning)";
      case "delete":
        return `Beat deleted (${entry.metadata?.delete_option || "unknown"} option)`;
      case "create":
        return "Beat created";
      default:
        return entry.action;
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-sm text-muted-foreground animate-pulse">
        Loading activity history...
      </div>
    );
  }

  if (entries.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium">Activity History ({entries.length})</span>
          </div>
          <ChevronDown
            size={16}
            className={`text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-0 pl-4 border-l-2 border-muted ml-5 mt-2 mb-4">
          {entries.map((entry) => {
            const config = actionConfig[entry.action] || {
              icon: Clock,
              label: entry.action,
              color: "text-muted-foreground",
            };
            const Icon = config.icon;

            return (
              <div key={entry.id} className="relative pb-4 last:pb-0">
                <div className="absolute -left-[calc(0.5rem+1px)] top-1 w-3 h-3 rounded-full bg-background border-2 border-muted flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                </div>
                <div className="pl-4">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Icon size={12} className={config.color} />
                    <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{getDescription(entry)}</p>
                  <p className="text-[10px] text-muted-foreground/70">by {entry.performer_name}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
