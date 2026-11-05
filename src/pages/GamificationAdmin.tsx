import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { BarChart3, Loader2 } from "lucide-react";
import { GamificationHome } from "@/modules/gamification/GamificationHome";
import { GamificationOverview } from "@/modules/gamification/GamificationOverview";
import { ProgramDetail } from "@/modules/gamification/ProgramDetail";
import { FocusProducts } from "@/modules/gamification/FocusProducts";
import { GamificationHero } from "@/modules/gamification/GamificationHero";
import { GamificationTabs } from "@/modules/gamification/GamificationTabs";
import { RedemptionPolicy } from "@/modules/gamification/RedemptionPolicy";
import { SectionPlaceholder } from "@/modules/gamification/SectionPlaceholder";
import { ActivitiesList } from "@/modules/gamification/ActivitiesList";
import { PointsLedger } from "@/modules/gamification/PointsLedger";
import { RedemptionQueue } from "@/modules/gamification/RedemptionQueue";
import { ProgramViewMode } from "@/modules/gamification/constants";


const VIEW_KEY = "gam-games-view";
/** Remembered per browser only — a display preference, nothing to sync. Wrapped
 *  because private windows and blocked site data make localStorage throw. */
const readView = (): ProgramViewMode => {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === "list" || v === "grid2" ? v : "grid3";
  } catch {
    return "grid3";
  }
};

/**
 * Games = the old Overview / Programs / Activities tabs. Overview and Programs
 * rendered the identical component, and Activities was the same data as a flat
 * list, so all three are one page now.
 *
 * The view switcher lives here rather than inside either section: the programs
 * and their activities are two views of one thing, so a single control sets
 * both. Picking "list" puts the whole page in list form.
 */
function GamesSection() {
  const [view, setView] = useState<ProgramViewMode>(readView);

  const changeView = (v: ProgramViewMode) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* preference just won't stick */ }
  };

  return (
    <div className="space-y-3">
      <GamificationHome view={view} onViewChange={changeView} />
      <ActivitiesList view={view} />
    </div>
  );
}

export default function GamificationAdmin() {
  const navigate = useNavigate();
  const { hasAdminAccess, loading } = useAdminAccess();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!hasAdminAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <div className="w-full -mx-0 px-3 sm:px-5 xl:px-7 py-5 min-h-screen" style={{ background: "#eef0f4" }}>
        {/* No flex gap here on purpose — the sticky tab bar carries its own padding so
            content scrolls underneath it without showing through a transparent band. */}
        <div className="mx-auto w-full max-w-[1600px] flex flex-col">
          <div className="mb-3">
            <GamificationHero onOpenSettings={() => navigate("/gamification-admin/policy")} />
          </div>

          <GamificationTabs />

          <div className="min-w-0">
            <Routes>
              <Route index element={<GamificationOverview />} />
              <Route path="games" element={<GamesSection />} />
              {/* old links keep working */}
              <Route path="programs" element={<Navigate to="/gamification-admin/games" replace />} />
              <Route path="activities" element={<Navigate to="/gamification-admin/games" replace />} />
              <Route path="policy" element={<RedemptionPolicy />} />
              <Route path="program/:programId" element={<ProgramDetail />} />
              <Route path="focus-products" element={<FocusProducts />} />
              <Route path="points" element={<PointsLedger />} />
              <Route path="redemptions" element={<RedemptionQueue />} />
              {/* Both were empty placeholders and their tabs are gone. Keep the
                  paths as redirects so existing links and bookmarks still land
                  somewhere sensible rather than bouncing to Overview. */}
              <Route path="rewards" element={<Navigate to="/gamification-admin/focus-products" replace />} />
              <Route path="leaderboard" element={<Navigate to="/gamification-admin/points" replace />} />
              <Route
                path="reports"
                element={
                  <SectionPlaceholder
                    icon={BarChart3}
                    title="Reports"
                    description="Scheduled and ad-hoc reporting on points issued, redemption rates and game performance over time."
                  />
                }
              />
              <Route path="*" element={<Navigate to="/gamification-admin" replace />} />
            </Routes>
          </div>
        </div>
      </div>
    </Layout>
  );
}
