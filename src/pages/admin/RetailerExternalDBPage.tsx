import React from 'react';
import { Layout } from '@/components/Layout';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { Button } from '@/components/ui/button';
import { MarketingContactsTab } from '@/components/admin/marketing/MarketingContactsTab';

const RetailerExternalDBPage: React.FC = () => {
  const { hasAdminAccess, loading } = useAdminAccess();
  const navigate = useNavigate();

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!hasAdminAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-subtle p-4">
        <div className="w-full space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 rounded-xl bg-gradient-hero border border-accent-gold/40 p-6">
            <div>
              <h1 className="text-3xl font-bold text-white">Leads Management</h1>
              <p className="text-white/70">View and Manage your Leads for business productivity and marketing</p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/admin/retailer-unsorted')}
              className="flex items-center gap-2 bg-transparent border-white/40 text-white hover:bg-white/15 hover:text-white"
            >
              View other retailers
            </Button>
          </div>

          <MarketingContactsTab />
        </div>
      </div>
    </Layout>
  );
};

export default RetailerExternalDBPage;
