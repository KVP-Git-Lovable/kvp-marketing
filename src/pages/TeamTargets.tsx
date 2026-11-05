import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useSubordinates } from "@/hooks/useSubordinates";
import { TeamTargetDashboard } from "@/components/admin/TeamTargetDashboard";
import { Loader2, Users } from "lucide-react";

export default function TeamTargets() {
  const { user } = useAuth();
  const { subordinateIds, isLoading } = useSubordinates();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7 sm:h-8 sm:w-8" />
            Team Performance
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitor your team's progress against targets
          </p>
        </div>

        <TeamTargetDashboard
          userScope="team"
          effectiveUserIds={subordinateIds}
          hasAdminAccess={false}
        />
      </div>
    </Layout>
  );
}
