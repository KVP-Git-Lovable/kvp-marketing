import { useState, useEffect, useMemo, useCallback } from "react";
import { useTableQuery, type TableColumn } from "@/lib/tableKit";
import { TableToolbar } from "@/components/table/TableToolbar";
import { SortableHead } from "@/components/table/SortableHead";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, ArrowRightLeft, Eye, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  deleteDistributor,
  deleteDistributorWithRetailers,
  archiveDistributor,
  unarchiveDistributor,
  DISTRIBUTOR_DELETE_PERMISSION,
  type RetailerAction,
} from "@/utils/deleteDistributor";
import {
  fetchDeleteBlockers,
  retailerBlocker,
  describeBlockers,
} from "@/utils/distributorDeleteBlockers";
import {
  ResolveRetailersDialog,
  type ResolveRetailersTarget,
} from "@/components/distributor/ResolveRetailersDialog";
import {
  CannotDeleteDialog,
  type CannotDeleteTarget,
} from "@/components/distributor/CannotDeleteDialog";
import { RetailerRemapDialog } from "@/components/distributor/RetailerRemapDialog";
import { ArchiveDistributorDialog } from "@/components/distributor/ArchiveDistributorDialog";
import { DistributorTree } from "@/components/distributor/DistributorTree";
import { DistributorTierList } from "@/components/distributor/DistributorTierList";
import {
  DistributorDetailPane,
  type NetworkCounts,
} from "@/components/distributor/DistributorDetailPane";
import { useDistributorTypes, resolveTypeCode } from "@/hooks/useDistributorTypes";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Distributor Master — the network, and whatever is selected in it.
 *
 * This page used to be four stat cards above four tabs carrying the same four
 * numbers, with the hierarchy hidden behind a button and each card showing a
 * name, a phone and nothing anyone could act on. Its own subtitle says it
 * manages the network structure, so the structure is the page now: the tree on
 * the left, the selected distributor on the right, and no number shown twice.
 */

interface Distributor {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: string;
  type_id: string | null;
  distribution_level: string | null;
  parent_id: string | null;
  archived_at: string | null;
  partnership_status: string | null;
  gst_number: string | null;
}

type Scope = "live" | "archived" | "all";

/** The tree groups by who reports to whom; by tier groups by what each one is.
 *  The second is the only one that answers "show me all the Super Stockists",
 *  which is what the four tabs this page used to have were for. */
type View = "network" | "tier" | "table";

