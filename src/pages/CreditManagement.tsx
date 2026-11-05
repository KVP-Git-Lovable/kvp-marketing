import { Layout } from "@/components/Layout";
import { CreditManagementConfig } from "@/components/CreditManagementConfig";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default function CreditManagement() {
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
      <div className="container mx-auto p-6 max-w-5xl space-y-6">
        <AdminPageHeader 
          title="Credit Management Configuration"
          subtitle="Configure retailer credit scoring system and parameters"
        />
        <CreditManagementConfig />
      </div>
    </Layout>
  );
}