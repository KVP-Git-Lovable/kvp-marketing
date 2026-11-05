import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ChevronsRight, ChevronLeft, ChevronsLeft, Loader2, Search, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";

/**
 * Mass Retailer Edit — pick a field, pick two of its values, and shuffle
 * retailers between them.
 *
 * This started life as Beat Exchange, which could only move retailers between
 * beats. The exchange itself was never beat-specific: everything that WAS is
 * collected in FIELDS below, so adding "move retailers from one X to another"
 * is a matter of adding one entry there, not another modal.
 */

interface Retailer {
  id: string;
  name: string;
  /** Carried so a whole beat or territory can be moved in one go. */
  beat_id?: string | null;
  beat_name?: string | null;
  territory_id?: string | null;
}

/**
 * One selectable value of the chosen field — a beat, a distributor, a category.
 * `raw` carries whatever the field needs beyond the id (a beat is keyed on its
 * TEXT beat_id but listed by its uuid, so it needs both).
 */
interface Opt {
  id: string;
  label: string;
  raw?: Record<string, any>;
}

/** Sentinel for "retailers that have no value for this field at all". */
const NONE_ID = "__none__";
const NONE_OPT: Opt = { id: NONE_ID, label: "— Not set —" };
const isNone = (o: Opt | undefined) => !!o && o.id === NONE_ID;

type LoadedOptions = { options: Opt[]; ownable?: Set<string> };

interface FieldDef {
  key: string;
  /** Shown in the field picker and as the column labels. */
  label: string;
  /** Lower-case singular, used in sentences. */
  noun: string;
  /**
   * May a retailer sit with this field unset? Offers "— Not set —" on both
   * sides. False for beat, whose column is NOT NULL in the database.
   */
  nullable: boolean;
  load: (ctx: LoadCtx) => Promise<LoadedOptions>;
  /** Narrow a retailers query down to the rows holding this value. */
  filter: (query: any, opt: Opt) => any;
  /** What to write onto the retailer rows that move here. */
  payload: (opt: Opt) => Record<string, any>;
  /**
   * Guard run before saving. Returning a string refuses the save with that
   * message. Used by beat, where you may only shuffle beats you own.
   */
  guard?: (from: Opt, to: Opt, ctx: SaveCtx) => string | null;
  /** Side effects after a successful save — currently only beat history. */
  afterSave?: (moves: Move[], ctx: SaveCtx) => Promise<void>;
}

interface LoadCtx {
  userId: string;
  /** True when the user may edit retailers outside their own hierarchy. */
  canModifyAll: boolean;
}

interface SaveCtx extends LoadCtx {
  ownable: Set<string>;
}

interface Move {
  retailers: Retailer[];
  from: Opt;
  to: Opt;
}

const byLabel = (a: Opt, b: Opt) => a.label.localeCompare(b.label);

/** Distinct non-empty values of a free-text column, as options. */
const loadDistinct = async (column: string): Promise<LoadedOptions> => {
  const { data, error } = await supabase
    .from("retailers")
    .select(column)
    .not(column, "is", null)
    .limit(20000);
  if (error) throw error;
  const seen = new Set<string>();
  for (const row of (data as any[]) || []) {
    const v = (row?.[column] ?? "").toString().trim();
    if (v) seen.add(v);
  }
  return { options: [...seen].map((v) => ({ id: v, label: v })).sort(byLabel) };
};

