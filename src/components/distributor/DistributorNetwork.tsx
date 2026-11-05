import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ChevronRight, ChevronDown, Map as MapIcon, Route, Store, Search,
  Phone, AlertTriangle, Loader2, User, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TILE_TONES } from "@/components/distributor/tileTones";
import { fullNameProps } from "@/lib/displayName";

/**
 * Market coverage for a distributor: who serves which territory, which beat
 * and which shop.
 *
 * Two readings of the same data, because the question has two shapes. "By
 * area" answers what is in this territory and who covers it; "By salesman"
 * answers what this person is responsible for. One RPC returns both -- the
 * nested tree and the same rows flat -- so switching is instant.
 */

interface Rep { id: string | null; name: string; count: number }
interface Retailer {
  id: string; name: string | null; status: string | null; phone: string | null;
  rep_id: string | null; rep_name: string | null;
}
interface Beat {
  id: string | null; code: string | null; name: string | null;
  retailer_count: number; rep_count: number; reps: Rep[] | null; retailers: Retailer[];
}
interface Territory {
  id: string | null; name: string | null; region: string | null; zone: string | null;
  beat_count: number; retailer_count: number; rep_count: number; beats: Beat[];
}
interface FlatRow {
  retailer_id: string; retailer_name: string | null; status: string | null; phone: string | null;
  beat_id: string | null; beat_code: string | null; beat_name: string | null;
  territory_id: string | null; territory_name: string | null;
  rep_id: string | null; rep_name: string | null;
}
interface Network {
  retailer_total: number; beat_total: number; territory_total: number; rep_total: number;
  retailers_without_beat: number; retailers_without_territory: number; retailers_without_rep: number;
  territories: Territory[]; flat: FlatRow[];
}

interface Props {
  distributorId: string;
  /** Opened from the Salesmen tile: land on this person's coverage. */
  focusRep?: { id: string; name: string } | null;
}

const UNSET = "~none";
const beatLabel = (name: string | null, code: string | null) =>
  name || (code ? `${code} — not in the beat master` : "No beat assigned");

