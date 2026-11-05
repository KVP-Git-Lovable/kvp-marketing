import { useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import {
  History,
  Info,
  Loader2,
  Copy,
  User,
  Store,
  CalendarDays,
  BarChart3,
  Plus,
  Minus,
  ArrowRightLeft,
  Pencil,
  Power,
  CheckCircle2,
  ChevronDown,
  Filter,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as beatService from "@/services/beatService";
import type { BeatHistory } from "@/services/beatService";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BeatHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beat: { id: string; beat_id: string; beat_name: string };
}

interface BeatSummary {
  ownerName: string | null;
  category: string | null;
  isActive: boolean;
  plannedOutlets: number;
  coveredOutlets: number;
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function fmt(dt?: string | null, withTime = false) {
  if (!dt) return "—";
  try {
    return format(new Date(dt), withTime ? "MMM d, yyyy · hh:mm a" : "MMM d, yyyy");
  } catch {
    return dt;
  }
}

type EventKind =
  | "created"
  | "assigned"
  | "retailer_add"
  | "retailer_remove"
  | "coverage"
  | "updated"
  | "activated"
  | "deactivated"
  | "other";

type EventCategory = "ownership" | "retailers" | "coverage" | "general";

interface TimelineEvent {
  id: string;
  kind: EventKind;
  categories: EventCategory[];
  title: string;
  timestamp: string | null;
  actorId: string | null;
  summaryNode?: React.ReactNode;
  details: Array<[string, string]>;
}

const kindStyles: Record<EventKind, { icon: React.ElementType; dot: string }> = {
  created: { icon: Plus, dot: "bg-emerald-500" },
  assigned: { icon: User, dot: "bg-blue-500" },
  retailer_add: { icon: Store, dot: "bg-violet-500" },
  retailer_remove: { icon: Minus, dot: "bg-red-500" },
  coverage: { icon: CalendarDays, dot: "bg-orange-500" },
  updated: { icon: Pencil, dot: "bg-indigo-500" },
  activated: { icon: CheckCircle2, dot: "bg-emerald-600" },
  deactivated: { icon: Power, dot: "bg-red-500" },
  other: { icon: ArrowRightLeft, dot: "bg-slate-400" },
};

const FIELD_LABELS: Record<string, string> = {
  beat_name: "Beat name",
  category: "Category",
  owner_id: "Owner",
  territory_id: "Territory",
  distributor_id: "Distributor",
  travel_allowance: "Travel allowance",
  average_km: "Average km",
  average_time_minutes: "Average time (min)",
  is_active: "Status",
};

const COVERAGE_FIELDS = new Set([
  "category",
  "territory_id",
  "distributor_id",
  "travel_allowance",
  "average_km",
  "average_time_minutes",
  "is_active",
]);

function Chip({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "accent" | "danger" | "success";
}) {
  const tones: Record<string, string> = {
    muted: "bg-muted text-muted-foreground",
    accent: "bg-primary/10 text-primary",
    danger: "bg-destructive/10 text-destructive",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  };
  return (
    <span className={`inline-flex max-w-[180px] items-center truncate rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

function FieldChange({ label, from, to }: { label: string; from: string; to: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Chip>{from}</Chip>
      <span className="text-muted-foreground">→</span>
      <Chip tone="accent">{to}</Chip>
    </div>
  );
}

function TimelineItem({ event, actorName, isLast }: { event: TimelineEvent; actorName: string; isLast: boolean }) {
  const [openDetails, setOpenDetails] = useState(false);
  const { icon: Icon, dot } = kindStyles[event.kind];

  return (
    <div className="relative flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${dot}`}>
          <Icon size={14} />
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-border" />}
      </div>

      <div className="mb-3 min-w-0 flex-1 rounded-xl border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-foreground">{event.title}</span>
          <span className="text-xs text-muted-foreground">{fmt(event.timestamp, true)}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">By {actorName}</p>
        {event.summaryNode && <div className="mt-1.5 space-y-1">{event.summaryNode}</div>}

        {event.details.length > 0 && (
          <Collapsible open={openDetails} onOpenChange={setOpenDetails}>
            <CollapsibleTrigger className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              View details
              <ChevronDown size={13} className={openDetails ? "rotate-180 transition-transform" : "transition-transform"} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1 rounded-lg bg-muted p-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Change details
              </p>
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Changed by</span>
                <span className="text-right font-medium">{actorName}</span>
              </div>
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Date &amp; time</span>
                <span className="text-right font-medium">{fmt(event.timestamp, true)}</span>
              </div>
              {event.details.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 text-xs">
                  <span className="capitalize text-muted-foreground">{k}</span>
                  <span className="break-words text-right font-medium text-foreground">{v}</span>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

function SummaryCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="min-w-0 text-sm font-semibold">{children}</div>
    </div>
  );
}

export function BeatHistoryDrawer({ open, onOpenChange, beat }: BeatHistoryDrawerProps) {
  const { can, loading: permLoading } = usePermissions();
  const [history, setHistory] = useState<BeatHistory | null>(null);
  const [summary, setSummary] = useState<BeatSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [territoryNames, setTerritoryNames] = useState<Record<string, string>>({});
  const [denied, setDenied] = useState(false);

  const [range, setRange] = useState<"30" | "90" | "365" | "all">("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");

  useEffect(() => {
    if (!open) return;
    if (permLoading) return;
    if (!can("module_my_beats", "read")) {
      setDenied(true);
      setHistory(null);
      return;
    }
    setDenied(false);
    let cancelled = false;
    (async () => {
      setLoading(true);
      setHistory(null);
      try {
        const h = await beatService.getBeatHistory(beat.id);
        if (cancelled) return;
        setHistory(h);

        const ids = new Set<string>();
        const territories = new Set<string>();
        h.ownership.forEach((r: any) => {
          [r.transferred_by, r.old_owner_id, r.new_owner_id].forEach((i) => i && ids.add(i));
        });
        h.retailerTransfers.forEach((r: any) => r.transferred_by && ids.add(r.transferred_by));
        (h.retailerAssignments ?? []).forEach((r: any) => {
          [r.assigned_by, r.removed_by].forEach((i) => i && ids.add(i));
        });
        h.coverage.forEach((r: any) => {
          [r.coverage_user_id, r.assigned_by, r.primary_user_id].forEach((i) => i && ids.add(i));
        });
        (h.activity ?? []).forEach((r: any) => {
          [r.performed_by, r.old_user_id, r.new_user_id].forEach((i) => i && ids.add(i));
          const meta = r.metadata || {};
          [meta.old, meta.new].forEach((side: any) => {
            if (side && typeof side === "object") {
              if (side.owner_id) ids.add(side.owner_id);
              if (side.territory_id) territories.add(side.territory_id);
            }
          });
        });

        const [profs, terrs] = await Promise.all([
          ids.size
            ? supabase.from("profiles").select("id, full_name, username").in("id", Array.from(ids))
            : Promise.resolve({ data: [] as any[] }),
          territories.size
            ? supabase.from("territories").select("id, name").in("id", Array.from(territories))
            : Promise.resolve({ data: [] as any[] }),
        ]);

        if (cancelled) return;
        const pmap: Record<string, string> = {};
        ((profs as any).data ?? []).forEach((p: any) => {
          pmap[p.id] = p.full_name || p.username || "Unknown";
        });
        setProfileNames(pmap);
        const tmap: Record<string, string> = {};
        ((terrs as any).data ?? []).forEach((t: any) => {
          tmap[t.id] = t.name;
        });
        setTerritoryNames(tmap);
      } catch (err: any) {
        toast.error(err?.message || "Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, beat.id, permLoading]);

  // Beat summary + coverage snapshot (last 30 days)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: b } = await supabase
          .from("beats")
          .select("owner_name, category, is_active, beat_id")
          .eq("beat_id", beat.beat_id)
          .maybeSingle();

        const { data: retailers } = await supabase
          .from("retailers")
          .select("id")
          .eq("beat_id", beat.beat_id);

        const retailerIds = (retailers ?? []).map((r: any) => r.id);
        let covered = 0;
        if (retailerIds.length) {
          const since = format(subDays(new Date(), 30), "yyyy-MM-dd");
          const { data: visits } = await supabase
            .from("visits")
            .select("retailer_id, status, planned_date")
            .in("retailer_id", retailerIds.slice(0, 500))
            .gte("planned_date", since);
          const done = new Set(
            (visits ?? [])
              .filter((v: any) => ["completed", "visited", "checked_out"].includes(String(v.status || "").toLowerCase()))
              .map((v: any) => v.retailer_id),
          );
          covered = done.size;
        }

        if (cancelled) return;
        setSummary({
          ownerName: (b as any)?.owner_name ?? null,
          category: (b as any)?.category ?? null,
          isActive: (b as any)?.is_active ?? true,
          plannedOutlets: retailerIds.length,
          coveredOutlets: covered,
        });
      } catch {
        /* summary is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, beat.beat_id]);

  const nameOf = (id?: string | null) => (id ? profileNames[id] ?? "Unknown user" : "—");
  const todayStr = new Date().toISOString().slice(0, 10);

  const valueLabel = (field: string, raw: any): string => {
    if (raw === null || raw === undefined || raw === "") return "Not set";
    if (field === "owner_id") return profileNames[raw] ?? "Unknown user";
    if (field === "territory_id") return territoryNames[raw] ?? "Unknown territory";
    if (field === "is_active") return raw ? "Active" : "Inactive";
    return String(raw);
  };

  /** Build normalized events from real audit records only. */
  const allEvents = useMemo<TimelineEvent[]>(() => {
    if (!history) return [];
    const events: TimelineEvent[] = [];

    // 1. beat_audit_log
    (history.activity ?? []).forEach((row: any) => {
      const action = String(row.action || "");
      const meta = row.metadata || {};
      const details: Array<[string, string]> = [];
      let categories: EventCategory[] = ["general"];
      let kind: EventKind = "other";
      let title = action.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
      let summaryNode: React.ReactNode = null;

      const upper = action.toUpperCase();

      if (upper.includes("CREATE")) {
        kind = "created";
        title = "Beat created";
        if (meta.beat_name) details.push(["beat name", String(meta.beat_name)]);
        if (row.new_user_id) details.push(["assigned to", nameOf(row.new_user_id)]);
        categories = ["general"];
      } else if (upper.includes("TRANSFER") || row.old_user_id || row.new_user_id) {
        kind = "assigned";
        title = row.old_user_id ? "Ownership transferred" : "Beat assigned";
        categories = ["ownership"];
        summaryNode = (
          <FieldChange
            label="Owner changed"
            from={row.old_user_id ? nameOf(row.old_user_id) : "Unassigned"}
            to={nameOf(row.new_user_id)}
          />
        );
        if (meta.reason) details.push(["reason", String(meta.reason)]);
      } else if (upper.includes("UNASSIGN")) {
        kind = "retailer_remove";
        title = "Retailers removed";
        categories = ["retailers"];
        if (meta.retailer_count != null) {
          summaryNode = <p className="text-xs text-muted-foreground">{meta.retailer_count} retailer(s) removed</p>;
        }
      } else if (upper.includes("REASSIGN")) {
        kind = "retailer_add";
        title = "Retailers reassigned";
        categories = ["retailers"];
        if (meta.retailer_count != null) {
          summaryNode = <p className="text-xs text-muted-foreground">{meta.retailer_count} retailer(s) reassigned</p>;
        }
      } else if (upper.includes("DEACTIVAT")) {
        kind = "deactivated";
        title = "Beat deactivated";
        categories = ["coverage"];
      } else if (upper.includes("REACTIVAT") || upper.includes("ACTIVATED")) {
        kind = "activated";
        title = "Beat activated";
        categories = ["coverage"];
      } else if (upper.includes("DELETE")) {
        kind = "retailer_remove";
        title = "Beat deleted";
        if (meta.delete_option) details.push(["delete option", String(meta.delete_option)]);
      } else if (upper.includes("UPDATE") || upper.includes("EDIT")) {
        kind = "updated";
        title = "Beat updated";
        const oldObj = meta.old && typeof meta.old === "object" ? meta.old : null;
        const newObj = meta.new && typeof meta.new === "object" ? meta.new : null;
        if (oldObj && newObj) {
          const changed = Object.keys({ ...oldObj, ...newObj }).filter(
            (k) => JSON.stringify(oldObj[k] ?? null) !== JSON.stringify(newObj[k] ?? null),
          );
          if (changed.length) {
            const cats = new Set<EventCategory>();
            changed.forEach((f) => {
              if (f === "owner_id" || f === "user_id" || f === "supervisor_id" || f === "team_id")
                cats.add("ownership");
              else if (COVERAGE_FIELDS.has(f)) cats.add("coverage");
              else cats.add("general");
            });
            categories = Array.from(cats);

            // Prominent, field-derived event title instead of a generic "Beat updated".
            if (changed.length === 1) {
              const f = changed[0];
              if (f === "owner_id" || f === "user_id") {
                kind = "assigned";
                title = oldObj[f] ? "Ownership transferred" : "Beat assigned";
              } else if (f === "supervisor_id") {
                kind = "assigned";
                title = "Supervisor changed";
              } else if (f === "team_id") {
                kind = "assigned";
                title = "Team assignment changed";
              } else if (f === "is_active") {
                kind = newObj[f] ? "activated" : "deactivated";
                title = newObj[f] ? "Beat activated" : "Beat deactivated";
              } else if (f === "beat_name") {
                title = "Beat renamed";
              } else {
                if (COVERAGE_FIELDS.has(f)) kind = "coverage";
                title = `${FIELD_LABELS[f] ?? f.replace(/_/g, " ")} changed`;
              }
            } else {
              const coverageOnly = changed.every((f) => COVERAGE_FIELDS.has(f));
              if (coverageOnly) {
                kind = "coverage";
                title = "Coverage settings updated";
              } else {
                title = `Beat updated — ${changed
                  .map((f) => (FIELD_LABELS[f] ?? f.replace(/_/g, " ")).toLowerCase())
                  .join(", ")}`;
              }
            }

            summaryNode = (
              <>
                {changed.map((f) => (
                  <FieldChange
                    key={f}
                    label={`${FIELD_LABELS[f] ?? f.replace(/_/g, " ")} changed`}
                    from={valueLabel(f, oldObj[f])}
                    to={valueLabel(f, newObj[f])}
                  />
                ))}
              </>
            );
            changed.forEach((f) => {
              details.push([
                `${FIELD_LABELS[f] ?? f.replace(/_/g, " ")}`,
                `${valueLabel(f, oldObj[f])} → ${valueLabel(f, newObj[f])}`,
              ]);
            });
          } else {
            summaryNode = <p className="text-xs text-muted-foreground">No field values changed in this update.</p>;
          }
        }
      }

      // Any remaining scalar metadata as details (no fabrication, only real fields)
      Object.entries(meta).forEach(([k, v]) => {
        if (v === null || v === undefined || typeof v === "object") return;
        if (["beat_name", "reason", "retailer_count", "delete_option"].includes(k)) return;
        details.push([k.replace(/_/g, " "), String(v)]);
      });

      events.push({
        id: `audit-${row.id}`,
        kind,
        categories,
        title,
        timestamp: row.created_at,
        actorId: row.performed_by ?? null,
        summaryNode,
        details,
      });
    });

    // 2. beat_ownership_history
    (history.ownership ?? []).forEach((row: any) => {
      events.push({
        id: `own-${row.id}`,
        kind: "assigned",
        categories: ["ownership"],
        title: row.old_owner_id ? "Ownership transferred" : "Beat assigned",
        timestamp: row.transferred_at,
        actorId: row.transferred_by ?? null,
        summaryNode: (
          <FieldChange
            label="Owner"
            from={row.old_owner_name || (row.old_owner_id ? nameOf(row.old_owner_id) : "Unassigned")}
            to={row.new_owner_name || nameOf(row.new_owner_id)}
          />
        ),
        details: row.reason ? [["reason", String(row.reason)]] : [],
      });
    });

    // 3. retailer_beat_transfer_history (moved in/out)
    (history.retailerTransfers ?? []).forEach((row: any) => {
      const incoming = row.to_beat_id === beat.beat_id;
      events.push({
        id: `rtr-${row.id}`,
        kind: incoming ? "retailer_add" : "retailer_remove",
        categories: ["retailers"],
        title: incoming ? "Retailer moved into this beat" : "Retailer moved out of this beat",
        timestamp: row.transferred_at,
        actorId: row.transferred_by ?? null,
        summaryNode: (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Chip tone={incoming ? "success" : "danger"}>{row.retailer_name || "Retailer"}</Chip>
            <Chip>{row.from_beat_name || row.from_beat_id || "—"}</Chip>
            <span className="text-muted-foreground">→</span>
            <Chip tone="accent">{row.to_beat_name || row.to_beat_id || "—"}</Chip>
          </div>
        ),
        details: row.transfer_reason ? [["reason", String(row.transfer_reason)]] : [],
      });
    });

    // 4. retailer_beat_assignments — grouped add/remove batches
    const addGroups = new Map<string, any[]>();
    const removeGroups = new Map<string, any[]>();
    (history.retailerAssignments ?? []).forEach((row: any) => {
      if (row.assigned_from) {
        const key = `${row.assigned_from}|${row.assigned_by ?? ""}`;
        addGroups.set(key, [...(addGroups.get(key) ?? []), row]);
      }
      if (row.assigned_to) {
        const key = `${row.assigned_to}|${row.removed_by ?? ""}`;
        removeGroups.set(key, [...(removeGroups.get(key) ?? []), row]);
      }
    });
    const pushGroup = (
      groups: Map<string, any[]>,
      kind: EventKind,
      verb: string,
      prefix: string,
    ) => {
      groups.forEach((rows, key) => {
        const [ts, actor] = key.split("|");
        const names = rows.map((r) => r.retailer_name).filter(Boolean) as string[];
        events.push({
          id: `${prefix}-${key}`,
          kind,
          categories: ["retailers"],
          title: rows.length > 1 ? `${rows.length} retailers ${verb}` : `Retailer ${verb}`,
          timestamp: ts,
          actorId: actor || null,
          summaryNode: names.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {names.slice(0, 6).map((n, i) => (
                <Chip key={`${n}-${i}`} tone={kind === "retailer_add" ? "success" : "danger"}>
                  {n}
                </Chip>
              ))}
              {names.length > 6 && <Chip>+{names.length - 6} more</Chip>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{rows.length} retailer(s) {verb}</p>
          ),
          details: [
            ["affected outlets", names.length ? names.join(" · ") : `${rows.length} retailer(s)`],
            ...(rows[0]?.transfer_reason ? ([["reason", String(rows[0].transfer_reason)]] as Array<[string, string]>) : []),
          ],
        });
      });
    };
    pushGroup(addGroups, "retailer_add", "added", "radd");
    pushGroup(removeGroups, "retailer_remove", "removed", "rrem");

    // 5. beat_coverage_assignments
    (history.coverage ?? []).forEach((row: any) => {
      const active = row.is_active && (row.end_date ?? "") >= todayStr;
      events.push({
        id: `cov-${row.id}`,
        kind: "coverage",
        categories: ["coverage"],
        title: `Coverage assigned — ${nameOf(row.coverage_user_id)}`,
        timestamp: row.created_at,
        actorId: row.assigned_by ?? null,
        summaryNode: (
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip>
              <Clock size={11} className="mr-1" />
              {fmt(row.start_date)} → {fmt(row.end_date)}
            </Chip>
            <Chip tone={active ? "success" : "muted"}>{active ? "Active" : "Ended"}</Chip>
          </div>
        ),
        details: [
          ["covering user", nameOf(row.coverage_user_id)],
          ["period", `${fmt(row.start_date)} → ${fmt(row.end_date)}`],
          ...(row.reason ? ([["reason", String(row.reason)]] as Array<[string, string]>) : []),
        ],
      });
    });

    return events.sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime());
  }, [history, profileNames, territoryNames, beat.beat_id]);

  const cutoff = useMemo(() => (range === "all" ? null : subDays(new Date(), Number(range))), [range]);

  const filtered = useMemo(() => {
    let rows = allEvents;
    if (cutoff) rows = rows.filter((e) => !e.timestamp || new Date(e.timestamp) >= cutoff);
    if (userFilter !== "all") rows = rows.filter((e) => e.actorId === userFilter);
    if (eventFilter !== "all") rows = rows.filter((e) => e.kind === eventFilter);
    return rows;
  }, [allEvents, cutoff, userFilter, eventFilter]);

  const byCategory = (cat: EventCategory) => filtered.filter((e) => e.categories.includes(cat));

  const userOptions = useMemo(() => {
    const ids = new Set<string>();
    allEvents.forEach((e) => e.actorId && ids.add(e.actorId));
    return Array.from(ids);
  }, [allEvents]);

  const missed = summary ? Math.max(0, summary.plannedOutlets - summary.coveredOutlets) : 0;
  const adherence =
    summary && summary.plannedOutlets > 0
      ? Math.round((summary.coveredOutlets / summary.plannedOutlets) * 100)
      : 0;

  const renderTimeline = (events: TimelineEvent[], emptyLabel: string, cat?: EventCategory) => {
    if (events.length === 0) {
      const totalForCat = cat ? allEvents.filter((e) => e.categories.includes(cat)).length : allEvents.length;
      const hiddenByFilters = totalForCat > 0;
      return (
        <EmptyState
          label={
            hiddenByFilters
              ? `${emptyLabel} for the selected filters — try widening the date range or clearing the user/event filter.`
              : emptyLabel
          }
        />
      );
    }
    return (
      <div>
        {events.map((e, i) => (
          <TimelineItem key={e.id} event={e} actorName={nameOf(e.actorId)} isLast={i === events.length - 1} />
        ))}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="z-[60] flex h-full w-full flex-col gap-0 bg-background p-0 sm:max-w-[780px]"
      >
        {/* Fixed header */}
        <SheetHeader className="shrink-0 space-y-1 border-b bg-background px-4 py-4 text-left sm:px-6">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <History size={18} className="text-primary" />
            <span className="truncate">Beat History — {beat.beat_name}</span>
          </SheetTitle>
          <SheetDescription>Full audit trail for this beat.</SheetDescription>
        </SheetHeader>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-4 sm:px-6">
          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border bg-card p-4 sm:grid-cols-3 lg:grid-cols-5">
            <SummaryCell label="Beat ID">
              <div className="flex min-w-0 items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="block truncate">{beat.beat_id}</span>
                    </TooltipTrigger>
                    <TooltipContent>{beat.beat_id}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(beat.beat_id);
                    toast.success("Beat ID copied");
                  }}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Copy beat ID"
                >
                  <Copy size={12} />
                </button>
              </div>
            </SummaryCell>

            <SummaryCell label="Current Owner">
              <span className="block truncate">{summary?.ownerName || "Unassigned"}</span>
            </SummaryCell>

            <SummaryCell label="Outlet Count">{summary?.plannedOutlets ?? "—"}</SummaryCell>

            <SummaryCell label="Frequency">
              <span className="text-muted-foreground">{summary?.category || "—"}</span>
            </SummaryCell>

            <SummaryCell label="Status">
              <Badge variant={summary?.isActive === false ? "secondary" : "default"}>
                {summary?.isActive === false ? "Inactive" : "Active"}
              </Badge>
            </SummaryCell>
          </div>

          {/* Coverage snapshot */}
          <div className="mt-3 rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 size={15} className="text-primary" />
              <h3 className="text-sm font-semibold">Coverage Snapshot</h3>
              <span className="ml-auto text-xs text-muted-foreground">Last 30 days</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Planned Outlets", value: summary?.plannedOutlets ?? 0, cls: "text-foreground" },
                { label: "Covered Outlets", value: summary?.coveredOutlets ?? 0, cls: "text-emerald-600" },
                { label: "Missed Outlets", value: missed, cls: "text-destructive" },
                { label: "Adherence", value: `${adherence}%`, cls: "text-foreground" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-muted p-3">
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                  <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Select value={range} onValueChange={(v) => setRange(v as any)}>
              <SelectTrigger className="w-full bg-card">
                <CalendarDays size={14} className="mr-2 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last 12 months</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>

            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-full bg-card">
                <User size={14} className="mr-2 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {userOptions.map((id) => (
                  <SelectItem key={id} value={id}>
                    {nameOf(id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-full bg-card">
                <Filter size={14} className="mr-2 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="assigned">Ownership</SelectItem>
                <SelectItem value="retailer_add">Retailers added</SelectItem>
                <SelectItem value="retailer_remove">Retailers removed</SelectItem>
                <SelectItem value="coverage">Coverage</SelectItem>
                <SelectItem value="updated">Updated</SelectItem>
                <SelectItem value="activated">Activated</SelectItem>
                <SelectItem value="deactivated">Deactivated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {denied ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              You don't have permission to view beat history.
            </div>
          ) : loading || permLoading || !history ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="activity" className="mt-4">
              <TabsList className="grid w-full grid-cols-4 bg-card">
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="ownership">Ownership</TabsTrigger>
                <TabsTrigger value="retailers">Retailers</TabsTrigger>
                <TabsTrigger value="coverage">Coverage</TabsTrigger>
              </TabsList>

              <TabsContent value="activity" className="mt-3">
                {renderTimeline(filtered, "No activity found")}
              </TabsContent>
              <TabsContent value="ownership" className="mt-3">
                {renderTimeline(byCategory("ownership"), "No ownership changes found", "ownership")}
              </TabsContent>
              <TabsContent value="retailers" className="mt-3">
                {renderTimeline(byCategory("retailers"), "No retailer changes found", "retailers")}
              </TabsContent>
              <TabsContent value="coverage" className="mt-3">
                {renderTimeline(byCategory("coverage"), "No coverage changes found", "coverage")}
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Sticky footer notice */}
        <div className="shrink-0 border-t bg-background px-4 py-3 sm:px-6">
          <div className="flex gap-2 rounded-xl border border-primary/20 bg-muted p-3 text-xs text-foreground/80">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Read-only audit history. Shows changes made to this beat, including ownership transfers, retailer
              updates, coverage changes and other recorded activity. Timestamps are shown in your local time.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default BeatHistoryDrawer;
