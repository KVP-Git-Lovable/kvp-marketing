import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3, ChevronLeft, ChevronRight, Coins, Gamepad2, IndianRupee, Loader2,
  Percent, TrendingUp, Trophy, Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { categoryMeta } from "./constants";
import { RangeSelect } from "./RangeSelect";
import { DEFAULT_RANGE } from "./dateRange";
import { DistributionChart, SpendTrendChart } from "./OverviewCharts";
import {
  useActivities, useAwardRecord, useAwardRecords, useGamActivePeople, useGamProfiles,
  useGamSettings, usePointsRollup, usePrograms, useRevenueByUser, useSpendByMonth,
} from "./hooks";
import { AwardRecordDetailById } from "./AwardRecordDetail";

const PAGE = "#eef0f4";
const INK = "#1c2440";
const MUT = "#9aa1b5";
const SEC = "#5a6284";
const LINE = "#e7e9f0";

const nfPts = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const nfInr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPts = (n: number) => nfPts.format(n);
const fmtInr = (n: number) => `₹${nfInr.format(n)}`;
const fmtWhen = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" }) : "—";

const UNASSIGNED = "__unassigned__";
/** 3 staging awards (and potentially more later) carry a NULL user_id. They
 *  get their own row rather than being dropped, so the "by person" total
 *  always reconciles with the headline instead of quietly falling short. */
const NO_PERSON = "__no_person__";

type Drill =
  | { kind: "points" }
  | { kind: "rupees" }
  | { kind: "games" }
  | { kind: "users" }
  | { kind: "game"; id: string }
  | { kind: "user"; id: string }
  // The two levels that turn a summary into an answer. gameId/userId carry the
  // UNASSIGNED / NO_PERSON sentinels, so the "not linked to…" buckets drill too.
  | { kind: "records"; gameId: string; userId: string }
  | { kind: "record"; id: string };

/** The card keys that open a dialog; revenue and share deliberately do not. */
type DrillKind = "points" | "rupees" | "games" | "users";

/**
 * Overview — the module's dashboard. Everything on it is derived from ONE
 * aggregate (gamification_points_rollup, keyed by program × user), so the
 * headline totals, the per-program table and the per-person table are three
 * views of the same numbers rather than three queries that can disagree.
 *
 * Rupee value is per program: gamification_games.points_to_rupee_conversion is
 * "1 point = ₹N". This page only REPORTS it — it is set where the game is
 * configured (on create, and from any of its activities). Points not
 * attributed to any program fall back to the global point_conversion.
 */
