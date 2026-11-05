import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from '@/lib/supabaseLoose';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Award, Medal, Trophy, Crown, Info, RefreshCw, Lock, Unlock,
  Download, ChevronDown, ChevronRight, CircleDashed,
} from "lucide-react";
import { toast } from "sonner";
import { downloadCSV } from "@/utils/fileDownloader";

const ICONS: Record<string, any> = { Award, Medal, Trophy, Crown };

const PERIODS = [
  { value: "lifetime",       label: "Lifetime — points never stop counting" },
  { value: "monthly",        label: "Monthly" },
  { value: "quarterly",      label: "Quarterly (Jan / Apr / Jul / Oct)" },
  { value: "half_yearly",    label: "Half-yearly" },
  { value: "annual",         label: "Calendar year" },
  { value: "financial_year", label: "Financial year (Apr – Mar)" },
];

type EntityType = "retailer" | "distributor";

interface TierConfig {
  entity_type: EntityType;
  points_basis: "loyalty_points" | "order_value";
  evaluation_period: string;
  value_per_point: number;
  protect_from_reset: boolean;
  allow_demotion: boolean;
  is_locked: boolean;
}

interface Tier {
  id: string; entity_type: EntityType; tier_name: string;
  min_points: number; max_points: number | null;
  colour: string; icon: string | null; benefits: string | null;
  sort_order: number; is_active: boolean;
}

