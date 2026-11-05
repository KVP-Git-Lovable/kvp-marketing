import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BadgeIndianRupee, Gamepad2, LayoutDashboard, Settings, Trophy,
} from "lucide-react";
import { useHasRedemptionQueue, useRedemptionQueue } from "./hooks";

const PAGE = "#eef0f4";
const LINE = "#e7e9f0";

type TabItem = { key: string; label: string; short: string; icon: any; to: string };

// Overview and Programs used to render the SAME component, which is why they
// were collapsed. Overview is back as a real dashboard — points and reward
// value by game and by person — while Games carries the programs AND the flat
// activity list that used to sit behind its own tab.
const TABS: TabItem[] = [
  { key: "overview",    label: "Overview",    short: "Home",    icon: LayoutDashboard, to: "/gamification-admin" },
  { key: "games",       label: "Games",       short: "Games",   icon: Gamepad2, to: "/gamification-admin/games" },
  // The points ledger IS the admin leaderboard — every award, who earned it and
  // what it was worth. Rewards and Leaderboard were empty placeholders beside it.
  { key: "points",      label: "Leaderboard", short: "Leaders", icon: Trophy,   to: "/gamification-admin/points" },
  // Only shown to someone who actually has requests to action — see below.
  { key: "redemptions", label: "Redemptions", short: "Redeem",  icon: BadgeIndianRupee, to: "/gamification-admin/redemptions" },
  { key: "policy",      label: "Policy & Configuration", short: "Policy", icon: Settings, to: "/gamification-admin/policy" },
];

/**
 * Routes stay the source of truth — the tab bar reads the active section from
 * the URL and navigates on change, so deep links and browser-back keep working.
 */
export function activeTabKey(pathname: string) {
  if (pathname.includes("/policy")) return "policy";
  if (pathname.includes("/redemptions")) return "redemptions";
  // /leaderboard and /rewards now redirect onto the points ledger; map them so
  // the tab still reads as selected while the redirect resolves.
  if (pathname.includes("/points") || pathname.includes("/leaderboard")) return "points";
  if (pathname.includes("/reports")) return "reports";
  // focus-products is reached from the Games section, so it belongs to Games.
  if (pathname.includes("/focus-products")) return "games";
  // /games, /programs, /program/:id and /activities all live under Games now.
  if (pathname.includes("/games") || pathname.includes("/program") || pathname.includes("/activities")) {
    return "games";
  }
  return "overview";
}

export function GamificationTabs() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = activeTabKey(pathname);

  // Redemptions is hidden from anyone with nobody reporting to them — the queue
  // would be permanently empty, because the rpc only returns requests this
  // caller may action. The route stays reachable either way; hiding the tab is
  // a courtesy, not the access control.
  const { data: hasQueue } = useHasRedemptionQueue();
  const { data: waiting = [] } = useRedemptionQueue(["pending"]);

  const tabs = TABS.filter((t) => t.key !== "redemptions" || hasQueue);

  return (
    <div className="sticky top-0 z-30 pt-1 pb-3" style={{ background: PAGE }}>
      <div className="flex items-center">
        <Tabs
          value={active}
          onValueChange={(v) => {
            const next = tabs.find((t) => t.key === v);
            if (next) navigate(next.to);
          }}
          className="flex-1 min-w-0"
        >
          <TabsList
            className={`grid w-full h-auto grid-cols-2 gap-1 p-1 rounded-[11px] text-[#6b7288] ${
              tabs.length > 4 ? "sm:grid-cols-5" : "sm:grid-cols-4"
            }`}
            style={{ background: "#e3e6ef" }}
          >
            {tabs.map((t) => (
              <TabsTrigger
                key={t.key}
                value={t.key}
                className="flex items-center justify-center gap-1.5 rounded-[8px] px-2 py-2 text-[12px] font-semibold data-[state=active]:bg-background data-[state=active]:text-primary"
              >
                <t.icon className="h-[13px] w-[13px] shrink-0" />
                <span className="hidden md:inline truncate">{t.label}</span>
                <span className="md:hidden truncate">{t.short}</span>
                {/* Requests used to sit at pending with nobody aware they
                    existed. The count is here so the queue is visible without
                    opening it. */}
                {t.key === "redemptions" && waiting.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-primary/15 text-primary px-1.5 text-[10px] font-bold tabular-nums">
                    {waiting.length}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}