export function DistributorNetwork({ distributorId, focusRep }: Props) {
  const [net, setNet] = useState<Network | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"area" | "rep">("area");
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  /** Salesmen tile -> the by-salesman breakdown, scrolled into view.
   *  Any search is cleared first, or the list opens filtered to something else
   *  and the count on the tile stops matching what is underneath it. */
  const showSalesmen = () => {
    setMode("rep");
    setSearch("");
    requestAnimationFrame(() =>
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("distributor_network", {
        p_distributor_id: distributorId,
      });
      if (cancelled) return;
      if (error) { toast.error("Could not load the network: " + error.message); setNet(null); }
      else setNet(data as unknown as Network);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [distributorId]);

  // Arriving from the Salesmen tile: show that person's coverage straight away.
  useEffect(() => {
    if (!focusRep) return;
    setMode("rep");
    setSearch(focusRep.name);
  }, [focusRep]);

  const q = search.trim().toLowerCase();
  const hit = (...vals: (string | null | undefined)[]) =>
    !q || vals.some((v) => (v || "").toLowerCase().includes(q));

  /** By area: territory > beat > shop, filtered to branches that still match. */
  const areaView = useMemo(() => {
    if (!net) return [];
    if (!q) return net.territories;
    return net.territories
      .map((t) => {
        if (hit(t.name)) return t;
        const beats = t.beats
          .map((b) => {
            if (hit(b.name, b.code)) return b;
            const retailers = b.retailers.filter((r) => hit(r.name, r.rep_name));
            return retailers.length ? { ...b, retailers } : null;
          })
          .filter(Boolean) as Beat[];
        return beats.length ? { ...t, beats } : null;
      })
      .filter(Boolean) as Territory[];
  }, [net, q]);

  /** By salesman: person > territory > beat > shop, built from the flat rows. */
  const repView = useMemo(() => {
    if (!net) return [];
    const rows = net.flat.filter((r) =>
      hit(r.rep_name, r.retailer_name, r.beat_name, r.territory_name));
    const reps = new Map<string, {
      id: string; name: string; retailers: number;
      territories: Map<string, { name: string; beats: Map<string, { name: string; rows: FlatRow[] }> }>;
    }>();
    for (const row of rows) {
      const rid = row.rep_id ?? UNSET;
      const rep = reps.get(rid) ?? {
        id: rid, name: row.rep_name || "Nobody assigned", retailers: 0, territories: new Map(),
      };
      rep.retailers += 1;
      const tid = row.territory_id ?? UNSET;
      const terr = rep.territories.get(tid) ?? { name: row.territory_name || "No territory", beats: new Map() };
      const bid = row.beat_id ?? row.beat_code ?? UNSET;
      const beat = terr.beats.get(bid) ?? { name: beatLabel(row.beat_name, row.beat_code), rows: [] };
      beat.rows.push(row);
      terr.beats.set(bid, beat);
      rep.territories.set(tid, terr);
      reps.set(rid, rep);
    }
    return [...reps.values()].sort((a, b) => b.retailers - a.retailers || a.name.localeCompare(b.name));
  }, [net, q]);

  // A search should land on the answer, not on rows you still have to open.
  useEffect(() => {
    if (!q) return;
    const keys: string[] = [];
    if (mode === "area") {
      areaView.forEach((t) => {
        keys.push(`t:${t.id ?? UNSET}`);
        t.beats.forEach((b) => keys.push(`b:${t.id ?? UNSET}:${b.id ?? b.code ?? UNSET}`));
      });
    } else {
      repView.forEach((r) => {
        keys.push(`r:${r.id}`);
        r.territories.forEach((t, tid) => {
          keys.push(`rt:${r.id}:${tid}`);
          t.beats.forEach((_b, bid) => keys.push(`rb:${r.id}:${tid}:${bid}`));
        });
      });
    }
    setOpen(new Set(keys));
  }, [q, mode, areaView, repView]);

  const toggle = (k: string) =>
    setOpen((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  if (loading) {
    return (
      <Card><CardContent className="p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </CardContent></Card>
    );
  }
  if (!net) {
    return (
      <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">
        The network could not be loaded.
      </CardContent></Card>
    );
  }

  const gaps = net.retailers_without_beat + net.retailers_without_territory + net.retailers_without_rep;

  const RetailerRow = ({ r, showRep = true }: { r: Retailer | FlatRow; showRep?: boolean }) => {
    const name = "retailer_name" in r ? r.retailer_name : r.name;
    return (
      <li className="flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-muted/50">
        <Store className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="truncate" {...fullNameProps(name || "Unnamed shop")} />
        {r.status && r.status !== "active" && (
          <Badge variant="outline" className="text-[10px] shrink-0">{r.status}</Badge>
        )}
        {showRep && (
          <span className={cn(
            "flex items-center gap-1 text-[11px] shrink-0 ml-2",
            r.rep_name ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400",
          )}>
            <User className="h-3 w-3" />{r.rep_name || "no salesman"}
          </span>
        )}
        {r.phone && (
          <a href={`tel:${r.phone}`} className="ml-auto flex items-center gap-1 text-xs text-primary shrink-0">
            <Phone className="h-3 w-3" />{r.phone}
          </a>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Territories", value: net.territory_total, icon: MapIcon, sub: "Areas they cover" },
          { label: "Beats", value: net.beat_total, icon: Route, sub: "Routes inside them" },
          { label: "Retailers", value: net.retailer_total, icon: Store, sub: "Shops on those routes" },
          // The only tile that goes somewhere: the list below already reads
          // "Salesman -> Territory -> Beat -> Shop", so the tile just turns it on.
          {
            label: "Salesmen", value: net.rep_total, icon: Users,
            sub: net.rep_total > 0 ? "See who they are" : "Covering those shops",
            onClick: net.rep_total > 0 ? showSalesmen : undefined,
          },
        ].map((k) => {
          const body = (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</span>
                <k.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums leading-none">{k.value}</div>
              <div className={cn("mt-1.5 text-xs", k.onClick ? "text-primary" : "text-muted-foreground")}>
                {k.sub}
                {k.onClick && <ChevronRight className="inline h-3 w-3 ml-0.5 align-[-1px]" />}
              </div>
            </>
          );
          return k.onClick ? (
            <button
              key={k.label}
              type="button"
              onClick={k.onClick}
              className="rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {body}
            </button>
          ) : (
            <div key={k.label} className="rounded-xl border bg-card p-4">{body}</div>
          );
        })}
      </div>

      {gaps > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-amber-900 dark:text-amber-200">
            Coverage gaps:{" "}
            {[
              net.retailers_without_rep > 0 && `${net.retailers_without_rep} shop(s) have no salesman`,
              net.retailers_without_beat > 0 && `${net.retailers_without_beat} are on no beat`,
              net.retailers_without_territory > 0 && `${net.retailers_without_territory} sit under a beat with no territory`,
            ].filter(Boolean).join(", ")}. They are all listed below, grouped as unassigned.
          </p>
        </div>
      )}

      {focusRep && q === focusRep.name.toLowerCase() && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <User className="h-4 w-4 text-primary shrink-0" />
          <span>Showing <b>{focusRep.name}</b>&rsquo;s coverage only.</span>
          <Button variant="ghost" size="sm" className="h-7 ml-auto" onClick={() => setSearch("")}>
            Show everyone
          </Button>
        </div>
      )}

      <Card ref={listRef} className="scroll-mt-4">
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Market coverage</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {mode === "area"
                  ? "Territory → Beat → Shop, with the salesman on each shop."
                  : "Salesman → Territory → Beat → Shop."}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ToggleGroup
                type="single"
                value={mode}
                onValueChange={(v) => v && setMode(v as "area" | "rep")}
                size="sm"
              >
                <ToggleGroupItem value="area" className="text-xs px-3 gap-1">
                  <MapIcon className="h-3.5 w-3.5" /> By area
                </ToggleGroupItem>
                <ToggleGroupItem value="rep" className="text-xs px-3 gap-1">
                  <Users className="h-3.5 w-3.5" /> By salesman
                </ToggleGroupItem>
              </ToggleGroup>
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8 h-8"
                  placeholder="Search person, area, beat or shop"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" className="h-8" onClick={() => setOpen(new Set())}>
                Collapse
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {mode === "area" ? (
            areaView.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {q ? "Nothing matches that." : "No retailers are linked to this distributor yet."}
              </p>
            ) : (
              <div className="divide-y">
                {areaView.map((t) => {
                  const tKey = `t:${t.id ?? UNSET}`;
                  const tOpen = open.has(tKey);
                  return (
                    <div key={tKey} className="py-1">
                      <button type="button" onClick={() => toggle(tKey)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left border transition-colors",
                          t.id ? TILE_TONES.violet.surface : "bg-muted/40 border-dashed",
                          "hover:brightness-[0.98]",
                        )}>
                        {tOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                               : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className={cn(
                          "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                          t.id ? TILE_TONES.violet.chip : "bg-muted text-muted-foreground",
                        )}>
                          <MapIcon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0">
                          <span
                            className={cn(
                              "block font-semibold text-sm truncate",
                              t.id ? TILE_TONES.violet.figure : "text-muted-foreground italic",
                            )}
                            {...fullNameProps(t.name || "No territory assigned")}
                          />
                          {t.region && (
                            <span className="block text-[11px] text-muted-foreground truncate">{t.region}</span>
                          )}
                        </span>
                        <span className="ml-auto flex items-center gap-1.5 shrink-0">
                          {[
                            { n: t.beat_count, l: "beats", tone: TILE_TONES.sky },
                            { n: t.retailer_count, l: "shops", tone: TILE_TONES.amber },
                            { n: t.rep_count, l: "salesmen", tone: TILE_TONES.emerald },
                          ].map((x) => (
                            <span key={x.l}
                              className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums whitespace-nowrap", x.tone.chip)}>
                              {x.n} <span className="hidden sm:inline font-normal">{x.l}</span>
                            </span>
                          ))}
                        </span>
                      </button>

                      {tOpen && (
                        <div className="ml-6 mt-1 border-l pl-2">
                          {t.beats.map((b) => {
                            const bKey = `b:${t.id ?? UNSET}:${b.id ?? b.code ?? UNSET}`;
                            const bOpen = open.has(bKey);
                            return (
                              <div key={bKey}>
                                <button type="button" onClick={() => toggle(bKey)}
                                  className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-sky-50/60 dark:hover:bg-sky-950/20 text-left border-b last:border-0">
                                  {bOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                         : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                                  <span className={cn(
                                    "h-6 w-6 rounded-md flex items-center justify-center shrink-0",
                                    b.id ? TILE_TONES.sky.chip : "bg-muted text-muted-foreground",
                                  )}>
                                    <Route className="h-3 w-3" />
                                  </span>
                                  <span className={cn("text-sm truncate", !b.id && "text-muted-foreground italic")}
                                    {...fullNameProps(beatLabel(b.name, b.code))} />
                                  {/* Who runs this beat, so coverage reads off the row itself. */}
                                  <span className="flex items-center gap-1 flex-wrap ml-2 min-w-0">
                                    {(b.reps ?? []).slice(0, 3).map((rep) => (
                                      <Badge key={`${bKey}:${rep.id ?? UNSET}`} variant="secondary"
                                        className="text-[10px] font-normal gap-1">
                                        <User className="h-2.5 w-2.5" />{rep.name} · {rep.count}
                                      </Badge>
                                    ))}
                                    {(b.reps?.length ?? 0) > 3 && (
                                      <Badge variant="outline" className="text-[10px]">
                                        +{(b.reps!.length - 3)} more
                                      </Badge>
                                    )}
                                  </span>
                                  <span className={cn(
                                    "ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums shrink-0 whitespace-nowrap",
                                    TILE_TONES.amber.chip,
                                  )}>
                                    {b.retailer_count} <span className="hidden sm:inline font-normal">shops</span>
                                  </span>
                                </button>
                                {bOpen && (
                                  <ul className="ml-5 border-l pl-3 py-0.5">
                                    {b.retailers.map((r) => <RetailerRow key={r.id} r={r} />)}
                                  </ul>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : repView.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {q ? "Nothing matches that." : "No retailers are linked to this distributor yet."}
            </p>
          ) : (
            <div className="divide-y">
              {repView.map((rep) => {
                const rKey = `r:${rep.id}`;
                const rOpen = open.has(rKey);
                const unassigned = rep.id === UNSET;
                return (
                  <div key={rKey} className="py-1">
                    <button type="button" onClick={() => toggle(rKey)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted/60 text-left">
                      {rOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                             : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0",
                        unassigned ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary",
                      )}>
                        {unassigned ? "!" : rep.name.charAt(0).toUpperCase()}
                      </span>
                      <span className={cn("font-medium text-sm truncate", unassigned && "text-amber-700 dark:text-amber-400 italic")}>
                        {rep.name}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums shrink-0">
                        {rep.territories.size} territor{rep.territories.size === 1 ? "y" : "ies"} ·{" "}
                        {[...rep.territories.values()].reduce((n, t) => n + t.beats.size, 0)} beats ·{" "}
                        {rep.retailers} shops
                      </span>
                    </button>

                    {rOpen && (
                      <div className="ml-6 border-l pl-2">
                        {[...rep.territories.entries()].map(([tid, terr]) => {
                          const tKey = `rt:${rep.id}:${tid}`;
                          const tOpen = open.has(tKey);
                          return (
                            <div key={tKey}>
                              <button type="button" onClick={() => toggle(tKey)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 text-left">
                                {tOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                       : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                                <MapIcon className={cn("h-3.5 w-3.5 shrink-0", tid === UNSET ? "text-muted-foreground" : "text-primary")} />
                                <span className={cn("text-sm truncate", tid === UNSET && "text-muted-foreground italic")}>
                                  {terr.name}
                                </span>
                                <span className="ml-auto text-xs text-muted-foreground tabular-nums shrink-0">
                                  {terr.beats.size} beats
                                </span>
                              </button>
                              {tOpen && (
                                <div className="ml-5 border-l pl-2">
                                  {[...terr.beats.entries()].map(([bid, beat]) => {
                                    const bKey = `rb:${rep.id}:${tid}:${bid}`;
                                    const bOpen = open.has(bKey);
                                    return (
                                      <div key={bKey}>
                                        <button type="button" onClick={() => toggle(bKey)}
                                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 text-left">
                                          {bOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                 : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                                          <Route className={cn("h-3.5 w-3.5 shrink-0", bid === UNSET ? "text-muted-foreground" : "text-sky-600 dark:text-sky-400")} />
                                          <span className={cn("text-sm truncate", bid === UNSET && "text-muted-foreground italic")}>
                                            {beat.name}
                                          </span>
                                          <span className="ml-auto text-xs text-muted-foreground tabular-nums shrink-0">
                                            {beat.rows.length}
                                          </span>
                                        </button>
                                        {bOpen && (
                                          <ul className="ml-5 border-l pl-3 py-0.5">
                                            {beat.rows.map((r) => (
                                              <RetailerRow key={r.retailer_id} r={r} showRep={false} />
                                            ))}
                                          </ul>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