/** Quote every field — retailer names contain commas often enough to matter. */
const csv = (headers: string[], rows: (string | number | null)[][]) =>
  [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

export function LoyaltyTierManagement() {
  const [entity, setEntity] = useState<EntityType>("retailer");
  const [openTier, setOpenTier] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: configs = [] } = useQuery({
    queryKey: ["loyalty-tier-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("loyalty_tier_config").select("*");
      if (error) throw error;
      return data as TierConfig[];
    },
  });

  const { data: tiers = [] } = useQuery({
    queryKey: ["loyalty-tiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_tiers").select("*").order("sort_order");
      if (error) throw error;
      return data as Tier[];
    },
  });

  // Who holds what, by name — so a badge can be opened and exported, not just counted.
  const { data: members = [] } = useQuery({
    queryKey: ["loyalty-tier-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_loyalty_status")
        .select("entity_type, entity_id, entity_name, assigned_user, period_points, lifetime_points, effective_tier, best_tier_ever")
        .order("period_points", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["loyalty-tier-config"] });
    qc.invalidateQueries({ queryKey: ["loyalty-tiers"] });
    qc.invalidateQueries({ queryKey: ["loyalty-tier-members"] });
  };

  const saveConfig = useMutation({
    mutationFn: async (patch: Partial<TierConfig> & { entity_type: EntityType }) => {
      const { entity_type, ...rest } = patch;
      const { error } = await supabase
        .from("loyalty_tier_config").update(rest).eq("entity_type", entity_type);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Badge settings saved"); },
    onError: (e: any) => toast.error(e.message ?? "Could not save"),
  });

  const saveTier = useMutation({
    mutationFn: async (t: Partial<Tier> & { id: string }) => {
      const { id, ...rest } = t;
      const { error } = await supabase.from("retailer_loyalty_tiers").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Badge level updated"); },
    // The database refuses a threshold change while locked; show its own words.
    onError: (e: any) => toast.error(e.message ?? "Could not update the badge level"),
  });

  const setLock = useMutation({
    mutationFn: async (locked: boolean) => {
      const { error } = await supabase.rpc("loyalty_set_tier_lock",
        { p_entity: entity, p_locked: locked });
      if (error) throw error;
      return locked;
    },
    onSuccess: (locked) => {
      invalidate();
      toast.success(locked ? "Badge levels locked" : "Badge levels unlocked — changes now allowed");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not change the lock"),
  });

  const rebank = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("loyalty_record_tier_awards");
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Every badge currently earned has been banked"); },
    onError: (e: any) => toast.error(e.message ?? "Could not bank badges"),
  });

  const cfg = configs.find((c) => c.entity_type === entity);
  const locked = cfg?.is_locked ?? true;
  const rows = tiers.filter((t) => t.entity_type === entity);
  const mine = useMemo(
    () => members.filter((m) => m.entity_type === entity), [members, entity]);

  const holdersOf = (name: string) => mine.filter((m) => m.effective_tier === name);
  // "No badge" = has never actually earned one, as opposed to sitting in the
  // entry band on zero points.
  const notStarted = useMemo(
    () => mine.filter((m) => Number(m.lifetime_points ?? 0) === 0), [mine]);

  const noun = entity === "retailer" ? "retailer" : "distributor";
  const unit = cfg?.points_basis === "order_value" ? "points (from order value)" : "points";

  const exportRows = (label: string, list: any[]) => {
    if (!list.length) { toast.error("Nothing to download"); return; }
    downloadCSV(
      csv(["Name", "Badge", "Points", "Lifetime points", "Assigned user"],
          list.map((m) => [m.entity_name, m.effective_tier ?? "—",
                           m.period_points ?? 0, m.lifetime_points ?? 0, m.assigned_user ?? ""])),
      `${noun}s-${label.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}`
    );
  };

  const MemberList = ({ label, list }: { label: string; list: any[] }) => (
    <div className="border-t bg-muted/30 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium">
          {list.length} {noun}{list.length === 1 ? "" : "s"}
        </span>
        <Button size="sm" variant="outline" className="h-7"
                onClick={() => exportRows(label, list)}>
          <Download className="mr-1.5 h-3 w-3" /> Download CSV
        </Button>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-md border bg-background">
        {list.map((m) => (
          <div key={m.entity_id}
               className="flex items-center justify-between gap-3 border-b px-3 py-2 text-[12.5px] last:border-0">
            <div className="min-w-0">
              <div className="truncate font-medium">{m.entity_name}</div>
              {m.assigned_user && (
                <div className="truncate text-[11px] text-muted-foreground">{m.assigned_user}</div>
              )}
            </div>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {Number(m.period_points ?? 0).toLocaleString("en-IN")} pts
            </span>
          </div>
        ))}
        {list.length === 0 && (
          <p className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">
            No {noun}s here.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <Tabs value={entity} onValueChange={(v) => { setEntity(v as EntityType); setOpenTier(null); }}>
      <TabsList>
        <TabsTrigger value="retailer">Retailer badges</TabsTrigger>
        <TabsTrigger value="distributor">Distributor badges</TabsTrigger>
      </TabsList>

      <TabsContent value={entity} className="mt-4 space-y-4">
        {/* ---------------- how badges are earned ---------------- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">How badges are earned</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Counting period</Label>
              <Select value={cfg?.evaluation_period ?? "lifetime"}
                      onValueChange={(v) => saveConfig.mutate({ entity_type: entity, evaluation_period: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                The window the target must be reached inside.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Counts towards a badge</Label>
              <Select value={cfg?.points_basis ?? "loyalty_points"}
                      onValueChange={(v) => saveConfig.mutate({ entity_type: entity, points_basis: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="loyalty_points">Loyalty points earned</SelectItem>
                  <SelectItem value="order_value">Business value ordered</SelectItem>
                </SelectContent>
              </Select>
              {cfg?.points_basis === "order_value" && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[12px] text-muted-foreground">₹</span>
                  <Input type="number" className="h-8 w-24" defaultValue={cfg?.value_per_point}
                         onBlur={(e) => saveConfig.mutate({
                           entity_type: entity, value_per_point: Number(e.target.value || 100) })} />
                  <span className="text-[12px] text-muted-foreground">= 1 point</span>
                </div>
              )}
            </div>

            <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <Label className="cursor-default">Keep badge after a reset</Label>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  A badge already earned is never taken back when points expire or reset.
                </p>
              </div>
              <Switch checked={cfg?.protect_from_reset ?? true}
                      aria-label="Keep badge after a points reset"
                      onCheckedChange={(v) => saveConfig.mutate({ entity_type: entity, protect_from_reset: v })} />
            </div>

            <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <Label className="cursor-default">Allow dropping a tier</Label>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  Off means a badge only ever goes up. On lets a weak period pull it down.
                </p>
              </div>
              <Switch checked={cfg?.allow_demotion ?? false}
                      aria-label="Allow dropping a tier"
                      onCheckedChange={(v) => saveConfig.mutate({ entity_type: entity, allow_demotion: v })} />
            </div>
          </CardContent>
        </Card>

        {/* ---------------- the bands ---------------- */}
        <Card>
          <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              Badge levels
              <Badge variant={locked ? "secondary" : "destructive"} className="gap-1">
                {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                {locked ? "Locked" : "Unlocked"}
              </Badge>
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant={locked ? "default" : "outline"} size="sm"
                      onClick={() => setLock.mutate(!locked)} disabled={setLock.isPending}>
                {locked ? <Unlock className="mr-2 h-3.5 w-3.5" /> : <Lock className="mr-2 h-3.5 w-3.5" />}
                {locked ? "Unlock to edit" : "Lock again"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => rebank.mutate()} disabled={rebank.isPending}>
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${rebank.isPending ? "animate-spin" : ""}`} />
                Bank earned badges
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportRows("all", mine)}>
                <Download className="mr-2 h-3.5 w-3.5" /> Download all
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {rows.map((t) => {
              const Icon = ICONS[t.icon ?? ""] ?? Award;
              const holders = holdersOf(t.tier_name);
              const isOpen = openTier === t.tier_name;
              return (
                <div key={t.id} className="overflow-hidden rounded-lg border">
                  <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                    <button
                      onClick={() => setOpenTier(isOpen ? null : t.tier_name)}
                      className="flex shrink-0 items-center gap-2 text-left"
                      aria-expanded={isOpen}
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold"
                            style={{ color: t.colour, backgroundColor: `${t.colour}1A`,
                                     border: `1px solid ${t.colour}55` }}>
                        <Icon className="h-4 w-4" style={{ color: t.colour }} />
                        {t.tier_name}
                      </span>
                    </button>

                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <span className="text-[12px] text-muted-foreground">from</span>
                      <Input type="number" className="h-8 w-28" disabled={locked}
                             defaultValue={t.min_points}
                             onBlur={(e) => {
                               const v = Number(e.target.value || 0);
                               if (v !== t.min_points) saveTier.mutate({ id: t.id, min_points: v });
                             }} />
                      <span className="text-[12px] text-muted-foreground">to</span>
                      <Input type="number" className="h-8 w-28" disabled={locked}
                             defaultValue={t.max_points ?? ""} placeholder="no ceiling"
                             onBlur={(e) => {
                               const v = e.target.value === "" ? null : Number(e.target.value);
                               if (v !== t.max_points) saveTier.mutate({ id: t.id, max_points: v });
                             }} />
                      <span className="text-[12px] text-muted-foreground">{unit}</span>
                    </div>

                    <button onClick={() => setOpenTier(isOpen ? null : t.tier_name)}
                            className="shrink-0 text-right">
                      <div className="text-lg font-bold tabular-nums">{holders.length}</div>
                      <div className="text-[11px] text-muted-foreground">{noun}s</div>
                    </button>
                  </div>
                  {isOpen && <MemberList label={t.tier_name} list={holders} />}
                </div>
              );
            })}

            {/* Not started — the "who has no badge" question */}
            <div className="overflow-hidden rounded-lg border border-dashed">
              <button
                onClick={() => setOpenTier(openTier === "__none" ? null : "__none")}
                className="flex w-full items-center gap-3 p-3 text-left"
                aria-expanded={openTier === "__none"}
              >
                {openTier === "__none" ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                       : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold text-muted-foreground">
                  <CircleDashed className="h-4 w-4" /> No badge earned yet
                </span>
                <span className="flex-1 text-[11.5px] text-muted-foreground">
                  Has never earned any {unit.split(" ")[0]}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-lg font-bold tabular-nums">{notStarted.length}</span>
                  <span className="block text-[11px] text-muted-foreground">{noun}s</span>
                </span>
              </button>
              {openTier === "__none" && <MemberList label="no badge" list={notStarted} />}
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                Counts are live: change a threshold and they move immediately. But with
                <strong> keep badge after a reset</strong> on, nobody who has already earned
                a badge loses it when you raise a bar — the new range only decides who can
                newly reach it. Ranges are locked by default; unlock, change, then lock
                again. Renaming or recolouring a badge stays available while locked.
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
