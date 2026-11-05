import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Gamepad2, Plus, Trophy, Loader2, HelpCircle, ExternalLink,
  LayoutGrid, Columns2, List, ChevronRight, Eye, EyeOff,
} from "lucide-react";
import { categoryMeta, ProgramViewMode } from "./constants";
import { useActivities, useProgramUsage, usePrograms } from "./hooks";
import { ProgramForm } from "./ProgramForm";
import { ProgramActions } from "./ProgramActions";


const PAGE = "#eef0f4";
const INK = "#1c2440";
const MUT = "#9aa1b5";
const SEC = "#5a6284";
const LINE = "#e7e9f0";

/** `view` is owned by the Games page so one switcher drives this list AND the
 *  activities below it; the local fallback keeps the component standalone. */
export function GamificationHome({
  view: viewProp,
  onViewChange,
}: {
  view?: ProgramViewMode;
  onViewChange?: (v: ProgramViewMode) => void;
} = {}) {
  const navigate = useNavigate();
  const { data: programs = [], isLoading } = usePrograms();
  const { data: allActivities = [] } = useActivities();
  // Drives whether each card may offer Delete — see ProgramActions.
  const { data: usageByGame } = useProgramUsage();
  const [createOpen, setCreateOpen] = useState(false);
  const [localView, setLocalView] = useState<ProgramViewMode>("grid3");
  const view = viewProp ?? localView;
  const setView = (v: ProgramViewMode) => (onViewChange ? onViewChange(v) : setLocalView(v));

  /** Retired games stay in the table because their points and history still
   *  reference them, so the list hides them by default and offers them back
   *  behind a toggle rather than making someone scroll past games nobody runs. */
  const [showInactive, setShowInactive] = useState(false);
  const inactiveCount = programs.filter((p: any) => !p.is_active).length;
  const visiblePrograms = showInactive ? programs : programs.filter((p: any) => p.is_active);

  const gridClass =
    view === "grid3"
      ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6"
      : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";

  return (
    <div style={{ color: INK }}>
      {/* SECTION LABEL — sticks below the tab bar (taller on mobile, where tabs wrap to two rows) */}
      <div className="sticky top-[94px] sm:top-[57px] z-10 -mx-1 px-1 py-3 mb-4 backdrop-blur" style={{ background: `${PAGE}f0` }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] rounded-[10px] bg-primary/10 text-primary flex items-center justify-center">
              <Gamepad2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[15px] font-bold tracking-tight leading-tight" style={{ color: INK }}>Reward Games</div>
              <div className="text-[11.5px] mt-0.5" style={{ color: MUT }}>Manage and monitor your reward games</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {inactiveCount > 0 && (
              <button
                onClick={() => setShowInactive((v) => !v)}
                aria-pressed={showInactive}
                title={showInactive ? "Hide inactive games" : "Show inactive games"}
                className={`text-[12.5px] font-semibold rounded-[10px] px-3 py-2 inline-flex items-center gap-1.5 transition-colors ${
                  showInactive ? "bg-primary/10 text-primary" : "bg-white hover:bg-[#f4f5f9]"
                }`}
                style={showInactive
                  ? { border: "1px solid transparent" }
                  : { border: `1px solid ${LINE}`, color: SEC }}
              >
                {showInactive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showInactive ? "Hide inactive" : `Inactive (${inactiveCount})`}
              </button>
            )}
            <div className="inline-flex bg-white rounded-[10px] p-0.5" style={{ border: `1px solid ${LINE}` }}>
              {([["grid3", LayoutGrid, "Small cards"], ["grid2", Columns2, "Large cards"], ["list", List, "List"]] as const).map(([v, Icon, title]) => (
                <button key={v} onClick={() => setView(v)} title={title} aria-label={title} aria-pressed={view === v}
                        className={`w-[30px] h-7 rounded-[8px] flex items-center justify-center transition-colors ${view === v ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            <button onClick={() => setCreateOpen(true)}
                    className="text-[12.5px] font-semibold bg-primary text-primary-foreground rounded-[12px] px-4 py-2.5 inline-flex items-center gap-1.5 transition-opacity hover:opacity-90"
                    >
              <Plus className="h-4 w-4" /> New game
            </button>
          </div>
        </div>
      </div>

      {/* PROGRAMS — cards, or a real list when the switcher says so */}
      {isLoading ? (
        <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !visiblePrograms.length ? (
        <div className="bg-white rounded-[20px] p-8 text-center text-sm" style={{ border: `1px solid ${LINE}`, color: MUT }}>
          {programs.length
            ? `No active games — ${inactiveCount} inactive. Use “Inactive (${inactiveCount})” above to see them.`
            : "No programs yet — create your first reward program."}
        </div>
      ) : view === "list" ? (
        <div className="bg-white rounded-[16px] overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
          {visiblePrograms.map((p: any, i: number) => {
            const cat = categoryMeta(p.category);
            const acts = allActivities.filter((a: any) => a.game_id === p.id);
            const on = acts.filter((a: any) => a.is_enabled).length;
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-[#f7f8fb]"
                style={i ? { borderTop: `1px solid ${LINE}` } : undefined}
              >
                <button
                  type="button"
                  onClick={() => navigate(`/gamification-admin/program/${p.id}`)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div className="w-[28px] h-[28px] rounded-[9px] flex items-center justify-center shrink-0"
                       style={{ background: cat.fill, color: cat.ac }}>
                    <Trophy className="h-[14px] w-[14px]" />
                  </div>
                  <span className="text-[13.5px] font-semibold tracking-tight truncate"
                        style={{ flex: "0 1 auto", minWidth: 0 }}>
                    {p.name}
                  </span>
                  <span className="text-[10.5px] px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: cat.fill, color: cat.tx }}>
                    {cat.label}
                  </span>
                  <span className="text-[11.5px] shrink-0" style={{ color: MUT }}>
                    {on}/{acts.length} activities
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 ml-auto hidden sm:block" style={{ color: MUT }} />
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                        style={{ background: p.is_active ? "#e9f7ef" : "#f1f2f7", color: p.is_active ? "#178a5a" : MUT }}>
                    {p.is_active ? "Active" : "Inactive"}
                  </span>
                  <ProgramActions
                    program={p}
                    usage={usageByGame?.get(p.id)}
                    iconClassName="text-[#9aa1b5] hover:text-[#5a6284]"
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={gridClass}>
          {visiblePrograms.map((p: any) => {
            const cat = categoryMeta(p.category);
            const acts = allActivities.filter((a: any) => a.game_id === p.id);
            const on = acts.filter((a: any) => a.is_enabled).length;
            return (
              <div
                key={p.id}
                onClick={() => navigate(`/gamification-admin/program/${p.id}`)}
                className="group rounded-[20px] p-5 relative cursor-pointer bg-white transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_18px_40px_-24px_rgba(28,36,64,.45)] flex flex-col min-h-[186px]"
                style={{ border: `1px solid ${LINE}` }}
              >
                <div className="mb-3 w-[42px] h-[42px] rounded-[13px] flex items-center justify-center shrink-0"
                     style={{ background: cat.fill, color: cat.ac }}>
                  <Trophy className="h-[20px] w-[20px]" />
                </div>
                <div>
                  <div className="text-[15px] font-bold tracking-tight truncate" style={{ color: INK }}>{p.name}</div>
                  <div className="text-[11.5px] mt-0.5" style={{ color: MUT }}>{cat.label}</div>
                </div>
                <div className="flex items-center gap-5 mt-auto pt-3.5" style={{ borderTop: `1px solid ${LINE}` }}>
                  <div className="flex flex-col">
                    <span className="text-[19px] font-extrabold leading-none" style={{ color: cat.tx }}>{on}</span>
                    <span className="text-[9px] uppercase tracking-[0.08em] mt-1" style={{ color: MUT }}>active</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[19px] font-extrabold leading-none" style={{ color: INK }}>{acts.length}</span>
                    <span className="text-[9px] uppercase tracking-[0.08em] mt-1" style={{ color: MUT }}>total</span>
                  </div>
                  <div className="ml-auto w-[28px] h-[28px] rounded-[9px] flex items-center justify-center transition-colors"
                       style={{ background: cat.fill, color: cat.ac }}>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
                <div className="flex items-center gap-1 absolute top-3.5 right-3">
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                        style={{ background: p.is_active ? "#e9f7ef" : "#f1f2f7", color: p.is_active ? "#178a5a" : MUT }}>
                    {p.is_active ? "Active" : "Inactive"}
                  </span>
                  <ProgramActions
                    program={p}
                    usage={usageByGame?.get(p.id)}
                    iconClassName="text-[#9aa1b5] hover:text-[#5a6284]"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* HELP */}
      <div className="bg-white rounded-[20px] px-5 py-4 flex items-center gap-4 mt-6" style={{ border: `1px solid ${LINE}` }}>
        <div className="w-[38px] h-[38px] rounded-[12px] bg-[#fdf3e3] text-amber-500 flex items-center justify-center shrink-0">
          <HelpCircle className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[13px] font-semibold">Focus products &amp; rewards setup</div>
          <div className="text-[11.5px] mt-0.5" style={{ color: SEC }}>
            Flag the products that earn extra points, then configure programs and activities.
          </div>
        </div>
        <button onClick={() => navigate("/gamification-admin/focus-products")}
                className="ml-auto text-[12.5px] rounded-[10px] px-3.5 py-2 inline-flex items-center gap-1.5 hover:bg-[#f4f5f9] transition-colors"
                style={{ border: `1px solid ${LINE}`, color: SEC }}>
          Focus products <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      <ProgramForm open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
