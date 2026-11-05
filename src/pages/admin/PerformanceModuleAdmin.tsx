import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModuleSelector } from "@/components/targets/ModuleSelector";
import { KPIConfigTable } from "@/components/targets/KPIConfigTable";
import { RoleTargetForm } from "@/components/targets/RoleTargetForm";
import { useActivePerformanceModule } from "@/hooks/useActivePerformanceModule";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PerformanceModuleAdmin() {
  const { hasAdminAccess, loading: authLoading } = useAdminAccess();
  const { activeModule, isLoading: configLoading } = useActivePerformanceModule();
  const navigate = useNavigate();

  if (authLoading || configLoading) {
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
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin-controls")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Performance Module Management</h1>
            <p className="text-muted-foreground">
              Configure performance tracking system for your organization
            </p>
          </div>
        </div>

        <Tabs defaultValue="module" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="module">Module Selection</TabsTrigger>
            <TabsTrigger value="kpis">KPI Configuration</TabsTrigger>
            <TabsTrigger value="targets">Role Targets</TabsTrigger>
          </TabsList>

          <TabsContent value="module" className="space-y-6">
            <ModuleSelector currentModule={activeModule} />
          </TabsContent>

          <TabsContent value="kpis" className="space-y-6">
            <KPIConfigTable />
          </TabsContent>

          <TabsContent value="targets" className="space-y-6">
            <RoleTargetForm />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
