import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight, Coins, ExternalLink, Gamepad2, Gift, Loader2, Settings, Sparkles, Star, Zap,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useActivities, useGamProfiles, useGamSettings, usePointsIssuedYtd, usePointsYtdBreakdown, usePrograms,
} from "./hooks";
import { categoryMeta } from "./constants";
import { TrophyMark } from "@/components/gamification/TrophyMark";

const INK = "#1c2440";
const MUT = "#9aa1b5";
const SEC = "#5a6284";
const LINE = "#e7e9f0";

type StatKey = "programs" | "activities" | "points" | "engine";

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" }) : "—";

const Pill = ({ tone, children }: { tone: "good" | "muted" | "warn"; children: React.ReactNode }) => {
  const cls =
    tone === "good" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : tone === "warn" ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-slate-50 text-slate-600 border-slate-200";
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${cls}`}>{children}</span>;
};

const FooterLink = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:underline"
  >
    {label} <ExternalLink className="h-3.5 w-3.5" />
  </button>
);

/**
 * Compact hero band. Same content as the original full-height hero — gradient,
 * glow orbs, pixel wordmark, trophy and the four stat tiles — laid out as a
 * horizontal band so it costs ~170px instead of ~300px, and sits above the tab
 * bar on every section of the module. Each stat tile opens a details dialog.
 */
export function GamificationHero({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const navigate = useNavigate();
  const { data: programs = [] } = usePrograms();
  const { data: allActivities = [] } = useActivities();
  const { data: settings } = useGamSettings();
  const { data: pointsYtd = 0 } = usePointsIssuedYtd();
  const [open, setOpen] = useState<StatKey | null>(null);

  const activeActivities = allActivities.filter((a: any) => a.is_enabled).length;

  const stats: { key: StatKey; icon: any; bg: string; value: string | number; label: string }[] = [
    { key: "programs", icon: Gamepad2, bg: "#3b82f6", value: programs.length, label: "Games" },
    { key: "activities", icon: Zap, bg: "#14b8a6", value: activeActivities, label: "Active activities" },
    { key: "points", icon: Coins, bg: "#f59e0b", value: pointsYtd.toLocaleString(), label: "Points issued YTD" },
    { key: "engine", icon: Gift, bg: "#10b981", value: settings?.engine_enabled ? "On" : "Off", label: "Rewards engine" },
  ];

  const go = (to: string) => { setOpen(null); navigate(to); };

  return (
    <div
      className="relative overflow-hidden rounded-[20px] px-5 sm:px-7 py-4 sm:py-5 bg-gradient-primary text-primary-foreground"
    >
      <div
        className="pointer-events-none absolute -top-[90px] -left-[60px] w-[240px] h-[240px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,.16) 0%, rgba(255,255,255,0) 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-[120px] right-[28%] w-[300px] h-[300px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(212,160,80,.35) 0%, rgba(212,160,80,0) 70%)" }}
      />
      <Sparkles className="pointer-events-none absolute h-3.5 w-3.5 text-white/40 animate-pulse" style={{ left: "46%", top: "14%" }} />
      <Star className="pointer-events-none absolute h-3 w-3 text-amber-300/70 animate-pulse" style={{ left: "58%", top: "70%" }} />
      <Coins className="pointer-events-none absolute h-3.5 w-3.5 text-amber-200/60 animate-pulse" style={{ left: "38%", top: "82%" }} />

      <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
        <div className="flex-1 min-w-0 w-full">
          <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/70">Rewards engine</div>

          <h1
            className="font-pixel text-[18px] sm:text-[22px] xl:text-[25px] leading-none mt-1.5 mb-0 text-white"
            style={{ textShadow: "2px 2px 0 rgba(0,0,0,.35)" }}
          >
            GAMIFICATION
          </h1>

          <p className="text-[11.5px] xl:text-[12.5px] mt-2 max-w-[560px] leading-snug text-white/75">
            Build reward programs, define activities that earn points, and automatically reward your field teams.
          </p>

          <div className="mt-3 -mx-1 px-1 flex gap-2 overflow-x-auto sm:overflow-visible sm:flex-wrap">
            {stats.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-haspopup="dialog"
                title={`View ${s.label.toLowerCase()} details`}
                onClick={() => setOpen(s.key)}
                className="group min-w-[136px] sm:min-w-0 shrink-0 flex items-center gap-2.5 rounded-[12px] px-3 py-2 bg-white/10 backdrop-blur-md text-left cursor-pointer transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                style={{ border: "1px solid rgba(255,255,255,.16)" }}
              >
                <div
                  className="w-[22px] h-[22px] rounded-[7px] flex items-center justify-center text-white shrink-0"
                  style={{ background: s.bg }}
                >
                  <s.icon className="h-[13px] w-[13px]" />
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-extrabold leading-none text-white">{s.value}</div>
                  <div className="text-[9px] mt-1 text-white/65 truncate">{s.label}</div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 ml-auto text-white/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <div className="shrink-0">
          <TrophyMark
            float
            alt="Rewards trophy illustration"
            className="w-[92px] sm:w-[112px] xl:w-[128px] h-auto"
          />
        </div>
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" style={{ color: INK }}>
          {open === "programs" && <ProgramsDetail programs={programs} activities={allActivities} go={go} />}
          {open === "activities" && <ActivitiesDetail programs={programs} activities={allActivities} go={go} />}
          {open === "points" && <PointsDetail programs={programs} go={go} />}
          {open === "engine" && (
            <EngineDetail
              settings={settings}
              onOpenSettings={onOpenSettings ? () => { setOpen(null); onOpenSettings(); } : undefined}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProgramsDetail({ programs, activities, go }: { programs: any[]; activities: any[]; go: (to: string) => void }) {
  const today = new Date(new Date().toDateString());
  const status = (p: any) => {
    if (p.is_active === false) return { tone: "muted" as const, label: "Inactive" };
    if (p.end_date && new Date(p.end_date) < today) return { tone: "warn" as const, label: "Ended" };
    return { tone: "good" as const, label: "Active" };
  };
  const active = programs.filter((p) => status(p).label === "Active").length;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-pixel text-sm text-primary">GAMES</DialogTitle>
      </DialogHeader>
      <p className="text-[12px] -mt-1" style={{ color: SEC }}>
        {programs.length} game{programs.length === 1 ? "" : "s"} · {active} active · {programs.length - active} inactive or ended
      </p>
      <div className="space-y-2">
        {programs.length === 0 && <p className="text-[12.5px]" style={{ color: MUT }}>No games yet.</p>}
        {programs.map((p) => {
          const cat = categoryMeta(p.category);
          const acts = activities.filter((a) => a.game_id === p.id);
          const on = acts.filter((a) => a.is_enabled).length;
          const st = status(p);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => go(`/gamification-admin/program/${p.id}`)}
              className="w-full flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors hover:bg-muted"
              style={{ border: `1px solid ${LINE}` }}
            >
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cat.dot}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold truncate">{p.name}</div>
                <div className="text-[11px] mt-0.5 truncate" style={{ color: MUT }}>
                  {cat.label} · {fmtDate(p.start_date)} – {fmtDate(p.end_date)} · {on}/{acts.length} activities on
                </div>
              </div>
              <Pill tone={st.tone}>{st.label}</Pill>
              <ChevronRight className="h-4 w-4 shrink-0" style={{ color: MUT }} />
            </button>
          );
        })}
      </div>
      <FooterLink label="Open Games" onClick={() => go("/gamification-admin/programs")} />
    </>
  );
}

function ActivitiesDetail({ programs, activities, go }: { programs: any[]; activities: any[]; go: (to: string) => void }) {
  const enabled = activities.filter((a) => a.is_enabled);
  const disabled = activities.length - enabled.length;
  const groups = programs
    .map((p) => ({ program: p, acts: enabled.filter((a) => a.game_id === p.id) }))
    .filter((g) => g.acts.length > 0);
  const orphans = enabled.filter((a) => !programs.some((p) => p.id === a.game_id));

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-pixel text-sm text-primary">ACTIVE ACTIVITIES</DialogTitle>
      </DialogHeader>
      <p className="text-[12px] -mt-1" style={{ color: SEC }}>
        {enabled.length} enabled across {groups.length} program{groups.length === 1 ? "" : "s"}
        {disabled > 0 && ` · ${disabled} disabled (not counted)`}
      </p>
      <div className="space-y-4">
        {enabled.length === 0 && <p className="text-[12.5px]" style={{ color: MUT }}>No enabled activities yet.</p>}
        {groups.map(({ program, acts }) => {
          const cat = categoryMeta(program.category);
          return (
            <div key={program.id}>
              <button
                type="button"
                onClick={() => go(`/gamification-admin/program/${program.id}`)}
                className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide hover:text-primary"
                style={{ color: SEC }}
              >
                <span className={`h-2 w-2 rounded-full ${cat.dot}`} /> {program.name}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <div className="mt-1.5 space-y-1.5">
                {acts.map((a) => <ActivityRow key={a.id} a={a} />)}
              </div>
            </div>
          );
        })}
        {orphans.length > 0 && (
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wide" style={{ color: SEC }}>Unassigned</div>
            <div className="mt-1.5 space-y-1.5">{orphans.map((a) => <ActivityRow key={a.id} a={a} />)}</div>
          </div>
        )}
      </div>
      <FooterLink label="Open Activities" onClick={() => go("/gamification-admin/activities")} />
    </>
  );
}

function ActivityRow({ a }: { a: any }) {
  const reward = a.is_tiered ? "Tiered" : `${Number(a.points ?? 0).toLocaleString()} pts`;
  const trigger = String(a.trigger_type ?? a.action_type ?? "").replace(/_/g, " ");
  return (
    <div className="flex items-center gap-3 rounded-[10px] px-3 py-2" style={{ border: `1px solid ${LINE}` }}>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold truncate">{a.action_name}</div>
        {trigger && <div className="text-[11px] capitalize truncate" style={{ color: MUT }}>{trigger}</div>}
      </div>
      <Pill tone="good">{reward}</Pill>
    </div>
  );
}

function PointsDetail({ programs, go }: { programs: any[]; go: (to: string) => void }) {
  const { data, isLoading } = usePointsYtdBreakdown();
  const { data: profiles = [] } = useGamProfiles();
  const year = new Date().getFullYear();
  const userName = (id: string | null) =>
    id ? (profiles.find((p: any) => p.id === id)?.full_name || "Unnamed") : "Unattributed";
  const programName = (id: string | null) =>
    id ? (programs.find((p) => p.id === id)?.name || "Deleted game") : "Unattributed";
  const maxMonth = Math.max(1, ...(data?.byMonth.map((m) => m.points) ?? [1]));

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-pixel text-sm text-primary">POINTS ISSUED {year}</DialogTitle>
      </DialogHeader>
      {isLoading || !data ? (
        <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <>
          <div className="flex items-baseline gap-3 -mt-1">
            <div className="text-[26px] font-extrabold leading-none">{data.total.toLocaleString()}</div>
            <div className="text-[12px]" style={{ color: SEC }}>
              points across {data.awards.toLocaleString()} award{data.awards === 1 ? "" : "s"} since 1 Jan
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: SEC }}>By month</div>
            <div className="space-y-1.5">
              {data.byMonth.map((m) => (
                <div key={m.key} className="flex items-center gap-2 text-[12px]">
                  <div className="w-8 shrink-0" style={{ color: MUT }}>{m.label}</div>
                  <div className="flex-1 h-[10px] rounded-full overflow-hidden" style={{ background: "#eef0f4" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(m.points / maxMonth) * 100}%`, background: "linear-gradient(90deg,hsl(var(--primary)),hsl(35 65% 55%))" }}
                    />
                  </div>
                  <div className="w-16 text-right font-semibold tabular-nums">{m.points.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: SEC }}>By game</div>
              <div className="space-y-1">
                {data.byProgram.length === 0 && <p className="text-[12px]" style={{ color: MUT }}>None yet.</p>}
                {data.byProgram.map((r) => (
                  <div key={r.gameId ?? "none"} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="truncate">{programName(r.gameId)}</span>
                    <span className="font-semibold tabular-nums shrink-0">{r.points.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: SEC }}>Top earners</div>
              <div className="space-y-1">
                {data.topUsers.length === 0 && <p className="text-[12px]" style={{ color: MUT }}>None yet.</p>}
                {data.topUsers.map((r, i) => (
                  <div key={r.userId ?? "none"} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="truncate"><span style={{ color: MUT }}>{i + 1}.</span> {userName(r.userId)}</span>
                    <span className="font-semibold tabular-nums shrink-0">{r.points.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      <FooterLink label="Open Points ledger" onClick={() => go("/gamification-admin/points")} />
    </>
  );
}

function EngineDetail({ settings, onOpenSettings }: { settings: any; onOpenSettings?: () => void }) {
  const on = !!settings?.engine_enabled;
  const rows: [string, React.ReactNode][] = [
    ["Rewards engine", <Pill tone={on ? "good" : "warn"}>{on ? "On" : "Off"}</Pill>],
    ["Points currency", settings?.currency_name || "Points"],
    ["Conversion", `1 point = ₹${settings?.point_conversion ?? 1}`],
    ["Default award mode", <span className="capitalize">{settings?.default_award_mode ?? "auto"}</span>],
    ["Approval fallback", <span className="capitalize">{String(settings?.approval_fallback ?? "—").replace(/_/g, " ")}</span>],
    ["Leaderboard", settings?.leaderboard_enabled ? "Enabled" : "Disabled"],
    ["Notifications", settings?.notifications_enabled ? "Enabled" : "Disabled"],
    ["Timezone", settings?.timezone || "—"],
  ];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-pixel text-sm text-primary">REWARDS ENGINE</DialogTitle>
      </DialogHeader>
      {!on && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[12.5px] text-amber-900 -mt-1">
          The engine is off — no points are issued for any activity until it is switched on in Global settings.
        </div>
      )}
      <div className="rounded-[12px] overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
        {rows.map(([k, v], i) => (
          <div
            key={k}
            className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]"
            style={{ borderTop: i ? `1px solid ${LINE}` : undefined }}
          >
            <span style={{ color: SEC }}>{k}</span>
            <span className="font-semibold text-right">{v}</span>
          </div>
        ))}
      </div>
      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-primary text-primary-foreground rounded-[12px] px-4 py-2.5 self-start transition-opacity hover:opacity-90"
        >
          <Settings className="h-4 w-4" /> Open Global settings
        </button>
      )}
    </>
  );
}