const FIELDS: FieldDef[] = [
  {
    key: "beat",
    label: "Beat",
    noun: "beat",
    // retailers.beat_id is NOT NULL, so there is no "unassigned" to move to.
    nullable: false,
    load: async ({ userId, canModifyAll }) => {
      const nowIso = new Date().toISOString();

      // Someone who may modify every retailer gets every beat; everyone else
      // gets the beats they own plus the ones shared with them.
      if (canModifyAll) {
        const { data, error } = await supabase
          .from("beats")
          .select("id, beat_id, beat_name")
          .eq("is_active", true)
          .order("beat_name", { ascending: true });
        if (error) throw error;
        const rows = (data || []) as any[];
        return {
          options: rows.map((b) => ({ id: b.id, label: b.beat_name, raw: b })),
          ownable: new Set(rows.map((b) => b.beat_id)),
        };
      }

      const ownedRes = await supabase
        .from("beats")
        .select("id, beat_id, beat_name")
        .eq("is_active", true)
        .eq("user_id", userId)
        .order("beat_name", { ascending: true });
      if (ownedRes.error) throw ownedRes.error;
      const owned = (ownedRes.data || []) as any[];

      // Shared beats via beat_user_access — two-step fetch (no FK embed needed).
      let shared: any[] = [];
      try {
        const { data: accessRows } = await supabase
          .from("beat_user_access")
          .select("beat_id, access_type, effective_to")
          .eq("user_id", userId)
          .eq("is_active", true)
          .in("access_type", ["CO_OWNER", "OPERATIONAL"])
          .or(`effective_to.is.null,effective_to.gt.${nowIso}`);
        const ids = Array.from(new Set((accessRows || []).map((r: any) => r.beat_id).filter(Boolean)));
        if (ids.length > 0) {
          const { data: beatRows } = await supabase
            .from("beats")
            .select("id, beat_id, beat_name")
            .eq("is_active", true)
            .in("id", ids);
          shared = beatRows || [];
        }
      } catch {
        // Non-fatal: the owned beats still list.
      }

      const merged = [...owned];
      for (const b of shared) if (!merged.some((x) => x.beat_id === b.beat_id)) merged.push(b);

      return {
        options: merged.map((b) => ({ id: b.id, label: b.beat_name, raw: b })).sort(byLabel),
        // Only beats you OWN may be edited, even though shared ones are listed.
        ownable: new Set(owned.map((b) => b.beat_id)),
      };
    },
    filter: (q, opt) => q.eq("beat_id", opt.raw?.beat_id),
    payload: (opt) => ({ beat_id: opt.raw?.beat_id, beat_name: opt.raw?.beat_name }),
    guard: (from, to, { ownable, canModifyAll }) => {
      if (canModifyAll) return null;
      if (!ownable.has(from.raw?.beat_id) || !ownable.has(to.raw?.beat_id)) {
        return "You can only move retailers between beats you own";
      }
      return null;
    },
    afterSave: async (moves, { userId }) => {
      const rows = moves.flatMap((m) =>
        m.retailers.map((r) => ({
          retailer_id: r.id,
          retailer_name: r.name,
          from_beat_id: m.from.raw?.beat_id ?? null,
          from_beat_name: m.from.label,
          to_beat_id: m.to.raw?.beat_id ?? null,
          to_beat_name: m.to.label,
          transferred_by: userId,
        })),
      );
      if (rows.length === 0) return;
      const { error } = await supabase.from("retailer_beat_transfer_history").insert(rows);
      if (error) throw error;
    },
  },
  {
    key: "distributor",
    label: "Distributor",
    noun: "distributor",
    nullable: true,
    load: async () => {
      // Distributor Master hides archived distributors. `status` is 'active'
      // on every row in both environments, so it is archived_at that decides;
      // production has no such column yet, hence the fallback.
      let rows: any[] = [];
      let hasArchived = true;
      const withArchived = await supabase
        .from("distributors")
        .select("id, name, archived_at")
        .order("name", { ascending: true });
      if (withArchived.error) {
        hasArchived = false;
        const plain = await supabase
          .from("distributors")
          .select("id, name")
          .order("name", { ascending: true });
        if (plain.error) throw plain.error;
        rows = plain.data || [];
      } else {
        rows = withArchived.data || [];
      }

      if (!hasArchived) {
        return { options: rows.map((d) => ({ id: d.id, label: d.name })) };
      }

      // An archived distributor that still holds retailers has to stay
      // pickable -- otherwise its shops cannot be moved off it, which is the
      // one job this screen exists for. Staging's archived KVP Pvt. Ltd.
      // holds 224 of them.
      const archivedIds = rows.filter((d) => d.archived_at).map((d) => d.id);
      const stillUsed = new Set<string>();
      if (archivedIds.length > 0) {
        const { data: links } = await supabase
          .from("retailers")
          .select("distributor_id")
          .in("distributor_id", archivedIds)
          .limit(20000);
        ((links as any[]) || []).forEach((r) => r?.distributor_id && stillUsed.add(r.distributor_id));
      }

      return {
        options: rows
          .filter((d) => !d.archived_at || stillUsed.has(d.id))
          .map((d) => ({
            id: d.id,
            label: d.archived_at ? `${d.name} (archived)` : d.name,
          })),
      };
    },
    filter: (q, opt) => (isNone(opt) ? q.is("distributor_id", null) : q.eq("distributor_id", opt.id)),
    // Writing distributor_id alone leaves the legacy parent_type/parent_name
    // saying something else -- in production that is where the link actually
    // lives, so moving a retailer here has to settle both.
    payload: (opt) =>
      isNone(opt)
        ? { distributor_id: null }
        : { distributor_id: opt.id, parent_type: "Distributor", parent_name: opt.label },
  },
  {
    // Production holds the retailer -> distributor link in free text:
    // parent_type ('Company', 'Distributor', 'Super Stockist') plus
    // parent_name. 4,377 retailers sit under Company / BHARATH BEVERAGES and
    // none of them has distributor_id set, so they are invisible to the
    // Distributor field above. This is how you find and move them.
    key: "parent_link",
    label: "Linked to (old style)",
    noun: "link",
    nullable: true,
    load: async () => {
      const { data, error } = await supabase
        .from("retailers")
        .select("parent_type, parent_name")
        .not("parent_name", "is", null)
        .limit(20000);
      if (error) throw error;
      const counts = new Map<string, { type: string; name: string; n: number }>();
      for (const row of (data as any[]) || []) {
        const name = (row?.parent_name ?? "").toString().trim();
        if (!name) continue;
        const type = (row?.parent_type ?? "").toString().trim() || "Unspecified";
        const key = `${type}\u0000${name}`;
        const hit = counts.get(key);
        if (hit) hit.n += 1;
        else counts.set(key, { type, name, n: 1 });
      }
      return {
        options: [...counts.entries()]
          .map(([id, v]) => ({
            id,
            label: `${v.type} · ${v.name} (${v.n})`,
            raw: { parent_type: v.type === "Unspecified" ? null : v.type, parent_name: v.name },
          }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      };
    },
    filter: (q, opt) => {
      if (isNone(opt)) return q.is("parent_name", null);
      const t = opt.raw?.parent_type;
      const withName = q.eq("parent_name", opt.raw?.parent_name);
      return t === null ? withName.is("parent_type", null) : withName.eq("parent_type", t);
    },
    payload: (opt) =>
      isNone(opt)
        ? { parent_type: null, parent_name: null }
        : { parent_type: opt.raw?.parent_type ?? null, parent_name: opt.raw?.parent_name ?? null },
  },
  {
    key: "territory",
    label: "Territory",
    noun: "territory",
    nullable: true,
    load: async () => {
      const { data, error } = await supabase
        .from("territories")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return { options: ((data || []) as any[]).map((t) => ({ id: t.id, label: t.name })) };
    },
    filter: (q, opt) => (isNone(opt) ? q.is("territory_id", null) : q.eq("territory_id", opt.id)),
    payload: (opt) => ({ territory_id: isNone(opt) ? null : opt.id }),
  },
  {
    key: "category",
    label: "Retailer Category",
    noun: "category",
    nullable: true,
    load: () => loadDistinct("category"),
    filter: (q, opt) => (isNone(opt) ? q.is("category", null) : q.eq("category", opt.id)),
    payload: (opt) => ({ category: isNone(opt) ? null : opt.id }),
  },
  {
    key: "retail_type",
    label: "Type",
    noun: "type",
    nullable: true,
    load: () => loadDistinct("retail_type"),
    filter: (q, opt) => (isNone(opt) ? q.is("retail_type", null) : q.eq("retail_type", opt.id)),
    payload: (opt) => ({ retail_type: isNone(opt) ? null : opt.id }),
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Side = "A" | "B";
const PAGE_SIZE = 50;
const sortByName = (xs: Retailer[]) => [...xs].sort((a, b) => a.name.localeCompare(b.name));

export const MassRetailerEditModal = ({ open, onOpenChange, onSuccess }: Props) => {
  const { permissions } = usePermissions();
  const canModifyAll = !!permissions["module_my_retailers"]?.can_modify_all;

  const [fieldKey, setFieldKey] = useState<string>(FIELDS[0].key);
  const field = useMemo(() => FIELDS.find((f) => f.key === fieldKey) ?? FIELDS[0], [fieldKey]);

  const [options, setOptions] = useState<Opt[]>([]);
  const [ownable, setOwnable] = useState<Set<string>>(new Set());
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");

  const [panelA, setPanelA] = useState<Retailer[]>([]);
  const [panelB, setPanelB] = useState<Retailer[]>([]);
  const [originalA, setOriginalA] = useState<Set<string>>(new Set());
  const [originalB, setOriginalB] = useState<Set<string>>(new Set());
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");
  const [checkedA, setCheckedA] = useState<Set<string>>(new Set());
  const [checkedB, setCheckedB] = useState<Set<string>>(new Set());
  const [pageA, setPageA] = useState(1);
  const [pageB, setPageB] = useState(1);

  /**
   * Moving a distributor's book one shop at a time is unusable at 224 rows.
   * Grouping the panels by beat or territory lets a whole route, or a whole
   * area with every beat under it, be ticked in one go.
   */
  const [groupBy, setGroupBy] = useState<"none" | "beat" | "territory">("none");
  const [territoryNames, setTerritoryNames] = useState<Record<string, string>>({});

  const [dragOverSide, setDragOverSide] = useState<Side | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  /** Every option plus "— Not set —" where the field allows it. */
  const selectable = useMemo(
    () => (field.nullable ? [NONE_OPT, ...options] : options),
    [field, options],
  );
  const optA = selectable.find((o) => o.id === aId);
  const optB = selectable.find((o) => o.id === bId);
  const sameValue = !!aId && !!bId && aId === bId;

  const clearSelection = () => {
    setAId(""); setBId("");
    setPanelA([]); setPanelB([]);
    setOriginalA(new Set()); setOriginalB(new Set());
    setSearchA(""); setSearchB("");
    setCheckedA(new Set()); setCheckedB(new Set());
    setPageA(1); setPageB(1);
  };

  // Reset everything when closing.
  useEffect(() => {
    if (!open) {
      clearSelection();
      setFieldKey(FIELDS[0].key);
      setGroupBy("none");
      setOptions([]);
      setOwnable(new Set());
      setConfirmOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load the chosen field's options. Switching field drops any pending moves,
  // which is the only safe thing to do — they describe the old field.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      clearSelection();
      setLoadingOptions(true);
      try {
        const { data: userRes, error: authErr } = await supabase.auth.getUser();
        if (authErr || !userRes?.user) throw new Error("Not authenticated");
        const loaded = await field.load({ userId: userRes.user.id, canModifyAll });
        if (cancelled) return;
        setOptions(loaded.options);
        setOwnable(loaded.ownable ?? new Set());
      } catch (e: any) {
        if (!cancelled) {
          toast.error(e?.message || `Could not load ${field.noun} list`);
          setOptions([]);
          setOwnable(new Set());
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fieldKey, canModifyAll]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("territories").select("id, name");
      if (cancelled) return;
      const map: Record<string, string> = {};
      ((data as any[]) || []).forEach((t) => { map[t.id] = t.name; });
      setTerritoryNames(map);
    })();
    return () => { cancelled = true; };
  }, [open]);

  const loadSide = async (side: Side, opt: Opt | undefined) => {
    if (!opt) {
      if (side === "A") { setPanelA([]); setOriginalA(new Set()); }
      else { setPanelB([]); setOriginalB(new Set()); }
      return;
    }
    side === "A" ? setLoadingA(true) : setLoadingB(true);
    try {
      const query = field.filter(
        supabase.from("retailers").select("id, name, beat_id, beat_name, territory_id"), opt);
      const { data, error } = await query.order("name", { ascending: true });
      if (error) throw error;
      const rows = ((data as Retailer[]) || []).map((r) => ({
        id: r.id, name: r.name,
        beat_id: r.beat_id ?? null, beat_name: r.beat_name ?? null,
        territory_id: r.territory_id ?? null,
      }));
      const ids = new Set(rows.map((r) => r.id));
      if (side === "A") { setPanelA(rows); setOriginalA(ids); }
      else { setPanelB(rows); setOriginalB(ids); }
    } catch (e: any) {
      toast.error(e?.message || "Could not load retailers");
      if (side === "A") { setPanelA([]); setOriginalA(new Set()); }
      else { setPanelB([]); setOriginalB(new Set()); }
    } finally {
      side === "A" ? setLoadingA(false) : setLoadingB(false);
    }
  };

  // Reload both sides whenever either value changes — clears pending moves.
  useEffect(() => {
    if (!open || sameValue) return;
    setCheckedA(new Set()); setCheckedB(new Set());
    setPageA(1); setPageB(1);
    loadSide("A", optA);
    loadSide("B", optB);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aId, bId, open]);

  const filteredA = useMemo(
    () => panelA.filter((r) => r.name.toLowerCase().includes(searchA.toLowerCase())),
    [panelA, searchA],
  );
  const filteredB = useMemo(
    () => panelB.filter((r) => r.name.toLowerCase().includes(searchB.toLowerCase())),
    [panelB, searchB],
  );

  const aTotal = filteredA.length;
  const bTotal = filteredB.length;
  const aStart = aTotal === 0 ? 0 : (pageA - 1) * PAGE_SIZE + 1;
  const aEnd = Math.min(pageA * PAGE_SIZE, aTotal);
  const bStart = bTotal === 0 ? 0 : (pageB - 1) * PAGE_SIZE + 1;
  const bEnd = Math.min(pageB * PAGE_SIZE, bTotal);
  const aPageItems = filteredA.slice(aStart === 0 ? 0 : aStart - 1, aEnd);
  const bPageItems = filteredB.slice(bStart === 0 ? 0 : bStart - 1, bEnd);

  const toggleCheck = (side: Side, id: string) => {
    const [cur, set] = side === "A" ? [checkedA, setCheckedA] : [checkedB, setCheckedB];
    const s = new Set(cur);
    s.has(id) ? s.delete(id) : s.add(id);
    set(s);
  };
  const toggleSelectAll = (side: Side) => {
    const [cur, set, filtered] =
      side === "A" ? [checkedA, setCheckedA, filteredA] : [checkedB, setCheckedB, filteredB];
    const ids = filtered.map((r) => r.id);
    const all = ids.length > 0 && ids.every((id) => cur.has(id));
    const s = new Set(cur);
    if (all) ids.forEach((id) => s.delete(id)); else ids.forEach((id) => s.add(id));
    set(s);
  };

  /** Ticks or clears a whole beat or territory at once. */
  const toggleGroup = (side: Side, ids: string[], allChecked: boolean) => {
    const [cur, set] = side === "A" ? [checkedA, setCheckedA] : [checkedB, setCheckedB];
    const s = new Set(cur);
    if (allChecked) ids.forEach((id) => s.delete(id));
    else ids.forEach((id) => s.add(id));
    set(s);
  };

  const moveIds = (from: Side, to: Side, ids: string[]) => {
    if (from === to || ids.length === 0) return;
    const idSet = new Set(ids);
    if (from === "A") {
      const moving = panelA.filter((r) => idSet.has(r.id));
      setPanelA(panelA.filter((r) => !idSet.has(r.id)));
      setPanelB(sortByName([...panelB, ...moving]));
      const c = new Set(checkedA); ids.forEach((id) => c.delete(id)); setCheckedA(c);
    } else {
      const moving = panelB.filter((r) => idSet.has(r.id));
      setPanelB(panelB.filter((r) => !idSet.has(r.id)));
      setPanelA(sortByName([...panelA, ...moving]));
      const c = new Set(checkedB); ids.forEach((id) => c.delete(id)); setCheckedB(c);
    }
  };

  /** The bucket a retailer falls in under the current grouping. */
  const groupOf = (r: Retailer): { key: string; label: string } => {
    if (groupBy === "beat") {
      const key = r.beat_id || "~nobeat";
      return { key, label: r.beat_name || r.beat_id || "No beat" };
    }
    const key = r.territory_id || "~noterr";
    return { key, label: r.territory_id ? (territoryNames[r.territory_id] || "Unnamed territory") : "No territory" };
  };

  /** Rows grouped and sorted, with unassigned last so it does not lead. */
  const groupRows = (rows: Retailer[]) => {
    const m = new Map<string, { label: string; rows: Retailer[] }>();
    rows.forEach((r) => {
      const g = groupOf(r);
      const hit = m.get(g.key);
      if (hit) hit.rows.push(r);
      else m.set(g.key, { label: g.label, rows: [r] });
    });
    return [...m.entries()].sort((a, b) => {
      const au = a[0].startsWith("~"), bu = b[0].startsWith("~");
      if (au !== bu) return au ? 1 : -1;
      return a[1].label.localeCompare(b[1].label);
    });
  };

  const movedToB = useMemo(() => panelB.filter((r) => originalA.has(r.id)), [panelB, originalA]);
  const movedToA = useMemo(() => panelA.filter((r) => originalB.has(r.id)), [panelA, originalB]);
  const totalMoves = movedToA.length + movedToB.length;
  const canConfirm = !!aId && !!bId && !sameValue && totalMoves > 0 && !isSaving;

  const onDragStart = (e: React.DragEvent, side: Side, id: string) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ side, id }));
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e: React.DragEvent, side: Side) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverSide !== side) setDragOverSide(side);
  };
  const onDrop = (e: React.DragEvent, target: Side) => {
    e.preventDefault();
    setDragOverSide(null);
    try {
      const { side, id } = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (side && id && side !== target) moveIds(side, target, [id]);
    } catch { /* ignore */ }
  };

  /**
   * Writes one leg of the exchange. Returns the ids that actually changed --
   * row-level security filters an UPDATE silently rather than raising, so a
   * rep who may not touch some of these retailers gets a partial write and
   * must be told, not congratulated.
   */
  const applyMove = async (rows: Retailer[], to: Opt): Promise<Set<string>> => {
    if (rows.length === 0) return new Set();
    const { data, error } = await supabase
      .from("retailers")
      .update({ ...field.payload(to), updated_at: new Date().toISOString() })
      .in("id", rows.map((r) => r.id))
      .select("id");
    if (error) throw error;
    return new Set(((data as any[]) || []).map((r) => r.id));
  };

  const handleConfirm = async () => {
    if (!canConfirm || !optA || !optB) return;

    const { data: userData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userData.user) { toast.error("Not authenticated"); return; }
    const ctx: SaveCtx = { userId: userData.user.id, canModifyAll, ownable };

    const refusal = field.guard?.(optA, optB, ctx);
    if (refusal) { toast.error(refusal); return; }

    setIsSaving(true);
    try {
      const savedB = await applyMove(movedToB, optB);
      const savedA = await applyMove(movedToA, optA);

      const doneToB = movedToB.filter((r) => savedB.has(r.id));
      const doneToA = movedToA.filter((r) => savedA.has(r.id));
      const blocked = (movedToB.length - doneToB.length) + (movedToA.length - doneToA.length);

      if (field.afterSave) {
        await field.afterSave(
          [
            { retailers: doneToB, from: optA, to: optB },
            { retailers: doneToA, from: optB, to: optA },
          ].filter((m) => m.retailers.length > 0),
          ctx,
        );
      }

      const x = doneToB.length, y = doneToA.length;
      if (x + y === 0) {
        toast.error(`Nothing was changed — you do not have permission to edit ${blocked === 1 ? "that retailer" : "those retailers"}.`);
      } else {
        toast.success(
          `${x} moved to ${optB.label}, ${y} moved to ${optA.label}.` +
          (blocked > 0 ? ` ${blocked} skipped — not yours to edit.` : ""),
        );
      }

      setConfirmOpen(false);
      setCheckedA(new Set()); setCheckedB(new Set());
      setPageA(1); setPageB(1);
      await Promise.all([loadSide("A", optA), loadSide("B", optB)]);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.message || "Update failed");
    } finally {
      setIsSaving(false);
    }
  };

  const renderPanel = (side: Side) => {
    const opt = side === "A" ? optA : optB;
    const panel = side === "A" ? panelA : panelB;
    const loading = side === "A" ? loadingA : loadingB;
    const search = side === "A" ? searchA : searchB;
    const setSearch = side === "A" ? setSearchA : setSearchB;
    const setPage = side === "A" ? setPageA : setPageB;
    const filtered = side === "A" ? filteredA : filteredB;
    const pageItems = side === "A" ? aPageItems : bPageItems;
    const checked = side === "A" ? checkedA : checkedB;
    const start = side === "A" ? aStart : bStart;
    const end = side === "A" ? aEnd : bEnd;
    const total = side === "A" ? aTotal : bTotal;
    const page = side === "A" ? pageA : pageB;
    const chosen = side === "A" ? aId : bId;
    const allFilteredChecked = filtered.length > 0 && filtered.every((r) => checked.has(r.id));

    return (
      <div
        className={`border rounded-md flex flex-col bg-card transition-colors ${dragOverSide === side ? "ring-2 ring-primary border-primary bg-primary/5" : ""}`}
        onDragOver={(e) => onDragOver(e, side)}
        onDragLeave={() => dragOverSide === side && setDragOverSide(null)}
        onDrop={(e) => onDrop(e, side)}
      >
        <div className="px-3 py-2 border-b">
          <h4 className="text-sm font-semibold truncate">
            Retailers in {opt?.label || "—"} ({panel.length})
          </h4>
        </div>
        <div className="p-3 space-y-2 flex-1 flex flex-col">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search retailers"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              disabled={!chosen || isSaving}
            />
          </div>
          {chosen && filtered.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <Checkbox
                checked={allFilteredChecked}
                onCheckedChange={() => toggleSelectAll(side)}
                disabled={isSaving}
              />
              <span>Select all ({filtered.length})</span>
            </label>
          )}
          <div className="flex-1 min-h-[260px] max-h-[340px] overflow-y-auto border rounded-md p-1 bg-background">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !chosen ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Select a {field.noun}.
              </p>
            ) : pageItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {panel.length === 0 ? `No retailers in this ${field.noun}.` : "No matches."}
              </p>
            ) : (
              groupBy === "none" ? (
                pageItems.map((r) => (
                  <div
                    key={r.id}
                    draggable={!isSaving}
                    onDragStart={(e) => onDragStart(e, side, r.id)}
                    className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 cursor-grab active:cursor-grabbing text-sm"
                  >
                    <Checkbox
                      checked={checked.has(r.id)}
                      onCheckedChange={() => toggleCheck(side, r.id)}
                      disabled={isSaving}
                    />
                    <span className="flex-1 truncate">{r.name}</span>
                  </div>
                ))
              ) : (
                /* Grouped: the header checkbox takes the whole beat or
                   territory, which is the point of grouping at all. Every
                   match is shown rather than a page, so ticking a group
                   cannot silently miss rows on page two. */
                groupRows(filtered).map(([key, g]) => {
                  const ids = g.rows.map((r) => r.id);
                  const all = ids.every((id) => checked.has(id));
                  const some = !all && ids.some((id) => checked.has(id));
                  return (
                    <div key={key} className="mb-1">
                      <div className="flex items-center gap-2 px-2 py-1 rounded bg-muted/60 sticky top-0">
                        <Checkbox
                          checked={all ? true : some ? "indeterminate" : false}
                          onCheckedChange={() => toggleGroup(side, ids, all)}
                          disabled={isSaving}
                        />
                        <span className={`flex-1 truncate text-xs font-semibold ${key.startsWith("~") ? "text-muted-foreground italic" : ""}`}>
                          {g.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{g.rows.length}</span>
                      </div>
                      {g.rows.map((r) => (
                        <div
                          key={r.id}
                          draggable={!isSaving}
                          onDragStart={(e) => onDragStart(e, side, r.id)}
                          className="flex items-center gap-2 py-1 pl-6 pr-2 rounded hover:bg-muted/50 cursor-grab active:cursor-grabbing text-sm"
                        >
                          <Checkbox
                            checked={checked.has(r.id)}
                            onCheckedChange={() => toggleCheck(side, r.id)}
                            disabled={isSaving}
                          />
                          <span className="flex-1 truncate">{r.name}</span>
                        </div>
                      ))}
                    </div>
                  );
                })
              )
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {groupBy === "none"
                ? `Showing ${start} to ${end} of ${total}`
                : `${total} retailer${total === 1 ? "" : "s"} in ${groupRows(filtered).length} ${groupBy === "beat" ? "beat" : "territory"}${groupRows(filtered).length === 1 ? "" : "s"}`}
            </span>
            {groupBy === "none" && (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 px-2" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" disabled={end >= total} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderValueSelect = (side: Side) => {
    const value = side === "A" ? aId : bId;
    const other = side === "A" ? bId : aId;
    const setValue = side === "A" ? setAId : setBId;
    return (
      <Select value={value} onValueChange={setValue} disabled={loadingOptions || isSaving}>
        <SelectTrigger>
          <SelectValue
            placeholder={
              loadingOptions
                ? `Loading ${field.noun} list...`
                : `Select ${field.label} ${side}`
            }
          />
        </SelectTrigger>
        <SelectContent>
          {selectable.filter((o) => o.id !== other).map((o) => (
            <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const x = movedToB.length, y = movedToA.length;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !isSaving && onOpenChange(o)}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              Mass Retailer Edit
            </DialogTitle>
            <DialogDescription>
              Choose a field, pick two of its values, and move retailers between them.
              Nothing is saved until you confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Field to edit</label>
            <Select value={fieldKey} onValueChange={setFieldKey} disabled={isSaving}>
              <SelectTrigger className="md:max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELDS.map((f) => (
                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Moving a distributor's book one shop at a time is unusable at a
              few hundred rows. Group the lists and a whole route, or a whole
              area with every beat under it, moves in one tick. */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Group the lists by</label>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)} disabled={isSaving}>
              <SelectTrigger className="md:max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nothing — one shop at a time</SelectItem>
                <SelectItem value="beat">Beat — move a whole route</SelectItem>
                <SelectItem value="territory">Territory — move a whole area</SelectItem>
              </SelectContent>
            </Select>
          </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{field.label} A</label>
              {renderValueSelect("A")}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{field.label} B</label>
              {renderValueSelect("B")}
              {sameValue && (
                <p className="text-xs text-destructive">
                  {field.label} A and {field.label} B cannot be the same.
                </p>
              )}
            </div>
          </div>

          {!loadingOptions && options.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No {field.noun} values available to you.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-stretch mt-2">
            {renderPanel("A")}
            <div className="flex md:flex-col flex-row justify-center items-center gap-2 md:py-4">
              <Button size="icon" variant="outline" onClick={() => moveIds("A","B",[...checkedA])} disabled={checkedA.size === 0 || isSaving} title="Move checked to B"><ChevronRight /></Button>
              <Button size="icon" variant="outline" onClick={() => moveIds("A","B", filteredA.map((r) => r.id))} disabled={filteredA.length === 0 || isSaving} title="Move all to B"><ChevronsRight /></Button>
              <Button size="icon" variant="outline" onClick={() => moveIds("B","A",[...checkedB])} disabled={checkedB.size === 0 || isSaving} title="Move checked to A"><ChevronLeft /></Button>
              <Button size="icon" variant="outline" onClick={() => moveIds("B","A", filteredB.map((r) => r.id))} disabled={filteredB.length === 0 || isSaving} title="Move all to A"><ChevronsLeft /></Button>
            </div>
            {renderPanel("B")}
          </div>

          {totalMoves > 0 && optA && optB && (
            <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <strong>{x}</strong> retailer{x === 1 ? "" : "s"} will move to <strong>{optB.label}</strong>,{" "}
              <strong>{y}</strong> retailer{y === 1 ? "" : "s"} will move to <strong>{optA.label}</strong>.
            </div>
          )}

          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={!canConfirm}>Confirm Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={(o) => !isSaving && setConfirmOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm {field.label} Change</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1 pt-1 text-sm text-foreground">
                <div><strong>{x}</strong> retailer{x === 1 ? "" : "s"} will be moved to <strong>{optB?.label}</strong>.</div>
                <div><strong>{y}</strong> retailer{y === 1 ? "" : "s"} will be moved to <strong>{optA?.label}</strong>.</div>
                <div className="text-muted-foreground pt-2">This action cannot be undone.</div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={isSaving}>
              {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
