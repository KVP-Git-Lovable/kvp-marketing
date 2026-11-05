import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from '@/integrations/supabase/db';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Store, Star, UsersRound, Gift, IndianRupee, Percent, Search, ChevronRight,
  X, Award, Medal, Trophy, Crown, Download, CircleDashed,
} from "lucide-react";
import { RetailerLoyaltyDrawer } from "./RetailerLoyaltyDrawer";
import { downloadCSV } from "@/utils/fileDownloader";

const ICONS: Record<string, any> = { Award, Medal, Trophy, Crown };
const PAGE_SIZE = 25;

const rs = (n: number) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(2)}Cr`
  : n >= 100000 ? `₹${(n / 100000).toFixed(2)}L`
  : `₹${Math.round(n).toLocaleString("en-IN")}`;
const num = (n: number) => Number(n ?? 0).toLocaleString("en-IN");
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Rolling windows, plus the financial year the business actually reports on. */
const RANGES = [
  { value: "all",   label: "All time" },
  { value: "week",  label: "Last 7 days" },
  { value: "month", label: "Last 30 days" },
  { value: "qtr",   label: "Last 90 days" },
  { value: "year",  label: "Last 12 months" },
  { value: "fy",    label: "This financial year" },
  { value: "custom",label: "Custom range" },
];

function rangeDates(kind: string, from: string, to: string): [string | null, string | null] {
  const today = new Date();
  const back = (days: number) => {
    const d = new Date(today); d.setDate(d.getDate() - days); return iso(d);
  };
  switch (kind) {
    case "week":  return [back(7), iso(today)];
    case "month": return [back(30), iso(today)];
    case "qtr":   return [back(90), iso(today)];
    case "year":  return [back(365), iso(today)];
    case "fy": {
      const y = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      return [`${y}-04-01`, iso(today)];
    }
    case "custom": return [from || null, to || null];
    default: return [null, null];
  }
}

type Row = {
  retailer_id: string; retailer_name: string | null; beat_name: string | null;
  city: string | null; category: string | null; phone: string | null;
  owner_id: string | null; assigned_user: string | null;
  orders: number; revenue: number; last_order: string | null;
  points_earned: number; points_redeemed: number; points_balance: number;
  points_value_rs: number; loyalty_cost_pct: number | null;
  gifts_given: number; tier_name: string | null; tier_colour: string | null;
  tier_icon: string | null; tier_rank: number | null;
  next_tier: string | null; points_to_next: number | null; has_badge: boolean;
};

type Lens =
  | { kind: "all" } | { kind: "earning" } | { kind: "ordering" } | { kind: "gifted" }
  | { kind: "nobadge" }
  | { kind: "user"; id: string; label: string }
  | { kind: "beat"; label: string }
  | { kind: "tier"; label: string };

type Group = "retailers" | "users" | "beats" | "tiers";

export function LoyaltyOverviewDashboard() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [group, setGroup] = useState<Group>("retailers");
  const [lens, setLens] = useState<Lens>({ kind: "all" });
  const [openRetailer, setOpenRetailer] = useState<string | null>(null);

  const [range, setRange] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [badgeFilter, setBadgeFilter] = useState("all");

  const [from, to] = rangeDates(range, customFrom, customTo);

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["loyalty-overview-v3", from, to],
    queryFn: async () => {
      // Revenue and points are counted inside the window; the badge still
      // reflects live standing, which is what an admin expects to see.
      const { data, error } = await supabase.rpc("loyalty_overview",
        { p_from: from, p_to: to });
      if (error) throw error;
      return ((data ?? []) as Row[])
        .sort((a, b) => Number(b.points_earned) - Number(a.points_earned));
    },
  });

  const users = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => { if (r.owner_id) m.set(r.owner_id, r.assigned_user ?? "Unnamed"); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.category).filter(Boolean))].sort() as string[], [rows]);
  const badges = useMemo(
    () => [...new Set(rows.map((r) => r.tier_name).filter(Boolean))] as string[], [rows]);

  const totals = useMemo(() => {
    const revenue = rows.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
    const cost = rows.reduce((s, r) => s + Number(r.points_value_rs ?? 0), 0);
    return {
      retailers: rows.length, revenue, cost,
      costPct: revenue > 0 ? (100 * cost) / revenue : 0,
      points: rows.reduce((s, r) => s + Number(r.points_earned ?? 0), 0),
      ordering: rows.filter((r) => Number(r.orders) > 0).length,
      earning: rows.filter((r) => Number(r.points_earned) > 0).length,
      gifts: rows.reduce((s, r) => s + Number(r.gifts_given ?? 0), 0),
      users: new Set(rows.map((r) => r.owner_id).filter(Boolean)).size,
      noBadge: rows.filter((r) => !r.has_badge).length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    switch (lens.kind) {
      case "earning":  list = list.filter((r) => Number(r.points_earned) > 0); break;
      case "ordering": list = list.filter((r) => Number(r.orders) > 0); break;
      case "gifted":   list = list.filter((r) => Number(r.gifts_given) > 0); break;
      case "nobadge":  list = list.filter((r) => !r.has_badge); break;
      case "user":     list = list.filter((r) => r.owner_id === lens.id); break;
      case "beat":     list = list.filter((r) => (r.beat_name ?? "No beat") === lens.label); break;
      case "tier":     list = list.filter((r) => (r.tier_name ?? "—") === lens.label); break;
    }
    if (userFilter !== "all") list = list.filter((r) => r.owner_id === userFilter);
    if (categoryFilter !== "all") list = list.filter((r) => r.category === categoryFilter);
    if (badgeFilter !== "all") {
      list = badgeFilter === "__none"
        ? list.filter((r) => !r.has_badge)
        : list.filter((r) => r.tier_name === badgeFilter);
    }
    const t = search.trim().toLowerCase();
    if (t) list = list.filter((r) =>
      [r.retailer_name, r.beat_name, r.city, r.category, r.phone, r.assigned_user, r.tier_name]
        .some((v) => v?.toLowerCase().includes(t)));
    return list;
  }, [rows, lens, userFilter, categoryFilter, badgeFilter, search]);

  const grouped = useMemo(() => {
    const key = (r: Row) =>
      group === "users" ? (r.assigned_user ?? "Unassigned")
      : group === "beats" ? (r.beat_name ?? "No beat")
      : (r.tier_name ?? "No badge");
    const map = new Map<string, any>();
    filtered.forEach((r) => {
      const k = key(r);
      const cur = map.get(k) ?? {
        label: k, id: group === "users" ? r.owner_id ?? undefined : undefined,
        retailers: 0, revenue: 0, points: 0, cost: 0,
        colour: group === "tiers" ? r.tier_colour : undefined,
        icon: group === "tiers" ? r.tier_icon : undefined,
      };
      cur.retailers += 1;
      cur.revenue += Number(r.revenue ?? 0);
      cur.points += Number(r.points_earned ?? 0);
      cur.cost += Number(r.points_value_rs ?? 0);
      map.set(k, cur);
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue || b.points - a.points);
  }, [filtered, group]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const go = (l: Lens, g: Group = "retailers") => { setLens(l); setGroup(g); setPage(1); };

  const exportCsv = () => {
    if (!filtered.length) return;
    const head = ["Retailer", "Badge", "Beat", "City", "Category", "Assigned user",
                  "Orders", "Revenue", "Points earned", "Points balance",
                  "Points value (Rs)", "Loyalty cost %", "Gifts", "Last order"];
    const body = filtered.map((r) => [
      r.retailer_name, r.tier_name ?? "", r.beat_name ?? "", r.city ?? "", r.category ?? "",
      r.assigned_user ?? "", r.orders, Math.round(Number(r.revenue)), r.points_earned,
      r.points_balance, r.points_value_rs, r.loyalty_cost_pct ?? "", r.gifts_given,
      r.last_order ?? "",
    ]);
    downloadCSV(
      [head, ...body].map((row) =>
        row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"),
      `loyalty-overview-${range}-${new Date().toISOString().slice(0, 10)}`
    );
  };

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
    );
  }
  if (isError) {
    return (
      <Card><CardContent className="py-12 text-center">
        <p className="font-heading font-semibold">Unable to load the loyalty overview</p>
        <p className="mt-1 text-sm text-muted-foreground">Refresh the page to try again.</p>
      </CardContent></Card>
    );
  }

  const KPIS = [
    { key: "all", label: "Total retailers", value: num(totals.retailers), sub: `${totals.ordering} ordering`,
      icon: Store, tone: "bg-primary/5 text-primary", on: () => go({ kind: "all" }) },
    { key: "rev", label: "Total revenue", value: rs(totals.revenue), sub: "confirmed orders",
      icon: IndianRupee, tone: "bg-emerald-500/10 text-emerald-600", on: () => go({ kind: "ordering" }, "users") },
    { key: "pts", label: "Points given", value: num(totals.points), sub: `${totals.earning} earning`,
      icon: Star, tone: "bg-warning/15 text-warning-foreground", on: () => go({ kind: "earning" }) },
    { key: "cost", label: "Loyalty cost", value: rs(totals.cost), sub: `${totals.costPct.toFixed(2)}% of revenue`,
      icon: Percent, tone: "bg-rose-500/10 text-rose-600", on: () => go({ kind: "earning" }, "tiers") },
    { key: "users", label: "Linked users", value: num(totals.users), sub: "handling these retailers",
      icon: UsersRound, tone: "bg-accent text-accent-foreground", on: () => go({ kind: "all" }, "users") },
    { key: "nobadge", label: "No badge yet", value: num(totals.noBadge), sub: "never earned one",
      icon: CircleDashed, tone: "bg-muted text-muted-foreground", on: () => go({ kind: "nobadge" }) },
  ];

  const lensLabel =
    lens.kind === "all" ? null
    : lens.kind === "earning" ? "Earning points"
    : lens.kind === "ordering" ? "Has ordered"
    : lens.kind === "gifted" ? "Has taken a gift"
    : lens.kind === "nobadge" ? "No badge yet"
    : lens.label;

  return (
    <div className="space-y-4 font-sans">
      {/* ---- filters ---- */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-card p-3">
        <Select value={range} onValueChange={(v) => { setRange(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {range === "custom" && (
          <>
            <Input type="date" className="h-9 w-[150px]" value={customFrom}
                   onChange={(e) => setCustomFrom(e.target.value)} aria-label="From date" />
            <Input type="date" className="h-9 w-[150px]" value={customTo}
                   onChange={(e) => setCustomTo(e.target.value)} aria-label="To date" />
          </>
        )}

        <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="All users" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            {users.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={badgeFilter} onValueChange={(v) => { setBadgeFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="All badges" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All badges</SelectItem>
            {badges.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            <SelectItem value="__none">No badge yet</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                 placeholder="Search retailer, beat, user or badge" className="h-9 pl-9"
                 aria-label="Search loyalty retailers" />
        </div>

        <Button variant="outline" size="sm" className="h-9" onClick={exportCsv}
                disabled={!filtered.length}>
          <Download className="mr-2 h-3.5 w-3.5" /> Download ({num(filtered.length)})
        </Button>
      </div>

      {/* ---- KPIs: each one is a filter ---- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {KPIS.map((k) => (
          <button key={k.key} onClick={k.on}
            className="group rounded-lg border border-border/80 bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{k.label}</p>
                <p className="mt-1 font-heading text-2xl font-bold tabular-nums">{k.value}</p>
                <p className="text-[11px] text-muted-foreground">{k.sub}</p>
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${k.tone}`}>
                <k.icon className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              View breakdown <ChevronRight className="h-3 w-3" />
            </span>
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border/70 px-4 py-3 sm:px-5">
          {(["retailers", "users", "beats", "tiers"] as Group[]).map((g) => (
            <Button key={g} size="sm" variant={group === g ? "default" : "outline"}
                    onClick={() => { setGroup(g); setPage(1); }} className="h-8">
              {g === "tiers" ? "By badge" : g === "retailers" ? "Retailers"
                : g === "users" ? "By user" : "By beat"}
            </Button>
          ))}
          {lensLabel && (
            <Badge variant="secondary" className="ml-1 gap-1">
              {lensLabel}
              <button onClick={() => setLens({ kind: "all" })} aria-label="Clear filter">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <span className="ml-auto text-[11.5px] text-muted-foreground">
            {num(filtered.length)} of {num(rows.length)}
          </span>
        </div>

        {group !== "retailers" ? (
          <div className="divide-y">
            {grouped.map((g) => {
              const Icon = ICONS[g.icon ?? ""] ?? null;
              return (
                <button key={g.label}
                  onClick={() => go(group === "users" && g.id ? { kind: "user", id: g.id, label: g.label }
                    : group === "beats" ? { kind: "beat", label: g.label }
                    : { kind: "tier", label: g.label })}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      {Icon && g.colour && <Icon className="h-4 w-4 shrink-0" style={{ color: g.colour }} />}
                      <span className="truncate">{g.label}</span>
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      {g.retailers} retailer{g.retailers === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold tabular-nums">{rs(g.revenue)}</div>
                    <div className="text-[11.5px] tabular-nums text-muted-foreground">
                      {num(g.points)} pts · {rs(g.cost)} cost
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
            {grouped.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Nothing to show.</p>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y">
              {visible.map((r) => {
                const Icon = ICONS[r.tier_icon ?? ""] ?? null;
                return (
                  <button key={r.retailer_id} onClick={() => setOpenRetailer(r.retailer_id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{r.retailer_name}</span>
                        {r.tier_name && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                            style={{ color: r.tier_colour ?? undefined,
                                     backgroundColor: `${r.tier_colour}1A`,
                                     border: `1px solid ${r.tier_colour}55` }}>
                            {Icon && <Icon className="h-3 w-3" style={{ color: r.tier_colour ?? undefined }} />}
                            {r.tier_name}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[11.5px] text-muted-foreground">
                        {[r.beat_name, r.assigned_user, r.category].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-semibold tabular-nums">{rs(Number(r.revenue))}</div>
                      <div className="text-[11.5px] tabular-nums text-muted-foreground">
                        {num(r.points_earned)} pts
                        {r.loyalty_cost_pct != null && ` · ${r.loyalty_cost_pct}%`}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
              {visible.length === 0 && (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No retailers match this view.
                </p>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3 sm:px-5">
                <span className="text-[12px] text-muted-foreground">
                  page {safePage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={safePage <= 1}
                          onClick={() => setPage(safePage - 1)}>Previous</Button>
                  <Button size="sm" variant="outline" disabled={safePage >= totalPages}
                          onClick={() => setPage(safePage + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <RetailerLoyaltyDrawer retailerId={openRetailer} open={!!openRetailer}
                             onClose={() => setOpenRetailer(null)} />
    </div>
  );
}
