import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowDown, ArrowUp, ChevronsUpDown, Coins, Loader2, ListFilter, Search, Users, X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { categoryMeta } from "./constants";
import {
  useAwardRecord, useGamProfiles, useGamSettings, usePointsLedger, usePointsSummary, usePrograms,
} from "./hooks";
import { AwardRecordDetailById } from "./AwardRecordDetail";
import { RangeSelect } from "./RangeSelect";
import { DEFAULT_RANGE } from "./dateRange";

const PAGE = "#eef0f4";
const INK = "#1c2440";
const MUT = "#9aa1b5";
const SEC = "#5a6284";
const LINE = "#e7e9f0";

const UNATTRIBUTED = "__none__";

type SortDir = "asc" | "desc";
type Sort = { key: string; dir: SortDir } | null;
/** null = column not filtered. A set holding every option is normalised back to
 *  null, so "everything ticked" never counts as an active filter. */
type ColFilters = Record<string, Set<string> | null>;
const PAGE_STEP = 100;

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" }) : "—";

/**
 * The full points ledger — every award, with who earned it, which activity and
 * program produced it, what it was tied to, and when it expires.
 */
export function PointsLedger() {
  const [limit, setLimit] = useState(PAGE_STEP);
  // Empty = all time. Both the ledger and the balances honour it, so the
  // headline totals and the per-person balances always describe the same window.
  const [dateFrom, setDateFrom] = useState(() => DEFAULT_RANGE()[0]);
  const [dateTo, setDateTo] = useState(() => DEFAULT_RANGE()[1]);
  const { data: rows = [], isLoading: loadingRows } = usePointsLedger(limit, dateFrom, dateTo);
  const { data: summary, isLoading: loadingSummary } = usePointsSummary(dateFrom, dateTo);
  const { data: profiles = [] } = useGamProfiles();
  const { data: programs = [] } = usePrograms();
  const { data: settings } = useGamSettings();

  // The award a row opened. The ledger is a flat list with no context of its
  // own, so it fetches the one record it needs by id rather than carrying the
  // retailer and order joins on every row it never shows.
  const [recordId, setRecordId] = useState<string | null>(null);
  const { data: record, isLoading: recordLoading, error: recordError } = useAwardRecord(recordId ?? undefined);

  const [query, setQuery] = useState("");
  const [programId, setProgramId] = useState("all");
  const [person, setPerson] = useState("all");
  const [source, setSource] = useState("all");
  // Default-hide deactivated reps from the "person" filter's option list — a
  // manager should still be able to pull an inactive rep's historical points, so
  // this only changes which names are offered, never which rows are shown.
  const [showInactivePeople, setShowInactivePeople] = useState(false);
  // The Select shows "Custom range…" either because it was chosen, or because
  // hand-typed dates match no preset — otherwise a custom window would light up
  // whichever preset happened to be nearest.
  const [showCustom, setShowCustom] = useState(false);
  // Per-column sort and value filters, on top of the toolbar's filters.
  const [sort, setSort] = useState<Sort>(null);
  const [colFilters, setColFilters] = useState<ColFilters>({});

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p: any) => m.set(p.id, p.full_name || "Unnamed"));
    return m;
  }, [profiles]);

  const activeById = useMemo(() => {
    const m = new Map<string, boolean>();
    profiles.forEach((p: any) => m.set(p.id, p.is_active !== false));
    return m;
  }, [profiles]);

  const nameOf = (userId?: string | null) =>
    !userId ? "Unattributed" : nameById.get(userId) ?? "Unknown user";

  const visiblePeople = useMemo(
    () =>
      (summary?.byUser ?? []).filter(
        (u) =>
          showInactivePeople ||
          u.userId === UNATTRIBUTED ||
          activeById.get(u.userId) !== false ||
          person === u.userId
      ),
    [summary, showInactivePeople, activeById, person]
  );

  const sources = useMemo(
    () => Array.from(new Set(rows.map((r: any) => r.reference_type).filter(Boolean))).sort(),
    [rows]
  );

  const toolbarFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r: any) => {
      if (programId !== "all" && r.game_id !== programId) return false;
      if (person !== "all" && (r.user_id ?? UNATTRIBUTED) !== person) return false;
      if (source !== "all" && r.reference_type !== source) return false;
      if (!q) return true;
      return (
        nameOf(r.user_id).toLowerCase().includes(q) ||
        (r.gamification_actions?.action_name ?? "").toLowerCase().includes(q) ||
        (r.gamification_games?.name ?? "").toLowerCase().includes(q) ||
        (r.reference_type ?? "").toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, programId, person, source, nameById]);

  /**
   * The table's columns, each able to say what it displays and what it sorts on
   * — so the header filter always offers exactly the strings the reader can see
   * in that column, and Date/Points still sort chronologically/numerically
   * rather than alphabetically.
   */
  const columns = useMemo(
    () => [
      { key: "date", label: "Date", align: "left" as const,
        value: (r: any) => fmtDate(r.earned_at), sortBy: (r: any) => r.earned_at ?? "" },
      { key: "person", label: "Person", align: "left" as const,
        value: (r: any) => nameOf(r.user_id) },
      { key: "activity", label: "Activity", align: "left" as const,
        value: (r: any) => r.gamification_actions?.action_name ?? "—" },
      { key: "program", label: "Game", align: "left" as const,
        value: (r: any) => r.gamification_games?.name ?? "—" },
      { key: "source", label: "Source", align: "left" as const,
        value: (r: any) => String(r.reference_type ?? "—").replace(/_/g, " ") },
      { key: "expires", label: "Expires", align: "left" as const,
        value: (r: any) => fmtDate(r.expires_at), sortBy: (r: any) => r.expires_at ?? "" },
      { key: "points", label: "Points", align: "right" as const,
        value: (r: any) => String(Number(r.points || 0)), sortBy: (r: any) => Number(r.points || 0) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nameById]
  );

  /** Options come from the toolbar-filtered rows and deliberately IGNORE the
   *  column filters, so ticking a value never makes the other options vanish
   *  from under the cursor. */
  const optionsByColumn = useMemo(() => {
    const m: Record<string, string[]> = {};
    columns.forEach((c) => {
      m[c.key] = Array.from(new Set(toolbarFiltered.map((r: any) => c.value(r)))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );
    });
    return m;
  }, [columns, toolbarFiltered]);

  const hasColFilters = Object.values(colFilters).some((v) => v && v.size);

  const filtered = useMemo(() => {
    let out = toolbarFiltered;

    for (const c of columns) {
      const allowed = colFilters[c.key];
      if (allowed && allowed.size) out = out.filter((r: any) => allowed.has(c.value(r)));
    }

    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        const read = col.sortBy ?? col.value;
        const factor = sort.dir === "asc" ? 1 : -1;
        // Copied before sorting — the memo's input array must not be mutated.
        out = [...out].sort((a: any, b: any) => {
          const av = read(a);
          const bv = read(b);
          if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
          return String(av).localeCompare(String(bv), undefined, { numeric: true }) * factor;
        });
      }
    }
    return out;
  }, [toolbarFiltered, columns, colFilters, sort]);

  const cycleSort = (key: string) =>
    setSort((cur) =>
      cur?.key !== key ? { key, dir: "asc" } : cur.dir === "asc" ? { key, dir: "desc" } : null
    );

  const clearColumnState = () => {
    setColFilters({});
    setSort(null);
  };

  const shownTotal = filtered.reduce((s: number, r: any) => s + Number(r.points || 0), 0);
  const isFiltered =
    !!query.trim() || programId !== "all" || person !== "all" || source !== "all" ||
    !!dateFrom || !!dateTo || hasColFilters;
  const canLoadMore = rows.length >= limit && (!summary || rows.length < summary.awards);

  const topBalance = summary?.byUser?.[0]?.points ?? 0;

  return (
    <div style={{ color: INK }}>
      {/* HEADER */}
      <div
        className="sticky top-[94px] sm:top-[57px] z-10 -mx-1 px-1 py-3 mb-4 backdrop-blur"
        style={{ background: `${PAGE}f0` }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] rounded-[10px] bg-primary/10 text-primary flex items-center justify-center">
              <Coins className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[15px] font-bold tracking-tight leading-tight">Points ledger</div>
              <div className="text-[11.5px] mt-0.5" style={{ color: MUT }}>
                {loadingSummary
                  ? "Loading…"
                  : `${summary?.awards ?? 0} awards · ${(summary?.total ?? 0).toLocaleString()} points since ${fmtDate(summary?.earliest)}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUT }} />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ledger"
                className="h-9 w-[178px] pl-8 text-[13px] bg-white"
              />
            </div>
            <Select value={person} onValueChange={setPerson}>
              <SelectTrigger className="h-9 w-[150px] text-[13px] bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                {visiblePeople.map((u) => (
                  <SelectItem key={u.userId} value={u.userId}>
                    {u.userId === UNATTRIBUTED ? "Unattributed" : nameOf(u.userId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1.5 text-[11px] cursor-pointer select-none" style={{ color: MUT }}>
              <Switch
                checked={showInactivePeople}
                onCheckedChange={setShowInactivePeople}
                className="scale-75"
              />
              Show inactive
            </label>
            <Select value={programId} onValueChange={setProgramId}>
              <SelectTrigger className="h-9 w-[156px] text-[13px] bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All games</SelectItem>
                {programs.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="h-9 w-[132px] text-[13px] bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any source</SelectItem>
                {sources.map((s: any) => (
                  <SelectItem key={s} value={s}>{String(s).replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date range — applied in the query, so the balances and the
                headline totals describe the same window as the rows. The control
                itself is shared with the Overview so the two can't drift. */}
            <RangeSelect
              from={dateFrom}
              to={dateTo}
              onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
              showCustom={showCustom}
              onShowCustomChange={setShowCustom}
            />
          </div>
        </div>
      </div>

      {/* BALANCES */}
      <div className="bg-white rounded-[16px] px-4 py-3.5 mb-3" style={{ border: `1px solid ${LINE}` }}>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-3.5 w-3.5" style={{ color: MUT }} />
          <span className="text-[12.5px] font-bold tracking-tight">Balances by person</span>
          <span className="text-[11px]" style={{ color: MUT }}>
            {visiblePeople.length} with points
            {(summary?.byUser?.length ?? 0) > visiblePeople.length && !showInactivePeople
              ? ` · ${(summary?.byUser?.length ?? 0) - visiblePeople.length} inactive hidden`
              : ""}
          </span>
        </div>
        {loadingSummary ? (
          <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {visiblePeople.map((u) => {
              const unattributed = u.userId === UNATTRIBUTED;
              const pct = topBalance ? (u.points / topBalance) * 100 : 0;
              return (
                <button
                  key={u.userId}
                  onClick={() => setPerson(person === u.userId ? "all" : u.userId)}
                  className={`text-left rounded-[12px] px-3 py-2.5 transition-colors ${
                    person === u.userId ? "bg-primary/10" : "hover:bg-muted"
                  }`}
                  style={{ border: `1px solid ${person === u.userId ? "#d9caf9" : LINE}` }}
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-[12px] font-semibold truncate flex-1"
                      style={unattributed ? { color: "#a2650a" } : undefined}
                    >
                      {unattributed ? "Unattributed" : nameOf(u.userId)}
                    </span>
                    <span className="text-[14px] font-extrabold leading-none">{u.points.toLocaleString()}</span>
                  </div>
                  <div className="h-[5px] rounded-full mt-2 overflow-hidden" style={{ background: "#eceef4" }}>
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${pct}%`, background: unattributed ? "hsl(35 65% 55%)" : "hsl(var(--primary))" }}
                    />
                  </div>
                  <div className="text-[9.5px] mt-1.5" style={{ color: MUT }}>
                    {u.awards} awards · last {fmtDate(u.last)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* LEDGER */}
      <div className="bg-white rounded-[16px] overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${LINE}` }}>
          <span className="text-[12.5px] font-bold tracking-tight">All awards</span>
          <span className="text-[11px]" style={{ color: MUT }}>
            {loadingRows ? "loading…" : `showing ${filtered.length}${isFiltered ? " matching" : ""}`}
          </span>
          {isFiltered && (
            <span className="text-[11px] ml-auto" style={{ color: SEC }}>
              {shownTotal.toLocaleString()} pts in view
            </span>
          )}
          {(hasColFilters || sort) && (
            <button
              type="button"
              onClick={clearColumnState}
              className={`text-[11px] inline-flex items-center gap-1 rounded-[8px] px-2 py-1 hover:bg-[#f4f5f9] transition-colors ${
                isFiltered ? "" : "ml-auto"
              }`}
              style={{ border: `1px solid ${LINE}`, color: SEC }}
            >
              <X className="h-3 w-3" /> Reset columns
            </button>
          )}
        </div>

        {loadingRows && !rows.length ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !filtered.length ? (
          <div className="py-12 text-center text-sm" style={{ color: MUT }}>
            {rows.length ? "No awards match these filters." : "No points have been awarded yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className="px-2 py-1.5 whitespace-nowrap"
                      style={{ borderBottom: `1px solid ${LINE}`, background: "#fafbfd" }}
                    >
                      <ColumnHeader
                        label={c.label}
                        align={c.align}
                        dir={sort?.key === c.key ? sort.dir : null}
                        onSort={() => cycleSort(c.key)}
                        setSort={(dir) => setSort({ key: c.key, dir })}
                        options={optionsByColumn[c.key] ?? []}
                        selected={colFilters[c.key] ?? null}
                        onSelect={(next) => setColFilters((f) => ({ ...f, [c.key]: next }))}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: any) => {
                  const cat = categoryMeta(r.gamification_games?.category);
                  const unattributed = !r.user_id;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setRecordId(r.id)}
                      className="cursor-pointer hover:bg-[#f8f9fc]"
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: SEC, borderBottom: `1px solid #f2f3f7` }}>
                        {fmtDate(r.earned_at)}
                      </td>
                      <td className="px-4 py-2.5 font-semibold whitespace-nowrap"
                          style={{ borderBottom: `1px solid #f2f3f7`, color: unattributed ? "#a2650a" : INK }}>
                        {nameOf(r.user_id)}
                      </td>
                      <td className="px-4 py-2.5" style={{ borderBottom: `1px solid #f2f3f7` }}>
                        {r.gamification_actions?.action_name ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ borderBottom: `1px solid #f2f3f7` }}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: cat.ac }} />
                          <span style={{ color: SEC }}>{r.gamification_games?.name ?? "—"}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ borderBottom: `1px solid #f2f3f7` }}>
                        <span className="text-[10.5px] px-2 py-0.5 rounded-full"
                              style={{ background: PAGE, color: SEC }}>
                          {String(r.reference_type ?? "—").replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: MUT, borderBottom: `1px solid #f2f3f7` }}>
                        {fmtDate(r.expires_at)}
                      </td>
                      {/* A correction is a negative award. It rendered as
                          "+-1,425" in payout green before this. */}
                      <td className="px-4 py-2.5 text-right font-extrabold whitespace-nowrap"
                          style={{
                            color: Number(r.points || 0) < 0 ? "#b8501d" : "#178a5a",
                            borderBottom: `1px solid #f2f3f7`,
                          }}>
                        {Number(r.points || 0) > 0 ? "+" : ""}
                        {Number(r.points || 0).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {canLoadMore && !isFiltered && (
          <div className="px-4 py-3 flex justify-center" style={{ borderTop: `1px solid ${LINE}` }}>
            <button
              onClick={() => setLimit((l) => l + PAGE_STEP)}
              disabled={loadingRows}
              className="text-[12.5px] rounded-[10px] px-4 py-2 inline-flex items-center gap-2 hover:bg-[#f4f5f9] transition-colors disabled:opacity-60"
              style={{ border: `1px solid ${LINE}`, color: SEC }}
            >
              {loadingRows && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Load {PAGE_STEP} more
              <span style={{ color: MUT }}>
                ({rows.length} of {summary?.awards ?? "?"})
              </span>
            </button>
          </div>
        )}
      </div>

      {isFiltered && canLoadMore && (
        <div className="text-[11px] mt-2.5 px-1" style={{ color: MUT }}>
          Filters and sorting apply to the {rows.length} awards loaded so far — clear them to load the rest.
        </div>
      )}

      {/* A ledger row is a record, so it opens the record — the same panel the
          Overview's drill-down bottoms out at, rather than a second answer to
          the same question. */}
      <Dialog open={!!recordId} onOpenChange={(v) => { if (!v) setRecordId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[15px] text-left">Award detail</DialogTitle></DialogHeader>
          <div className="max-h-[64vh] overflow-y-auto -mx-1 px-1">
            <AwardRecordDetailById
              record={record}
              isLoading={recordLoading}
              error={recordError}
              rate={Number(settings?.point_conversion ?? 1)}
              onClose={() => setRecordId(null)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * One column heading: click the label to cycle sort (asc → desc → off), or open
 * the funnel to tick which values to keep. The value list is built from what is
 * actually in the column, so it never offers a value that matches nothing.
 *
 * "No filter" is represented by null rather than a full set, so ticking every
 * box is the same as not filtering and the funnel stops looking active.
 */
function ColumnHeader({
  label, align, dir, onSort, setSort, options, selected, onSelect,
}: {
  label: string;
  align: "left" | "right";
  dir: SortDir | null;
  onSort: () => void;
  setSort: (dir: SortDir) => void;
  options: string[];
  selected: Set<string> | null;
  onSelect: (next: Set<string> | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const needle = q.trim().toLowerCase();
  const shown = needle ? options.filter((o) => o.toLowerCase().includes(needle)) : options;
  const isOn = (o: string) => (selected ? selected.has(o) : true);

  const toggle = (o: string) => {
    const next = new Set(selected ?? options);
    if (next.has(o)) next.delete(o);
    else next.add(o);
    onSelect(next.size === options.length ? null : next);
  };

  const SortIcon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ChevronsUpDown;

  return (
    <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
      <button
        type="button"
        onClick={onSort}
        title={`Sort by ${label.toLowerCase()}`}
        className="group inline-flex items-center gap-1 rounded-[6px] px-2 py-1 hover:bg-[#eef0f6] transition-colors"
      >
        <span className="text-[9.5px] uppercase tracking-[0.1em] font-bold" style={{ color: dir ? INK : MUT }}>
          {label}
        </span>
        <SortIcon
          className={`h-3 w-3 shrink-0 transition-opacity ${dir ? "opacity-100" : "opacity-30 group-hover:opacity-70"}`}
          style={{ color: dir ? "hsl(var(--primary))" : MUT }}
        />
      </button>

      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(""); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={`Filter ${label.toLowerCase()}`}
            aria-label={`Filter ${label.toLowerCase()}`}
            className="w-[22px] h-[22px] rounded-[6px] inline-flex items-center justify-center hover:bg-[#eef0f6] transition-colors"
            style={selected ? { background: "hsl(var(--primary) / 0.12)" } : undefined}
          >
            <ListFilter className="h-3 w-3" style={{ color: selected ? "hsl(var(--primary))" : MUT }} />
          </button>
        </PopoverTrigger>

        <PopoverContent align={align === "right" ? "end" : "start"} className="w-[230px] p-2">
          <div className="flex gap-1 mb-2">
            <button
              type="button"
              onClick={() => setSort("asc")}
              className={`flex-1 text-[11.5px] rounded-[7px] px-2 py-1.5 inline-flex items-center justify-center gap-1 transition-colors ${
                dir === "asc" ? "bg-primary/10 text-primary" : "hover:bg-muted"
              }`}
            >
              <ArrowUp className="h-3 w-3" /> Asc
            </button>
            <button
              type="button"
              onClick={() => setSort("desc")}
              className={`flex-1 text-[11.5px] rounded-[7px] px-2 py-1.5 inline-flex items-center justify-center gap-1 transition-colors ${
                dir === "desc" ? "bg-primary/10 text-primary" : "hover:bg-muted"
              }`}
            >
              <ArrowDown className="h-3 w-3" /> Desc
            </button>
          </div>

          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}`}
            className="h-8 text-[12px] mb-1.5"
          />

          <div className="flex items-center justify-between px-1 pb-1.5">
            <span className="text-[10.5px]" style={{ color: MUT }}>
              {/* Counted against the options actually present — narrowing the
                  date range can drop values a filter still remembers, and
                  "5 of 3" would be nonsense. */}
              {selected
                ? `${options.filter((o) => selected.has(o)).length} of ${options.length}`
                : `All ${options.length}`}
            </span>
            {selected && (
              <button
                type="button"
                onClick={() => onSelect(null)}
                className="text-[10.5px] font-semibold text-primary hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="max-h-[210px] overflow-y-auto -mx-1 px-1">
            {!shown.length ? (
              <div className="py-4 text-center text-[11.5px]" style={{ color: MUT }}>No matches.</div>
            ) : (
              shown.map((o) => (
                <label
                  key={o}
                  className="group flex items-center gap-2 px-1.5 py-1 rounded-[6px] hover:bg-muted cursor-pointer"
                >
                  <Checkbox checked={isOn(o)} onCheckedChange={() => toggle(o)} />
                  <span className="text-[12px] truncate flex-1">{o}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); onSelect(new Set([o])); }}
                    className="text-[10px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    only
                  </button>
                </label>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