export default function DistributorMaster() {
  const navigate = useNavigate();
  const { types, hierarchyTypes, loading: typesLoading } = useDistributorTypes();
  const { can, loading: permsLoading } = usePermissions();
  const canDelete = can(DISTRIBUTOR_DELETE_PERMISSION.object, "delete");

  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [counts, setCounts] = useState<Record<string, NetworkCounts>>({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<Scope>("live");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>("network");

  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Distributor | null>(null);
  const [resolveTarget, setResolveTarget] = useState<ResolveRetailersTarget | null>(null);
  const [blockedTarget, setBlockedTarget] = useState<CannotDeleteTarget | null>(null);
  const [showRemapDialog, setShowRemapDialog] = useState(false);
  /** Archive asks first now: it empties the pickers and can strand shops. */
  const [archiveTarget, setArchiveTarget] = useState<Distributor | null>(null);
  /** Hide looks like a data action but only affects this browser. */
  const [hideTarget, setHideTarget] = useState<Distributor | null>(null);

  // Hiding is this browser's own view of the list, kept from the previous
  // design. Archiving is the real, shared one.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("hiddenDistributorIds") || "[]")); }
    catch { return new Set(); }
  });
  const [showHidden, setShowHidden] = useState(false);

  const loadDistributors = useCallback(async () => {
    try {
      const [rowsRes, countsRes] = await Promise.all([
        supabase.from("distributors").select("*").order("name"),
        supabase.rpc("distributor_network_summary"),
      ]);

      if (rowsRes.error) throw rowsRes.error;
      setDistributors((rowsRes.data || []) as Distributor[]);

      // Counted by the database: retailers_select scopes rows to the viewer's
      // own beats, so counting here would report 0 for a distributor with ten.
      if (countsRes.error) {
        console.error("Could not load the network figures:", countsRes.error);
      } else {
        const map: Record<string, NetworkCounts> = {};
        for (const r of (countsRes.data ?? []) as Array<Record<string, unknown>>) {
          map[String(r.distributor_id)] = {
            retailers: Number(r.retailers ?? 0),
            warehouses: Number(r.warehouses ?? 0),
            orders_placed: Number(r.orders_placed ?? 0),
            children: Number(r.children ?? 0),
          };
        }
        setCounts(map);
      }
    } catch (error: unknown) {
      toast.error(
        "Failed to load distributors: " +
          (error instanceof Error ? error.message : String(error)),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDistributors(); }, [loadDistributors]);

  const persistHidden = (s: Set<string>) => {
    localStorage.setItem("hiddenDistributorIds", JSON.stringify([...s]));
  };

  const toggleHidden = (id: string, name: string) => {
    const next = new Set(hiddenIds);
    const nowHidden = !next.has(id);
    if (nowHidden) next.add(id);
    else next.delete(id);
    setHiddenIds(next);
    persistHidden(next);
    toast.success(nowHidden ? `${name} hidden from this list` : `${name} shown again`);
  };

  const archivedCount = distributors.filter((d) => d.archived_at).length;
  const liveCount = distributors.length - archivedCount;

  /** What the tree draws. A row matched by the search keeps its ancestors, so
   *  it stays in its place in the shape instead of appearing unattached. */
  const treeRows = useMemo(() => {
    let rows = distributors;

    if (scope === "live") rows = rows.filter((d) => !d.archived_at);
    else if (scope === "archived") rows = rows.filter((d) => d.archived_at);

    if (!showHidden) rows = rows.filter((d) => !hiddenIds.has(d.id));

    const q = search.trim().toLowerCase();
    if (q) {
      const byId = new Map(distributors.map((d) => [d.id, d]));
      const keep = new Set<string>();
      for (const d of rows) {
        const hit =
          d.name.toLowerCase().includes(q) ||
          d.contact_person?.toLowerCase().includes(q) ||
          d.phone?.includes(q);
        if (!hit) continue;
        let cur: Distributor | undefined = d;
        const guard = new Set<string>();
        while (cur && !guard.has(cur.id)) {
          keep.add(cur.id);
          guard.add(cur.id);
          cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
        }
      }
      rows = rows.filter((d) => keep.has(d.id));
    }

    return rows;
  }, [distributors, scope, search, showHidden, hiddenIds]);

  // Open on the company rather than on a prompt.
  useEffect(() => {
    if (selectedId || distributors.length === 0 || typesLoading) return;
    const oem = distributors.find((d) => resolveTypeCode(d, types) === "OEM" && !d.archived_at);
    setSelectedId(oem?.id ?? distributors.find((d) => !d.archived_at)?.id ?? distributors[0].id);
  }, [selectedId, distributors, types, typesLoading]);


  /**
   * The network as a flat, sortable table.
   *
   * The tree and the tier list answer "who sits under whom"; neither can be
   * sorted by retailer count or filtered to one status without destroying the
   * shape that makes them worth having. This third view drops the hierarchy on
   * purpose, and is where sort, column filters and the exports live.
   */
  const typeNameById = useMemo(
    () => new Map(types.map((t) => [t.id, t.name])), [types]);
  const nameById = useMemo(
    () => new Map(distributors.map((d) => [d.id, d.name])), [distributors]);

  const distributorColumns: TableColumn<Distributor>[] = useMemo(() => [
    { key: "name", header: "Distributor", type: "text", value: (d) => d.name },
    { key: "type", header: "Type", type: "enum",
      value: (d) => (d.type_id ? typeNameById.get(d.type_id) ?? "—" : d.distribution_level ?? "—") },
    { key: "parent", header: "Reports to", type: "enum",
      value: (d) => (d.parent_id ? nameById.get(d.parent_id) ?? "—" : "—") },
    { key: "contact", header: "Contact", type: "text", value: (d) => d.contact_person ?? "" },
    { key: "phone", header: "Phone", type: "text", value: (d) => d.phone ?? "" },
    { key: "email", header: "Email", type: "text", exportOnly: true, value: (d) => d.email ?? "" },
    { key: "gst", header: "GST number", type: "text", exportOnly: true, value: (d) => d.gst_number ?? "" },
    { key: "address", header: "Address", type: "text", exportOnly: true, value: (d) => d.address ?? "" },
    { key: "retailers", header: "Retailers", type: "number", align: "right",
      value: (d) => counts[d.id]?.retailers ?? 0 },
    { key: "warehouses", header: "Warehouses", type: "number", align: "right",
      value: (d) => counts[d.id]?.warehouses ?? 0 },
    { key: "orders", header: "Orders", type: "number", align: "right",
      value: (d) => counts[d.id]?.orders_placed ?? 0 },
    { key: "children", header: "Sub-distributors", type: "number", align: "right",
      value: (d) => counts[d.id]?.children ?? 0 },
    { key: "status", header: "Status", type: "enum",
      value: (d) => (d.archived_at ? "Archived" : d.status || "—") },
    { key: "partnership", header: "Partnership", type: "enum", exportOnly: true,
      value: (d) => d.partnership_status ?? "—" },
  ], [typeNameById, nameById, counts]);

  /* Layered over treeRows, so the scope buttons and the search box above
     still decide which distributors are in play. */
  const dq = useTableQuery(treeRows, distributorColumns);
  const visibleDistributorColumns = distributorColumns.filter((c) => !c.exportOnly);
  const selected = distributors.find((d) => d.id === selectedId) ?? null;
  const selectedParent = selected?.parent_id
    ? distributors.find((d) => d.id === selected.parent_id) ?? null
    : null;
  const selectedChildren = selected
    ? distributors.filter((d) => d.parent_id === selected.id)
    : [];

  /* ----------------------------------------------------------- actions --- */

  const startDelete = async () => {
    if (!selected) return;
    const target = selected;
    setBusy(true);

    const blockers = await fetchDeleteBlockers(target.id);
    const retailers = retailerBlocker(blockers);
    setBusy(false);

    // Retailers can be dealt with; nothing else here can. So the choice is only
    // worth offering when they are the whole obstacle — otherwise moving them
    // would just surface the next refusal.
    if (retailers && blockers.length === 1) {
      setResolveTarget({ id: target.id, name: target.name, retailerCount: retailers.row_count });
      return;
    }

    if (blockers.length > 0) {
      setBlockedTarget({
        id: target.id,
        name: target.name,
        reason: describeBlockers(blockers, target.name) ?? "It cannot be deleted.",
        alreadyInactive: !!target.archived_at,
      });
      return;
    }

    setDeleteTarget(target);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusy(true);
    const result = await deleteDistributor(target);
    setBusy(false);
    setDeleteTarget(null);

    if (!result.ok) {
      toast.error(result.reason, { duration: 10000 });
      return;
    }

    toast.success(`${target.name} moved to recycle bin`);
    setSelectedId(null);
    loadDistributors();
  };

  const confirmResolve = async (action: RetailerAction, reassignTo?: string) => {
    if (!resolveTarget) return;
    const target = resolveTarget;
    setBusy(true);
    const result = await deleteDistributorWithRetailers(target, action, reassignTo);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.reason, { duration: 10000 });
      return;
    }

    setResolveTarget(null);
    toast.success(
      action === "reassign"
        ? `${target.retailerCount} retailers moved, and ${target.name} deleted`
        : `${target.retailerCount} retailers archived, and ${target.name} deleted`,
    );
    setSelectedId(null);
    loadDistributors();
  };

  const archive = async (
    target: Distributor,
    retailerAction: 'leave' | RetailerAction = 'leave',
    reassignTo?: string,
  ) => {
    setBusy(true);
    const result = await archiveDistributor(target, retailerAction, reassignTo);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.reason, { duration: 10000 });
      return;
    }

    setBlockedTarget(null);
    setArchiveTarget(null);
    toast.success(
      retailerAction === 'reassign'
        ? `${target.name} archived, and its retailers moved`
        : `${target.name} archived — its records are untouched`,
    );
    loadDistributors();
  };

  const restore = async (target: Distributor) => {
    setBusy(true);
    const result = await unarchiveDistributor(target);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.reason, { duration: 10000 });
      return;
    }

    toast.success(`${target.name} is back in the network`);
    loadDistributors();
  };

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const scopeButton = (value: Scope, label: string, count?: number) => (
    <button
      type="button"
      onClick={() => setScope(value)}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
        scope === value
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
      {count !== undefined && <span className="tabular-nums">{count}</span>}
    </button>
  );

  const totalRetailers = Object.values(counts).reduce((n, c) => n + c.retailers, 0);

  return (
    <Layout>
      <div className="p-4 pb-24">

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Distributor Master</h1>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Loading the network…"
                : `${liveCount} live · ${archivedCount} archived · ${totalRetailers.toLocaleString("en-IN")} retailers served`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowRemapDialog(true)}>
              <ArrowRightLeft className="h-4 w-4" />
              Remap retailers
            </Button>
            <Button size="sm" className="gap-2" onClick={() => navigate("/add-distributor")}>
              <Plus className="h-4 w-4" />
              Add distributor
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-stretch gap-4">

          {/* The network */}
          <Card className="flex-[1_1_340px] self-start">
            <CardContent className="p-3">
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search the network…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  aria-label="Search the network"
                />
              </div>

              <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setView("network")}
                  className={cn(
                    "rounded-md py-1.5 text-xs font-medium transition-colors",
                    view === "network"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Network
                </button>
                <button
                  type="button"
                  onClick={() => setView("tier")}
                  className={cn(
                    "rounded-md py-1.5 text-xs font-medium transition-colors",
                    view === "tier"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  By tier
                </button>
                <button
                  type="button"
                  onClick={() => setView("table")}
                  className={cn(
                    "rounded-md py-1.5 text-xs font-medium transition-colors",
                    view === "table"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Table
                </button>
              </div>

              {/* Column filters and the exports. Offered in every view: the
                  export is of the same rows whichever way they are drawn, and
                  wanting a spreadsheet is not a reason to leave the tree. */}
              <TableToolbar
                className="mb-3"
                showSearch={false}
                columns={distributorColumns}
                rows={dq.view}
                search={dq.search}
                onSearch={dq.setSearch}
                filters={dq.filters}
                onFilter={dq.setFilter}
                onClearFilters={dq.clearFilters}
                activeFilterCount={dq.activeFilterCount}
                total={distributors.length}
                shown={dq.view.length}
                exportName="distributors"
                exportTitle="Distributor master"
              />

              {view !== "table" && dq.activeFilterCount > 0 && (
                <p className="mb-3 text-[11px] text-muted-foreground">
                  {dq.view.length} of {treeRows.length} match these filters. The
                  export is narrowed to them; the network above keeps its shape,
                  because hiding a parent would orphan everything under it.
                </p>
              )}

              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {scopeButton("live", "Live", liveCount)}
                {archivedCount > 0 && scopeButton("archived", "Archived", archivedCount)}
                {archivedCount > 0 && scopeButton("all", "All")}
                {hiddenIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowHidden((v) => !v)}
                    className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                  >
                    <Eye className="h-3 w-3" />
                    {showHidden ? "Hide hidden" : `Hidden ${hiddenIds.size}`}
                  </button>
                )}
              </div>

              {loading || typesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                view === "network" ? (
                  <DistributorTree
                    rows={treeRows}
                    types={types}
                    selectedId={selectedId}
                    collapsed={collapsed}
                    onSelect={setSelectedId}
                    onToggle={toggleCollapse}
                    hiddenIds={hiddenIds}
                  />
                ) : view === "tier" ? (
                  <DistributorTierList
                    rows={treeRows}
                    types={types}
                    tiers={hierarchyTypes}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    hiddenIds={hiddenIds}
                  />
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {visibleDistributorColumns.map((c) => (
                            <th key={c.key} className="px-3 py-2.5 font-semibold whitespace-nowrap">
                              <SortableHead
                                label={c.header}
                                sortKey={c.key}
                                sort={dq.sort}
                                onToggle={dq.toggleSort}
                                align={c.align ?? "left"}
                              />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {dq.view.map((d) => (
                          <tr
                            key={d.id}
                            onClick={() => setSelectedId(d.id)}
                            className={cn(
                              "cursor-pointer transition-colors",
                              selectedId === d.id ? "bg-primary/5" : "hover:bg-muted/40",
                              hiddenIds.has(d.id) && "opacity-50",
                            )}
                          >
                            {visibleDistributorColumns.map((c) => (
                              <td
                                key={c.key}
                                className={cn(
                                  "px-3 py-2.5 whitespace-nowrap",
                                  c.align === "right" && "text-right tabular-nums",
                                  c.key === "name" && "font-medium",
                                  c.key !== "name" && c.align !== "right" && "text-muted-foreground",
                                )}
                              >
                                {c.format ? c.format(d) : String(c.value(d) ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {dq.view.length === 0 && (
                      <div className="px-3 py-10 text-center">
                        <p className="text-sm text-muted-foreground">
                          No distributor matches these filters.
                        </p>
                        <Button variant="outline" size="sm" className="mt-3"
                          onClick={dq.clearFilters}>
                          Clear filters
                        </Button>
                      </div>
                    )}
                  </div>
                )
              )}
            </CardContent>
          </Card>

          {/* What is selected in it */}
          <Card className="flex-[999_1_520px] self-start">
            <CardContent className="p-0">
              <DistributorDetailPane
                row={selected}
                parent={selectedParent}
                children={selectedChildren}
                counts={selected ? counts[selected.id] : undefined}
                types={types}
                canDelete={canDelete && !permsLoading}
                isHidden={selected ? hiddenIds.has(selected.id) : false}
                busy={busy}
                onOpen={(id) => navigate(`/distributor/${id}`)}
                onSelect={setSelectedId}
                onEdit={() => selected && navigate(`/edit-distributor/${selected.id}`)}
                onDelete={startDelete}
                onArchive={() => selected && setArchiveTarget(selected)}
                onRestore={() => selected && restore(selected)}
                onToggleHidden={() => {
                  if (!selected) return;
                  // Un-hiding needs no warning; it only puts something back.
                  if (hiddenIds.has(selected.id)) toggleHidden(selected.id, selected.name);
                  else setHideTarget(selected);
                }}
              />
            </CardContent>
          </Card>
        </div>

        {hierarchyTypes.length === 0 && !typesLoading && (
          <p className="mt-4 text-sm text-warning">
            No distributor types are configured, so the network cannot be laid out.
          </p>
        )}

        <ArchiveDistributorDialog
          target={archiveTarget}
          candidates={distributors.filter((d) => !d.archived_at)}
          working={busy}
          onCancel={() => setArchiveTarget(null)}
          onConfirm={(action, reassignTo) =>
            archiveTarget && archive(archiveTarget, action, reassignTo)
          }
        />

        <AlertDialog open={!!hideTarget} onOpenChange={(o) => !o && setHideTarget(null)}>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Hide {hideTarget?.name} from this list?</AlertDialogTitle>
              <AlertDialogDescription>
                This only affects your own browser. Nothing is archived or deleted, nobody
                else's list changes, and you can bring it back with “Show hidden”.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (hideTarget) toggleHidden(hideTarget.id, hideTarget.name);
                  setHideTarget(null);
                }}
              >
                Hide it
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ResolveRetailersDialog
          target={resolveTarget}
          candidates={distributors.filter((d) => !d.archived_at)}
          working={busy}
          onCancel={() => setResolveTarget(null)}
          onConfirm={confirmResolve}
        />

        <CannotDeleteDialog
          target={blockedTarget}
          working={busy}
          onCancel={() => setBlockedTarget(null)}
          onArchive={() => {
            const row = distributors.find((d) => d.id === blockedTarget?.id);
            if (row) archive(row);
          }}
        />

        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => { if (!open && !busy) setDeleteTarget(null); }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Nothing is attached to it, so it can go properly. It moves to the recycle
                bin and can be restored from there.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <Button variant="destructive" disabled={busy} onClick={() => confirmDelete()}>
                {busy ? "Deleting…" : "Delete"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <RetailerRemapDialog
          open={showRemapDialog}
          onOpenChange={setShowRemapDialog}
          onSuccess={loadDistributors}
        />
      </div>
    </Layout>
  );
}
