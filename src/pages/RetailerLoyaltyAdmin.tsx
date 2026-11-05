import { Layout } from "@/components/Layout";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { Navigate } from "react-router-dom";
import { Loader2, Gift } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoyaltyParameterConfig } from "@/components/loyalty/LoyaltyParameterConfig";
import { GiftMasterManagement } from "@/components/loyalty/GiftMasterManagement";
import { LoyaltyPointsDashboard } from "@/components/loyalty/LoyaltyPointsDashboard";
import { GiftSubscriptionsManagement } from "@/components/loyalty/GiftSubscriptionsManagement";
import { GiftRedemptionsManagement } from "@/components/loyalty/GiftRedemptionsManagement";
import { LoyaltyAnalytics } from "@/components/loyalty/LoyaltyAnalytics";
import { LoyaltyOverviewDashboard } from "@/components/loyalty/LoyaltyOverviewDashboard";
import { LoyaltyTierManagement } from "@/components/loyalty/LoyaltyTierManagement";
import { ProgramsManagement } from "@/components/loyalty/ProgramsManagement";
import { ActionsManagement } from "@/components/loyalty/ActionsManagement";

export default function RetailerLoyaltyAdmin() {
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
      <div className="min-h-screen w-full overflow-x-hidden bg-muted/30 px-3 py-4 font-sans sm:px-5 sm:py-5 xl:px-7">
        <div className="w-full max-w-none space-y-4">
          <header className="flex items-center gap-3 border-b border-border/70 pb-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary/5 text-primary">
              <Gift className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">Retailer Loyalty Program</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Retailer performance, earning parameters, gifts, subscriptions, and redemptions
              </p>
            </div>
          </header>

          <Tabs defaultValue="overview" className="w-full space-y-4">
            <div className="w-full overflow-x-auto border-b border-border/70">
              <TabsList className="flex h-auto min-w-max justify-start rounded-none bg-transparent p-0 md:grid md:w-full md:min-w-0 md:grid-cols-9">
                {[
                  ["overview", "Overview"],
                  ["program", "Program & Tasks"],
                  ["parameters", "Parameters"],
                  ["badges", "Badges"],
                  ["gifts", "Gifts"],
                  ["points", "Points"],
                  ["subscriptions", "Subscriptions"],
                  ["redemptions", "Redemptions"],
                  ["analytics", "Analytics"],
                ].map(([value, label]) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="min-w-32 rounded-none border-b-2 border-transparent px-4 py-3 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none md:min-w-0 md:w-full"
                  >
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="overview" className="mt-0 w-full">
              <LoyaltyOverviewDashboard />
            </TabsContent>

            {/* The programme and the tasks that actually award points. Both
                components existed but were wired into no page, so the rules
                that pay out could not be edited anywhere in the admin panel. */}
            <TabsContent value="program" className="mt-0 w-full space-y-4">
              <ProgramsManagement />
              <ActionsManagement />
            </TabsContent>

            <TabsContent value="parameters" className="mt-0 w-full space-y-4">
              <LoyaltyParameterConfig />
            </TabsContent>

            <TabsContent value="badges" className="mt-0 w-full space-y-4">
              <LoyaltyTierManagement />
            </TabsContent>

            <TabsContent value="gifts" className="w-full space-y-4">
              <GiftMasterManagement />
            </TabsContent>

            <TabsContent value="points" className="w-full space-y-4">
              <LoyaltyPointsDashboard />
            </TabsContent>

            <TabsContent value="subscriptions" className="w-full space-y-4">
              <GiftSubscriptionsManagement />
            </TabsContent>

            <TabsContent value="redemptions" className="w-full space-y-4">
              <GiftRedemptionsManagement />
            </TabsContent>

            <TabsContent value="analytics" className="w-full space-y-4">
              <LoyaltyAnalytics />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
