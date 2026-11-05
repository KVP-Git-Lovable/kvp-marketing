import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useActivePerformanceModule } from "@/hooks/useActivePerformanceModule";
import { Loader2 } from "lucide-react";
import MyTargets from "./MyTargets";
import Leaderboard from "./Leaderboard";

const Performance = () => {
  const navigate = useNavigate();
  const { activeModule, isGamificationActive, isTargetActualActive, isLoading } = useActivePerformanceModule();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  // If disabled, redirect to dashboard
  if (activeModule === 'none') {
    navigate('/dashboard');
    return null;
  }

  // If gamification is active, show leaderboard/gamification view
  if (isGamificationActive) {
    return <Leaderboard />;
  }

  // If target_actual is active, show target vs actual view
  if (isTargetActualActive) {
    return <MyTargets />;
  }

  // Fallback - should not reach here
  return null;
};

export default Performance;
