import React from 'react';
import { Layout } from '@/components/Layout';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { RetailerUnsortedLookup } from '@/components/admin/RetailerUnsortedLookup';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const RetailerUnsortedPage: React.FC = () => {
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
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/retailer-external-db')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <AdminPageHeader
              title="Uncategorized Retailers"
              subtitle="Browse uncategorized retailer data by state, district and city"
            />
          </div>
          <RetailerUnsortedLookup />
        </div>
      </div>
    </Layout>
  );
};

export default RetailerUnsortedPage;