export function GamificationOverview() {
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState(() => DEFAULT_RANGE()[0]);
  const [dateTo, setDateTo] = useState(() => DEFAULT_RANGE()[1]);
  const [showCustom, setShowCustom] = useState(false);
  /** The open drill-down, innermost last. Empty = closed. Kept as a stack so
   *  every level can be stepped back out of instead of closing the dialog. */
  const [drillStack, setDrillStack] = useState<Drill[]>([]);
  const openDrill = useCallback((d: Drill) => setDrillStack([d]), []);
  const pushDrill = useCallback((d: Drill) => setDrillStack((s) => [...s, d]), []);
  const popDrillTo = useCallback((i: number) => setDrillStack((s) => s.slice(0, i + 1)), []);

  const { data: programs = [], isLoading: loadingPrograms } = usePrograms();
  const { data: activities = [] } = useActivities();
  const { data: profiles = [] } = useGamProfiles();
  /** Everyone on the team right now. The page lists AGAINST this, so a rep
   *  who earned nothing is shown at zero instead of being absent — and
   *  deactivated people are gone from it, which is also what the roll-up
   *  below now does, so the list and the totals agree by construction. */
  const { data: people = [] } = useGamActivePeople();
  const { data: settings } = useGamSettings();
  const { data: rollup = [], isLoading: loadingRollup } = usePointsRollup(dateFrom, dateTo);

  const isLoading = loadingPrograms || loadingRollup;

  const programById = useMemo(
    () => new Map(programs.map((p: any) => [p.id, p])),
    [programs]
  );
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p: any) => m.set(p.id, p.full_name ?? "Unnamed"));
    people.forEach((p) => m.set(p.id, p.full_name ?? "Unnamed"));
    return m;
  }, [profiles, people]);

  const globalRate = Number(settings?.point_conversion ?? 1);
  /** Rupees per point for a program; unattributed points use the global rate.
   *  Memoised so the roll-ups below can depend on it honestly.
   *
   *  The per-game rate falls back to the GLOBAL rate, not to 1:
   *  gamification_games.points_to_rupee_conversion no longer exists, so every
   *  attributed award was being valued at ₹1 a point whatever the policy said.
   *  That was invisible only because the configured rate is currently 1. */
  const rateFor = useCallback(
    (gameId: string | null) => {
      const p: any = gameId ? programById.get(gameId) : null;
      return Number(p?.points_to_rupee_conversion ?? globalRate);
    },
    [programById, globalRate]
  );

  const activityCount = useMemo(() => {
    const m = new Map<string, number>();
    activities.forEach((a: any) => m.set(a.game_id, (m.get(a.game_id) ?? 0) + 1));
    return m;
  }, [activities]);

  /** Per program, over the selected window. Active programs with no points still
   *  appear — "this one has earned nothing yet" is information too. Retired ones
   *  do not get that courtesy row: they are listed only when they actually earned
   *  something in the window, because dropping them outright would take their
   *  points out of the totals below and make the page disagree with the ledger.
   *  Such a row keeps its "Inactive" badge so it reads as history, not as live. */
  const byGame = useMemo(() => {
    const m = new Map<string, { points: number; awards: number; users: Set<string>; last: string | null }>();
    const touch = (k: string) =>
      m.get(k) ?? m.set(k, { points: 0, awards: 0, users: new Set(), last: null }).get(k)!;
    rollup.forEach((r) => {
      const k = r.gameId ?? UNASSIGNED;
      const cur = touch(k);
      cur.points += r.points;
      cur.awards += r.awards;
      if (r.userId) cur.users.add(r.userId);
      if (r.lastEarned && (!cur.last || r.lastEarned > cur.last)) cur.last = r.lastEarned;
    });
    programs.forEach((p: any) => { if (p.is_active) touch(p.id); });

    return Array.from(m.entries())
      .map(([id, v]) => {
        const program: any = programById.get(id);
        const rate = rateFor(id === UNASSIGNED ? null : id);
        return {
          id,
          program,
          name: program?.name ?? "Not linked to a game",
          rate,
          rupees: v.points * rate,
          activities: activityCount.get(id) ?? 0,
          ...v,
        };
      })
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  }, [rollup, programs, programById, activityCount, rateFor]);

  /** Per person. Rupees are summed per (person, program) pair, because the rate
   *  belongs to the program — a single blended rate would be wrong. */
  const byUser = useMemo(() => {
    const m = new Map<string, { points: number; rupees: number; awards: number; games: Set<string>; last: string | null }>();
    rollup.forEach((r) => {
      const key = r.userId ?? NO_PERSON;
      const cur = m.get(key) ?? { points: 0, rupees: 0, awards: 0, games: new Set<string>(), last: null };
      cur.points += r.points;
      cur.rupees += r.points * rateFor(r.gameId);
      cur.awards += r.awards;
      if (r.gameId) cur.games.add(r.gameId);
      if (r.lastEarned && (!cur.last || r.lastEarned > cur.last)) cur.last = r.lastEarned;
      m.set(key, cur);
    });
    // Everyone currently on the team gets a row. "Nobody in this branch
    // scored" is the finding the report is opened for, and a person who is
    // simply absent reads as if they took part. Nothing is added to any
    // total by this — the points still come only from the roll-up.
    people.forEach((p) => {
      if (!m.has(p.id)) m.set(p.id, { points: 0, rupees: 0, awards: 0, games: new Set<string>(), last: null });
    });
    return Array.from(m.entries())
      .map(([id, v]) => ({
        id,
        name: id === NO_PERSON ? "Not linked to a person" : nameById.get(id) ?? "Unknown user",
        ...v,
      }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  }, [rollup, nameById, rateFor, people]);

  /** Revenue is scoped to the same window as everything else on the page, so a
   *  cost ratio compares like with like. No window means all time. */
  const revFrom = useMemo(() => (dateFrom ? new Date(`${dateFrom}T00:00:00`) : new Date("2000-01-01")), [dateFrom]);
  const revTo = useMemo(() => (dateTo ? new Date(`${dateTo}T23:59:59`) : new Date()), [dateTo]);
  const { data: revenueRows = [] } = useRevenueByUser(revFrom, revTo);
  const { data: spendRows = [], isLoading: spendLoading } = useSpendByMonth(12);
  const revenueById = useMemo(
    () => new Map(revenueRows.map((r) => [r.user_id, r])),
    [revenueRows],
  );

  const totalPoints = byGame.reduce((s, g) => s + g.points, 0);
  const totalRupees = byGame.reduce((s, g) => s + g.rupees, 0);
  const activeGames = programs.filter((p: any) => p.is_active).length;
  // The card says "People earning", so it counts people who earned. The list
  // behind it is longer on purpose — it also shows who did not.
  const peopleEarning = byUser.filter((u) => u.id !== NO_PERSON && u.awards > 0).length;

  const totalRevenue = revenueRows.reduce((s, r) => s + r.revenue, 0);
  const totalOrders = revenueRows.reduce((s, r) => s + r.orders, 0);
  /** The question the company actually asks: of what we sold, how much went
   *  back out as rewards. Null rather than 0% when nothing was sold, because
   *  "0% of nothing" reads as good news. */
  const spendShare = totalRevenue > 0 ? (totalRupees / totalRevenue) * 100 : null;

  const cards = [
    {
      key: "points" as const, icon: Coins, tint: "#fdf3e3", ink: "#b8860b",
      value: fmtPts(totalPoints), label: "Total points earned",
      sub: `${rollup.reduce((s, r) => s + r.awards, 0).toLocaleString()} awards`,
    },
    {
      key: "rupees" as const, icon: IndianRupee, tint: "#e9f7ef", ink: "#178a5a",
      value: fmtInr(totalRupees), label: "Spent on rewards",
      sub: "at each game's point rate",
    },
    {
      key: "revenue" as const, icon: TrendingUp, tint: "#eaf6ff", ink: "#0369a1",
      value: totalRevenue ? fmtInr(totalRevenue) : "—", label: "Revenue booked",
      sub: totalOrders ? `${totalOrders.toLocaleString()} orders in this period` : "no orders in this period",
      // no drill: the dialogs rank by points, and opening one from a revenue
      // card would answer a different question than the one that was clicked
      flat: true,
    },
    {
      key: "share" as const, icon: Percent, tint: "#fdf0f0", ink: "#c0392b",
      value: spendShare === null ? "—" : `${spendShare < 0.01 ? "<0.01" : spendShare.toFixed(2)}%`,
      label: "Rewards as share of revenue",
      sub: spendShare === null ? "needs revenue in this period" : `${fmtInr(totalRupees)} of ${fmtInr(totalRevenue)}`,
      flat: true,
    },
    {
      key: "games" as const, icon: Gamepad2, tint: "#eaf1fe", ink: "#2a63c8",
      value: `${activeGames}`, label: "Active games",
      sub: `${programs.length} in total`,
    },
    {
      key: "users" as const, icon: Users, tint: "#f2edff", ink: "#5A2DD8",
      value: `${peopleEarning}`, label: "People earning",
      sub: dateFrom || dateTo ? "in this period" : "all time",
    },
  ];

  return (
    <div style={{ color: INK }}>
      {/* HEADER — sticks below the tab bar like every other section */}
      <div
        className="sticky top-[94px] sm:top-[57px] z-10 -mx-1 px-1 py-3 mb-4 backdrop-blur"
        style={{ background: `${PAGE}f0` }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] rounded-[10px] bg-primary/10 text-primary flex items-center justify-center">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[15px] font-bold tracking-tight leading-tight">Overview</div>
              <div className="text-[11.5px] mt-0.5" style={{ color: MUT }}>
                Points and reward value by game and by person
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
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

      {isLoading ? (
        <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* KPI CARDS */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {cards.map((c) => {
              const flat = "flat" in c && c.flat;
              const Tag: any = flat ? "div" : "button";
              return (
                <Tag
                  key={c.key}
                  {...(flat
                    ? {}
                    : { type: "button", onClick: () => openDrill({ kind: c.key as DrillKind }) })}
                  className={`group bg-white rounded-[20px] p-5 text-left transition-all duration-300 ${
                    flat ? "" : "hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgba(28,36,64,.45)]"
                  }`}
                  style={{ border: `1px solid ${LINE}` }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-[38px] h-[38px] rounded-[12px] flex items-center justify-center shrink-0"
                         style={{ background: c.tint, color: c.ink }}>
                      <c.icon className="h-[18px] w-[18px]" />
                    </div>
                    {!flat && (
                      <ChevronRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{ color: MUT }} />
                    )}
                  </div>
                  <div className="text-[23px] font-extrabold leading-none mt-3.5 tracking-tight">{c.value}</div>
                  <div className="text-[12px] font-semibold mt-1.5 leading-snug">{c.label}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: MUT }}>{c.sub}</div>
                </Tag>
              );
            })}
          </div>

          {/* CHARTS — the same numbers as the tables below, read at a glance.
              Every mark drills to the same dialog a table row opens. */}
          <div className="grid gap-4 xl:grid-cols-2">
            <DistributionChart
              title="Points by game"
              hint="Who is paying out, and what it is worth"
              rows={byGame.map((g) => ({ id: g.id, name: g.name, points: g.points, rupees: g.rupees }))}
              storageKey="gam.overview.byGameChart"
              onPick={(id) => openDrill({ kind: "game", id })}
            />
            <DistributionChart
              title="Points by person"
              hint="Who is earning, best first"
              rows={byUser.filter((u) => u.points > 0).map((u) => ({ id: u.id, name: u.name, points: u.points, rupees: u.rupees }))}
              storageKey="gam.overview.byUserChart"
              onPick={(id) => openDrill({ kind: "user", id })}
            />
          </div>

          <SpendTrendChart rows={spendRows} loading={spendLoading} />

          {/* BY GAME */}
          <Panel
            title="By game"
            hint="Click a row for who earned it. Point value is set on the game."
            count={byGame.length}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px] min-w-[720px]">
                <Head cols={["Game", "Activities", "People", "Awards", "Points", "1 pt = ₹", "Value", ""]} />
                <tbody>
                  {byGame.map((g) => {
                    const cat = categoryMeta(g.program?.category);
                    return (
                      <tr
                        key={g.id}
                        onClick={g.awards > 0 ? () => openDrill({ kind: "game", id: g.id }) : undefined}
                        className={`${g.awards > 0 ? "cursor-pointer hover:bg-[#f7f8fb]" : ""} transition-colors`}
                        style={{ borderTop: `1px solid ${LINE}` }}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-[24px] h-[24px] rounded-[8px] flex items-center justify-center shrink-0"
                                 style={{ background: cat.fill, color: cat.ac }}>
                              <Trophy className="h-[12px] w-[12px]" />
                            </div>
                            <span className="font-medium truncate">{g.name}</span>
                            {g.program && !g.program.is_active && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                                    style={{ background: "#f1f2f7", color: MUT }}>Inactive</span>
                            )}
                          </div>
                        </td>
                        <Num>{g.activities}</Num>
                        <Num>{g.users.size}</Num>
                        <Num>{g.awards.toLocaleString()}</Num>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums">{fmtPts(g.points)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: SEC }}>
                          ₹{g.rate}
                          {!g.program && <span className="ml-1" style={{ color: MUT }}>(global)</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: "#178a5a" }}>
                          {fmtInr(g.rupees)}
                        </td>
                        <td className="px-3 py-2.5 w-[30px]">
                          {g.awards > 0 && <ChevronRight className="h-4 w-4" style={{ color: MUT }} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <Foot>
                  <td className="px-4 py-2.5 font-bold">Total</td>
                  <td colSpan={3} />
                  <td className="px-3 py-2.5 text-right font-extrabold tabular-nums">{fmtPts(totalPoints)}</td>
                  <td />
                  <td className="px-3 py-2.5 text-right font-extrabold tabular-nums" style={{ color: "#178a5a" }}>
                    {fmtInr(totalRupees)}
                  </td>
                  <td />
                </Foot>
              </table>
            </div>
          </Panel>

          {/* BY PERSON */}
          <Panel title="By person" hint="Click a row to see which games they earned from." count={byUser.length}>
            {!byUser.length ? (
              <Empty>No points earned in this period.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] min-w-[780px]">
                  <Head cols={["Person", "Games", "Awards", "Points", "Incentive", "Revenue booked", "Cost of revenue", "Last earned", ""]} />
                  <tbody>
                    {byUser.map((u) => (
                      <tr
                        key={u.id}
                        onClick={u.awards > 0 ? () => openDrill({ kind: "user", id: u.id }) : undefined}
                        className={`${u.awards > 0 ? "cursor-pointer hover:bg-[#f7f8fb]" : ""} transition-colors`}
                        style={{ borderTop: `1px solid ${LINE}` }}
                      >
                        <td className="px-4 py-2.5 font-medium">{u.name}</td>
                        <Num>{u.games.size}</Num>
                        <Num>{u.awards.toLocaleString()}</Num>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums">{fmtPts(u.points)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: "#178a5a" }}>
                          {fmtInr(u.rupees)}
                        </td>
                        {(() => {
                          const rev = revenueById.get(u.id)?.revenue ?? 0;
                          // What the incentive costs per rupee booked. Revenue is
                          // what they sold, not revenue the scheme caused — the
                          // ratio is a cost check, not an attribution claim.
                          const ratio = rev > 0 ? (u.rupees / rev) * 100 : null;
                          return (
                            <>
                              <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: rev ? INK : MUT }}>
                                {rev ? fmtInr(rev) : "—"}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: MUT }}>
                                {ratio === null ? "—" : `${ratio < 0.01 ? "<0.01" : ratio.toFixed(2)}%`}
                              </td>
                            </>
                          );
                        })()}
                        <td className="px-3 py-2.5 text-right" style={{ color: SEC }}>{fmtWhen(u.last)}</td>
                        <td className="px-3 py-2.5 w-[30px]">
                          {u.awards > 0 && <ChevronRight className="h-4 w-4" style={{ color: MUT }} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <Foot>
                    <td className="px-4 py-2.5 font-bold">Total</td>
                    <td colSpan={2} />
                    <td className="px-3 py-2.5 text-right font-extrabold tabular-nums">
                      {fmtPts(byUser.reduce((s, u) => s + u.points, 0))}
                    </td>
                    <td className="px-3 py-2.5 text-right font-extrabold tabular-nums" style={{ color: "#178a5a" }}>
                      {fmtInr(byUser.reduce((s, u) => s + u.rupees, 0))}
                    </td>
                    {(() => {
                      const rev = revenueRows.reduce((s, r) => s + r.revenue, 0);
                      const inc = byUser.reduce((s, u) => s + u.rupees, 0);
                      const ratio = rev > 0 ? (inc / rev) * 100 : null;
                      return (
                        <>
                          <td className="px-3 py-2.5 text-right font-extrabold tabular-nums">{rev ? fmtInr(rev) : "—"}</td>
                          <td className="px-3 py-2.5 text-right font-extrabold tabular-nums" style={{ color: MUT }}>
                            {ratio === null ? "—" : `${ratio < 0.01 ? "<0.01" : ratio.toFixed(2)}%`}
                          </td>
                        </>
                      );
                    })()}
                    <td colSpan={2} />
                  </Foot>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}

      <DrillStack
        stack={drillStack}
        onPush={pushDrill}
        onPopTo={popDrillTo}
        onClose={() => setDrillStack([])}
        byGame={byGame}
        byUser={byUser}
        rollup={rollup}
        people={people}
        nameById={nameById}
        programById={programById}
        rateFor={rateFor}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onOpenProgram={(id) => { setDrillStack([]); navigate(`/gamification-admin/program/${id}`); }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- bits ---- */

const Panel = ({
  title, hint, count, children,
}: { title: string; hint?: string; count?: number; children: React.ReactNode }) => (
  <div className="bg-white rounded-[20px] overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
    <div className="px-4 py-3 flex items-baseline gap-2.5 flex-wrap" style={{ borderBottom: `1px solid ${LINE}` }}>
      <span className="text-[13px] font-bold tracking-tight">{title}</span>
      {count !== undefined && <span className="text-[11px]" style={{ color: MUT }}>{count}</span>}
      {hint && <span className="text-[11px] ml-auto" style={{ color: MUT }}>{hint}</span>}
    </div>
    {children}
  </div>
);

const Head = ({ cols }: { cols: string[] }) => (
  <thead>
    <tr className="text-[10.5px] uppercase tracking-[0.06em]" style={{ color: MUT }}>
      {cols.map((c, i) => (
        <th key={c + i} className={`px-3 py-2 font-medium ${i === 0 ? "text-left px-4" : "text-right"}`}>{c}</th>
      ))}
    </tr>
  </thead>
);

const Foot = ({ children }: { children: React.ReactNode }) => (
  <tfoot>
    <tr style={{ borderTop: `2px solid ${LINE}`, background: "#fafbfd" }}>{children}</tr>
  </tfoot>
);

const Num = ({ children }: { children: React.ReactNode }) => (
  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: SEC }}>{children}</td>
);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="px-4 py-8 text-center text-[12.5px]" style={{ color: MUT }}>{children}</div>
);

/**
 * The drill-down, as a STACK.
 *
 * It used to be a single view that closed: clicking a game showed who earned
 * it and that was the end of the road, so "which awards are those?" had no
 * answer and level 2 looked like a repeat of level 1. Now every level pushes
 * onto a stack with a breadcrumb, and the bottom of it is the individual
 * award — the same record a Points-ledger row opens.
 *
 * The rows still come from the one roll-up the whole page is derived from, so
 * a summary and the records beneath it can never disagree.
 */
function DrillStack({
  stack, onPush, onPopTo, onClose, byGame, byUser, rollup, people, nameById, programById,
  rateFor, dateFrom, dateTo, onOpenProgram,
}: {
  stack: Drill[];
  onPush: (d: Drill) => void;
  onPopTo: (i: number) => void;
  onClose: () => void;
  byGame: any[];
  byUser: any[];
  rollup: { gameId: string | null; userId: string | null; points: number; awards: number; lastEarned: string | null }[];
  people: { id: string; full_name: string }[];
  nameById: Map<string, string>;
  programById: Map<string, any>;
  rateFor: (id: string | null) => number;
  dateFrom: string;
  dateTo: string;
  onOpenProgram: (id: string) => void;
}) {
  const view = stack.length ? stack[stack.length - 1] : null;

  // Both queries are declared unconditionally and disabled unless their level
  // is the one on screen — hooks cannot be called behind an early return.
  const recordsView = view?.kind === "records" ? view : null;
  const { data: records = [], isLoading: recordsLoading } = useAwardRecords(
    recordsView && recordsView.gameId !== UNASSIGNED ? recordsView.gameId : null,
    recordsView && recordsView.userId !== NO_PERSON ? recordsView.userId : null,
    dateFrom,
    dateTo,
    !!recordsView,
  );
  const recordView = view?.kind === "record" ? view : null;
  const { data: record, isLoading: recordLoading, error: recordError } = useAwardRecord(recordView?.id);

  if (!view) return null;

  const gameName = (id: string | null) =>
    (id && id !== UNASSIGNED ? programById.get(id)?.name : null) ?? "Not linked to a game";
  const personName = (id: string | null) =>
    !id || id === NO_PERSON
      ? "Not linked to a person"
      : nameById.get(id) ?? people.find((p) => p.id === id)?.full_name ?? "Unknown user";

  /** What each level is called in the breadcrumb — short, because the title
   *  above it already says the long version. */
  const crumb = (d: Drill): string => {
    switch (d.kind) {
      case "points": return "Points by game";
      case "rupees": return "Value by game";
      case "games": return "All games";
      case "users": return "By person";
      case "game": return gameName(d.id);
      case "user": return personName(d.id);
      case "records": return "Records";
      case "record": return "Detail";
    }
  };

  type Row = {
    key: string;
    label: string;
    extra?: string;
    points: number;
    rupees: number;
    awards: number;
    /** Absent = terminal. A row with nothing under it must not look clickable. */
    next?: Drill;
  };

  let title = "";
  let rows: Row[] = [];
  let footer: React.ReactNode = null;
  let body: React.ReactNode = null;

  if (view.kind === "points" || view.kind === "rupees" || view.kind === "games") {
    title =
      view.kind === "points" ? "Points earned by game"
      : view.kind === "rupees" ? "Reward value by game"
      : "All games";
    rows = byGame.map((g) => ({
      key: g.id,
      label: g.name,
      extra:
        view.kind === "games"
          ? `${g.program?.is_active ? "Active" : "Inactive"} · ${g.activities} activities`
          : `1 pt = ₹${g.rate}`,
      points: g.points,
      rupees: g.rupees,
      awards: g.awards,
      // A game nobody has earned from has no records to show; it still lists,
      // because "this one has paid nothing" is information.
      next: g.awards > 0 ? ({ kind: "game", id: g.id } as Drill) : undefined,
    }));
  } else if (view.kind === "users") {
    title = "Points earned by person";
    rows = byUser.map((u) => ({
      key: u.id,
      label: u.name,
      extra: u.awards > 0 ? `${u.games.size} games` : "nothing earned in this period",
      points: u.points,
      rupees: u.rupees,
      awards: u.awards,
      next: u.awards > 0 ? ({ kind: "user", id: u.id } as Drill) : undefined,
    }));
  } else if (view.kind === "game") {
    title = `${gameName(view.id)} — who earned it`;
    const rate = rateFor(view.id === UNASSIGNED ? null : view.id);
    // Awards with no person are kept: they are part of this game's total, and
    // dropping them made the dialog fail to add up to the row that opened it.
    const earned = new Map(
      rollup
        .filter((r) => (r.gameId ?? UNASSIGNED) === view.id)
        .map((r) => [r.userId ?? NO_PERSON, r] as const)
    );
    // The answer to "who earned it" includes the people who did not. The list
    // is therefore the roster plus whatever the roll-up holds, never the
    // roll-up alone.
    const keys = Array.from(new Set([...people.map((p) => p.id), ...earned.keys()]));
    rows = keys
      .map((k) => {
        const r = earned.get(k);
        const points = r?.points ?? 0;
        const awards = r?.awards ?? 0;
        return {
          key: k,
          label: personName(k === NO_PERSON ? null : k),
          extra: awards ? undefined : "nothing earned in this period",
          points,
          rupees: points * rate,
          awards,
          // No records behind a zero row, so it is terminal.
          next: awards ? ({ kind: "records", gameId: view.id, userId: k } as Drill) : undefined,
        };
      })
      .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label));
    if (view.id !== UNASSIGNED) {
      footer = (
        <button
          type="button"
          onClick={() => onOpenProgram(view.id)}
          className="text-[12.5px] font-semibold text-primary hover:underline inline-flex items-center gap-1.5"
        >
          Open this game's setup <ChevronRight className="h-3.5 w-3.5" />
        </button>
      );
    }
  } else if (view.kind === "user") {
    title = `${personName(view.id)} — where the points came from`;
    rows = rollup
      .filter((r) => (r.userId ?? NO_PERSON) === view.id)
      .map((r) => ({
        key: r.gameId ?? UNASSIGNED,
        label: gameName(r.gameId),
        extra: `1 pt = ₹${rateFor(r.gameId)}`,
        points: r.points,
        rupees: r.points * rateFor(r.gameId),
        awards: r.awards,
        next: { kind: "records", gameId: r.gameId ?? UNASSIGNED, userId: view.id } as Drill,
      }))
      .sort((a, b) => b.points - a.points);
  } else if (view.kind === "records") {
    title = `${personName(view.userId)} · ${gameName(view.gameId)}`;
    const rate = rateFor(view.gameId === UNASSIGNED ? null : view.gameId);
    if (recordsLoading) {
      body = <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
    } else {
      rows = records.map((a) => ({
        key: a.id,
        label: a.points < 0 ? "Correction" : a.retailer_name ?? a.activity ?? "Award",
        extra: [
          fmtWhen(a.earned_at),
          a.tier_pct != null ? `tier ${a.tier_pct}%` : null,
          a.order_value != null ? `order ${fmtInr(a.order_value)}` : null,
          a.retailer_name && a.activity ? a.activity : null,
        ].filter(Boolean).join(" · "),
        points: a.points,
        rupees: a.points * rate,
        awards: 1,
        next: { kind: "record", id: a.id } as Drill,
      }));
    }
  } else {
    title = "Award detail";
    body = (
      <AwardRecordDetailById
        record={record}
        isLoading={recordLoading}
        error={recordError}
        rate={rateFor(record?.game_id ?? null)}
        onClose={onClose}
        onOpenGame={(id) => onPush({ kind: "game", id })}
        onOpenPerson={(id) => onPush({ kind: "user", id })}
      />
    );
  }

  const totalPoints = rows.reduce((s, r) => s + r.points, 0);
  const totalRupees = rows.reduce((s, r) => s + r.rupees, 0);

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 pr-6">
            {stack.length > 1 && (
              <button
                type="button"
                onClick={() => onPopTo(stack.length - 2)}
                aria-label="Back"
                className="shrink-0 rounded-[8px] w-7 h-7 flex items-center justify-center hover:bg-[#f1f2f7]"
                style={{ border: `1px solid ${LINE}`, color: SEC }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <DialogTitle className="text-[15px] text-left truncate">{title}</DialogTitle>
          </div>
        </DialogHeader>

        {stack.length > 1 && (
          <div className="flex flex-wrap items-center gap-1 text-[11px] -mt-1" style={{ color: MUT }}>
            {stack.map((d, i) =>
              i === stack.length - 1 ? (
                <span key={i} className="px-1 font-semibold" style={{ color: SEC }}>{crumb(d)}</span>
              ) : (
                <span key={i} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onPopTo(i)}
                    className="px-1 rounded font-semibold text-primary hover:underline"
                  >
                    {crumb(d)}
                  </button>
                  <ChevronRight className="h-3 w-3" />
                </span>
              )
            )}
          </div>
        )}

        {body ? (
          <div className="max-h-[58vh] overflow-y-auto -mx-1 px-1">{body}</div>
        ) : !rows.length ? (
          <div className="py-8 text-center text-[12.5px]" style={{ color: MUT }}>Nothing in this period.</div>
        ) : (
          <div className="max-h-[52vh] overflow-y-auto -mx-1 px-1">
            <table className="w-full text-[12.5px]">
              <Head cols={["", "Awards", "Points", "Value", ""]} />
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    onClick={r.next ? () => onPush(r.next!) : undefined}
                    className={r.next ? "cursor-pointer hover:bg-[#f7f8fb] transition-colors" : ""}
                    style={{ borderTop: `1px solid ${LINE}` }}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium truncate">{r.label}</div>
                      {r.extra && <div className="text-[11px] mt-0.5" style={{ color: MUT }}>{r.extra}</div>}
                    </td>
                    <Num>{r.awards.toLocaleString()}</Num>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">{fmtPts(r.points)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums"
                        style={{ color: r.points < 0 ? "#b8501d" : "#178a5a" }}>
                      {fmtInr(r.rupees)}
                    </td>
                    {/* The cell is reserved whatever the row does, so a terminal
                        row does not shift its neighbours — but the chevron only
                        appears where there is somewhere to go. */}
                    <td className="px-2 py-2.5 w-[26px]">
                      {r.next && <ChevronRight className="h-4 w-4" style={{ color: MUT }} />}
                    </td>
                  </tr>
                ))}
              </tbody>
              <Foot>
                <td className="px-4 py-2.5 font-bold">Total</td>
                <td />
                <td className="px-3 py-2.5 text-right font-extrabold tabular-nums">{fmtPts(totalPoints)}</td>
                <td className="px-3 py-2.5 text-right font-extrabold tabular-nums" style={{ color: "#178a5a" }}>
                  {fmtInr(totalRupees)}
                </td>
                <td />
              </Foot>
            </table>
          </div>
        )}

        {footer && <div className="pt-1">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}
